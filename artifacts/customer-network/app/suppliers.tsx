import { Feather } from "@expo/vector-icons";
import { useMiniAppListConnections, MiniAppConnection } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function SupplierCard({ item }: { item: MiniAppConnection }) {
  const colors = useColors();
  const initial = item.businessName?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <Pressable
      onPress={() => router.push(`/supplier/${item.id}`)}
      testID={`supplier-card-${item.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {item.businessLogo ? (
        <Image source={{ uri: item.businessLogo }} style={styles.avatarImg} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
            {initial}
          </Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.businessName}
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
          {item.status === "blocked" ? "Blocked" : "Connected"}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function SuppliersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customer, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useMiniAppListConnections();

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
            paddingTop: Math.max(insets.top, 20),
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            My Suppliers
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {customer?.mobile}
          </Text>
        </View>
        <Pressable
          onPress={handleLogout}
          hitSlop={10}
          testID="logout-button"
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name="log-out" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <SkeletonList />
        </View>
      ) : isError ? (
        <View style={styles.centerFill}>
          <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Couldn&apos;t load suppliers
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <SupplierCard item={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 90 },
          ]}
          scrollEnabled={!!data && data.length > 0}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
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
    elevation: 5,
  },
});
