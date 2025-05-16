import * as core from "@actions/core";
import { EnvironmentService } from "./environment-service";
import { GitHubService } from "./github-service";
import { Deployment, DeploymentSummary, EnvironmentHierarchy } from "../types";

// Mock dependencies
jest.mock("@actions/core");
jest.mock("./github-service");

describe("EnvironmentService", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDeploymentSummary", () => {
    it("should generate hierarchy and deployment details", async () => {
      // Arrange
      const mockDeployments: Deployment[] = [
        {
          environment: "dev",
          sha: "abc123",
          target_url: "https://example.com/dev",
          deployment_id: 1,
        },
        {
          environment: "staging",
          sha: "def456",
          target_url: "https://example.com/staging",
          deployment_id: 2,
        },
      ];

      const expectedHierarchy: EnvironmentHierarchy = {
        dev: "main",
        staging: "dev",
      };

      // Mock GitHubService methods
      (GitHubService.prototype.getLastSuccessfulDeployment as jest.Mock).mockImplementation((env: string) => {
        if (env === "dev") {
          return Promise.resolve({
            sha: "abc123",
            target_url: "https://example.com/dev",
            environment: "dev",
            deployment_id: 1,
          });
        }
        if (env === "staging") {
          return Promise.resolve({
            sha: "def456",
            target_url: "https://example.com/staging",
            environment: "staging",
            deployment_id: 2,
          });
        }
        return Promise.resolve(undefined);
      });

      (GitHubService.prototype.getMainBranchSha as jest.Mock).mockResolvedValue("main123");

      (GitHubService.prototype.compareDeployments as jest.Mock).mockResolvedValue({
        compareUrl: "https://github.com/compare/abc123...def456",
        changes: {
          ahead: 5,
          behind: 0,
          commits: [],
        },
      });

      const environmentService = new EnvironmentService();

      // Act
      const result = await environmentService.getDeploymentSummary(["dev", "staging"]);

      // Assert
      expect(result.environmentHierarchy).toEqual(expectedHierarchy);
      expect(result.deploymentSummaries.length).toBe(2);
      expect(result.deploymentSummaries[0].environment).toBe("dev");
      expect(result.deploymentSummaries[1].environment).toBe("staging");
      expect(GitHubService.prototype.getLastSuccessfulDeployment).toHaveBeenCalledTimes(2);
    });

    it("should handle missing deployments", async () => {
      // Arrange
      // First deployment exists, second one doesn't
      (GitHubService.prototype.getLastSuccessfulDeployment as jest.Mock).mockImplementation((env: string) => {
        if (env === "dev") {
          return Promise.resolve({
            sha: "abc123",
            target_url: "https://example.com/dev",
            environment: "dev",
            deployment_id: 1,
          });
        }
        return Promise.resolve(undefined);
      });

      (GitHubService.prototype.getMainBranchSha as jest.Mock).mockResolvedValue("main123");

      const environmentService = new EnvironmentService();
      const warningSpy = jest.spyOn(core, "warning");

      // Act
      const result = await environmentService.getDeploymentSummary(["dev", "staging"]);

      // Assert
      expect(result.deploymentSummaries.length).toBe(1);
      expect(result.deploymentSummaries[0].environment).toBe("dev");
      expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining("No successful deployment found for staging"));
    });
  });
});
