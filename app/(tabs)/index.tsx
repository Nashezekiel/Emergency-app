import { ScrollView, Text, View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/use-auth";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/dev/login");
        },
      },
    ]);
  };

  const handlePanicPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/panic");
  };

  const handleReportPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(tabs)/report");
  };

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        {/* Header Hero Area */}
        <LinearGradient
          colors={[colors.primary, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          className="pt-16 pb-8 px-6 rounded-b-3xl mb-4"
        >
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-xl font-medium text-white opacity-90">Stay Safe,</Text>
              <Text className="text-3xl font-extrabold text-white tracking-tight">
                {user?.name?.split(' ')[0] || "Citizen"}
              </Text>
            </View>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center border border-white/30">
                <IconSymbol name="person.fill" size={22} color="#FFF" />
              </View>
            </Pressable>
          </View>

          <View className="bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm flex-row items-center">
            <IconSymbol name="shield.fill" size={24} color="#FFF" />
            <View className="ml-3 flex-1">
              <Text className="text-white font-bold text-base">System Online</Text>
              <Text className="text-white/80 text-xs">Emergency services are available 24/7</Text>
            </View>
          </View>
        </LinearGradient>

        <View className="flex-1 gap-6 px-6">
          {/* Panic Alert Button - Large and Prominent */}
          <Pressable
            onPress={handlePanicPress}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginTop: 10 }]}
          >
            <View className="rounded-3xl p-8 items-center gap-4 overflow-hidden border-4 border-error/20 shadow-xl shadow-error/30"
              style={{ backgroundColor: colors.error }}>
              <View className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mt-10 -mr-10" />
              <View className="absolute bottom-0 left-0 w-40 h-40 bg-black opacity-10 rounded-full -mb-20 -ml-20" />

              <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center border-4 border-white/30 shadow-lg mb-2">
                <IconSymbol name="exclamationmark.triangle.fill" size={48} color="#FFF" />
              </View>

              <View className="items-center">
                <Text className="text-3xl font-black text-white tracking-widest uppercase">SOS PANIC</Text>
                <Text className="text-sm text-white/90 text-center font-medium mt-1">
                  Hold for immediate dispatch
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Section Divider */}
          <View className="flex-row items-center mt-4 mb-2">
            <Text className="text-sm font-bold text-muted uppercase tracking-wider">Additional Options</Text>
            <View className="flex-1 h-px bg-border ml-4" />
          </View>

          {/* Report Emergency Button */}
          <Pressable
            onPress={handleReportPress}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View className="bg-surface rounded-2xl p-5 flex-row items-center border border-border shadow-sm">
              <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center mr-4">
                <IconSymbol name="doc.text.fill" size={28} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-foreground">File a Report</Text>
                <Text className="text-sm text-muted mt-1 leading-tight">Provide details about non-immediate issues</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.muted} />
            </View>
          </Pressable>

          {/* Info Cards */}
          <View className="gap-3">
            <View className="bg-surface rounded-2xl p-4 border border-border flex-row items-center shadow-sm">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                <IconSymbol name="location.fill" size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-foreground text-base">Auto Location Enabled</Text>
                <Text className="text-xs text-muted mt-0.5">
                  Your coordinates are attached securely
                </Text>
              </View>
            </View>

            <View className="bg-surface rounded-2xl p-4 border border-border flex-row items-center shadow-sm">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                <IconSymbol name="bell.fill" size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-foreground text-base">Alert System Active</Text>
                <Text className="text-xs text-muted mt-0.5">
                  Receive updates from local authorities
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
