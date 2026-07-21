import { Feather } from "@expo/vector-icons";
import {
  getMiniAppListInvoicesQueryKey,
  getMiniAppListPaymentsQueryKey,
  getMiniAppGetStatementQueryKey,
  getMiniAppListGalleryQueryKey,
  getMiniAppPollMessagesQueryKey,
  getMiniAppRecentMessagesQueryKey,
  MiniAppChatMessage,
  MiniAppConnection,
  MiniAppInvoice,
  MiniAppPayment,
  MiniAppStatementEntry,
  MiniAppGalleryShare,
  useMiniAppListConnections,
  useMiniAppListInvoices,
  useMiniAppListPayments,
  useMiniAppGetStatement,
  useMiniAppListGallery,
  useMiniAppGetGalleryFull,
  useMiniAppPollMessages,
  useMiniAppRecentMessages,
  useMiniAppSendMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ZoomableImage from "@/components/ZoomableImage";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTabCache, timeAgo } from "@/hooks/useTabCache";
import SyncRing from "@/components/SyncRing";

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

  const { customer } = useAuth();
  const { data: connectionsLive } = useMiniAppListConnections();
  // Same cache the Suppliers list already warms (`connections_list`) — a slow
  // or dropped connection here shouldn't blank out the header/permissions
  // when the exact same data was already fetched moments ago to get here.
  const { cachedData: connectionsCached } = useTabCache<MiniAppConnection[]>("connections_list");
  const connections = connectionsLive ?? connectionsCached;
  const connection = useMemo(
    () => connections?.find((c) => c.id === connectionId),
    [connections, connectionId],
  );
  // Respect the customer's own privacy toggle — a custom label (if set)
  // stands in for the supplier's real business name everywhere in the app.
  const displayName = (customer?.showSupplierRealName === false && connection?.customLabel) || connection?.businessName || "Supplier";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: displayName,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.primaryForeground,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
      }} />

      {/* Material-style scrollable pill tabs — the old flex:1 row crushed
          five labels into wrapping soup on phone widths */}
      <View style={[styles.tabBar, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              /* RN Android quirk: a Pressable with android_ripple caches its
                 background drawable, so a changing backgroundColor sticks to a
                 stale tab. The color lives on an inner View instead. */
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                testID={`tab-${t.key}`}
                style={styles.tabPillOuter}
              >
                <View
                  style={[
                    styles.tabPill,
                    { backgroundColor: active ? colors.primary : colors.secondary },
                  ]}
                >
                  <Feather
                    name={t.icon}
                    size={15}
                    color={active ? "#ffffff" : "#64748b"}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      { color: active ? "#ffffff" : "#64748b" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
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
      {tab === "gallery" && (
        <GalleryTab connectionId={connectionId} permissions={connection?.permissions} />
      )}
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
          android_ripple={{ color: "#ffffff33", borderless: true, radius: 21 }}
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
  const [refreshing, setRefreshing] = useState(false);
  const { cachedData, lastUpdated, saveCache } = useTabCache<MiniAppInvoice[]>(`inv_${connectionId}`);
  const { data, isLoading, isFetching, isError, refetch } = useMiniAppListInvoices(connectionId, {
    query: {
      queryKey: getMiniAppListInvoicesQueryKey(connectionId),
      enabled: !!connectionId && permissions?.invoice !== false,
    },
  });

  useEffect(() => { if (data) saveCache(data); }, [data, saveCache]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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

  if (isLoading && !cachedData) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const displayData = (data ?? cachedData ?? []) as (MiniAppInvoice & { source?: string })[];

  return (
    <FlatList
      data={displayData}
      keyExtractor={(item) => `${item.source ?? "cloud"}-${item.id}`}
      scrollEnabled={displayData.length > 0}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        lastUpdated || isFetching ? (
          <View style={styles.syncRow}>
            {isFetching && <SyncRing size={14} backgroundColor={colors.background} />}
            {lastUpdated && (
              <Text style={[styles.syncLabel, { color: colors.mutedForeground }]}>
                {isError ? "⚡ Offline · " : ""}Last synced {timeAgo(lastUpdated)}
              </Text>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.centerFill}>
          {isError ? (
            <Feather name="wifi-off" size={30} color={colors.mutedForeground} />
          ) : (
            <Feather name="file-text" size={30} color={colors.mutedForeground} />
          )}
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {isError ? "Couldn\u2019t load invoices" : "No invoices yet"}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/invoice-detail",
              params: {
                connectionId: String(connectionId),
                source: item.source ?? "cloud",
                invoiceId: String(item.id),
              },
            })
          }
          android_ripple={{ color: colors.border }}
          style={({ pressed }) => [
            styles.invoiceCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
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
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
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
  const [refreshing, setRefreshing] = useState(false);
  const { cachedData, lastUpdated, saveCache } = useTabCache<MiniAppPayment[]>(`pay_${connectionId}`);
  const { data, isLoading, isFetching, isError, refetch } = useMiniAppListPayments(connectionId, {
    query: {
      queryKey: getMiniAppListPaymentsQueryKey(connectionId),
      enabled: !!connectionId && permissions?.payment !== false,
    },
  });

  useEffect(() => { if (data) saveCache(data); }, [data, saveCache]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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

  if (isLoading && !cachedData) return <View style={styles.centerFill}><ActivityIndicator color={colors.primary} /></View>;

  const displayData = data ?? cachedData ?? [];

  return (
    <FlatList
      data={displayData}
      keyExtractor={(item: MiniAppPayment & { source?: string }) => `${item.source ?? "cloud"}-${item.id}`}
      scrollEnabled={displayData.length > 0}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        lastUpdated || isFetching ? (
          <View style={styles.syncRow}>
            {isFetching && <SyncRing size={14} backgroundColor={colors.background} />}
            {lastUpdated && (
              <Text style={[styles.syncLabel, { color: colors.mutedForeground }]}>
                {isError ? "⚡ Offline · " : ""}Last synced {timeAgo(lastUpdated)}
              </Text>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.centerFill}>
          {isError ? (
            <Feather name="wifi-off" size={30} color={colors.mutedForeground} />
          ) : (
            <Feather name="credit-card" size={30} color={colors.mutedForeground} />
          )}
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {isError ? "Couldn\u2019t load payments" : "No payments yet"}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            Alert.alert(
              `Receipt ${item.paymentNumber}`,
              [
                `Date: ${new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
                `Amount: ₹${Number(item.amount).toLocaleString("en-IN")}`,
                `Mode: ${item.paymentMode}`,
                item.notes ? `Notes: ${item.notes}` : null,
              ].filter(Boolean).join("\n"),
            )
          }
          android_ripple={{ color: colors.border }}
          style={({ pressed }) => [
            styles.invoiceCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
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
        </Pressable>
      )}
    />
  );
}

interface StatementData { entries: MiniAppStatementEntry[]; closingBalance: number }

function StatementTab({
  connectionId,
  permissions,
}: {
  connectionId: number;
  permissions?: { statement?: boolean } | null;
}) {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const { cachedData, lastUpdated, saveCache } = useTabCache<StatementData>(`stmt_${connectionId}`);
  const { data, isLoading, isFetching, isError, refetch } = useMiniAppGetStatement(connectionId, {
    query: {
      queryKey: getMiniAppGetStatementQueryKey(connectionId),
      enabled: !!connectionId && permissions?.statement !== false,
    },
  });

  useEffect(() => { if (data) saveCache(data as StatementData); }, [data, saveCache]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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

  if (isLoading && !cachedData) return <View style={styles.centerFill}><ActivityIndicator color={colors.primary} /></View>;

  const displayData = (data ?? cachedData) as StatementData | undefined;
  const entries = displayData?.entries ?? [];
  const closing = displayData?.closingBalance ?? 0;

  return (
    <FlatList
      data={entries}
      keyExtractor={(item: MiniAppStatementEntry) => `${item.type}-${item.id}`}
      scrollEnabled={entries.length > 0}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          {lastUpdated || isFetching ? (
            <View style={styles.syncRow}>
              {isFetching && <SyncRing size={14} backgroundColor={colors.background} />}
              {lastUpdated && (
                <Text style={[styles.syncLabel, { color: colors.mutedForeground }]}>
                  {isError ? "⚡ Offline · " : ""}Last synced {timeAgo(lastUpdated)}
                </Text>
              )}
            </View>
          ) : null}
          {entries.length > 0 ? (
            <View style={[styles.statementHeader, { backgroundColor: closing > 0 ? "#fef9c3" : "#dcfce7", borderColor: closing > 0 ? "#fde047" : "#86efac" }]}>
              <Text style={[styles.invoiceDate, { color: colors.mutedForeground }]}>Outstanding Balance</Text>
              <Text style={[styles.invoiceAmount, { color: closing > 0 ? "#b45309" : "#16a34a", fontSize: 18 }]}>
                ₹{Math.abs(closing).toLocaleString("en-IN")} {closing > 0 ? "due" : closing < 0 ? "advance" : "clear"}
              </Text>
            </View>
          ) : null}
        </>
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

function GalleryGrid({ items, onPress }: { items: MiniAppGalleryShare[]; onPress: (imageId: number) => void }) {
  return (
    <View style={styles.galleryGrid}>
      {items.map((item) => (
        <Pressable key={item.imageId} onPress={() => onPress(item.imageId)} style={styles.galleryCell}>
          <Image source={{ uri: item.thumbnailUrl }} style={{ flex: 1, borderRadius: 8 }} resizeMode="cover" />
        </Pressable>
      ))}
    </View>
  );
}

function GalleryTab({
  connectionId,
  permissions,
}: {
  connectionId: number;
  permissions?: { gallery?: boolean } | null;
}) {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [viewerImageId, setViewerImageId] = useState<number | null>(null);
  const { cachedData, lastUpdated, saveCache } = useTabCache<MiniAppGalleryShare[]>(`gallery_${connectionId}`);
  const { data, isLoading, isFetching, isError, refetch } = useMiniAppListGallery(connectionId, {
    query: {
      queryKey: getMiniAppListGalleryQueryKey(connectionId),
      enabled: !!connectionId && permissions?.gallery !== false,
    },
  });

  useEffect(() => { if (data) saveCache(data); }, [data, saveCache]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (permissions?.gallery === false) {
    return (
      <View style={styles.centerFill}>
        <Feather name="lock" size={30} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Not shared with you
        </Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          This supplier hasn&apos;t enabled gallery sharing.
        </Text>
      </View>
    );
  }

  if (isLoading && !cachedData) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const displayData = (data ?? cachedData ?? []) as MiniAppGalleryShare[];
  const sharedItems = displayData.filter((i) => i.shared);
  const otherItems = displayData.filter((i) => !i.shared);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {(lastUpdated || isFetching) && (
          <View style={styles.syncRow}>
            {isFetching && <SyncRing size={14} backgroundColor={colors.background} />}
            {lastUpdated && (
              <Text style={[styles.syncLabel, { color: colors.mutedForeground }]}>
                {isError ? "⚡ Offline · " : ""}Last synced {timeAgo(lastUpdated)}
              </Text>
            )}
          </View>
        )}

        {displayData.length === 0 ? (
          <View style={styles.centerFill}>
            <Feather name={isError ? "wifi-off" : "image"} size={30} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {isError ? "Gallery load nahi hui" : "Abhi koi photo nahi hai"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isError
                ? "Internet check karke neeche kheench kar phir try karein."
                : "Your supplier will add product photos here."}
            </Text>
          </View>
        ) : (
          <>
            {sharedItems.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.gallerySectionTitle, { color: colors.foreground }]}>
                  Aapko bheji gayi ({sharedItems.length})
                </Text>
                <GalleryGrid items={sharedItems} onPress={setViewerImageId} />
              </View>
            )}
            {otherItems.length > 0 && (
              <View>
                <Text style={[styles.gallerySectionTitle, { color: colors.foreground }]}>
                  Is supplier ki aur photos ({otherItems.length})
                </Text>
                <GalleryGrid items={otherItems} onPress={setViewerImageId} />
              </View>
            )}
          </>
        )}
      </ScrollView>
      {viewerImageId != null && (
        <GalleryImageViewer connectionId={connectionId} imageId={viewerImageId} onClose={() => setViewerImageId(null)} />
      )}
    </>
  );
}

// Full-size image only downloads on tap, not upfront with the thumbnail list.
function GalleryImageViewer({ connectionId, imageId, onClose }: { connectionId: number; imageId: number; onClose: () => void }) {
  const colors = useColors();
  // Once an image has been opened successfully, its URL should stay
  // available offline forever after (the actual bytes are already cached
  // on-device by <Image> the first time it renders).
  const { cachedData, saveCache } = useTabCache<{ url: string }>(`gallery_full_${connectionId}_${imageId}`);
  const { data, isLoading, isError } = useMiniAppGetGalleryFull(connectionId, imageId);
  useEffect(() => { if (data?.url) saveCache(data); }, [data, saveCache]);
  const displayData = data ?? cachedData;
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      {/* Modal content renders in its own native window on Android/iOS —
          outside the app root's GestureHandlerRootView — so gesture-handler
          needs its own instance in here or pinch/pan/tap never register. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)" }}>
          <Pressable onPress={onClose} style={{ position: "absolute", top: 50, right: 20, zIndex: 1, padding: 8 }}>
            <Feather name="x" size={26} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {!displayData?.url && isLoading ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : !displayData?.url ? (
              <>
                <Feather name={isError ? "wifi-off" : "image"} size={30} color="#fff" />
                <Text style={{ color: "#fff", marginTop: 10, fontFamily: "Inter_500Medium" }}>
                  Photo load nahi hui
                </Text>
              </>
            ) : (
              <ZoomableImage uri={displayData.url} width={Dimensions.get("window").width} height={Dimensions.get("window").height * 0.8} />
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { borderBottomWidth: 1 },
  tabScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabPillOuter: { borderRadius: 999 },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
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
  syncRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  syncLabel: { fontSize: 11, fontFamily: "Inter_400Regular", opacity: 0.7 },
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
  gallerySectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap" },
  galleryCell: { width: "33.333%", aspectRatio: 1, padding: 2 },
  invoiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 1,
    overflow: "hidden",
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
