import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../styles/theme";
import type { DriverDispatch } from "../../types/dispatch";

interface Props {
  accessToken: string;
  apiUrl: string;
  dispatch: DriverDispatch;
  disabled: boolean;
  onOpenRoute: () => void;
}

export function DispatchCoverageMap({ accessToken, apiUrl, dispatch, disabled, onOpenRoute }: Props) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const revision = dispatch.orders.map((order) => `${order.id}:${order.status}`).join(",");
  const uri = `${apiUrl}/api/driver/dispatches/${encodeURIComponent(dispatch.id)}/map?revision=${encodeURIComponent(revision)}&attempt=${attempt}`;

  const handleMapPress = () => {
    if (failed) {
      setFailed(false);
      setAttempt((value) => value + 1);
      return;
    }
    onOpenRoute();
  };

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Delivery coverage</Text>
          <Text style={styles.subtitle}>{disabled ? "Route is unavailable while updating or after all stops close" : "Tap the map to open the optimized route"}</Text>
        </View>
        <View style={styles.legend}>
          <Legend color={colors.warning} label="Pending" />
          <Legend color={colors.success} label="Done" />
          <Legend color={colors.danger} label="Exception" />
        </View>
      </View>
      <Pressable accessibilityHint={failed ? "Retries the delivery coverage map" : "Calculates the best stop order and opens Google Maps"} accessibilityRole="button" disabled={disabled && !failed} onPress={handleMapPress} style={({ pressed }) => [styles.mapFrame, pressed && styles.pressed, disabled && !failed && styles.disabled]}>
        {!failed ? (
          <Image
            accessibilityLabel={`Map of ${dispatch.orders.length} delivery stops`}
            onError={() => setFailed(true)}
            resizeMode="cover"
            source={{ uri, headers: { Accept: "image/png", Authorization: `Bearer ${accessToken}` }, cache: "reload" }}
            style={styles.map}
          />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackTitle}>Coverage map unavailable</Text>
            <Text style={styles.fallbackBody}>Tap here to try loading the map again.</Text>
          </View>
        )}
      </Pressable>
      {dispatch.orders.length > 15 && <Text style={styles.note}>The map shows the first 15 stops. Google Maps opens the optimized navigation set.</Text>}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  titleRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 14 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  legend: { alignItems: "flex-end", gap: 3 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 5 },
  dot: { borderRadius: 999, height: 8, width: 8 },
  legendText: { color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 10 },
  mapFrame: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 14, borderWidth: 1, height: 190, overflow: "hidden" },
  map: { height: "100%", width: "100%" },
  fallback: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  fallbackTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  fallbackBody: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: "center" },
  note: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 14 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
});
