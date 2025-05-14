/**
 * Service for environment hierarchy management and comparisons
 */

import * as core from "@actions/core";
import { DeploymentSummary, EnvironmentHierarchy, EnvironmentShaMap } from "./types";
import { GitHubService } from "./github-service";

export class EnvironmentService {
  private readonly githubService: GitHubService;

  constructor(githubService: GitHubService) {
    this.githubService = githubService;
  }

  /**
   * Generate environment hierarchy based on a list of environments
   * @param environments Array of environment names
   * @returns Hierarchy mapping where key is an environment and value is its parent/upstream
   */
  public generateEnvHierarchy(environments: string[]): EnvironmentHierarchy {
    const hierarchy: EnvironmentHierarchy = {};

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

  /**
   * Compare all environments according to the provided hierarchy
   * @param summaries Deployment summaries to update with comparison results
   * @param deploymentShas Map of environment names to their deployment SHAs
   * @param envHierarchy Environment hierarchy map
   */
  public async compareAllEnvironments(
    summaries: DeploymentSummary[],
    deploymentShas: EnvironmentShaMap,
    envHierarchy: EnvironmentHierarchy
  ): Promise<DeploymentSummary[]> {
    // Create a copy of the summaries to avoid modifying the input directly
    const updatedSummaries = [...summaries];

    // Compare each environment with its upstream
    for (const env of Object.keys(envHierarchy)) {
      const fromEnv = env;
      const toEnv = envHierarchy[env];

      if (deploymentShas[fromEnv] && deploymentShas[toEnv]) {
        const fromSha = deploymentShas[fromEnv];
        const toSha = deploymentShas[toEnv];

        core.info(`🔄 Comparing ${fromEnv}(${fromSha}) to ${toEnv}(${toSha})`);

        const comparison = await this.githubService.compareDeployments(fromEnv, toEnv, fromSha, toSha);

        // Find and update the summary for this environment
        const summary = updatedSummaries.find((s) => s.environment === fromEnv);
        if (summary) {
          summary.compareUrl = comparison.compareUrl;
          summary.changes = comparison.changes;
        }
      } else {
        core.warning(`Cannot compare ${fromEnv} to ${toEnv} - missing deployment SHA`);
      }
    }
    return updatedSummaries;
  }

  /**
   * Get deployment SHAs for all specified environments
   * @param environments Array of environment names
   * @returns Object containing environment SHAs map and summaries array
   */
  public async getDeploymentShas(environments: string[]): Promise<{
    deploymentShas: EnvironmentShaMap;
    summaries: DeploymentSummary[];
  }> {
    const deploymentShas: EnvironmentShaMap = {};
    const summaries: DeploymentSummary[] = [];

    // Get the last successful deployment SHA for each environment
    for (const env of environments) {
      console.info(`Checking deployment for environment: ${env}`);

      const deployment = await this.githubService.getLastSuccessfulDeployment(env);
      if (deployment) {
        deploymentShas[env] = deployment.sha;
        core.setOutput(`last_successful_deployment_sha_${env}`, deployment);

        summaries.push({
          environment: env,
          sha: deployment.sha,
          target_url: deployment.target_url,
          deployment_id: deployment.deployment_id,
        });

        core.info(`ℹ️ Found deployment SHA for ${env}: ${deployment.sha}`);
      } else {
        core.warning(`No successful deployment found for ${env}`);
      }
    }

    // If we have main branch SHA, add it
    if (!deploymentShas["main"]) {
      const mainSha = await this.githubService.getMainBranchSha();
      if (mainSha) {
        deploymentShas["main"] = mainSha;
      }
    }

    return { deploymentShas, summaries };
  }
}
