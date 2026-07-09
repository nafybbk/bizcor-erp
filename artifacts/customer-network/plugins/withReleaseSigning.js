// Config plugin: wires the permanent release keystore into android/app/build.gradle
// every time `expo prebuild` regenerates the android/ folder (which is gitignored).
// The keystore lives in credentials/ (tracked in git). All published APKs must be
// signed with this key or existing installs will refuse to update over it.
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING = `
        release {
            storeFile file('../../credentials/bizcor-release.keystore')
            storePassword 'bizcor2026release'
            keyAlias 'bizcor-connect'
            keyPassword 'bizcor2026release'
        }`;

// CMake 3.30's ninja handles Windows paths >260 chars (needed for RN codegen);
// the AGP default 3.22 does not. Requires the SDK package "cmake;3.30.4" and
// the Windows registry flag LongPathsEnabled=1.
const CMAKE_PIN = `
    externalNativeBuild {
        cmake {
            version "3.30.4"
        }
    }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (process.platform === "win32" && !gradle.includes('version "3.30.4"')) {
      gradle = gradle.replace(
        /(android\s*\{\s*\n\s*ndkVersion[^\n]*\n)/,
        `$1${CMAKE_PIN}\n`
      );
    }
    if (!gradle.includes("bizcor-release.keystore")) {
      // Add release entry inside signingConfigs { debug { ... } }
      gradle = gradle.replace(
        /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/,
        `$1${RELEASE_SIGNING}`
      );
      // Point the release build type at it instead of the debug key
      gradle = gradle.replace(
        /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig signingConfigs.release"
      );
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
