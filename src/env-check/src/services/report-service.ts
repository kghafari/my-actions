import * as core from "@actions/core";
import { Deployment, DeploymentSummary, EnvironmentHierarchy, GitHubConfig } from "../types";
const path = require("path");

export class ReportService {
  constructor(private readonly config: GitHubConfig) {
    this.config = config;
  }

  public async generateReport(summary: DeploymentSummary): Promise<void> {
    core.info("📝 Generating final summary...");

    // Create report in reverse order, i.e prod, beta, test
    const summaryList = summary.deploymentSummaries.reverse();

    this.addSummaryTable(summaryList, summary.environmentHierarchy);
    this.addEnvironmentDetails(summaryList, summary.environmentHierarchy);

    if (process.env.NODE_ENV === "development") {
      const fs = await import("fs/promises");
      const html = core.summary.stringify();
      const filePath = path.resolve(__dirname, "./summary.html");
      await fs.writeFile(filePath, html, "utf-8");
    }

    // Write the summary
    await core.summary.write();
  }

  private addSummaryTable(summaryList: Deployment[], envHierarchy: EnvironmentHierarchy): void {
    core.summary.addHeading("Environments", 2).addTable([
      [
        { data: "Environment", header: true },
        { data: "Status", header: true },
        { data: "Details", header: true },
      ],
      ...summaryList.map((summary) => {
        const envName = summary.environment;
        const upstreamEnv = envHierarchy[envName];

        let status = "✅ Deployed from ";
        status += `<a href=${summary.target_url}>${summary.target_url?.split(`/runs/`)[1]}</a>`;

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

  private addEnvironmentDetails(summaryList: Deployment[], envHierarchy: EnvironmentHierarchy): void {
    for (const summary of summaryList) {
      const envName = summary.environment;
      const upstreamEnv = envHierarchy[envName];

      core.summary.addHeading(`${envName.toUpperCase()} SUMMARY`, 2);

      // Add the deployment SHA info
      core.summary
        .addRaw(`Last Deployed to ${envName}: `)
        .addLink(
          `${summary.sha.substring(0, 7)}`,
          `https://github.com/${this.config.owner}/${this.config.repo}/commit/${summary.sha}`
        )
        .addRaw(` from `)
        .addLink(`${summary.target_url?.split(`/runs/`)[1]}`, summary.target_url || "");
      if (summary.release_url?.includes("/releases/tag/")) {
        core.summary.addRaw(` on release `).addLink(`${summary.ref}`, summary.release_url || "");
      }
      core.summary.addRaw(`\n\n`);

      if (summary.compareUrl && upstreamEnv) {
        core.summary.addLink(`Compare to ${upstreamEnv}`, summary.compareUrl);
      }
      core.summary.addRaw(`\n`);

      // Add commit list if available
      if (summary.changes?.commits && summary.changes.commits.length > 0) {
        core.summary.addRaw(`#### Commits in ${upstreamEnv}`).addRaw(`\n`);
        this.addCommitList(summary);
      }
    }
  }

  private addCommitList(summary: Deployment): void {
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
        core.summary
          .addRaw(`- ${messageToDisplay} by @${author} in `)
          .addLink(`#${prNumber}`, `https://github.com/${this.config.owner}/${this.config.repo}/pull/${prNumber}`);
      } else {
        core.summary
          .addRaw(`- \`${commitMessage}\` by @${author} in `)
          .addLink(`${shortSha}`, `https://github.com/${this.config.owner}/${this.config.repo}/commit/${commit.sha}`);
      }
      core.summary.addRaw(`\n`);
      // markdownSummary = markdownSummary.addRaw(`from `).addLink(`${summary.deployment_id}`, `${commit.target_url}`);
    }
    core.summary.addBreak();
  }
}
