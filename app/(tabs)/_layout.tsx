import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "expo-router";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  // Show loading state while auth is loading
  if (loading) {
    return null;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Redirect href="/dev/login" />;
  }

  // Check user role - default to civilian if not set
  const userRole = user.userRole || "civilian";

  // Show different tabs based on user role
  if (userRole === "responder") {
    return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            paddingTop: 8,
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet.rectangle" color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: "Map",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="coordination"
          options={{
            title: "Coordination",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="status"
          options={{
            title: "Status",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.circle.fill" color={color} />,
          }}
        />
      </Tabs>
    );
  }

  // Civilian interface (default)
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: "Status",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
