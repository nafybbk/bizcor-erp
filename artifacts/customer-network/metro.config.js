const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Windows: pnpm's virtual store is relocated to D:\ps (npm_config_virtual_store_dir)
// to stay under CMake's 250-char object path limit when building the Android APK.
// Metro can only resolve files inside watched folders, so include the store when present.
if (fs.existsSync("D:/ps")) {
  config.watchFolders = [...(config.watchFolders ?? []), "D:/ps"];
}

// Gradle's release build sets EXPO_NO_METRO_WORKSPACE_ROOT=1 to stop Expo's
// monorepo detection from moving Metro's server-relative resolution root up
// to the pnpm workspace root. Both react-native-gradle-plugin's JS-bundling
// task and expo-updates' own manifest-generation script pass/expect the
// entry file relative to THIS project folder, not the workspace root, and
// disagree with Expo's default monorepo behavior ("Unable to resolve module
// ./entry.js from <workspace root>", and a doubled-path variant inside
// expo-updates). Disabling workspace detection also empties the
// watchFolders/nodeModulesPaths Expo would normally add for monorepo
// packages, so replicate that manually for what this app actually imports
// from (@workspace/* packages under lib/). Dev mode (`expo start`, LAN
// testing) doesn't set this env var, so it keeps the wider root that the
// entry.js re-export trick above was written for.
if (process.env.EXPO_NO_METRO_WORKSPACE_ROOT) {
  const workspaceRoot = path.resolve(__dirname, "../..");
  config.watchFolders = [
    ...new Set([
      ...(config.watchFolders ?? []),
      path.join(workspaceRoot, "node_modules"),
      path.join(workspaceRoot, "lib"),
    ]),
  ];
  config.resolver.nodeModulesPaths = [
    ...new Set([
      ...(config.resolver.nodeModulesPaths ?? []),
      path.join(__dirname, "node_modules"),
      path.join(workspaceRoot, "node_modules"),
    ]),
  ];
}

module.exports = config;
