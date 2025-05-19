import * as core from "@actions/core";
import { checker } from "./src/check-deployments";
import * as dotenv from "dotenv";

// Load environment variables from .env file
if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: "./.env" });
  core.warning("Running in development mode. Using .env file for configuration.");
}

async function run() {
  try {
    await checker();
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
