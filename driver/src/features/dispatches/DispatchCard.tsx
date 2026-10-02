import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DriverDispatch, DriverDispatchStatus, DriverOrder } from "../../types/dispatch";
import { colors } from "../../styles/theme";

const STATUS_LABELS: Record<DriverDispatchStatus, string> = {
  preparing: "Preparing",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface DispatchCardProps {
  dispatch: DriverDispatch;
  onDeliver(order: DriverOrder): void;
  onReconcile(dispatch: DriverDispatch): void;
}

export function DispatchCard({ dispatch, onDeliver, onReconcile }: DispatchCardProps) {
  const pendingCount = dispatch.orders.filter((order) => order.status === "in_transit").length;
  const canReconcile = dispatch.status === "in_transit" && dispatch.orders.length > 0;
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.reference}>{dispatch.referenceNumber}</Text>
          <Text style={styles.van}>{dispatch.vanName}</Text>
        </View>
        <View style={[styles.badge, dispatch.status === "completed" && styles.completedBadge]}>
          <Text style={styles.badgeText}>{STATUS_LABELS[dispatch.status]}</Text>
        </View>
      </View>
      <Text style={styles.stopCount}>
        {pendingCount} pending · {dispatch.orders.length} total
      </Text>
      {dispatch.orders.map((order, index) => (
        <View key={order.id} style={[styles.stop, index > 0 && styles.stopBorder]}>
          <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{index + 1}</Text></View>
          <View style={styles.stopDetails}>
            <Text numberOfLines={1} style={styles.client}>{order.clientName}</Text>
            <Text numberOfLines={2} style={styles.address}>{order.clientAddress}</Text>
            <Text style={[styles.orderStatus, order.status === "delivered" && styles.deliveredStatus]}>
              {order.status === "in_transit" ? "Pending delivery" : formatStatus(order.status)}
            </Text>
            {order.status === "in_transit" && (
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18,
    borderWidth: 1, padding: 18, gap: 14,
  },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headingText: { flex: 1 },
  reference: { color: colors.text, fontSize: 18, fontWeight: "800" },
  van: { color: colors.textMuted, fontSize: 14, marginTop: 3 },
  badge: { backgroundColor: "#F3DEC0", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  completedBadge: { backgroundColor: "#D8EBDF" },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  stopCount: { color: colors.primary, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  stop: { flexDirection: "row", gap: 12, paddingTop: 2 },
  stopBorder: { borderTopColor: colors.surfaceMuted, borderTopWidth: 1, paddingTop: 14 },
  stopNumber: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: colors.surfaceMuted,
    alignItems: "center", justifyContent: "center",
  },
  stopNumberText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  stopDetails: { flex: 1 },
  client: { color: colors.text, fontSize: 15, fontWeight: "700" },
  address: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  orderStatus: { color: colors.warning, fontSize: 12, fontWeight: "800", marginTop: 7, textTransform: "uppercase" },
  deliveredStatus: { color: colors.success },
  deliverButton: {
    alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10,
    marginTop: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  deliverButtonPressed: { backgroundColor: colors.primaryPressed },
  deliverLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  endTripSection: { borderTopColor: colors.border, borderTopWidth: 1, gap: 7, paddingTop: 14 },
  endTripTitle: { color: colors.success, fontSize: 14, fontWeight: "800" },
  endTripBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  endTripButton: { alignSelf: "flex-start", backgroundColor: colors.success, borderRadius: 10, marginTop: 3, paddingHorizontal: 16, paddingVertical: 11 },
  endTripLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
