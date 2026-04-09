const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...config.resolver.assetExts.filter((ext) => ext !== "svg"),
  "ttf",
  "otf",
  "woff",
  "woff2",
];

module.exports = config;
