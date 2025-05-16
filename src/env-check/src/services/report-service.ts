import * as core from "@actions/core";
import { Deployment, DeploymentSummary, EnvironmentHierarchy, GitHubConfig } from "../types";

export class ReportService {
  constructor(private readonly config: GitHubConfig) {
    this.config = config;
  }

  public async generateReport(summary: DeploymentSummary): Promise<void> {
    core.info("📝 Generating final summary...");

    // Create report in reverse order, i.e prod, beta, test
    const summaryList = summary.deploymentSummaries.reverse();

    // Add a table for the environment summaries
    let markdownSummary = this.addSummaryTable(core.summary, summaryList, summary.environmentHierarchy);

    // Add detailed sections for each environment
    markdownSummary = this.addEnvironmentSummaries(markdownSummary, summaryList, summary.environmentHierarchy);

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
    summaryList: Deployment[],
    envHierarchy: EnvironmentHierarchy
  ): typeof core.summary {
    return markdownSummary.addHeading("Environments", 2).addTable([
      [
        { data: "Environment", header: true },
        { data: "Status", header: true },
        { data: "Details", header: true },
      ],
      ...summaryList.map((summary) => {
        const envName = summary.environment;
        const upstreamEnv = envHierarchy[envName];

        let status = "✅ Deployed from ";
        status += `<a href=${summary.target_url}>(job id here)</a>`;

        let details = `SHA: `;
        details += `<a href=https://github.com/${this.config.owner}/${this.config.repo}/commit/${
          summary.sha
        }>${summary.sha.substring(0, 7)}</a>`;

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
  private addEnvironmentSummaries(
    markdownSummary: typeof core.summary,
    summaryList: Deployment[],
    envHierarchy: EnvironmentHierarchy
  ): typeof core.summary {
    for (const summary of summaryList) {
      const envName = summary.environment;
      const upstreamEnv = envHierarchy[envName];

      markdownSummary = markdownSummary.addHeading(`${envName.toUpperCase()} SUMMARY`, 2);

      // Add the deployment SHA info
      markdownSummary = markdownSummary
        .addRaw(`Last Deployed to ${envName}: `)
        .addLink(
          `${summary.sha.substring(0, 7)}`,
          `https://github.com/${this.config.owner}/${this.config.repo}/commit/${summary.sha}`
        )
        .addRaw(` from `)
        // TODO: get correct workflow run URL
        .addLink(`job`, summary.target_url || "")
        .addRaw(` via `)
        .addLink(`deployment`, summary.release_url || "")
        .addRaw(`\n`);

      if (summary.compareUrl && upstreamEnv) {
        markdownSummary = markdownSummary.addLink(`Compare to ${upstreamEnv}`, summary.compareUrl).addRaw("\n\n");
      }

      // Add commit list if available
      if (summary.changes?.commits && summary.changes.commits.length > 0) {
        markdownSummary = markdownSummary.addRaw(`#### Commits in ${upstreamEnv}\n\n`);
        markdownSummary = this.addCommitList(markdownSummary, summary);
      }
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
  private addCommitList(markdownSummary: typeof core.summary, summary: Deployment): typeof core.summary {
    for (const commit of summary.changes!.commits) {
      const author = commit.author?.login || commit.commit?.author?.name || "Unknown author";
      const shortSha = commit.sha.substring(0, 7);
      const commitMessage = commit.commit?.message?.split("\n")[0] || "";

      // Check for PR number in the commit message with multiple patterns
      let prNumber: string | null = null;
      let messageToDisplay = commitMessage;

      // Pattern 1: Merge pull request #XX from...
      const mergePrMatch = commitMessage.match(/Merge pull request #(\d+)/);
      if (mergePrMatch) {
        prNumber = mergePrMatch[1];
        messageToDisplay = commitMessage.replace(`Merge pull request #${prNumber} from `, "");
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
          .addRaw(`- ${messageToDisplay} by @${author} in `)
          .addLink(`#${prNumber}`, `https://github.com/${this.config.owner}/${this.config.repo}/pull/${prNumber}`);
      } else {
        markdownSummary = markdownSummary
          .addRaw(`- ${commitMessage} by @${author} in `)
          .addLink(shortSha, `https://github.com/${this.config.owner}/${this.config.repo}/commit/${commit.sha}`);
      }
    }
    markdownSummary = markdownSummary.addRaw(`from `).addLink(`${summary.deployment_id}`, `${summary.target_url}`);

    return markdownSummary.addRaw(`\n\n`);
  }
}
