import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { reconcileDriverTrip } from "../../services/driver-api";
import { colors, fonts } from "../../styles/theme";
import type { DispatchReconciliationInput, DriverDispatch } from "../../types/dispatch";

interface Props {
  accessToken: string;
  apiUrl: string;
  dispatch: DriverDispatch | null;
  onClose(): void;
  onSubmitted(): void;
}

interface InventoryDraft {
  productVariantId: string;
  label: string;
  returnedQuantity: number;
  damaged: string;
  missing: string;
}

export function TripReconciliationModal(props: Props) {
  if (!props.dispatch) return null;
  return <TripReconciliationForm {...props} dispatch={props.dispatch} key={props.dispatch.id} />;
}

function TripReconciliationForm({ accessToken, apiUrl, dispatch, onClose, onSubmitted }: Omit<Props, "dispatch"> & { dispatch: DriverDispatch }) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [inventory, setInventory] = useState<InventoryDraft[]>(() => buildInventory(dispatch));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const failedOrders = dispatch.orders.filter((order) => order.status === "in_transit");
  const deliveredOrders = dispatch.orders.filter((order) => order.status === "delivered" || order.status === "successful");
  const remaining = inventory.reduce((sum, item) => sum + Math.max(0, item.returnedQuantity - numberValue(item.damaged) - numberValue(item.missing)), 0);
  const valid = failedOrders.every((order) => reasons[order.id]?.trim())
    && inventory.every((item) => numberValue(item.damaged) + numberValue(item.missing) <= item.returnedQuantity);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await reconcileDriverTrip(apiUrl, accessToken, dispatch.id, buildInput(dispatch, reasons, inventory, notes));
      onSubmitted();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The reconciliation could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}><Text style={styles.eyebrow}>TRIP RECONCILIATION</Text><Text style={styles.title}>{dispatch.referenceNumber}</Text></View>
          <Pressable accessibilityRole="button" disabled={submitting} onPress={onClose}><Text style={styles.close}>Close</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Summary label="Delivered orders" value={deliveredOrders.length} />
          <Summary label="Failed / undelivered orders" value={failedOrders.length} />
          <Summary label="Remaining inventory (calculated)" value={remaining} />

          <SectionTitle>Delivery outcomes</SectionTitle>
          {dispatch.orders.map((order) => {
            const failed = order.status === "in_transit";
            return <View key={order.id} style={styles.panel}>
              <View style={styles.row}><Text style={styles.panelTitle}>{order.referenceNumber}</Text><Text style={[styles.outcome, failed ? styles.failed : styles.delivered]}>{failed ? "FAILED" : "DELIVERED"}</Text></View>
              <Text style={styles.muted}>{order.clientName}</Text>
              {failed && <Field label="Reason for failed delivery">
                <TextInput maxLength={500} multiline placeholder="Required" value={reasons[order.id] ?? ""} onChangeText={(value) => setReasons((current) => ({ ...current, [order.id]: value }))} style={[styles.input, styles.textarea]} />
              </Field>}
            </View>;
          })}

          <SectionTitle>Returned, damaged, and missing items</SectionTitle>
          {inventory.length === 0 ? <Text style={styles.muted}>No items are returning from failed deliveries.</Text> : inventory.map((item, index) => (
            <View key={item.productVariantId} style={styles.panel}>
              <Text style={styles.panelTitle}>{item.label}</Text>
              <Text style={styles.muted}>{item.returnedQuantity} returned · {Math.max(0, item.returnedQuantity - numberValue(item.damaged) - numberValue(item.missing))} remaining</Text>
              <View style={styles.quantityRow}>
                <Field label="Damaged"><TextInput keyboardType="number-pad" value={item.damaged} onChangeText={(value) => updateInventory(setInventory, index, "damaged", value)} style={styles.input} /></Field>
                <Field label="Missing"><TextInput keyboardType="number-pad" value={item.missing} onChangeText={(value) => updateInventory(setInventory, index, "missing", value)} style={styles.input} /></Field>
              </View>
              {numberValue(item.damaged) + numberValue(item.missing) > item.returnedQuantity && <Text style={styles.error}>Exceptions cannot exceed returned quantity.</Text>}
            </View>
          ))}
          <Field label="Driver notes"><TextInput maxLength={1000} multiline value={notes} onChangeText={setNotes} style={[styles.input, styles.textarea]} /></Field>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={!valid || submitting} onPress={() => void submit()} style={[styles.submit, (!valid || submitting) && styles.disabled]}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitLabel}>Submit reconciliation and end trip</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function buildInventory(dispatch: DriverDispatch | null): InventoryDraft[] {
  const items = new Map<string, InventoryDraft>();
  dispatch?.orders.filter((order) => order.status === "in_transit").flatMap((order) => order.items).forEach((item) => {
    const saved = items.get(item.productVariantId);
    if (saved) saved.returnedQuantity += item.quantity;
    else items.set(item.productVariantId, { productVariantId: item.productVariantId, label: `${item.productTitle} · ${item.variantLabel}`, returnedQuantity: item.quantity, damaged: "0", missing: "0" });
  });
  return [...items.values()];
}

function buildInput(dispatch: DriverDispatch, reasons: Record<string, string>, inventory: InventoryDraft[], notes: string): DispatchReconciliationInput {
  return {
    orders: dispatch.orders.map((order) => ({ orderId: order.id, outcome: order.status === "in_transit" ? "failed" : "delivered", failureReason: reasons[order.id]?.trim() ?? "" })),
    exceptions: inventory.filter((item) => numberValue(item.damaged) + numberValue(item.missing) > 0).map((item) => ({ productVariantId: item.productVariantId, damagedQuantity: numberValue(item.damaged), missingQuantity: numberValue(item.missing), notes: "" })),
    notes: notes.trim(),
  };
}

function updateInventory(setter: React.Dispatch<React.SetStateAction<InventoryDraft[]>>, index: number, field: "damaged" | "missing", value: string) {
  setter((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value.replace(/\D/g, "") } : item));
}
function numberValue(value: string): number { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0; }
function Summary({ label, value }: { label: string; value: number }) { return <View style={styles.summary}><Text style={styles.muted}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>; }
function SectionTitle({ children }: { children: string }) { return <Text style={styles.sectionTitle}>{children}</Text>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, header: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", padding: 20 }, headerText: { flex: 1 },
  eyebrow: { color: colors.primary, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.2 }, title: { color: colors.text, fontFamily: fonts.display, fontSize: 29, marginTop: 3 }, close: { color: colors.primary, fontFamily: fonts.extraBold, padding: 8 }, content: { gap: 12, padding: 20, paddingBottom: 44 },
  summary: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 14 }, summaryValue: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 18 },
  sectionTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17, marginTop: 14 }, panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 15 }, row: { alignItems: "center", flexDirection: "row", gap: 10 }, panelTitle: { color: colors.text, flex: 1, fontFamily: fonts.extraBold, fontSize: 14 }, outcome: { fontFamily: fonts.extraBold, fontSize: 11 }, delivered: { color: colors.success }, failed: { color: colors.danger }, muted: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  field: { flex: 1, gap: 6, marginTop: 11 }, label: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 }, input: { backgroundColor: "#FFFFFF", borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 }, textarea: { minHeight: 76, textAlignVertical: "top" }, quantityRow: { flexDirection: "row", gap: 12 }, error: { color: colors.danger, fontFamily: fonts.semiBold, fontSize: 12, marginTop: 8 }, submit: { alignItems: "center", backgroundColor: colors.success, borderRadius: 12, minHeight: 50, justifyContent: "center", marginTop: 12, padding: 14 }, submitLabel: { color: "#FFFFFF", fontFamily: fonts.extraBold, fontSize: 14, textAlign: "center" }, disabled: { opacity: 0.5 },
});
