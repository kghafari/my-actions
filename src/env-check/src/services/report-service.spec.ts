import * as core from "@actions/core";
import { ReportService } from "./report-service";
import { Deployment, DeploymentSummary, GitHubConfig } from "../types";

// Mock core module
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  summary: {
    addHeading: jest.fn().mockReturnThis(),
    addTable: jest.fn().mockReturnThis(),
    addRaw: jest.fn().mockReturnThis(),
    addLink: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("ReportService", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateReport", () => {
    it("should generate a report with tables and details", async () => {
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
        deploymentSummaries: [
          {
            environment: "dev",
            sha: "abc123",
            target_url: "https://example.com/job/1",
            deployment_id: 1,
            compareUrl: "https://github.com/compare/main...dev",
            changes: {
              ahead: 3,
              behind: 0,
              commits: [
                {
                  sha: "commit1",
                  commit: { message: "Fix bug", author: { name: "User 1" } },
                  author: { login: "user1" },
                },
              ],
            },
          },
          {
            environment: "staging",
            sha: "def456",
            target_url: "https://example.com/job/2",
            deployment_id: 2,
            compareUrl: "https://github.com/compare/dev...staging",
            changes: {
              ahead: 2,
              behind: 1,
              commits: [
                {
                  sha: "commit2",
                  commit: { message: "Add feature", author: { name: "User 2" } },
                  author: { login: "user2" },
                },
              ],
            },
          },
        ],
      };

      const reportService = new ReportService(mockConfig);

      // Act
      await reportService.generateReport(mockSummary);

      // Assert
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining("Generating final summary"));
      expect(core.summary.addHeading).toHaveBeenCalledWith("Environments", 2);
      expect(core.summary.addTable).toHaveBeenCalledTimes(1);
      expect(core.summary.addRaw).toHaveBeenCalled();
      expect(core.summary.addLink).toHaveBeenCalled();
      expect(core.summary.write).toHaveBeenCalledTimes(1);
    });

    it("should handle pull request references in commit messages", async () => {
      // Arrange
      const mockConfig: GitHubConfig = {
        owner: "test-owner",
        repo: "test-repo",
        environments: ["dev"],
      };

      // Use PR reference formats in commit messages
      const mockSummary: DeploymentSummary = {
        environmentHierarchy: { dev: "main" },
        deploymentSummaries: [
          {
            environment: "dev",
            sha: "abc123",
            target_url: "https://example.com/job/1",
            deployment_id: 1,
            compareUrl: "https://github.com/compare/main...dev",
            changes: {
              ahead: 2,
              behind: 0,
              commits: [
                {
                  sha: "commit1",
                  commit: { message: "Merge pull request #123 from branch\nAdd feature", author: { name: "User 1" } },
                  author: { login: "user1" },
                },
                {
                  sha: "commit2",
                  commit: { message: "Fix typo (#456)", author: { name: "User 2" } },
                  author: { login: "user2" },
                },
              ],
            },
          },
        ],
      };

      const reportService = new ReportService(mockConfig);
      const addLinkSpy = jest.spyOn(core.summary, "addLink");

      // Act
      await reportService.generateReport(mockSummary);

      // Assert
      // Verify PR links were created
      expect(addLinkSpy).toHaveBeenCalledWith("#123", "https://github.com/test-owner/test-repo/pull/123");
      expect(addLinkSpy).toHaveBeenCalledWith("#456", "https://github.com/test-owner/test-repo/pull/456");
    });
  });
});
