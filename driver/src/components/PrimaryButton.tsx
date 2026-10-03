import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts } from "../styles/theme";

interface PrimaryButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress(): void;
}

export function PrimaryButton({ label, loading = false, disabled = false, onPress }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, isDisabled && styles.disabled]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
  },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.55 },
  label: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16 },
});
