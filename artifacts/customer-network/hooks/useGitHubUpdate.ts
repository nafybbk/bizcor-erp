import Constants from "expo-constants";
import { Directory, DownloadTask, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";

const GITHUB_REPO = "nafybbk/bizcor-releases";
// APK must be named: bizcor-connect-X.X.X.apk  (version extracted from filename)
const APK_NAME_PATTERN = /bizcor-connect[- ]([\d.]+)\.apk$/i;

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, "")
    .split(".")
    .map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] ?? 0;
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export function useGitHubUpdate() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const downloadAndInstall = useCallback(
    async (url: string, filename: string) => {
      try {
        setDownloading(true);
        setProgress(0);

        const dest = new File(Paths.cache as Directory, filename);
        const task = new DownloadTask(url, dest, {
          onProgress: (snap) => {
            if (snap.totalBytes > 0) {
              setProgress(snap.bytesWritten / snap.totalBytes);
            }
          },
        });

        const downloaded = await task.downloadAsync();
        if (!downloaded) throw new Error("Download cancelled");

        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: downloaded.uri,
          flags: 1,
          type: "application/vnd.android.package-archive",
        });
      } catch {
        Alert.alert(
          "Download Failed",
          "Could not download the update. Please try again when you have a stable connection."
        );
      } finally {
        setDownloading(false);
        setProgress(0);
      }
    },
    []
  );

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS !== "android") return;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) return;

      const release = await res.json();
      const currentVersion = Constants.expoConfig?.version ?? "1.0.0";

      // Find APK asset and extract its version from the filename
      const apkAsset = (
        release.assets as { name: string; browser_download_url: string }[]
      ).find((a) => APK_NAME_PATTERN.test(a.name));
      if (!apkAsset) return; // No CN APK in this release — skip

      const match = apkAsset.name.match(APK_NAME_PATTERN);
      const apkVersion = match?.[1] ?? "";
      if (!apkVersion || !isNewer(apkVersion, currentVersion)) return;

      Alert.alert(
        "Update Available",
        `BizCor Connect v${apkVersion} is ready.\n\nCurrent: v${currentVersion}`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Install Now",
            onPress: () =>
              downloadAndInstall(apkAsset.browser_download_url, apkAsset.name),
          },
        ]
      );
    } catch {
      // Silent — no internet, rate limited, or no APK asset in release yet
    }
  }, [downloadAndInstall]);

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 4000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return { downloading, progress };
}
