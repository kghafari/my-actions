/**
 * Service for GitHub API interactions
 */

import { Octokit } from "@octokit/core";
import * as core from "@actions/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { throttling } from "@octokit/plugin-throttling";
import { createActionAuth } from "@octokit/auth-action";
import { EnhancedOctokit, ComparisonResult, DeployInfo, GitHubConfig } from "../types";
import { getConfig } from "../check-deployments";

export class GitHubService {
  private readonly octokit: EnhancedOctokit;
  private readonly config: GitHubConfig;

  constructor() {
    this.config = getConfig();
    this.octokit = this.configureOctokit();
  }

  /**
   * Get SHA for the last successful deployment of an environment
   * @param env Environment name
   * @param limit Maximum number of deployments to check (default: 15)
   * @returns SHA string or undefined if no successful deployment was found
   */
  public async getLastSuccessfulDeployment(env: string, limit = 15): Promise<DeployInfo | undefined> {
    core.info(`🔍 Finding last successful deployment for ${env}...`);

    try {
      const deployments = (
        await this.octokit.rest.repos.listDeployments({
          owner: this.config.owner,
          repo: this.config.repo,
          environment: env,
          per_page: limit,
        })
      ).data.sort((a, b) => b.created_at.localeCompare(a.created_at));

      core.info(`  > Found ${deployments.length} deployments for ${env} environment`);

      for (const deployment of deployments) {
        const { data: statuses } = await this.octokit.rest.repos.listDeploymentStatuses({
          owner: this.config.owner,
          repo: this.config.repo,
          deployment_id: deployment.id,
          per_page: 5, // Most deployments don't have tons of statuses
        });

        core.info(`  > Found ${statuses.length} statuses for deployment ${deployment.id}`);

        const wasSuccessful = statuses.find((s) => s.state === "success");

        if (wasSuccessful) {
          core.info(`🏁 Found last successful ${deployment.environment} deployment: ${wasSuccessful.target_url}`);
          return {
            sha: deployment.sha,
            target_url: wasSuccessful.log_url
              ? wasSuccessful.log_url.split("/job/")[0]
              : wasSuccessful.target_url.split("/job/")[0],
            environment: deployment.environment,
            deployment_id: deployment.id,
            release_url: await this.getReleaseUrl(deployment.ref),
            ref: deployment.ref,
          };
        }
      }
      return undefined;
    } catch (err) {
      core.warning(`No successful ${env} deployments found 😵💫`);
      core.setFailed(String(err));
      return undefined;
    }
  }

  private async getReleaseUrl(ref: string): Promise<string> {
    // Only check for release URL if the ref is not the main branch
    if (ref !== "main") {
      try {
        const { data: release } = await this.octokit.rest.repos.getReleaseByTag({
          owner: this.config.owner,
          repo: this.config.repo,
          tag: ref,
        });

        core.info(`ℹ️ Found release URL for ${ref}: ${release.html_url}`);

        return release.html_url;
      } catch (err) {
        core.warning(`Unable to get release URL for ${ref}: ${err}`);
        return "";
      }
    }
    return "";
  }
  public async getMainBranchSha(): Promise<string | undefined> {
    try {
      const { data: mainBranch } = await this.octokit.rest.repos.getBranch({
        owner: this.config.owner,
        repo: this.config.repo,
        branch: "main",
      });

      core.info(`ℹ️ Using main branch SHA: ${mainBranch.commit.sha}`);
      return mainBranch.commit.sha;
    } catch (err) {
      core.warning(`Unable to get main branch SHA: ${err}`);
      return undefined;
    }
  }

  /**
   * @param fromSha Source SHA
   * @param toSha Target SHA
   * @returns ComparisonResult with commit changes and URL
   */
  public async compareDeployments(fromSha: string, toSha: string): Promise<ComparisonResult> {
    try {
      console.info(`🔍 Comparing deployments ${fromSha}...${toSha}`);
      const { data } = await this.octokit.rest.repos.compareCommits({
        owner: this.config.owner,
        repo: this.config.repo,
        base: fromSha,
        head: toSha,
      });

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
        compareUrl: ``,
        changes: {
          ahead: 0,
          behind: 0,
          commits: [],
        },
      };
    }
  }

  private configureOctokit(): EnhancedOctokit {
    const MyOctokit = Octokit.plugin(restEndpointMethods, throttling);
    const octokit = new MyOctokit({
      authStrategy: createActionAuth,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          core.warning(`Request quota exhausted for request ${options.method} ${options.url}`);
          if (options.request.retryCount === 0) {
            core.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
          return false;
        },
        onSecondaryRateLimit: (_retryAfter, options) => {
          core.warning(`Abuse detected for request ${options.method} ${options.url}`);
        },
      },
    });

    return octokit;
  }
}
