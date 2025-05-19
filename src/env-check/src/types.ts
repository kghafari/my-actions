import { Octokit } from "@octokit/core";
import { Api } from "@octokit/plugin-rest-endpoint-methods";
import { Endpoints } from "@octokit/types";

export type EnhancedOctokit = Octokit & Api;
export type getReleaseByTagResponse = Endpoints["GET /repos/{owner}/{repo}/releases/tags/{tag}"]["response"];
export type compareCommitsResponse = Endpoints["GET /repos/{owner}/{repo}/compare/{basehead}"]["response"];
export type deploymentStatusResponse =
  Endpoints["GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"]["response"];

export interface DeploymentSummary {
  environmentHierarchy: EnvironmentHierarchy;
  deploymentSummaries: Deployment[];
}

export interface Deployment {
  environment: string;
  sha: string;
  compareUrl?: string;
  target_url?: string;
  deployment_id?: number;
  ref: string;
  release?: getReleaseByTagResponse;
  changes?: compareCommitsResponse["data"];
}

export interface DeployInfo {
  sha: string;
  target_url: string;
  environment: string;
  deployment_id: number;
  workflow_url?: string;
  release: getReleaseByTagResponse | undefined;
  ref: string;
}

/**
 * Environment hierarchy mapping where each key is an environment
 * and the value is its parent/upstream environment
 */
export type EnvironmentHierarchy = Record<string, string>;

/**
 * Mapping of environment names to their deployment SHAs
 */
export type EnvironmentShaMap = Record<string, string>;

export interface GitHubConfig {
  owner: string;
  repo: string;
  environments: string[];
}
