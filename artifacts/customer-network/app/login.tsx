import { Feather } from "@expo/vector-icons";
import { useMiniAppLogin, useMiniAppSettings } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setSession } = useAuth();
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMiniAppLogin();
  const { data: settings } = useMiniAppSettings();
  const appName = settings?.softwareName || "BizCor";
  const supportEmail = settings?.supportEmail || "info@naewtgroup.com";
  const supportPhone = settings?.supportPhone;

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -10, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(translateY, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [translateY]);

  const canSubmit = mobile.trim().length >= 6 && pin.trim().length >= 4;

  const handleLogin = async () => {
    if (!canSubmit || loginMutation.isPending) return;
    setError(null);
    try {
      const res = await loginMutation.mutateAsync({
        data: { mobile: mobile.trim(), pin: pin.trim() },
      });
      await setSession(res.token, res.customer);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace("/suppliers");
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Login failed. Please try again.";
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
          {
            paddingTop: Math.max(insets.top, Platform.OS === "web" ? 67 : 0) + 60,
            paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 24) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.Image
          source={require("../assets/images/bizcor-logo.png")}
          style={[styles.logo, { transform: [{ translateY }] }]}
          resizeMode="contain"
        />

        <Text style={[styles.title, { color: colors.foreground }]}>
          {appName}
        </Text>
        <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
          Connect
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sign in with your mobile number to view your suppliers, invoices,
          and chat.
        </Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Mobile number
            </Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="phone" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="98765 43210"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={setMobile}
                maxLength={15}
                testID="mobile-input"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              PIN
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
                placeholder="1234"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                value={pin}
                onChangeText={setPin}
                maxLength={8}
                testID="pin-input"
              />
              <Pressable
                onPress={() => setShowPin((v) => !v)}
                hitSlop={10}
                testID="toggle-pin-visibility"
              >
                <Feather
                  name={showPin ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              First time? Default PIN is 1234 — you can change it later.
            </Text>
          </View>

          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.destructive + "15" },
              ]}
            >
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={!canSubmit || loginMutation.isPending}
            testID="login-button"
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: !canSubmit || loginMutation.isPending ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                Continue
              </Text>
            )}
          </Pressable>

          <View style={styles.supportRow}>
            <Feather name="mail" size={13} color={colors.mutedForeground} />
            <Text style={[styles.supportText, { color: colors.mutedForeground }]}>
              {supportEmail}
            </Text>
          </View>
          {supportPhone ? (
            <View style={styles.supportRow}>
              <Feather name="phone" size={13} color={colors.mutedForeground} />
              <Text style={[styles.supportText, { color: colors.mutedForeground }]}>
                {supportPhone}
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, flexGrow: 1 },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 12,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 2 },
  appTagline: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    marginBottom: 32,
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
  hint: { fontSize: 12, fontFamily: "Inter_400Regular" },
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
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  supportText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
