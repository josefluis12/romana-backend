import { useState } from "react";
import {
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../providers/AuthProvider";
import { colors, fonts } from "../../styles/theme";

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
        <Image
          accessibilityLabel="Romana Peanut Brittle"
          resizeMode="contain"
          source={require("../../../assets/romana-logo.png")}
          style={styles.logo}
        />
        <Text style={styles.eyebrow}>ROMANA DRIVER</Text>
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
  logo: { width: 178, height: 114, marginBottom: 22 },
  eyebrow: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 42, marginTop: 8 },
  intro: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 360 },
  form: { gap: 10, marginTop: 34 },
  label: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, marginTop: 6 },
  input: {
    minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.regular, fontSize: 16, paddingHorizontal: 16,
  },
  error: { color: colors.danger, fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 20, marginVertical: 4 },
});
