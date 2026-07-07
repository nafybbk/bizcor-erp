import { Feather } from "@expo/vector-icons";
import {
  getMiniAppListInvoicesQueryKey,
  getMiniAppListPaymentsQueryKey,
  getMiniAppGetStatementQueryKey,
  getMiniAppPollMessagesQueryKey,
  getMiniAppRecentMessagesQueryKey,
  MiniAppChatMessage,
  MiniAppInvoice,
  MiniAppPayment,
  MiniAppStatementEntry,
  useMiniAppListConnections,
  useMiniAppListInvoices,
  useMiniAppListPayments,
  useMiniAppGetStatement,
  useMiniAppPollMessages,
  useMiniAppRecentMessages,
  useMiniAppSendMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type TabKey = "chat" | "invoices" | "payments" | "statement" | "gallery";

const TABS: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "chat", label: "Chat", icon: "message-circle" },
  { key: "invoices", label: "Invoices", icon: "file-text" },
  { key: "payments", label: "Payments", icon: "credit-card" },
  { key: "statement", label: "Statement", icon: "bar-chart-2" },
  { key: "gallery", label: "Gallery", icon: "image" },
];

export default function SupplierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const connectionId = Number(id);
  const colors = useColors();
  const [tab, setTab] = useState<TabKey>("chat");

  const { data: connections } = useMiniAppListConnections();
  const connection = useMemo(
    () => connections?.find((c) => c.id === connectionId),
    [connections, connectionId],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: connection?.businessName ?? "Supplier" }} />

      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              testID={`tab-${t.key}`}
              style={[
                styles.tabItem,
                active && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Feather
                name={t.icon}
                size={16}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.primary : colors.mutedForeground },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "chat" && <ChatTab connectionId={connectionId} />}
      {tab === "invoices" && (
        <InvoicesTab connectionId={connectionId} permissions={connection?.permissions} />
      )}
      {tab === "payments" && (
        <PaymentsTab connectionId={connectionId} permissions={connection?.permissions} />
      )}
      {tab === "statement" && (
        <StatementTab connectionId={connectionId} permissions={connection?.permissions} />
      )}
      {tab === "gallery" && <GalleryTab />}
    </View>
  );
}

function ChatTab({ connectionId }: { connectionId: number }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [lastId, setLastId] = useState(0);
  const listRef = useRef<FlatList<MiniAppChatMessage>>(null);

  const { data: recent, isLoading } = useMiniAppRecentMessages(connectionId, {
    query: {
      queryKey: getMiniAppRecentMessagesQueryKey(connectionId),
      enabled: !!connectionId,
    },
  });
  const { data: polled } = useMiniAppPollMessages(
    connectionId,
    { since: lastId },
    {
      query: {
        queryKey: getMiniAppPollMessagesQueryKey(connectionId, { since: lastId }),
        enabled: !!connectionId && lastId > 0,
        refetchInterval: 4000,
      },
    },
  );
  const sendMutation = useMiniAppSendMessage();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<MiniAppChatMessage[]>([]);

  useEffect(() => {
    if (recent && recent.length > 0) {
      setMessages(recent);
      setLastId(recent[recent.length - 1].id);
    }
  }, [recent]);

  useEffect(() => {
    if (polled && polled.length > 0) {
      setMessages((prev) => [...prev, ...polled]);
      setLastId(polled[polled.length - 1].id);
    }
  }, [polled]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    try {
      const sent = await sendMutation.mutateAsync({
        id: connectionId,
        data: { message: trimmed },
      });
      setMessages((prev) => [...prev, sent]);
      setLastId(sent.id);
      queryClient.invalidateQueries();
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setText(trimmed);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.chatContent}
          scrollEnabled={messages.length > 0}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Feather name="message-circle" size={30} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Say hello
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Start a conversation with your supplier.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.senderType === "customer";
            return (
              <View
                style={[
                  styles.bubbleRow,
                  { justifyContent: isMe ? "flex-end" : "flex-start" },
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isMe ? colors.primary : colors.secondary,
                      borderTopRightRadius: isMe ? 4 : 16,
                      borderTopLeftRadius: isMe ? 16 : 4,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: isMe ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {item.message}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View
        style={[
          styles.inputBar,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <TextInput
          style={[
            styles.chatInput,
            { backgroundColor: colors.secondary, color: colors.foreground },
          ]}
          placeholder="Type a message"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          testID="chat-input"
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          testID="chat-send-button"
          style={[
            styles.sendButton,
            {
              backgroundColor: colors.primary,
              opacity: !text.trim() || sendMutation.isPending ? 0.5 : 1,
            },
          ]}
        >
          <Feather name="send" size={16} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function InvoicesTab({
  connectionId,
  permissions,
}: {
  connectionId: number;
  permissions?: { invoice?: boolean } | null;
}) {
  const colors = useColors();
  const { data, isLoading, isError } = useMiniAppListInvoices(connectionId, {
    query: {
      queryKey: getMiniAppListInvoicesQueryKey(connectionId),
      enabled: !!connectionId && permissions?.invoice !== false,
    },
  });

  if (permissions?.invoice === false) {
    return (
      <View style={styles.centerFill}>
        <Feather name="lock" size={30} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Not shared with you
        </Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          This supplier hasn&apos;t enabled invoice sharing.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centerFill}>
        <Feather name="wifi-off" size={30} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Couldn&apos;t load invoices
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(item: MiniAppInvoice) => String(item.id)}
      scrollEnabled={!!data && data.length > 0}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.centerFill}>
          <Feather name="file-text" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No invoices yet
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.invoiceCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.invoiceIcon, { backgroundColor: colors.accent }]}>
            <Feather name="file-text" size={18} color={colors.accentForeground} />
          </View>
          <View style={styles.invoiceBody}>
            <Text style={[styles.invoiceNumber, { color: colors.foreground }]}>
              {item.voucherNumber}
            </Text>
            <Text style={[styles.invoiceDate, { color: colors.mutedForeground }]}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
          </View>
          <Text style={[styles.invoiceAmount, { color: colors.foreground }]}>
            ₹{Number(item.grandTotal).toLocaleString("en-IN")}
          </Text>
        </View>
      )}
    />
  );
}

function PaymentsTab({
  connectionId,
  permissions,
}: {
  connectionId: number;
  permissions?: { payment?: boolean } | null;
}) {
  const colors = useColors();
  const { data, isLoading, isError } = useMiniAppListPayments(connectionId, {
    query: {
      queryKey: getMiniAppListPaymentsQueryKey(connectionId),
      enabled: !!connectionId && permissions?.payment !== false,
    },
  });

  if (permissions?.payment === false) {
    return (
      <View style={styles.centerFill}>
        <Feather name="lock" size={30} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Not shared with you</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          This supplier hasn&apos;t enabled payment sharing.
        </Text>
      </View>
    );
  }

  if (isLoading) return <View style={styles.centerFill}><ActivityIndicator color={colors.primary} /></View>;

  if (isError) {
    return (
      <View style={styles.centerFill}>
        <Feather name="wifi-off" size={30} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn&apos;t load payments</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(item: MiniAppPayment) => String(item.id)}
      scrollEnabled={!!data && data.length > 0}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.centerFill}>
          <Feather name="credit-card" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No payments yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.invoiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.invoiceIcon, { backgroundColor: "#dcfce7" }]}>
            <Feather name="credit-card" size={18} color="#16a34a" />
          </View>
          <View style={styles.invoiceBody}>
            <Text style={[styles.invoiceNumber, { color: colors.foreground }]}>{item.paymentNumber}</Text>
            <Text style={[styles.invoiceDate, { color: colors.mutedForeground }]}>
              {new Date(item.date).toLocaleDateString()} · {item.paymentMode}
            </Text>
            {item.notes ? (
              <Text style={[styles.invoiceDate, { color: colors.mutedForeground }]} numberOfLines={1}>{item.notes}</Text>
            ) : null}
          </View>
          <Text style={[styles.invoiceAmount, { color: "#16a34a" }]}>
            ₹{Number(item.amount).toLocaleString("en-IN")}
          </Text>
        </View>
      )}
    />
  );
}

function StatementTab({
  connectionId,
  permissions,
}: {
  connectionId: number;
  permissions?: { statement?: boolean } | null;
}) {
  const colors = useColors();
  const { data, isLoading, isError } = useMiniAppGetStatement(connectionId, {
    query: {
      queryKey: getMiniAppGetStatementQueryKey(connectionId),
      enabled: !!connectionId && permissions?.statement !== false,
    },
  });

  if (permissions?.statement === false) {
    return (
      <View style={styles.centerFill}>
        <Feather name="lock" size={30} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Not shared with you</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          This supplier hasn&apos;t enabled statement sharing.
        </Text>
      </View>
    );
  }

  if (isLoading) return <View style={styles.centerFill}><ActivityIndicator color={colors.primary} /></View>;

  if (isError) {
    return (
      <View style={styles.centerFill}>
        <Feather name="wifi-off" size={30} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn&apos;t load statement</Text>
      </View>
    );
  }

  const entries = data?.entries ?? [];
  const closing = data?.closingBalance ?? 0;

  return (
    <FlatList
      data={entries}
      keyExtractor={(item: MiniAppStatementEntry) => `${item.type}-${item.id}`}
      scrollEnabled={entries.length > 0}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        entries.length > 0 ? (
          <View style={[styles.statementHeader, { backgroundColor: closing > 0 ? "#fef9c3" : "#dcfce7", borderColor: closing > 0 ? "#fde047" : "#86efac" }]}>
            <Text style={[styles.invoiceDate, { color: colors.mutedForeground }]}>Outstanding Balance</Text>
            <Text style={[styles.invoiceAmount, { color: closing > 0 ? "#b45309" : "#16a34a", fontSize: 18 }]}>
              ₹{Math.abs(closing).toLocaleString("en-IN")} {closing > 0 ? "due" : closing < 0 ? "advance" : "clear"}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.centerFill}>
          <Feather name="bar-chart-2" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No transactions yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.statementRow, { borderColor: colors.border }]}>
          <View style={styles.invoiceBody}>
            <Text style={[styles.invoiceNumber, { color: colors.foreground }]}>{item.ref}</Text>
            <Text style={[styles.invoiceDate, { color: colors.mutedForeground }]}>
              {new Date(item.date).toLocaleDateString()} · {item.type === "invoice" ? "Invoice" : "Receipt"}
            </Text>
          </View>
          <View style={styles.statementAmounts}>
            {item.debit > 0 ? (
              <Text style={[styles.invoiceDate, { color: "#dc2626", textAlign: "right" }]}>
                Dr ₹{item.debit.toLocaleString("en-IN")}
              </Text>
            ) : (
              <Text style={[styles.invoiceDate, { color: "#16a34a", textAlign: "right" }]}>
                Cr ₹{item.credit.toLocaleString("en-IN")}
              </Text>
            )}
            <Text style={[styles.invoiceDate, { color: colors.mutedForeground, textAlign: "right" }]}>
              Bal ₹{Math.abs(item.balance).toLocaleString("en-IN")}{item.balance > 0 ? " Dr" : item.balance < 0 ? " Cr" : ""}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

function GalleryTab() {
  const colors = useColors();
  return (
    <View style={styles.centerFill}>
      <Feather name="image" size={30} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Gallery coming soon
      </Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Your supplier will be able to share product photos here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  chatContent: { padding: 16, gap: 10, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 19 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 16, gap: 10, flexGrow: 1 },
  invoiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceBody: { flex: 1, gap: 3 },
  invoiceNumber: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  invoiceDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  invoiceAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statementHeader: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: "center",
    gap: 4,
  },
  statementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statementAmounts: { alignItems: "flex-end", gap: 3 },
});
