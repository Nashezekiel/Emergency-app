import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";

export default function Index() {
  const { user, loading, isAuthenticated } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  // If not authenticated, redirect to the dev login page (or auth implementation)
  if (!isAuthenticated || !user) {
    return <Redirect href="/dev/login" />;
  }

  // Redirect based on role
  if (user.role === "admin" || user.userRole === "responder") {
    return <Redirect href="/responder-dashboard" />;
  }

  // Default civilian view
  return <Redirect href="/(tabs)" />;
}
