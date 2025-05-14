/**
 * Types and interfaces for the deployment checker
 */

import { Octokit } from "@octokit/core";
import { Api } from "@octokit/plugin-rest-endpoint-methods";

/**
 * Enhanced Octokit type that includes REST API methods
 */
export type EnhancedOctokit = Octokit & Api;

/**
 * Interface representing deployment details
 */
export interface DeploymentSummary {
  environment: string;
  sha: string;
  compareUrl?: string;
  changes?: {
    ahead: number;
    behind: number;
    commits: any[];
  };
}

/**
 * Interface representing comparison results between two environments
 */
export interface ComparisonResult {
  compareUrl: string;
  changes: {
    ahead: number;
    behind: number;
    commits: any[];
  };
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
