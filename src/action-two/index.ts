import * as core from "@actions/core";
import { executeTask } from "./utils";

async function run() {
  try {
    const task = core.getInput("task");
    executeTask(task);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
