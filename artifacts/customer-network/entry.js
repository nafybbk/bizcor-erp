// Local re-export so Metro's dev-server manifest can address the entry
// point with an in-project relative URL. expo-router/entry itself lives in
// the relocated pnpm store (D:\ps, outside this project's folder tree —
// see metro.config.js), which Metro can only express as a path that walks
// back past the URL root — every HTTP client silently collapses that,
// breaking bundle download in Expo Go. Requiring it from here instead
// keeps the exposed entry URL inside the project root; everything this
// file requires is still resolved normally through Metro's module graph.
// Must run before anything else touches react-native-reanimated.
import "react-native-reanimated";

module.exports = require("expo-router/entry");
