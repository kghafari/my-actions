import * as core from "@actions/core";
import { EnvironmentService } from "./services/environment-service.js";
import { ReportService } from "./services/report-service.js";
import { GitHubConfig } from "./types.js";

class DeploymentChecker {
  constructor(
    private readonly config: GitHubConfig,
    private readonly environmentService: EnvironmentService,
    private readonly reportService: ReportService
  ) {}

  public async checkDeployments(): Promise<void> {
    const envArray = this.config.environments;

    const summary = await this.environmentService.getDeploymentSummary(envArray);

    // Generate the final summary
    await this.reportService.generateReport(summary);
  }
}

export async function checker(): Promise<void> {
  const config = getConfig();

  const environmentService = new EnvironmentService();
  const reportService = new ReportService(config);
  const deploymentChecker = new DeploymentChecker(config, environmentService, reportService);

  await deploymentChecker.checkDeployments();
}

export function getConfig(): GitHubConfig {
  const githubRepo = core.getInput("GITHUB_REPO");
  const [owner, repo] = githubRepo.split("/");
  const environments = core
    .getInput("environments_to_check")
    .split(",")
    .map((env) => env.trim());

  return {
    owner,
    repo,
    environments,
  };
}
