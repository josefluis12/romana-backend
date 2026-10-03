import { useState } from "react";
import * as Location from "expo-location";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SignaturePad } from "../../components/SignaturePad";
import { completeDriverDelivery } from "../../services/driver-api";
import { colors, fonts } from "../../styles/theme";
import type { DriverOrder, PaymentMode, SignaturePoint } from "../../types/dispatch";
import { getCompleteSignatureStrokes } from "./delivery-signature";
import { parseCollectedAmount } from "./delivery-payment";

const paymentModes: { label: string; value: PaymentMode }[] = [
  { label: "Cash", value: "cash" },
  { label: "GCash", value: "gcash" },
  { label: "Maya", value: "maya" },
  { label: "Bank transfer", value: "bank_transfer" },
  { label: "Cheque", value: "cheque" },
];

interface DeliveryConfirmationModalProps {
  apiUrl: string;
  accessToken: string;
  order: DriverOrder | null;
  onClose(): void;
  onDelivered(): void;
}

export function DeliveryConfirmationModal(props: DeliveryConfirmationModalProps) {
  const { apiUrl, accessToken, order, onClose, onDelivered } = props;
  const [strokes, setStrokes] = useState<SignaturePoint[][]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [collectedAmount, setCollectedAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const close = () => {
    if (isSaving) return;
    setStrokes([]);
    setPaymentMode(null);
    setCollectedAmount("");
    setError(null);
    setIsSigning(false);
    onClose();
  };

  const deliver = async () => {
    const signature = getCompleteSignatureStrokes(strokes);
    if (!order || signature.length === 0) {
      setError("Ask the client to provide a signature.");
      return;
    }
    if (!paymentMode) {
      setError("Select how the client paid.");
      return;
    }
    const amount = parseCollectedAmount(collectedAmount);
    if (amount === null) {
      setError("Enter a valid amount collected.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location access is required to record where the delivery was signed.");
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await completeDriverDelivery(apiUrl, accessToken, order.id, {
        signature,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? 0,
        paymentMode,
        collectedAmount: amount,
      });
      setStrokes([]);
      setPaymentMode(null);
      setCollectedAmount("");
      setIsSigning(false);
      onDelivered();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The delivery could not be completed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={close} transparent visible={order !== null}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={!isSigning}>
            <View style={styles.headingRow}>
              <View style={styles.headingText}>
                <Text style={styles.eyebrow}>PROOF OF DELIVERY</Text>
                <Text style={styles.title}>Confirm delivery</Text>
              </View>
              <Pressable accessibilityLabel="Close delivery confirmation" accessibilityRole="button" disabled={isSaving} onPress={close}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.orderSummary}>
              <Text style={styles.client}>{order?.clientName}</Text>
              <Text style={styles.reference}>{order?.referenceNumber}</Text>
              <Text style={styles.address}>{order?.clientAddress}</Text>
            </View>
            <Text style={styles.label}>Amount collected</Text>
            <Text style={styles.amountHint}>Order total: ₱{order?.total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <View style={styles.amountField}>
              <Text style={styles.currency}>₱</Text>
              <TextInput
                accessibilityLabel="Amount collected"
                editable={!isSaving}
                keyboardType="decimal-pad"
                onChangeText={setCollectedAmount}
                placeholder="0.00"
                style={styles.amountInput}
                value={collectedAmount}
              />
            </View>
            <Text style={styles.label}>Mode of payment</Text>
            <View accessibilityRole="radiogroup" style={styles.paymentModes}>
              {paymentModes.map((mode) => {
                const selected = paymentMode === mode.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={isSaving}
                    key={mode.value}
                    onPress={() => setPaymentMode(mode.value)}
                    style={({ pressed }) => [
                      styles.paymentMode,
                      selected && styles.paymentModeSelected,
                      pressed && styles.paymentModePressed,
                    ]}
                  >
                    <Text style={[styles.paymentModeText, selected && styles.paymentModeTextSelected]}>{mode.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Client signature</Text>
            <SignaturePad onChange={setStrokes} onSigningChange={setIsSigning} strokes={strokes} />
            <Pressable disabled={isSaving || strokes.length === 0} onPress={() => setStrokes([])}>
              <Text style={[styles.clear, strokes.length === 0 && styles.disabledText]}>Clear signature</Text>
            </Pressable>
            <Text style={styles.disclosure}>
              When you mark this delivered, the amount, payment mode, client signature, and your current GPS coordinates will be saved as delivery proof.
            </Text>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <PrimaryButton disabled={getCompleteSignatureStrokes(strokes).length === 0 || paymentMode === null || parseCollectedAmount(collectedAmount) === null} label="Mark as delivered" loading={isSaving} onPress={() => void deliver()} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(32,32,30,0.42)" },
  sheet: { maxHeight: "94%", backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  content: { padding: 20, paddingBottom: 36, gap: 14 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  headingText: { flex: 1 },
  eyebrow: { color: colors.primary, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, marginTop: 4 },
  close: { color: colors.primary, fontFamily: fonts.extraBold, fontSize: 14, paddingVertical: 5 },
  orderSummary: { backgroundColor: colors.surfaceMuted, borderRadius: 14, padding: 14 },
  client: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  reference: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13, marginTop: 3 },
  address: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: 5 },
  label: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 14, marginTop: 2 },
  amountHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: -8 },
  amountField: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", minHeight: 50, paddingHorizontal: 14 },
  currency: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16, marginRight: 8 },
  amountInput: { color: colors.text, flex: 1, fontFamily: fonts.bold, fontSize: 16, paddingVertical: 12 },
  paymentModes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentMode: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  paymentModeSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  paymentModePressed: { opacity: 0.72 },
  paymentModeText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  paymentModeTextSelected: { color: colors.surface },
  clear: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14, textAlign: "right" },
  disabledText: { opacity: 0.45 },
  disclosure: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 19 },
});
