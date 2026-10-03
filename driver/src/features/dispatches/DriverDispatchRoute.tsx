import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoginScreen } from "../auth/LoginScreen";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../styles/theme";
import { DispatchesScreen } from "./DispatchesScreen";
import type { DispatchView } from "./dispatch-view";

interface DriverDispatchRouteProps {
  view: DispatchView;
}

export function DriverDispatchRoute({ view }: DriverDispatchRouteProps) {
  const { isInitializing, session } = useAuth();

  if (isInitializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {session ? <DispatchesScreen view={view} /> : <LoginScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", backgroundColor: colors.background, flex: 1, justifyContent: "center" },
  safeArea: { backgroundColor: colors.background, flex: 1 },
});
