import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: {
    "action-one": "./src/action-one/index.ts",
    "action-two": "./src/action-two/index.ts",
    "env-check": "./src/env-check/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "src"),
    filename: "[name]/index.js",
  },
  resolve: {
    extensions: [".ts", ".js"],
    extensionAlias: {
      ".js": [".js", ".ts"], // This helps with ESM imports
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  target: "node",
  mode: "production",
};
