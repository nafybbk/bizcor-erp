import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, credStore as authCredStore, getCachedCustomer, SAVED_MOBILE_KEY, SAVED_PIN_KEY, type MiniAppCustomerInfo } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

// Same storage object as AuthContext (SecureStore native / AsyncStorage web),
// just re-exposed with the `.get`/`.set` names this screen already used.
const credStore = {
  get: authCredStore.getItem,
  set: authCredStore.setItem,
};

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setSession, restoreSession } = useAuth();
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local flag (not loginMutation.isPending) so a timed-out attempt frees the
  // button for retry even while the stale request is still in flight.
  const [submitting, setSubmitting] = useState(false);

  const loginMutation = useMiniAppLogin();
  const { data: settings } = useMiniAppSettings();
  // App's own brand is fixed — settings only drive the support contact rows,
  // and those render only once actually loaded (a fallback here briefly
  // showed the wrong email on cold starts and looked like a second screen).
  const appName = "BizCor";
  const supportEmail = settings?.supportEmail;
  const supportPhone = settings?.supportPhone;

  const translateY = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -10, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(translateY, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    anim.start();
    // Brand color cycle — color interpolation can't use the native driver
    const colorLoop = Animated.loop(
      Animated.timing(colorAnim, { toValue: 1, duration: 6000, useNativeDriver: false, easing: Easing.linear })
    );
    colorLoop.start();
    return () => { anim.stop(); colorLoop.stop(); };
  }, [translateY, colorAnim]);

  const titleColor = colorAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["#2563EB", "#7C3AED", "#DB2777", "#F59E0B", "#2563EB"],
  });

  // Prefill last used credentials (remember login) + show whoever last used
  // this device (name/avatar/code) so re-opening feels personal even before
  // re-authenticating — WhatsApp-style.
  const [cachedCustomer, setCachedCustomer] = useState<MiniAppCustomerInfo | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const [savedMobile, savedPin, cached] = await Promise.all([
          credStore.get(SAVED_MOBILE_KEY),
          credStore.get(SAVED_PIN_KEY),
          getCachedCustomer(),
        ]);
        if (savedMobile) setMobile(savedMobile);
        if (savedPin) setPin(savedPin);
        if (cached) setCachedCustomer(cached);
      } catch { /* first run / storage unavailable */ }
    })();
  }, []);

  const canSubmit = mobile.trim().length >= 6 && pin.trim().length >= 4;

  const handleLogin = async () => {
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      // Offline-first unlock: if this is the same mobile+PIN that last
      // logged in successfully on THIS device, restore that cached session
      // directly — zero network calls. The PIN is the security here; once
      // it's been verified by the server once, re-entering it correctly
      // shouldn't need internet again every single time. A different PIN
      // for the same (known) mobile fails immediately, no network wait —
      // only a genuinely new mobile number falls through to a real login.
      const [savedMobile, savedPin] = await Promise.all([
        credStore.get(SAVED_MOBILE_KEY),
        credStore.get(SAVED_PIN_KEY),
      ]);
      if (savedMobile && savedMobile === mobile.trim()) {
        if (savedPin === pin.trim()) {
          if (await restoreSession()) {
            if (Platform.OS !== "web") {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            router.replace("/suppliers");
            return;
          }
          // Creds match but nothing cached to restore (e.g. fresh install) — fall through to network below.
        } else {
          setError("Galat PIN");
          if (Platform.OS !== "web") {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          return;
        }
      }

      // Cold cloud servers can take a while — never spin forever
      const res = await Promise.race([
        loginMutation.mutateAsync({
          data: { mobile: mobile.trim(), pin: pin.trim() },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Server se jawab nahi aa raha. Kuch second baad dobara try karein.")), 30000)
        ),
      ]);
      await setSession(res.token, res.customer);
      // Remember for next login
      try {
        await Promise.all([
          credStore.set(SAVED_MOBILE_KEY, mobile.trim()),
          credStore.set(SAVED_PIN_KEY, pin.trim()),
        ]);
      } catch { /* non-critical */ }
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
    } finally {
      setSubmitting(false);
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
        <View style={styles.brandBlock}>
          <Animated.Image
            source={require("../assets/images/bizcor-logo.png")}
            style={[styles.logo, { transform: [{ translateY }] }]}
            resizeMode="contain"
          />

          <Animated.Text style={[styles.title, { color: titleColor }]}>
            {appName}
          </Animated.Text>
          <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
            Connect · v{Constants.expoConfig?.version ?? "?"}
          </Text>
          {cachedCustomer ? (
            <View style={styles.profileCard}>
              {cachedCustomer.avatarUrl ? (
                <Image source={{ uri: cachedCustomer.avatarUrl }} style={styles.profileAvatar} />
              ) : (
                <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
                  <Feather name="user" size={18} color="#fff" />
                </View>
              )}
              <View style={styles.profileTextCol}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {cachedCustomer.name || cachedCustomer.mobile}
                </Text>
                {cachedCustomer.customerId ? (
                  <Text style={styles.profileCode}>#{cachedCustomer.customerId}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
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
                android_ripple={{ color: "#88888833", borderless: true, radius: 20 }}
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
            disabled={!canSubmit || submitting}
            testID="login-button"
            android_ripple={{ color: "#ffffff33" }}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: !canSubmit || submitting ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                Continue
              </Text>
            )}
          </Pressable>

          {supportEmail ? (
            <View style={styles.supportRow}>
              <Feather name="mail" size={13} color={colors.mutedForeground} />
              <Text style={[styles.supportText, { color: colors.mutedForeground }]}>
                {supportEmail}
              </Text>
            </View>
          ) : null}
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
  brandBlock: { alignItems: "center", alignSelf: "stretch" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  profileAvatar: { width: 36, height: 36, borderRadius: 18 },
  profileAvatarPlaceholder: { backgroundColor: "#334155", alignItems: "center", justifyContent: "center" },
  profileTextCol: { flex: 1 },
  profileName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
  profileCode: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#cbd5e1", marginTop: 1 },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 12,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 2, textAlign: "center" },
  appTagline: {
    fontSize: 9.6,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
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
    overflow: "hidden",
    elevation: 2,
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
