import * as core from "@actions/core";
import { checkDeployments } from "./check-deployments";

async function run() {
  try {
    const environments = core.getInput("environments_to_check");
    await checkDeployments(environments);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
