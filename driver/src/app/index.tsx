import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoginScreen } from "../features/auth/LoginScreen";
import { DispatchesScreen } from "../features/dispatches/DispatchesScreen";
import { useAuth } from "../providers/AuthProvider";
import { colors } from "../styles/theme";

export default function HomeRoute() {
  const { isInitializing, session } = useAuth();
  if (isInitializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return <SafeAreaView style={styles.safeArea}>{session ? <DispatchesScreen /> : <LoginScreen />}</SafeAreaView>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  safeArea: { flex: 1, backgroundColor: colors.background },
});
