import { Octokit } from "@octokit/core";
import { Api } from "@octokit/plugin-rest-endpoint-methods";

export type EnhancedOctokit = Octokit & Api;

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
  release_url?: string;
  ref: string;
  changes?: {
    ahead: number;
    behind: number;
    commits: any[];
  };
}

export interface ComparisonResult {
  compareUrl: string;
  changes: {
    ahead: number;
    behind: number;
    commits: any[];
  };
}

export interface DeployInfo {
  sha: string;
  target_url: string;
  environment: string;
  deployment_id: number;
  workflow_url?: string;
  release_url?: string;
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
