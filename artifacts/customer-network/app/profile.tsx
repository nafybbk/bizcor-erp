import { Feather } from "@expo/vector-icons";
import {
  useMiniAppGetProfile,
  useMiniAppUpdateProfile,
  useMiniAppChangePin,
  customFetch,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { credStore, SAVED_PIN_KEY, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function SectionCard({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customer, updateCustomer } = useAuth();

  const { data: profile, isLoading } = useMiniAppGetProfile();
  const updateProfileMutation = useMiniAppUpdateProfile();
  const changePinMutation = useMiniAppChangePin();

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaved, setPinSaved] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);

  // Prefill editable fields once the real profile loads (not on every
  // refetch, so mid-edit isn't clobbered by a background revalidation)
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (profile && !prefilled) {
      setName(profile.name || "");
      setBusinessName(profile.businessName || "");
      setPrefilled(true);
    }
  }, [profile, prefilled]);

  const showSupplierRealName = profile?.showSupplierRealName ?? true;

  const buzz = async (ok: boolean) => {
    if (Platform.OS === "web") return;
    await Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileSaved(false);
    try {
      const updated = await updateProfileMutation.mutateAsync({
        data: { name: name.trim(), businessName: businessName.trim() },
      });
      if (customer) await updateCustomer({ ...customer, name: updated.name, businessName: updated.businessName });
      setProfileSaved(true);
      await buzz(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e: unknown) {
      setProfileError(e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Save nahi ho saka");
      await buzz(false);
    }
  };

  const handleToggleRealName = async (value: boolean) => {
    try {
      const updated = await updateProfileMutation.mutateAsync({ data: { showSupplierRealName: value } });
      if (customer) await updateCustomer({ ...customer, showSupplierRealName: updated.showSupplierRealName });
      await buzz(true);
    } catch {
      await buzz(false);
    }
  };

  const handlePickAvatar = async () => {
    if (avatarUploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setAvatarUploading(true);
    try {
      const asset = result.assets[0];
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        name: "avatar.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
      const res = await customFetch<{ avatarUrl: string }>("/api/mini-app/customer/profile/avatar", {
        method: "POST",
        body: form,
      });
      if (customer) await updateCustomer({ ...customer, avatarUrl: res.avatarUrl });
      await buzz(true);
    } catch {
      await buzz(false);
    } finally {
      setAvatarUploading(false);
    }
  };

  const canChangePin = oldPin.trim().length >= 4 && newPin.trim().length >= 4 && newPin.trim() === confirmPin.trim();

  const handleChangePin = async () => {
    if (!canChangePin || changePinMutation.isPending) return;
    setPinError(null);
    setPinSaved(false);
    if (newPin.trim() === oldPin.trim()) {
      setPinError("Naya PIN purane se alag hona chahiye");
      return;
    }
    try {
      await changePinMutation.mutateAsync({ data: { oldPin: oldPin.trim(), newPin: newPin.trim() } });
      // Keep the offline-unlock cache in sync with the freshly changed PIN
      if (customer?.mobile) await credStore.setItem(SAVED_PIN_KEY, newPin.trim());
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      setPinSaved(true);
      await buzz(true);
      setTimeout(() => setPinSaved(false), 2000);
    } catch (e: unknown) {
      setPinError(e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "PIN change nahi ho saka");
      await buzz(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={40}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Pressable onPress={handlePickAvatar} style={styles.avatarWrap} disabled={avatarUploading}>
              {customer?.avatarUrl ? (
                <Image source={{ uri: customer.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Feather name="user" size={32} color={colors.primaryForeground} />
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="camera" size={13} color={colors.primaryForeground} />
                )}
              </View>
            </Pressable>

            <SectionCard title="Aapki details" colors={colors}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Mobile number</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="phone" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>{customer?.mobile}</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Aapka naam</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="user" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Apna naam likhein"
                    placeholderTextColor={colors.mutedForeground}
                    value={name}
                    onChangeText={setName}
                    maxLength={100}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Aapka business naam</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="briefcase" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Business ka naam likhein"
                    placeholderTextColor={colors.mutedForeground}
                    value={businessName}
                    onChangeText={setBusinessName}
                    maxLength={150}
                  />
                </View>
              </View>

              {profileError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{profileError}</Text> : null}

              <Pressable
                onPress={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: colors.primary, opacity: updateProfileMutation.isPending ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>
                    {profileSaved ? "Save ho gaya ✓" : "Save Karein"}
                  </Text>
                )}
              </Pressable>
            </SectionCard>

            <SectionCard title="Privacy" colors={colors}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Suppliers ka asli naam dikhayein</Text>
                  <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>
                    Off karne par jin suppliers ko aapne apna naam diya hai, unka naam wahi dikhega — asli business naam nahi.
                  </Text>
                </View>
                <Switch
                  value={showSupplierRealName}
                  onValueChange={handleToggleRealName}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </SectionCard>

            <SectionCard title="PIN badlein" colors={colors}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Purana PIN</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="lock" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    keyboardType="number-pad"
                    secureTextEntry
                    value={oldPin}
                    onChangeText={setOldPin}
                    maxLength={8}
                  />
                </View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Naya PIN</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="lock" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    keyboardType="number-pad"
                    secureTextEntry
                    value={newPin}
                    onChangeText={setNewPin}
                    maxLength={8}
                  />
                </View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Naya PIN dobara likhein</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="lock" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    keyboardType="number-pad"
                    secureTextEntry
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    maxLength={8}
                  />
                </View>
              </View>

              {pinError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{pinError}</Text> : null}

              <Pressable
                onPress={handleChangePin}
                disabled={!canChangePin || changePinMutation.isPending}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: colors.primary, opacity: !canChangePin || changePinMutation.isPending ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                {changePinMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>
                    {pinSaved ? "PIN badal gaya ✓" : "PIN Badlein"}
                  </Text>
                )}
              </Pressable>
              <Text style={[styles.toggleHint, { color: colors.mutedForeground, marginTop: 4 }]}>
                Yehi PIN aapke login ke liye bhi kaam aata hai — offline hone par bhi yehi PIN dalke app khulta hai.
              </Text>
            </SectionCard>
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  avatarWrap: { alignSelf: "center", width: 88, height: 88, marginBottom: -4 },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  readOnlyText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveButton: { height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleRow: { flexDirection: "row", alignItems: "center" },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 4 },
  toggleHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
