import * as core from "@actions/core";
import { greet } from "./utils";

async function run() {
  try {
    const name = core.getInput("name");
    greet(name);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
