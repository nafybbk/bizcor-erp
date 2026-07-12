import { Feather } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type InvoiceItem = { name: string; qty: number; unit: string; rate: number; amount: number };
type InvoiceDetail = {
  voucherNumber: string;
  date: string;
  status: string | null;
  notes: string | null;
  grandTotal: number;
  items: InvoiceItem[] | null;
};

export default function InvoiceDetailScreen() {
  const { connectionId, source, invoiceId } = useLocalSearchParams<{
    connectionId: string;
    source: string;
    invoiceId: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const d = await customFetch<InvoiceDetail>(
        `/api/mini-app/connections/${connectionId}/invoices/${source}/${invoiceId}`,
      );
      setData(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [connectionId, source, invoiceId]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: data?.voucherNumber ?? "Invoice",
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
      }} />

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error || !data ? (
        <View style={styles.centerFill}>
          <Feather name="wifi-off" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Invoice load nahi hui
          </Text>
          <Pressable
            onPress={load}
            android_ripple={{ color: colors.primaryForeground + "33" }}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}
        >
          {/* Header card */}
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.headerTop}>
              <View style={[styles.docIcon, { backgroundColor: colors.accent }]}>
                <Feather name="file-text" size={20} color={colors.accentForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.docNumber, { color: colors.foreground }]}>{data.voucherNumber}</Text>
                <Text style={[styles.docDate, { color: colors.mutedForeground }]}>
                  {new Date(data.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </Text>
              </View>
              {data.status && data.status !== "posted" ? (
                <Text style={[styles.statusChip, { backgroundColor: colors.secondary, color: colors.mutedForeground }]}>
                  {data.status}
                </Text>
              ) : null}
            </View>
            <View style={[styles.totalRow, { borderColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>
                ₹{data.grandTotal.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>

          {/* Items */}
          {data.items === null ? (
            <View style={[styles.noteBox, { backgroundColor: colors.secondary }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                Item details supplier ke system se agli update pe milengi.
              </Text>
            </View>
          ) : data.items.length === 0 ? null : (
            <View style={[styles.itemsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.itemsHeading, { color: colors.mutedForeground }]}>
                ITEMS ({data.items.length})
              </Text>
              {data.items.map((it, i) => (
                <View
                  key={i}
                  style={[styles.itemRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.foreground }]}>{it.name}</Text>
                    <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                      {it.qty} {it.unit || "pcs"} × ₹{it.rate.toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { color: colors.foreground }]}>
                    ₹{it.amount.toLocaleString("en-IN")}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {data.notes ? (
            <View style={[styles.noteBox, { backgroundColor: colors.secondary }]}>
              <Feather name="message-square" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>{data.notes}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  retryButton: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, overflow: "hidden" },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  headerCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  docIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  docNumber: { fontSize: 16, fontFamily: "Inter_700Bold" },
  docDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusChip: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "capitalize",
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 12 },
  totalLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  itemsCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  itemsHeading: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, paddingVertical: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  itemMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  itemAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  noteBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12 },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
