import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../providers/AuthProvider";
import { fetchDriverDispatches } from "../../services/driver-api";
import { colors } from "../../styles/theme";
import type { DriverDispatch, DriverOrder } from "../../types/dispatch";
import { DispatchCard } from "./DispatchCard";
import { DeliveryConfirmationModal } from "./DeliveryConfirmationModal";
import { TripReconciliationModal } from "./TripReconciliationModal";

export function DispatchesScreen() {
  const { config, session, signOut } = useAuth();
  const [dispatches, setDispatches] = useState<DriverDispatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DriverOrder | null>(null);
  const [reconcilingDispatch, setReconcilingDispatch] = useState<DriverDispatch | null>(null);

  const load = useCallback(async (refreshing = false) => {
    if (!config || !session) return;
    if (refreshing) setIsRefreshing(true);
    try {
      setDispatches(await fetchDriverDispatches(config.apiUrl, session.access_token));
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Assigned dispatches are unavailable.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [config, session]);

  useEffect(() => {
    if (!config || !session) return;
    let isActive = true;
    void fetchDriverDispatches(config.apiUrl, session.access_token)
      .then((assignedDispatches) => {
        if (isActive) {
          setDispatches(assignedDispatches);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (isActive) {
          setError(caught instanceof Error ? caught.message : "Assigned dispatches are unavailable.");
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => { isActive = false; };
  }, [config, session]);

  const pendingCount = dispatches.reduce(
    (count, dispatch) => count + dispatch.orders.filter((order) => order.status === "in_transit").length,
    0,
  );

  const handleDelivered = () => {
    setSelectedOrder(null);
    void load(true);
  };

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={[styles.content, dispatches.length === 0 && styles.emptyContent]}
        data={dispatches}
        keyExtractor={(dispatch) => dispatch.id}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>{"TODAY'S ROUTE"}</Text>
              <Text style={styles.title}>My dispatches</Text>
              <Text style={styles.pending}>{pendingCount} {pendingCount === 1 ? "pending delivery" : "pending deliveries"}</Text>
              <Text numberOfLines={1} style={styles.email}>{session?.user.email}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void signOut()} hitSlop={10}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            {isLoading ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              <>
                <Text style={styles.emptyTitle}>{error ? "Could not load dispatches" : "No dispatches assigned"}</Text>
                <Text accessibilityRole={error ? "alert" : undefined} style={styles.emptyBody}>
                  {error ?? "New assignments will appear here when an administrator adds you to a dispatch."}
                </Text>
                {error && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { setIsLoading(true); void load(); }}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryLabel}>Try again</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={(
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />
        )}
        renderItem={({ item }) => (
          <DispatchCard
            dispatch={item}
            onDeliver={setSelectedOrder}
            onReconcile={setReconcilingDispatch}
          />
        )}
      />
      {config && session && (
        <DeliveryConfirmationModal
          accessToken={session.access_token}
          apiUrl={config.apiUrl}
          onClose={() => setSelectedOrder(null)}
          onDelivered={handleDelivered}
          order={selectedOrder}
        />
      )}
      {config && session && <TripReconciliationModal accessToken={session.access_token} apiUrl={config.apiUrl} dispatch={reconcilingDispatch} onClose={() => setReconcilingDispatch(null)} onSubmitted={() => { setReconcilingDispatch(null); void load(true); }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  emptyContent: { flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 28, gap: 16 },
  headerText: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 5 },
  pending: { color: colors.warning, fontSize: 13, fontWeight: "800", marginTop: 5 },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 5 },
  signOut: { color: colors.primary, fontSize: 14, fontWeight: "800", paddingVertical: 5 },
  separator: { height: 14 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 80 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptyBody: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  retryButton: { backgroundColor: colors.primary, borderRadius: 12, marginTop: 20, paddingHorizontal: 20, paddingVertical: 13 },
  retryLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
