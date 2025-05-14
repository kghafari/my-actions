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

export function executeTask(task: string) {
  console.info(`Executing task: ${task}. This is Action Two!`);
}

export async function checkDeployments(environments: string) {
  logInputs();
  // split the environments string into an array
  const envArray = environments.split(",");

  // Get the last successful deployment SHA for each environment
  for (const env of envArray) {
    console.info(`Checking deployment for environment: ${env}`);

    const sha = await getLastSuccessfulDeploymentSha(env);
    if (sha) {
      core.setOutput(`last_successful_deployment_sha_${env}`, sha);
      core.summary
        .addHeading(`Last successful deployment SHA for ${env}: ${sha}`)
        .addLink(
          `View deployment`,
          `https://github.com/${OWNER}/${REPO}/commit/${sha}`
        );
    } else {
      core.warning(`No successful deployment found for ${env}`);
      core.summary.addHeading(`Sad face :(`);
    }
  }
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
          `🏁Found last successful ${deployment.environment} deployment: ${wasSuccessful.target_url}`
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
