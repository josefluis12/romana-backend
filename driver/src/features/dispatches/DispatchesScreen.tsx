import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../providers/AuthProvider";
import { fetchDriverDispatches, fetchOptimizedDriverRoute, startDriverTrip } from "../../services/driver-api";
import { colors, fonts } from "../../styles/theme";
import type { DriverDispatch, DriverOrder } from "../../types/dispatch";
import { DispatchCard } from "./DispatchCard";
import { DeliveryConfirmationModal } from "./DeliveryConfirmationModal";
import { TripReconciliationModal } from "./TripReconciliationModal";
import { filterDispatchesByView, type DispatchView } from "./dispatch-view";

interface DispatchesScreenProps {
  view: DispatchView;
}

export function DispatchesScreen({ view }: DispatchesScreenProps) {
  const { config, session, signOut } = useAuth();
  const [dispatches, setDispatches] = useState<DriverDispatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startingDispatchId, setStartingDispatchId] = useState<string | null>(null);
  const [navigatingDispatchId, setNavigatingDispatchId] = useState<string | null>(null);
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

  const visibleDispatches = filterDispatchesByView(dispatches, view);
  const pendingCount = visibleDispatches.reduce(
    (count, dispatch) => count + (dispatch.status === "ready_for_departure"
      ? dispatch.orders.length
      : dispatch.orders.filter((order) => order.status === "in_transit").length),
    0,
  );

  const handleDelivered = () => {
    setSelectedOrder(null);
    void load(true);
  };

  const handleStartTrip = async (dispatch: DriverDispatch) => {
    if (!config || !session || startingDispatchId) return;
    setStartingDispatchId(dispatch.id);
    setError(null);
    try {
      await startDriverTrip(config.apiUrl, session.access_token, dispatch.id);
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The trip could not be started.");
    } finally {
      setStartingDispatchId(null);
    }
  };

  const handleOpenRoute = async (dispatch: DriverDispatch) => {
    if (!config || !session || navigatingDispatchId) return;
    setNavigatingDispatchId(dispatch.id);
    setError(null);
    try {
      const route = await fetchOptimizedDriverRoute(config.apiUrl, session.access_token, dispatch.id);
      await Linking.openURL(route.googleMapsUrl);
      if (route.omittedStopCount > 0) setError(`${route.omittedStopCount} additional stop${route.omittedStopCount === 1 ? " was" : "s were"} not included because Google Maps supports a limited number of navigation waypoints.`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The best route could not be opened.");
    } finally {
      setNavigatingDispatchId(null);
    }
  };

  const handleOpenOrderMap = async (order: DriverOrder) => {
    setError(null);
    try {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.clientAddress)}`;
      await Linking.openURL(url);
    } catch {
      setError("This delivery address could not be opened in Google Maps.");
    }
  };

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={[styles.content, visibleDispatches.length === 0 && styles.emptyContent]}
        data={visibleDispatches}
        key={view}
        keyExtractor={(dispatch) => dispatch.id}
        ListHeaderComponent={(
          <View>
            <View style={styles.brandRow}>
              <Image
                accessibilityLabel="Romana Peanut Brittle"
                resizeMode="contain"
                source={require("../../../assets/romana-logo.png")}
                style={styles.logo}
              />
              <Pressable accessibilityRole="button" onPress={() => void signOut()} hitSlop={10}>
                <Text style={styles.signOut}>Sign out</Text>
              </Pressable>
            </View>
            <View accessibilityRole="tablist" style={styles.navigation}>
              <NavigationLink active={view === "active"} href="/" label="Current trip" />
              <NavigationLink active={view === "history"} href="/history" label="History" />
            </View>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>{view === "active" ? "ACTIVE ASSIGNMENT" : "PAST ASSIGNMENTS"}</Text>
                <Text style={styles.title}>{view === "active" ? "Current trip" : "Trip history"}</Text>
                {view === "active" && (
                  <Text style={styles.pending}>{pendingCount} {pendingCount === 1 ? "pending delivery" : "pending deliveries"}</Text>
                )}
                <Text numberOfLines={1} style={styles.email}>{session?.user.email}</Text>
                {error && visibleDispatches.length > 0 && (
                  <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            {isLoading ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  {error ? "Could not load dispatches" : view === "active" ? "No active trip" : "No trip history yet"}
                </Text>
                <Text accessibilityRole={error ? "alert" : undefined} style={styles.emptyBody}>
                  {error ?? (view === "active"
                    ? "Your next assignment will appear here when an administrator starts a dispatch."
                    : "Completed and cancelled trips will appear here.")}
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
            accessToken={session?.access_token || ""}
            apiUrl={config?.apiUrl || ""}
            dispatch={item}
            interactive={view === "active"}
            isNavigating={navigatingDispatchId === item.id}
            isStarting={startingDispatchId === item.id}
            onDeliver={setSelectedOrder}
            onOpenOrderMap={(order) => void handleOpenOrderMap(order)}
            onReconcile={setReconcilingDispatch}
            onNavigate={(dispatch) => void handleOpenRoute(dispatch)}
            onStart={(dispatch) => void handleStartTrip(dispatch)}
            showDate={view === "history"}
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

function NavigationLink(props: { active: boolean; href: "/" | "/history"; label: string }) {
  return (
    <Link href={props.href} replace asChild>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: props.active }}
        style={StyleSheet.flatten([styles.navigationLink, props.active && styles.navigationLinkActive])}
      >
        <Text style={[styles.navigationLabel, props.active && styles.navigationLabelActive]}>{props.label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  emptyContent: { flexGrow: 1 },
  brandRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  logo: { height: 58, width: 92 },
  navigation: { backgroundColor: colors.surfaceMuted, borderRadius: 12, flexDirection: "row", marginBottom: 26, padding: 4 },
  navigationLink: { alignItems: "center", borderRadius: 9, flex: 1, minHeight: 42, justifyContent: "center", paddingHorizontal: 12 },
  navigationLinkActive: { backgroundColor: colors.surface },
  navigationLabel: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 13 },
  navigationLabelActive: { color: colors.primary },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 28, gap: 16 },
  headerText: { flex: 1 },
  eyebrow: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.5 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 38, marginTop: 5 },
  pending: { color: colors.warning, fontFamily: fonts.bold, fontSize: 13, marginTop: 5 },
  email: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: 5 },
  inlineError: { color: colors.danger, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18, marginTop: 10 },
  signOut: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14, paddingVertical: 5 },
  separator: { height: 14 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 80 },
  emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 26, textAlign: "center" },
  emptyBody: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  retryButton: { backgroundColor: colors.primary, borderRadius: 12, marginTop: 20, paddingHorizontal: 20, paddingVertical: 13 },
  retryLabel: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 14 },
});
