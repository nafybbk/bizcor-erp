const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// Windows: pnpm's virtual store is relocated to D:\ps (npm_config_virtual_store_dir)
// to stay under CMake's 250-char object path limit when building the Android APK.
// Metro can only resolve files inside watched folders, so include the store when present.
if (fs.existsSync("D:/ps")) {
  config.watchFolders = [...(config.watchFolders ?? []), "D:/ps"];
}

module.exports = config;
