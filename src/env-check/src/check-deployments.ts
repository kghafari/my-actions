import * as core from "@actions/core";
import { EnvironmentService } from "./services/environment-service";
import { ReportService } from "./services/report-service";
import { GitHubConfig } from "./types";

export async function checker(): Promise<void> {
  const config = getConfig();

  const environmentService = new EnvironmentService();
  const reportService = new ReportService(config);
  const deploymentChecker = new DeploymentChecker(config, environmentService, reportService);

  await deploymentChecker.checkDeployments();
}

class DeploymentChecker {
  constructor(
    private readonly config: GitHubConfig,
    private readonly environmentService: EnvironmentService,
    private readonly reportService: ReportService
  ) {}

  public async checkDeployments(): Promise<void> {
    await this.reportService.generateReport(
      await this.environmentService.getDeploymentSummary(this.config.environments)
    );
  }
}

export function getConfig(): GitHubConfig {
  // if dev mode, get from .env
  // else get from action inputs
  if (process.env.NODE_ENV === "development") {
    return {
      owner: process.env.GITHUB_REPO_OWNER || "",
      repo: process.env.GITHUB_REPO_NAME || "",
      environments: process.env.ENVIRONMENTS_TO_CHECK
        ? process.env.ENVIRONMENTS_TO_CHECK.split(",").map((env) => env.trim())
        : [],
    };
  }

  const [owner, repo] = core.getInput("GITHUB_REPO").split("/");
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
