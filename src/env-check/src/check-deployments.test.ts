import * as core from "@actions/core";
import { DeploymentChecker, checker, getConfig } from "./check-deployments";
import { EnvironmentService } from "./services/environment-service";
import { ReportService } from "./services/report-service";
import { DeploymentSummary, GitHubConfig } from "./types";

// Mock dependencies
jest.mock("@actions/core");
jest.mock("./services/environment-service");
jest.mock("./services/report-service");

describe("check-deployments", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DeploymentChecker", () => {
    it("should check deployments and generate report", async () => {
      // Arrange
      const mockConfig: GitHubConfig = {
        owner: "test-owner",
        repo: "test-repo",
        environments: ["dev", "staging", "prod"],
      };

      const mockSummary: DeploymentSummary = {
        environmentHierarchy: {
          dev: "main",
          staging: "dev",
          prod: "staging",
        },
        deploymentSummaries: [],
      };

      const mockEnvironmentService = {
        getDeploymentSummary: jest.fn().mockResolvedValue(mockSummary),
      } as unknown as EnvironmentService;

      const mockReportService = {
        generateReport: jest.fn().mockResolvedValue(undefined),
      } as unknown as ReportService;

      const deploymentChecker = new DeploymentChecker(mockConfig, mockEnvironmentService, mockReportService);

      // Act
      await deploymentChecker.checkDeployments();

      // Assert
      expect(mockEnvironmentService.getDeploymentSummary).toHaveBeenCalledWith(mockConfig.environments);
      expect(mockReportService.generateReport).toHaveBeenCalledWith(mockSummary);
    });
  });

  describe("getConfig", () => {
    it("should parse inputs correctly", () => {
      // Arrange
      (core.getInput as jest.Mock).mockImplementation((name) => {
        if (name === "GITHUB_REPO") return "test-owner/test-repo";
        if (name === "environments_to_check") return "dev, staging, prod";
        return "";
      });

      // Act
      const config = getConfig();

      // Assert
      expect(config).toEqual({
        owner: "test-owner",
        repo: "test-repo",
        environments: ["dev", "staging", "prod"],
      });
      expect(core.getInput).toHaveBeenCalledWith("GITHUB_REPO");
      expect(core.getInput).toHaveBeenCalledWith("environments_to_check");
    });

    it("should handle single environment", () => {
      // Arrange
      (core.getInput as jest.Mock).mockImplementation((name) => {
        if (name === "GITHUB_REPO") return "test-owner/test-repo";
        if (name === "environments_to_check") return "prod";
        return "";
      });

      // Act
      const config = getConfig();

      // Assert
      expect(config.environments).toEqual(["prod"]);
    });
  });

  describe("checker", () => {
    it("should initialize services and call checkDeployments", async () => {
      // Arrange
      const mockConfig: GitHubConfig = {
        owner: "test-owner",
        repo: "test-repo",
        environments: ["dev", "staging"],
      };

      // Mock the getConfig function
      jest.spyOn(require("./check-deployments"), "getConfig").mockReturnValue(mockConfig);

      const mockDeploymentSummary: DeploymentSummary = {
        environmentHierarchy: { dev: "main", staging: "dev" },
        deploymentSummaries: [],
      };

      // Setup mock implementations
      (EnvironmentService.prototype.getDeploymentSummary as jest.Mock).mockResolvedValue(mockDeploymentSummary);

      (ReportService.prototype.generateReport as jest.Mock).mockResolvedValue(undefined);

      // Act
      await checker();

      // Assert
      expect(EnvironmentService.prototype.getDeploymentSummary).toHaveBeenCalledWith(mockConfig.environments);

      expect(ReportService.prototype.generateReport).toHaveBeenCalledWith(mockDeploymentSummary);
    });
  });
});
