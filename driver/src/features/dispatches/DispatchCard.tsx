import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { DriverDispatch, DriverDispatchStatus, DriverOrder } from "../../types/dispatch";
import { colors, fonts } from "../../styles/theme";
import { DispatchCoverageMap } from "./DispatchCoverageMap";

const STATUS_LABELS: Record<DriverDispatchStatus, string> = {
  preparing: "Preparing",
  ready_for_departure: "Ready",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface DispatchCardProps {
  dispatch: DriverDispatch;
  accessToken: string;
  apiUrl: string;
  interactive: boolean;
  isNavigating: boolean;
  isStarting: boolean;
  onDeliver(order: DriverOrder): void;
  onReconcile(dispatch: DriverDispatch): void;
  onStart(dispatch: DriverDispatch): void;
  onNavigate(dispatch: DriverDispatch): void;
  showDate: boolean;
}

export function DispatchCard({ accessToken, apiUrl, dispatch, interactive, isNavigating, isStarting, onDeliver, onNavigate, onReconcile, onStart, showDate }: DispatchCardProps) {
  const pendingCount = dispatch.status === "ready_for_departure"
    ? dispatch.orders.length
    : dispatch.orders.filter((order) => order.status === "in_transit").length;
  const canStart = interactive && dispatch.status === "ready_for_departure";
  const canReconcile = interactive && dispatch.status === "in_transit" && dispatch.orders.length > 0;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityHint={interactive ? "Opens the optimized dispatch route in Google Maps" : undefined}
        accessibilityRole={interactive ? "button" : undefined}
        disabled={!interactive || isNavigating || !dispatch.orders.length}
        onPress={() => onNavigate(dispatch)}
        style={({ pressed }) => [styles.headingRow, pressed && styles.headingPressed]}
      >
        <View style={styles.headingText}>
          <Text style={styles.reference}>{dispatch.referenceNumber}</Text>
          <Text style={styles.van}>{dispatch.vanName}</Text>
          {showDate && <Text style={styles.date}>{formatDispatchDate(dispatch.createdAt)}</Text>}
        </View>
        <View style={[styles.badge, dispatch.status === "completed" && styles.completedBadge]}>
          <Text style={styles.badgeText}>{STATUS_LABELS[dispatch.status]}</Text>
        </View>
      </Pressable>
      <Text style={styles.stopCount}>
        {pendingCount} {interactive ? "pending" : "undelivered"} · {dispatch.orders.length} total
      </Text>
      {interactive && dispatch.orders.length > 0 && (
        <DispatchCoverageMap
          accessToken={accessToken}
          apiUrl={apiUrl}
          dispatch={dispatch}
          disabled={isNavigating}
          onOpenRoute={() => onNavigate(dispatch)}
        />
      )}
      {canStart && (
        <View style={styles.startSection}>
          <Text style={styles.startTitle}>Ready to leave?</Text>
          <Text style={styles.startBody}>Start the trip when the van is loaded and you are departing.</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isStarting}
            onPress={() => onStart(dispatch)}
            style={({ pressed }) => [styles.startButton, pressed && styles.deliverButtonPressed, isStarting && styles.disabled]}
          >
            {isStarting
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.startLabel}>Start trip</Text>}
          </Pressable>
        </View>
      )}
      {dispatch.orders.map((order, index) => (
        <View key={order.id} style={[styles.stop, index > 0 && styles.stopBorder]}>
          <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{index + 1}</Text></View>
          <View style={styles.stopDetails}>
            <Text numberOfLines={1} style={styles.client}>{order.clientName}</Text>
            <Text numberOfLines={2} style={styles.address}>{order.clientAddress}</Text>
            <Text style={[styles.orderStatus, order.status === "delivered" && styles.deliveredStatus]}>
              {order.status === "in_transit"
                ? interactive ? "Pending delivery" : "Not delivered"
                : formatStatus(order.status)}
            </Text>
            {interactive && order.status === "in_transit" && (
              <Pressable
                accessibilityHint="Opens signature capture for this client"
                accessibilityRole="button"
                onPress={() => onDeliver(order)}
                style={({ pressed }) => [styles.deliverButton, pressed && styles.deliverButtonPressed]}
              >
                <Text style={styles.deliverLabel}>Deliver this order</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
      {canReconcile && (
        <View style={styles.endTripSection}>
          <Text style={styles.endTripTitle}>Trip consolidation</Text>
          <Text style={styles.endTripBody}>Review delivered and failed orders, payments, returns, and inventory before submitting to admin.</Text>
          <Pressable accessibilityHint="Opens the trip reconciliation" accessibilityRole="button" onPress={() => onReconcile(dispatch)} style={({ pressed }) => [styles.endTripButton, pressed && styles.deliverButtonPressed]}>
            <Text style={styles.endTripLabel}>Consolidate orders</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDispatchDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18,
    borderWidth: 1, padding: 18, gap: 14,
  },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headingPressed: { opacity: 0.72 },
  headingText: { flex: 1 },
  reference: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  van: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, marginTop: 3 },
  date: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 3 },
  badge: { backgroundColor: "#FFF0C7", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  completedBadge: { backgroundColor: "#DFF2E5" },
  badgeText: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  stopCount: { color: colors.primary, fontFamily: fonts.extraBold, fontSize: 13, textTransform: "uppercase" },
  stop: { flexDirection: "row", gap: 12, paddingTop: 2 },
  stopBorder: { borderTopColor: colors.surfaceMuted, borderTopWidth: 1, paddingTop: 14 },
  stopNumber: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: colors.surfaceMuted,
    alignItems: "center", justifyContent: "center",
  },
  stopNumberText: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 13 },
  stopDetails: { flex: 1 },
  client: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  address: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginTop: 3 },
  orderStatus: { color: colors.warning, fontFamily: fonts.extraBold, fontSize: 12, marginTop: 7, textTransform: "uppercase" },
  deliveredStatus: { color: colors.success },
  startSection: { backgroundColor: colors.surfaceMuted, borderRadius: 12, gap: 6, padding: 14 },
  startTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 15 },
  startBody: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  startButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", marginTop: 4, minHeight: 42, minWidth: 112, paddingHorizontal: 16 },
  startLabel: { color: "#FFFFFF", fontFamily: fonts.extraBold, fontSize: 13 },
  disabled: { opacity: 0.55 },
  deliverButton: {
    alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10,
    marginTop: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  deliverButtonPressed: { backgroundColor: colors.primaryPressed },
  deliverLabel: { color: "#FFFFFF", fontFamily: fonts.extraBold, fontSize: 13 },
  endTripSection: { borderTopColor: colors.border, borderTopWidth: 1, gap: 7, paddingTop: 14 },
  endTripTitle: { color: colors.success, fontFamily: fonts.extraBold, fontSize: 14 },
  endTripBody: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  endTripButton: { alignSelf: "flex-start", backgroundColor: colors.success, borderRadius: 10, marginTop: 3, paddingHorizontal: 16, paddingVertical: 11 },
  endTripLabel: { color: "#FFFFFF", fontFamily: fonts.extraBold, fontSize: 13 },
});
