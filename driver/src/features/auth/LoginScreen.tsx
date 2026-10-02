import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../styles/theme";

export function LoginScreen() {
  const { signIn, configError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}><Text style={styles.brandLetter}>R</Text></View>
        <Text style={styles.eyebrow}>ROMANA OPERATIONS</Text>
        <Text style={styles.title}>Driver sign in</Text>
        <Text style={styles.intro}>View the dispatches and delivery stops assigned to you.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!isSubmitting && !configError}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="driver@example.com"
            placeholderTextColor="#91877D"
            style={styles.input}
            value={email}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="current-password"
            editable={!isSubmitting && !configError}
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            placeholder="Enter your password"
            placeholderTextColor="#91877D"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {(error || configError) && (
            <Text accessibilityRole="alert" style={styles.error}>{error ?? configError}</Text>
          )}
          <PrimaryButton
            disabled={!email.trim() || !password || Boolean(configError)}
            label="Sign in"
            loading={isSubmitting}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 48 },
  brandMark: {
    width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary, marginBottom: 24,
  },
  brandLetter: { color: "#FFFFFF", fontSize: 27, fontWeight: "800" },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: colors.text, fontSize: 34, fontWeight: "800", marginTop: 8 },
  intro: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 360 },
  form: { gap: 10, marginTop: 34 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 6 },
  input: {
    minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: colors.surface, color: colors.text, fontSize: 16, paddingHorizontal: 16,
  },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginVertical: 4 },
});
