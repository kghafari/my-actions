/**
 * Service for generating reports and summaries
 */

import * as core from "@actions/core";
import { DeploymentSummary, EnvironmentHierarchy } from "./types";

/**
 * Service class for report generation
 */
export class ReportService {
  private readonly owner: string;
  private readonly repo: string;

  /**
   * Constructs a new ReportService
   * @param owner Repository owner
   * @param repo Repository name
   */
  constructor(owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Generate and write the final markdown summary
   * @param summaries Array of deployment summaries
   * @param envHierarchy Environment hierarchy mapping
   */
  public async generateFinalSummary(
    summaries: DeploymentSummary[],
    envHierarchy: EnvironmentHierarchy
  ): Promise<void> {
    core.info("📝 Generating final summary...");

    const summaryList = [...summaries].reverse();

    // Create a new summary instance
    let markdownSummary = core.summary.addHeading(
      "Deployment Environment Status"
    );

    // Add a table for the environment summaries
    markdownSummary = this.addSummaryTable(
      markdownSummary,
      summaryList,
      envHierarchy
    );

    // Add detailed sections for each environment in reverse order
    markdownSummary = this.addDetailedSections(
      markdownSummary,
      summaryList,
      envHierarchy
    );

    // Write the summary
    await markdownSummary.write();
  }

  /**
   * Add the summary table to the markdown
   * @param markdownSummary Current markdown summary
   * @param summaryList List of deployment summaries
   * @param envHierarchy Environment hierarchy mapping
   * @returns Updated markdown summary
   * @private
   */
  private addSummaryTable(
    markdownSummary: typeof core.summary,
    summaryList: DeploymentSummary[],
    envHierarchy: EnvironmentHierarchy
  ): typeof core.summary {
    return markdownSummary.addHeading("Environment Summaries", 2).addTable([
      [
        { data: "Environment", header: true },
        { data: "Status", header: true },
        { data: "Details", header: true },
      ],
      ...summaryList.map((summary) => {
        const envName = summary.environment;
        const upstreamEnv = envHierarchy[envName];

        let status = "✅ Deployed";
        let details = `SHA: [${summary.sha.substring(
          0,
          7
        )}](https://github.com/${this.owner}/${this.repo}/commit/${
          summary.sha
        })`;

        if (summary.changes) {
          if (summary.changes.ahead > 0) {
            details += ` | ${upstreamEnv} is ${summary.changes.ahead} commits ahead`;
          }

          if (summary.changes.behind > 0) {
            details += ` | ${upstreamEnv} is ${summary.changes.behind} commits behind`;
          }
        }

        return [envName, status, details];
      }),
    ]);
  }

  /**
   * Add detailed sections for each environment
   * @param markdownSummary Current markdown summary
   * @param summaryList List of deployment summaries
   * @param envHierarchy Environment hierarchy mapping
   * @returns Updated markdown summary
   * @private
   */
  private addDetailedSections(
    markdownSummary: typeof core.summary,
    summaryList: DeploymentSummary[],
    envHierarchy: EnvironmentHierarchy
  ): typeof core.summary {
    for (const summary of summaryList) {
      const envName = summary.environment;
      const upstreamEnv = envHierarchy[envName];

      markdownSummary = markdownSummary.addHeading(
        `${envName.toUpperCase()} SUMMARY`,
        2
      );

      // Add the deployment SHA info
      markdownSummary = markdownSummary
        .addRaw(`Last Deployed to ${envName}:`)
        .addLink(
          `${summary.sha.substring(0, 7)}`,
          `https://github.com/${this.owner}/${this.repo}/commit/${summary.sha}`
        )
        .addRaw(`\n`);

      if (summary.compareUrl && upstreamEnv) {
        markdownSummary = markdownSummary
          .addLink(`Compare to ${upstreamEnv}`, summary.compareUrl)
          .addRaw("\n\n");
      }

      // Add commit list if available
      if (summary.changes?.commits && summary.changes.commits.length > 0) {
        markdownSummary = this.addCommitList(markdownSummary, summary);
      }

      // Add comparison info if available
    }

    return markdownSummary;
  }

  /**
   * Add commit list to the markdown
   * @param markdownSummary Current markdown summary
   * @param summary Deployment summary containing commit information
   * @returns Updated markdown summary
   * @private
   */
  private addCommitList(
    markdownSummary: typeof core.summary,
    summary: DeploymentSummary
  ): typeof core.summary {
    markdownSummary = markdownSummary.addRaw(`#### Commits\n\n`);

    for (const commit of summary.changes!.commits) {
      const author =
        commit.author?.login || commit.commit?.author?.name || "Unknown author";
      const shortSha = commit.sha.substring(0, 7);
      const commitMessage = commit.commit?.message?.split("\n")[0] || "";

      // Check for PR number in the commit message with multiple patterns
      let prNumber: string | null = null;
      let messageToDisplay = commitMessage;

      // Pattern 1: Merge pull request #XX from...
      const mergePrMatch = commitMessage.match(/Merge pull request #(\d+)/);
      if (mergePrMatch) {
        prNumber = mergePrMatch[1];
        messageToDisplay = commitMessage.replace(
          `Merge pull request #${prNumber} from `,
          ""
        );
      }
      // Pattern 2: Message (#XX)
      else {
        const inlinePrMatch = commitMessage.match(/.*\(#(\d+)\)/);
        if (inlinePrMatch) {
          prNumber = inlinePrMatch[1];
          messageToDisplay = commitMessage.replace(`(#${prNumber})`, "").trim();
        }
      }

      if (prNumber) {
        markdownSummary = markdownSummary
          .addRaw(` ${author}: `)
          .addLink(
            `#${prNumber}`,
            `https://github.com/${this.owner}/${this.repo}/pull/${prNumber}`
          )
          .addRaw(`${messageToDisplay}`);
      } else {
        markdownSummary = markdownSummary
          .addRaw(`\-- ${author}: `)
          .addLink(
            shortSha,
            `https://github.com/${this.owner}/${this.repo}/commit/${commit.sha}`
          )
          .addRaw(`${commitMessage}`);
      }
    }

    return markdownSummary.addRaw(`\n\n`);
  }
}
