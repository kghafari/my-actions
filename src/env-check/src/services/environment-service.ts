import * as core from "@actions/core";
import {
  Deployment,
  EnvironmentHierarchy,
  EnvironmentShaMap as DeploymentShaMap,
  DeploymentSummary,
  compareCommitsResponse,
} from "../types";
import { GitHubService } from "./github-service";

export class EnvironmentService {
  private readonly githubService: GitHubService;

  constructor() {
    this.githubService = new GitHubService();
  }

  public async getDeploymentSummary(environments: string[]): Promise<DeploymentSummary> {
    return {
      environmentHierarchy: this.generateEnvHierarchy(environments),
      deploymentSummaries: await this.getDeployDetails(environments),
    };
  }

  /**
   * Generate environment hierarchy based on a list of environments
   * @param environments Array of environment names
   * @returns Hierarchy mapping where key is an environment and value is its parent/upstream
   */
  private generateEnvHierarchy(environments: string[]): EnvironmentHierarchy {
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

  private async getDeployDetails(environments: string[]): Promise<Deployment[]> {
    let deployments: Deployment[] = [];

    for (const env of environments) {
      console.info(`Checking deployment for environment: ${env}`);

      const deployment = await this.githubService.getLastSuccessfulDeployment(env);
      if (deployment) {
        deployments.push({
          environment: env,
          sha: deployment.sha,
          target_url: deployment.target_url,
          deployment_id: deployment.deployment_id,
          release: deployment.release,
          ref: deployment.ref,
          changes: deployment.changes,
        });

        core.info(`ℹ️ Found deployment SHA for ${env}: ${deployment.sha}`);
      } else {
        core.warning(`No successful deployment found for ${env}`);
      }
    }

    await this.compareAllEnvironments(
      deployments,
      await this.getEnvironmentShaMap(environments),
      this.generateEnvHierarchy(environments)
    );

    return deployments;
  }

  private async getEnvironmentShaMap(environments: string[]): Promise<DeploymentShaMap> {
    const deploymentShaMap: DeploymentShaMap = {};

    // Get the last successful deployment SHA for each environment
    for (const env of environments) {
      console.info(`Checking deployment for environment: ${env}`);

      const deployment = await this.githubService.getLastSuccessfulDeployment(env);
      if (deployment) {
        deploymentShaMap[env] = deployment.sha;
        core.setOutput(`last_successful_deployment_sha_${env}`, deployment);
      } else {
        core.warning(`No successful deployment found for ${env}`);
      }
    }

    // If we have main branch SHA, add it
    if (!deploymentShaMap["main"]) {
      const mainSha = await this.githubService.getMainBranchSha();
      if (mainSha) {
        deploymentShaMap["main"] = mainSha;
      }
    }

    return deploymentShaMap;
  }

  /**
   * Compare all environments according to the provided hierarchy
   * @param deployments Deployment summaries to update with comparison results
   * @param deploymentShas Map of environment names to their deployment SHAs
   * @param envHierarchy Environment hierarchy map
   */
  private async compareAllEnvironments(
    deployments: Deployment[],
    deploymentShas: DeploymentShaMap,
    envHierarchy: EnvironmentHierarchy
  ): Promise<void> {
    // Compare each environment with its upstream
    for (const env of Object.keys(envHierarchy)) {
      const fromEnv = env;
      const toEnv = envHierarchy[env];

      if (deploymentShas[fromEnv] && deploymentShas[toEnv]) {
        const comparison: compareCommitsResponse["data"] = await this.githubService.compareDeployments(
          deploymentShas[fromEnv],
          deploymentShas[toEnv],
          fromEnv,
          toEnv
        );

        // Find and update the summary for this environment
        const summary = deployments.find((s) => s.environment === fromEnv);
        if (summary && comparison) {
          summary.changes = comparison;
        }
      } else {
        core.warning(`Cannot compare ${fromEnv} to ${toEnv} - missing deployment SHA`);
      }
    }
  }
}
