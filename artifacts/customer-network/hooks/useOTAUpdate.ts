import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Alert } from "react-native";

export function useOTAUpdate() {
  useEffect(() => {
    async function check() {
      if (__DEV__) return;

      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        await Updates.fetchUpdateAsync();

        Alert.alert(
          "App Updated",
          "A new version has been downloaded in the background.",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart Now",
              onPress: () => Updates.reloadAsync(),
            },
          ]
        );
      } catch {
        // Silent — no EAS configured yet, or no internet
      }
    }

    check();
  }, []);
}
