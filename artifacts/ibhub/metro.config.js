const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Watch only the directories ibhub actually needs from the workspace:
// - node_modules: for shared dependency resolution
// - lib: for @workspace/* shared packages (e.g. api-client-react)
// Avoid watching the entire workspaceRoot — it includes .local/skills
// temp directories that may not exist and crash the Metro file watcher.
config.watchFolders = [
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "lib"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.assetExts = [
  ...config.resolver.assetExts.filter((ext) => ext !== "svg"),
  "ttf",
  "otf",
];

module.exports = config;
