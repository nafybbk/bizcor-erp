import { Feather } from "@expo/vector-icons";
import { useMiniAppConnect } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

export default function ConnectSupplierScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [businessCode, setBusinessCode] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectMutation = useMiniAppConnect();

  const canSubmit = businessCode.trim().length >= 4 && pin.trim().length >= 1;

  const handleConnect = async () => {
    if (!canSubmit || connectMutation.isPending) return;
    setError(null);
    try {
      await connectMutation.mutateAsync({
        data: { businessCode: businessCode.trim().toUpperCase(), pin: pin.trim() },
      });
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Could not connect. Please check the code and PIN.";
      setError(message);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={40}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Connect to a supplier
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Ask your supplier for their business code and the PIN they set for
          you, then enter them below.
        </Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Business code
            </Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="hash" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="e.g. P6YH6N"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                value={businessCode}
                onChangeText={setBusinessCode}
                maxLength={12}
                testID="business-code-input"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Your PIN
            </Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="PIN given by supplier"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPin}
                value={pin}
                onChangeText={setPin}
                maxLength={10}
                testID="connect-pin-input"
              />
              <Pressable
                onPress={() => setShowPin((v) => !v)}
                hitSlop={10}
                android_ripple={{ color: "#88888833", borderless: true, radius: 20 }}
              >
                <Feather
                  name={showPin ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15" }]}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleConnect}
            disabled={!canSubmit || connectMutation.isPending}
            testID="connect-submit-button"
            android_ripple={{ color: "#ffffff33" }}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: !canSubmit || connectMutation.isPending ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {connectMutation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                Connect
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 28,
  },
  form: { gap: 18 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  submitButton: {
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
