import { Octokit } from "@octokit/core";
import * as core from "@actions/core";

import {
  Api,
  restEndpointMethods,
} from "@octokit/plugin-rest-endpoint-methods";
import { WebhookEvent, DeploymentStatusEvent } from "@octokit/webhooks-types";
import { throttling } from "@octokit/plugin-throttling";
import { createActionAuth } from "@octokit/auth-action";

const octokit = configureOctokit();

const GITHUB_REPO = core.getInput("GITHUB_REPO");
const [OWNER, REPO] = GITHUB_REPO.split("/");

// Function to generate environment hierarchy based on comma-separated environments
function generateEnvHierarchy(environments: string[]): Record<string, string> {
  const hierarchy: Record<string, string> = {};

  // For the first environment, the upstream is 'main'
  if (environments.length > 0) {
    hierarchy[environments[0]] = "main";
  }

  // For subsequent environments, the upstream is the previous environment
  for (let i = 1; i < environments.length; i++) {
    hierarchy[environments[i]] = environments[i - 1];
  }

  return hierarchy;
}

interface DeploymentSummary {
  environment: string;
  sha: string;
  compareUrl?: string;
  changes?: {
    ahead: number;
    behind: number;
    commits: any[];
  };
}

export function executeTask(task: string) {
  console.info(`Executing task: ${task}. This is Action Two!`);
}

export async function checkDeployments(environments: string) {
  logInputs();
  // split the environments string into an array
  const envArray = environments.split(",");

  // Generate the environment hierarchy based on the input environments
  const envHierarchy = generateEnvHierarchy(envArray);

  const deploymentShas: Record<string, string> = {};
  const summaries: DeploymentSummary[] = [];

  // Get the last successful deployment SHA for each environment
  for (const env of envArray) {
    console.info(`Checking deployment for environment: ${env}`);

    const sha = await getLastSuccessfulDeploymentSha(env);
    if (sha) {
      deploymentShas[env] = sha;
      core.setOutput(`last_successful_deployment_sha_${env}`, sha);

      summaries.push({
        environment: env,
        sha: sha,
      });

      core.info(`ℹ️ Found deployment SHA for ${env}: ${sha}`);
    } else {
      core.warning(`No successful deployment found for ${env}`);
    }
  }

  // If we have main branch SHA, add it
  if (!deploymentShas["main"]) {
    try {
      const { data: mainBranch } = await octokit.rest.repos.getBranch({
        owner: OWNER,
        repo: REPO,
        branch: "main",
      });

      deploymentShas["main"] = mainBranch.commit.sha;
      core.info(`ℹ️ Using main branch SHA: ${deploymentShas["main"]}`);
    } catch (err) {
      core.warning(`Unable to get main branch SHA: ${err}`);
    }
  }

  // Now compare environments according to the hierarchy
  await compareAllEnvironments(summaries, deploymentShas, envHierarchy);

  // Generate the final summary
  await generateFinalSummary(summaries, envHierarchy);
}

async function compareAllEnvironments(
  summaries: DeploymentSummary[],
  deploymentShas: Record<string, string>,
  envHierarchy: Record<string, string>
) {
  // Compare each environment with its upstream
  for (const env of Object.keys(envHierarchy)) {
    const fromEnv = env;
    const toEnv = envHierarchy[env];

    if (deploymentShas[fromEnv] && deploymentShas[toEnv]) {
      const fromSha = deploymentShas[fromEnv];
      const toSha = deploymentShas[toEnv];

      core.info(`🔄 Comparing ${fromEnv}(${fromSha}) to ${toEnv}(${toSha})`);

      const comparison = await compareDeployments(
        fromEnv,
        toEnv,
        fromSha,
        toSha
      );

      // Find and update the summary for this environment
      const summary = summaries.find((s) => s.environment === fromEnv);
      if (summary) {
        summary.compareUrl = comparison.compareUrl;
        summary.changes = comparison.changes;
      }
    } else {
      core.warning(
        `Cannot compare ${fromEnv} to ${toEnv} - missing deployment SHA`
      );
    }
  }
}

async function compareDeployments(
  fromEnv: string,
  toEnv: string,
  fromSha: string,
  toSha: string
): Promise<{
  compareUrl: string;
  changes: { ahead: number; behind: number; commits: any[] };
}> {
  try {
    const { data } = await octokit.rest.repos.compareCommits({
      owner: OWNER,
      repo: REPO,
      base: fromSha,
      head: toSha,
    });

    core.info(
      `📊 ${toEnv} is ${data.ahead_by} commits ahead and ${data.behind_by} commits behind ${fromEnv}`
    );

    return {
      compareUrl: data.html_url,
      changes: {
        ahead: data.ahead_by,
        behind: data.behind_by,
        commits: data.commits,
      },
    };
  } catch (err) {
    core.warning(`Error comparing deployments: ${err}`);
    return {
      compareUrl: `https://github.com/${OWNER}/${REPO}/compare/${fromSha}...${toSha}`,
      changes: {
        ahead: 0,
        behind: 0,
        commits: [],
      },
    };
  }
}

async function generateFinalSummary(
  summaries: DeploymentSummary[],
  envHierarchy: Record<string, string>
) {
  core.info("📝 Generating final summary...");

  // Create a new summary instance
  let markdownSummary = core.summary.addHeading(
    "Deployment Environment Status"
  );

  // Add a table for the environment summaries
  markdownSummary = markdownSummary
    .addHeading("Environment Summaries", 2)
    .addTable([
      [
        { data: "Environment", header: true },
        { data: "Status", header: true },
        { data: "Details", header: true },
      ],
      ...summaries.map((summary) => {
        const envName = summary.environment;
        const upstreamEnv = envHierarchy[envName];

        let status = "✅ Deployed";
        let details = `SHA: ${summary.sha.substring(0, 7)}`;

        if (summary.changes) {
          if (summary.changes.ahead > 0) {
            details += ` | ${upstreamEnv} is ${summary.changes.ahead} commits ahead`;
          }

          if (summary.changes.behind > 0) {
            details += ` | ${upstreamEnv} is ${summary.changes.behind} commits behind`;
          }
        }

        return [envName, status, details];
      }),
    ]);
  // Add detailed sections for each environment in reverse order
  for (const summary of [...summaries].reverse()) {
    const envName = summary.environment;
    const upstreamEnv = envHierarchy[envName];

    markdownSummary = markdownSummary.addHeading(
      `${envName.toUpperCase()} SUMMARY`,
      2
    );

    // Add the deployment SHA info
    markdownSummary = markdownSummary
      .addLink(
        `Last successful deployment`,
        `https://github.com/${OWNER}/${REPO}/commit/${summary.sha}`
      )
      .addRaw(`\n\nDeployment SHA: \`${summary.sha}\`\n\n`);

    // Add commit list if available
    if (summary.changes?.commits && summary.changes.commits.length > 0) {
      markdownSummary = markdownSummary.addRaw(`#### Commits\n\n`);

      // Add each commit with author and PR details if available
      for (const commit of summary.changes.commits) {
        const author =
          commit.author?.login ||
          commit.commit?.author?.name ||
          "Unknown author";
        const shortSha = commit.sha.substring(0, 7);
        const commitMessage = commit.commit?.message?.split("\n")[0] || "";

        // Check for PR number in the commit message (common PR merge pattern)
        const prMatch = commitMessage.match(/Merge pull request #(\d+)/);

        if (prMatch) {
          const prNumber = prMatch[1];
          markdownSummary = markdownSummary
            .addRaw(`- ${author}: `)
            .addLink(
              `#${prNumber} ${commitMessage.replace(
                `Merge pull request #${prNumber} from `,
                ""
              )}`,
              `https://github.com/${OWNER}/${REPO}/pull/${prNumber}`
            )
            .addRaw(`\n`);
        } else {
          markdownSummary = markdownSummary
            .addRaw(`- ${author}: `)
            .addLink(
              shortSha,
              `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`
            )
            .addRaw(` ${commitMessage}\n`);
        }
      }

      markdownSummary = markdownSummary.addRaw(`\n`);
    }

    // Add comparison info if available
    if (summary.compareUrl && upstreamEnv) {
      markdownSummary = markdownSummary
        .addLink(`Compare with ${upstreamEnv}`, summary.compareUrl)
        .addRaw("\n\n");
    }
  }

  // Write the summary
  await markdownSummary.write();
}

async function getLastSuccessfulDeploymentSha(
  env: string,
  limit = 15
): Promise<string | undefined> {
  core.info(`🔍 Finding last successful deployment for ${env}...`);

  try {
    const deployments = (
      await octokit.rest.repos.listDeployments({
        owner: OWNER,
        repo: REPO,
        environment: env,
        per_page: limit,
      })
    ).data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    core.info(
      `  > Found ${deployments.length} deployments for ${env} environment`
    );
    for (const deployment of deployments) {
      const { data: statuses } =
        await octokit.rest.repos.listDeploymentStatuses({
          owner: OWNER,
          repo: REPO,
          deployment_id: deployment.id,
          per_page: 5, // Most deployments don't have tons of statuses
        });

      core.info(
        `  > Found ${statuses.length} statuses for deployment ${deployment.id}`
      );
      const wasSuccessful = statuses.find((s) => s.state === "success");

      if (wasSuccessful) {
        core.info(
          `🏁 Found last successful ${deployment.environment} deployment: ${wasSuccessful.target_url}`
        );
        return deployment.sha;
      }
    }
    return undefined;
  } catch (err) {
    core.warning(`No successful ${env} deployments found 😵💫`);
    core.setFailed(String(err));
    return undefined;
  }
}

function logInputs() {
  core.info("Logging inputs...");
  core.info(`GITHUB_REPO: ${GITHUB_REPO}`);
  core.info(`OWNER: ${OWNER}`);
  core.info(`REPO: ${REPO}`);
  core.info(`GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`);
  core.info(`GITHUB_REF: ${process.env.GITHUB_REF}`);
  core.info(`GITHUB_SHA: ${process.env.GITHUB_SHA}`);
  core.info(`GITHUB_EVENT_NAME: ${process.env.GITHUB_EVENT_NAME}`);
}

function configureOctokit(): Octokit & Api {
  const MyOctokit = Octokit.plugin(restEndpointMethods, throttling);
  const octokit = new MyOctokit({
    authStrategy: createActionAuth,
    throttle: {
      onRateLimit: (retryAfter, options) => {
        core.warning(
          `Request quota exhausted for request ${options.method} ${options.url}`
        );
        if (options.request.retryCount === 0) {
          core.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (_retryAfter, options) => {
        core.warning(
          `Abuse detected for request ${options.method} ${options.url}`
        );
      },
    },
  });

  return octokit;
}
