import * as core from "@actions/core";
import { checker } from "./src/check-deployments";

async function run() {
  try {
    await checker();
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
