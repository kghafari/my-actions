const path = require("path");
const fs = require("fs");

// Dynamically find all action directories
const actionDirs = fs
  .readdirSync(path.resolve(__dirname, "src"))
  .filter((file) => fs.statSync(path.resolve(__dirname, "src", file)).isDirectory())
  .filter((dir) => fs.existsSync(path.resolve(__dirname, "src", dir, "index.ts")));

// Create entry points for each action
const entries = {};
actionDirs.forEach((dir) => {
  entries[dir] = `./src/${dir}/index.ts`;
});

module.exports = {
  entry: entries,
  output: {
    path: path.resolve(__dirname, "src"),
    filename: "[name]/index.js",
    sourceMapFilename: "[name]/index.js.map",
  },
  resolve: {
    extensions: [".ts", ".js", ".json"],
    modules: ["node_modules"],
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
  mode: process.env.NODE_ENV === "development" ? "development" : "production",
  devtool: process.env.NODE_ENV === "development" ? "source-map" : false,
  optimization: {
    minimize: false, // Don't minify to keep code readable
  },
  stats: {
    colors: true,
    warnings: true,
  },
};
