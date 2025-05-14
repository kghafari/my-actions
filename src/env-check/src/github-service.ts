/**
 * Service for GitHub API interactions
 */

import { Octokit } from "@octokit/core";
import * as core from "@actions/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { throttling } from "@octokit/plugin-throttling";
import { createActionAuth } from "@octokit/auth-action";
import { EnhancedOctokit, ComparisonResult, DeployInfo } from "./types";

export class GitHubService {
  private readonly octokit: EnhancedOctokit;
  private readonly owner: string;
  private readonly repo: string;

  /**
   * Constructs a new GitHubService
   * @param repository Repository in format "owner/repo"
   */
  constructor(repository: string) {
    this.octokit = this.configureOctokit();
    [this.owner, this.repo] = repository.split("/");
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
          owner: this.owner,
          repo: this.repo,
          environment: env,
          per_page: limit,
        })
      ).data.sort((a, b) => b.created_at.localeCompare(a.created_at));

      core.info(`  > Found ${deployments.length} deployments for ${env} environment`);

      for (const deployment of deployments) {
        const { data: statuses } = await this.octokit.rest.repos.listDeploymentStatuses({
          owner: this.owner,
          repo: this.repo,
          deployment_id: deployment.id,
          per_page: 5, // Most deployments don't have tons of statuses
        });

        core.info(`  > Found ${statuses.length} statuses for deployment ${deployment.id}`);

        const wasSuccessful = statuses.find((s) => s.state === "success");

        if (wasSuccessful) {
          core.info(`🏁 Found last successful ${deployment.environment} deployment: ${wasSuccessful.target_url}`);
          return {
            sha: deployment.sha,
            target_url: wasSuccessful.target_url,
            environment: deployment.environment,
            deployment_id: wasSuccessful.id,
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

  /**
   * Get the SHA of the main branch
   * @returns SHA of the main branch or undefined if not found
   */
  public async getMainBranchSha(): Promise<string | undefined> {
    try {
      const { data: mainBranch } = await this.octokit.rest.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
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
   * Compare deployments between two SHAs
   * @param fromEnv Source environment name for context
   * @param toEnv Target environment name for context
   * @param fromSha Source SHA
   * @param toSha Target SHA
   * @returns ComparisonResult with commit changes and URL
   */
  public async compareDeployments(
    fromEnv: string,
    toEnv: string,
    fromSha: string,
    toSha: string
  ): Promise<ComparisonResult> {
    try {
      const { data } = await this.octokit.rest.repos.compareCommits({
        owner: this.owner,
        repo: this.repo,
        base: fromSha,
        head: toSha,
      });

      core.info(`📊 ${toEnv} is ${data.ahead_by} commits ahead and ${data.behind_by} commits behind ${fromEnv}`);

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
        compareUrl: `https://github.com/${this.owner}/${this.repo}/compare/${fromSha}...${toSha}`,
        changes: {
          ahead: 0,
          behind: 0,
          commits: [],
        },
      };
    }
  }

  /**
   * Get repository details
   * @returns Repository details in the format "owner/repo"
   */
  public getRepoDetails(): { owner: string; repo: string } {
    return {
      owner: this.owner,
      repo: this.repo,
    };
  }

  /**
   * Configure Octokit instance with required plugins and authentication
   * @returns Configured Octokit instance
   * @private
   */
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
        },
        onSecondaryRateLimit: (_retryAfter, options) => {
          core.warning(`Abuse detected for request ${options.method} ${options.url}`);
        },
      },
    });

    return octokit;
  }
}
