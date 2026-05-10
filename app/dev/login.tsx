import { View, Text, Pressable, ActivityIndicator, TextInput, ScrollView, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import * as Auth from "@/lib/_core/auth";
import { removeSessionToken, clearUserInfo } from "@/lib/_core/auth";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [userRole, setUserRole] = useState<"civilian" | "responder">("civilian");
  
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.success) {
        // Use btoa safely or fallback to raw string if environment lacks it
        const authTicket = `${email}:${password}`;
        const mockToken = typeof btoa !== "undefined" ? btoa(authTicket) : `raw:${authTicket}`;
        
        await Auth.setSessionToken(mockToken);
        await Auth.setUserInfo({
          ...result.user,
          loginMethod: "email",
          role: result.user.role as any,
          userRole: result.user.userRole as any,
          lastSignedIn: new Date(result.user.lastSignedIn)
        });
        await refresh();
        router.replace("/");
      }
    } catch (e: any) {
      Alert.alert("Login Failed", e.message);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !name) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      const result = await registerMutation.mutateAsync({
        email,
        password,
        name,
        userRole,
      });
      if (result.success) {
        Alert.alert("Success", "Account created! Please login.", [
          { text: "OK", onPress: () => setIsRegistering(false) }
        ]);
      }
    } catch (e: any) {
      Alert.alert("Registration Failed", e.message);
    }
  };

  // Dev shortcut — always wipes the previous session first so switching
  // roles on Android never gets stuck in a stale cache.
  const handleDevLogin = async (role: "civilian" | "responder") => {
    try {
      // Clear any existing session before switching role
      await removeSessionToken();
      await clearUserInfo();

      const mockUser = {
        id: role === "responder" ? "mock-responder-id" : "mock-civilian-id",
        openId: role === "responder" ? "mock-responder-id" : "mock-civilian-id",
        name: role === "responder" ? "Jane Responder" : "John Civilian",
        email: "demo@example.com",
        loginMethod: "mock",
        role: "user" as const,
        userRole: role,
        lastSignedIn: new Date(),
      };

      await Auth.setSessionToken("mock_session_" + role);
      await Auth.setUserInfo(mockUser);
      await refresh();
      router.replace("/");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to login");
    }
  };

  // Escape hatch: clears any stale cached session (fixes Android auto-login)
  const handleClearSession = async () => {
    try {
      await removeSessionToken();
      await clearUserInfo();
      Alert.alert("Session Cleared", "Cached session removed. You are now logged out.");
      await refresh();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
        <View className="gap-8">
          <View className="gap-2 items-center">
            <Text className="text-4xl font-black text-foreground tracking-tighter">EMERGENCY</Text>
            <Text className="text-base text-muted text-center font-medium">
              {isRegistering ? "Create your account" : "Sign in to continue"}
            </Text>
          </View>

          <View className="gap-4">
            {isRegistering && (
              <View className="gap-2">
                <Text className="text-sm font-bold text-muted uppercase tracking-wider ml-1">Full Name</Text>
                <TextInput
                  placeholder="John Doe"
                  className="bg-surface p-4 rounded-2xl border border-border text-foreground"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View className="gap-2">
              <Text className="text-sm font-bold text-muted uppercase tracking-wider ml-1">Email</Text>
              <TextInput
                placeholder="email@example.com"
                className="bg-surface p-4 rounded-2xl border border-border text-foreground"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm font-bold text-muted uppercase tracking-wider ml-1">Password</Text>
              <TextInput
                placeholder="••••••••"
                className="bg-surface p-4 rounded-2xl border border-border text-foreground"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {isRegistering && (
              <View className="gap-2">
                <Text className="text-sm font-bold text-muted uppercase tracking-wider ml-1">Identify As</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setUserRole("civilian")}
                    className={`flex-1 p-4 rounded-2xl border-2 items-center ${
                      userRole === "civilian" ? "bg-primary/10 border-primary" : "bg-surface border-border"
                    }`}
                  >
                    <Text className={`font-bold ${userRole === "civilian" ? "text-primary" : "text-muted"}`}>Civilian</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setUserRole("responder")}
                    className={`flex-1 p-4 rounded-2xl border-2 items-center ${
                      userRole === "responder" ? "bg-primary/10 border-primary" : "bg-surface border-border"
                    }`}
                  >
                    <Text className={`font-bold ${userRole === "responder" ? "text-primary" : "text-muted"}`}>Responder</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              onPress={isRegistering ? handleRegister : handleLogin}
              disabled={loginMutation.isPending || registerMutation.isPending}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <View className="bg-primary rounded-2xl p-4 items-center shadow-lg shadow-primary/20">
                {loginMutation.isPending || registerMutation.isPending ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text className="text-lg font-bold text-background">
                    {isRegistering ? "Create Account" : "Sign In"}
                  </Text>
                )}
              </View>
            </Pressable>

            <Pressable onPress={() => setIsRegistering(!isRegistering)}>
              <Text className="text-center text-primary font-semibold">
                {isRegistering ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </Text>
            </Pressable>
          </View>

          {/* Dev Divider */}
          <View className="flex-row items-center gap-4">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-xs font-bold text-muted uppercase tracking-widest">Dev Shortcuts</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleDevLogin("civilian")}
              className="flex-1 bg-surface border border-border p-3 rounded-xl items-center"
            >
              <Text className="text-xs font-bold text-foreground">Skip to Civilian</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDevLogin("responder")}
              className="flex-1 bg-surface border border-border p-3 rounded-xl items-center"
            >
              <Text className="text-xs font-bold text-foreground">Skip to Responder</Text>
            </Pressable>
          </View>

          {/* Android fix: clear stale cached session */}
          <Pressable
            onPress={handleClearSession}
            className="bg-surface border border-border p-3 rounded-xl items-center"
          >
            <Text className="text-xs font-semibold text-muted">🗑️ Clear Cached Session (Android Fix)</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
