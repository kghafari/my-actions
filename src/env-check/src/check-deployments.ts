/**
 * Main module for checking deployments across environments
 */

import * as core from "@actions/core";
import { GitHubService } from "./github-service";
import { EnvironmentService } from "./environment-service";
import { ReportService } from "./report-service";

/**
 * Main class for coordinating deployment checks
 */
export class DeploymentChecker {
  private readonly githubService: GitHubService;
  private readonly environmentService: EnvironmentService;
  private readonly reportService: ReportService;

  /**
   * Constructs a new DeploymentChecker instance
   * @param githubRepo GitHub repository in format "owner/repo"
   */
  constructor(githubRepo: string) {
    this.githubService = new GitHubService(githubRepo);
    this.environmentService = new EnvironmentService(this.githubService);

    const { owner, repo } = this.githubService.getRepoDetails();
    this.reportService = new ReportService(owner, repo);
  }

  /**
   * Run the deployment check process
   * @param environments Comma-separated string of environments to check
   */
  public async checkDeployments(environments: string): Promise<void> {
    const envArray = environments.split(",");

    // Generate the environment hierarchy based on the input environments
    const envHierarchy = this.environmentService.generateEnvHierarchy(envArray);

    // Get deployment SHAs and summaries
    const { deploymentShas, summaries } =
      await this.environmentService.getDeploymentShas(envArray);

    // Compare environments according to the hierarchy
    await this.environmentService.compareAllEnvironments(
      summaries,
      deploymentShas,
      envHierarchy
    );

    // Generate the final summary
    await this.reportService.generateFinalSummary(summaries, envHierarchy);
  }
}

/**
 * Function to check deployments across environments
 * @param environments Comma-separated string of environments to check
 */
export async function checkDeployments(environments: string): Promise<void> {
  const githubRepo = core.getInput("GITHUB_REPO");
  const deploymentChecker = new DeploymentChecker(githubRepo);
  await deploymentChecker.checkDeployments(environments);
}
