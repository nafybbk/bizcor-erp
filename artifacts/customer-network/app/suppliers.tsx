import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useMiniAppListConnections, MiniAppConnection, customFetch } from "@workspace/api-client-react";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTabCache } from "@/hooks/useTabCache";
import SyncRing from "@/components/SyncRing";

type Conn = MiniAppConnection & {
  customerPaused?: boolean;
  partyName?: string | null;
  invoiceCount?: number;
  paymentCount?: number;
  lastDocDate?: string | null;
};

// Last doc-date the user has SEEN per connection — new activity gets a badge
const SEEN_KEY = "cn_seen_docs";
async function loadSeenMap(): Promise<Record<string, string>> {
  try { return JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) || "{}"); } catch { return {}; }
}
async function markSeen(connId: number, lastDocDate?: string | null) {
  try {
    const map = await loadSeenMap();
    map[String(connId)] = lastDocDate || new Date().toISOString();
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch { /* non-critical */ }
}

// Vibrant avatar colors picked by name hash — kills the "doctor's parchi" white
const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0d9488", "#4f46e5"];
function avatarColor(name?: string | null): string {
  let h = 0;
  for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function StatusChip({ status, paused }: { status?: string; paused: boolean }) {
  const cfg = status === "blocked"
    ? { bg: "#fee2e2", fg: "#dc2626", label: "Blocked" }
    : paused
      ? { bg: "#fef3c7", fg: "#b45309", label: "Paused" }
      : { bg: "#dcfce7", fg: "#16a34a", label: "Connected" };
  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: cfg.fg }]} />
      <Text style={[styles.chipText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function SupplierCard({ item, onChanged, hasNew, showSupplierRealName }: { item: Conn; onChanged: () => void; hasNew: boolean; showSupplierRealName: boolean }) {
  const colors = useColors();
  const displayName = (!showSupplierRealName && item.customLabel) || item.businessName;
  const initial = displayName?.charAt(0)?.toUpperCase() ?? "?";
  const paused = item.customerPaused === true;
  const docCount = (item.invoiceCount || 0) + (item.paymentCount || 0);

  const [renameOpen, setRenameOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState(item.customLabel || "");

  const setPaused = async (value: boolean) => {
    try {
      await customFetch(`/api/mini-app/connections/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ paused: value }),
      });
      onChanged();
    } catch {
      Alert.alert("Error", "Save nahi hua. Internet check karke dobara try karein.");
    }
  };

  const saveLabel = async () => {
    try {
      await customFetch(`/api/mini-app/connections/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ customLabel: labelDraft.trim() }),
      });
      setRenameOpen(false);
      onChanged();
    } catch {
      Alert.alert("Error", "Naam save nahi hua. Dobara try karein.");
    }
  };

  const remove = () => {
    Alert.alert(
      "Remove supplier?",
      `${displayName} aapki app se hat jayega (chat bhi delete hogi). Wapas judne ke liye business code + PIN dobara daalna hoga.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await customFetch(`/api/mini-app/connections/${item.id}`, { method: "DELETE" });
              onChanged();
            } catch {
              Alert.alert("Error", "Remove nahi hua. Dobara try karein.");
            }
          },
        },
      ]
    );
  };

  const openMenu = () => {
    Alert.alert(displayName ?? "Supplier", undefined, [
      paused
        ? { text: "▶  Resume", onPress: () => setPaused(false) }
        : { text: "⏸  Pause", onPress: () => setPaused(true) },
      { text: "✏️  Naam badlein", onPress: () => { setLabelDraft(item.customLabel || ""); setRenameOpen(true); } },
      { text: "🗑  Remove", style: "destructive", onPress: remove },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handlePress = () => {
    markSeen(item.id, item.lastDocDate);
    if (paused) {
      Alert.alert(
        "Paused hai",
        `${displayName} paused hai — data dekhne ke liye resume karein.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Resume", onPress: () => setPaused(false) },
        ]
      );
      return;
    }
    router.push(`/supplier/${item.id}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={openMenu}
      testID={`supplier-card-${item.id}`}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: hasNew ? colors.primary : colors.border,
          borderWidth: hasNew ? 1.5 : 1,
          opacity: pressed ? 0.85 : paused ? 0.6 : 1,
        },
      ]}
    >
      {item.businessLogo ? (
        <Image source={{ uri: item.businessLogo }} style={styles.avatarImg} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: avatarColor(displayName) }]}>
          <Text style={[styles.avatarText, { color: "#ffffff" }]}>
            {initial}
          </Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {displayName}
        </Text>
        {item.partyName ? (
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.partyName}
          </Text>
        ) : null}
        <Text style={[styles.docLine, { color: docCount > 0 ? colors.mutedForeground : "#cbd5e1" }]} numberOfLines={1}>
          {docCount > 0
            ? `${item.invoiceCount || 0} invoices · ${item.paymentCount || 0} receipts`
            : "Abhi koi document nahi"}
        </Text>
        <View style={styles.chipRow}>
          <StatusChip status={item.status} paused={paused} />
          {hasNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
      </View>
      <Pressable
        onPress={openMenu}
        hitSlop={10}
        testID={`supplier-menu-${item.id}`}
        android_ripple={{ color: colors.border, borderless: true, radius: 22 }}
      >
        <Feather name="more-vertical" size={20} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={styles.renameOverlay}>
          <View style={[styles.renameBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.renameTitle, { color: colors.foreground }]}>Is supplier ka naam badlein</Text>
            <Text style={[styles.renameHint, { color: colors.mutedForeground }]}>
              Khaali chhod dein to asli business naam wapas dikhega.
            </Text>
            <TextInput
              style={[styles.renameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={labelDraft}
              onChangeText={setLabelDraft}
              placeholder={item.businessName}
              placeholderTextColor={colors.mutedForeground}
              maxLength={60}
              autoFocus
            />
            <View style={styles.renameActions}>
              <Pressable onPress={() => setRenameOpen(false)} style={styles.renameCancelBtn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveLabel} style={[styles.renameSaveBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

export default function SuppliersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customer, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isFetching, isError, refetch } = useMiniAppListConnections();
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});

  // Shows the existing list instantly on app open instead of a blank
  // skeleton every time — the ring (not this) is what signals a fresh
  // background sync is in progress.
  const { cachedData, saveCache } = useTabCache<MiniAppConnection[]>("connections_list");
  useEffect(() => { if (data) saveCache(data); }, [data, saveCache]);
  const displayData = data ?? cachedData ?? [];

  // Reload on focus so badges clear right after visiting a supplier
  useFocusEffect(useCallback(() => {
    loadSeenMap().then(setSeenMap);
    refetch();
  }, [refetch]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 20) + 8,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.primaryForeground }]}>
              My Suppliers
            </Text>
            <Text style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.75)" }]}>
              {customer?.mobile} · v{Constants.expoConfig?.version ?? "?"}
            </Text>
          </View>
          {isFetching && <SyncRing size={16} backgroundColor={colors.primary} />}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => router.push("/profile")}
            hitSlop={10}
            testID="profile-button"
            android_ripple={{ color: "rgba(255,255,255,0.3)", borderless: true, radius: 24 }}
            style={[styles.iconButton, { backgroundColor: "rgba(255,255,255,0.18)" }]}
          >
            <Feather name="user" size={18} color={colors.primaryForeground} />
          </Pressable>
          <Pressable
            onPress={handleLogout}
            hitSlop={10}
            testID="logout-button"
            android_ripple={{ color: "rgba(255,255,255,0.3)", borderless: true, radius: 24 }}
            style={[styles.iconButton, { backgroundColor: "rgba(255,255,255,0.18)" }]}
          >
            <Feather name="log-out" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>

      {isLoading && !cachedData ? (
        <View style={styles.centerFill}>
          <SkeletonList />
        </View>
      ) : isError && displayData.length === 0 ? (
        <View style={styles.centerFill}>
          <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Couldn&apos;t load suppliers
          </Text>
          <Pressable
            onPress={() => refetch()}
            android_ripple={{ color: colors.primaryForeground + "33" }}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const c = item as Conn;
            const hasNew = !!(c.lastDocDate && c.lastDocDate > (seenMap[String(c.id)] || "")) && c.status !== "blocked";
            return <SupplierCard item={c} onChanged={() => refetch()} hasNew={hasNew} showSupplierRealName={customer?.showSupplierRealName !== false} />;
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 90 },
          ]}
          scrollEnabled={displayData.length > 0}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Feather name="briefcase" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No suppliers yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Connect to a supplier using their business code and PIN.
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={() => router.push("/connect")}
        testID="add-supplier-fab"
        android_ripple={{ color: colors.primaryForeground + "33", borderless: false }}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: Math.max(insets.bottom, 20) + 20,
          },
        ]}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

function SkeletonList() {
  const colors = useColors();
  return (
    <View style={{ width: "100%", paddingHorizontal: 20, gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: 72,
            borderRadius: 14,
            backgroundColor: colors.secondary,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  renameOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  renameBox: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 20, gap: 6 },
  renameTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  renameHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  renameInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46, fontSize: 15, fontFamily: "Inter_400Regular" },
  renameActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  renameCancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  renameSaveBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  docLine: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  newBadge: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  newBadgeText: { color: "#ffffff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 20, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 1,
    overflow: "hidden",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 46, height: 46, borderRadius: 12 },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },
});
