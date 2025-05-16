import * as core from "@actions/core";
import { GitHubService } from "./github-service";
import { createActionAuth } from "@octokit/auth-action";
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { throttling } from "@octokit/plugin-throttling";

// Mock dependencies
jest.mock("@actions/core");
jest.mock("@octokit/core");
jest.mock("@octokit/auth-action");
jest.mock("@octokit/plugin-rest-endpoint-methods");
jest.mock("@octokit/plugin-throttling");
jest.mock("../check-deployments", () => ({
  getConfig: jest.fn().mockReturnValue({
    owner: "test-owner",
    repo: "test-repo",
    environments: ["dev", "staging"],
  }),
}));

describe("GitHubService", () => {
  let mockOctokit: any;

  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Octokit plugin and constructor
    (Octokit.plugin as jest.Mock).mockReturnValue(Octokit);

    // Create a mock Octokit instance with the needed methods
    mockOctokit = {
      rest: {
        repos: {
          listDeployments: jest.fn(),
          listDeploymentStatuses: jest.fn(),
          getBranch: jest.fn(),
          compareCommits: jest.fn(),
        },
      },
    };

    (Octokit as unknown as jest.Mock).mockImplementation(() => mockOctokit);
  });

  describe("getLastSuccessfulDeployment", () => {
    it("should return the last successful deployment", async () => {
      // Arrange
      const mockDeployments = [
        { id: 123, sha: "abc123", environment: "dev", created_at: "2023-01-02T00:00:00Z" },
        { id: 122, sha: "def456", environment: "dev", created_at: "2023-01-01T00:00:00Z" },
      ];

      const mockStatuses = [{ state: "success", target_url: "https://example.com/job/123" }];

      mockOctokit.rest.repos.listDeployments.mockResolvedValue({
        data: mockDeployments,
      });

      mockOctokit.rest.repos.listDeploymentStatuses.mockResolvedValue({
        data: mockStatuses,
      });

      const githubService = new GitHubService();

      // Act
      const result = await githubService.getLastSuccessfulDeployment("dev");

      // Assert
      expect(result).toEqual({
        sha: "abc123",
        target_url: "https://example.com/job/123",
        environment: "dev",
        deployment_id: 123,
      });

      expect(mockOctokit.rest.repos.listDeployments).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        environment: "dev",
        per_page: 15,
      });

      expect(mockOctokit.rest.repos.listDeploymentStatuses).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        deployment_id: 123,
        per_page: 5,
      });
    });

    it("should return undefined if no successful deployment is found", async () => {
      // Arrange
      mockOctokit.rest.repos.listDeployments.mockResolvedValue({
        data: [{ id: 123, sha: "abc123", environment: "dev", created_at: "2023-01-01T00:00:00Z" }],
      });

      mockOctokit.rest.repos.listDeploymentStatuses.mockResolvedValue({
        data: [{ state: "failure", target_url: "https://example.com/job/123" }],
      });

      const githubService = new GitHubService();

      // Act
      const result = await githubService.getLastSuccessfulDeployment("dev");

      // Assert
      expect(result).toBeUndefined();
    });

    it("should handle errors", async () => {
      // Arrange
      mockOctokit.rest.repos.listDeployments.mockRejectedValue(new Error("API error"));

      const githubService = new GitHubService();
      const setFailedSpy = jest.spyOn(core, "setFailed");

      // Act
      const result = await githubService.getLastSuccessfulDeployment("dev");

      // Assert
      expect(result).toBeUndefined();
      expect(setFailedSpy).toHaveBeenCalledWith("API error");
    });
  });

  describe("getMainBranchSha", () => {
    it("should return the main branch SHA", async () => {
      // Arrange
      mockOctokit.rest.repos.getBranch.mockResolvedValue({
        data: {
          commit: {
            sha: "main123",
          },
        },
      });

      const githubService = new GitHubService();

      // Act
      const result = await githubService.getMainBranchSha();

      // Assert
      expect(result).toBe("main123");
      expect(mockOctokit.rest.repos.getBranch).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
      });
    });

    it("should handle errors", async () => {
      // Arrange
      mockOctokit.rest.repos.getBranch.mockRejectedValue(new Error("Branch not found"));

      const githubService = new GitHubService();
      const warningSpy = jest.spyOn(core, "warning");

      // Act
      const result = await githubService.getMainBranchSha();

      // Assert
      expect(result).toBeUndefined();
      expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining("Unable to get main branch SHA"));
    });
  });

  describe("compareDeployments", () => {
    it("should return comparison results", async () => {
      // Arrange
      const mockComparisonData = {
        html_url: "https://github.com/compare/abc...def",
        ahead_by: 3,
        behind_by: 1,
        commits: [{ sha: "commit1", commit: { message: "Fix bug" }, author: { login: "user1" } }],
      };

      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: mockComparisonData,
      });

      const githubService = new GitHubService();

      // Act
      const result = await githubService.compareDeployments("dev", "staging");

      // Assert
      expect(result).toEqual({
        compareUrl: "https://github.com/compare/abc...def",
        changes: {
          ahead: 3,
          behind: 1,
          commits: [{ sha: "commit1", commit: { message: "Fix bug" }, author: { login: "user1" } }],
        },
      });
    });

    it("should handle errors", async () => {
      // Arrange
      mockOctokit.rest.repos.compareCommits.mockRejectedValue(new Error("Cannot compare"));

      const githubService = new GitHubService();
      const warningSpy = jest.spyOn(core, "warning");

      // Act
      const result = await githubService.compareDeployments("dev", "staging");

      // Assert
      expect(result).toEqual({
        compareUrl: "",
        changes: {
          ahead: 0,
          behind: 0,
          commits: [],
        },
      });
      expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining("Error comparing deployments"));
    });
  });
});
