import { ScrollView, Text, View, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

type StatusFilter = "all" | "pending" | "in_progress" | "resolved";
type PriorityFilter = "all" | "low" | "medium" | "high" | "critical";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  in_progress: "#3B82F6",
  resolved: "#22C55E",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#3B82F6",
  medium: "#F59E0B",
  high: "#EF4444",
  critical: "#7C3AED",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const PRIORITY_ICONS: Record<string, string> = {
  low: "chevron.down",
  medium: "minus",
  high: "chevron.up",
  critical: "exclamationmark.2",
};

export default function ResponderDashboard() {
  const colors = useColors();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/dev/login");
        },
      },
    ]);
  };

  const { data: incidents, isLoading, error, refetch, dataUpdatedAt } = trpc.incidents.getResponderDashboard.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    limit: 50,
  }, {
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-sm text-muted mt-3">Loading incidents...</Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="p-4">
        <View className="items-center justify-center gap-4">
          <IconSymbol name="exclamationmark.circle.fill" size={48} color={colors.error} />
          <Text className="text-lg font-semibold text-foreground">Error loading incidents</Text>
          <Text className="text-sm text-muted text-center">{error.message}</Text>
          <Pressable onPress={() => refetch()}>
            <View className="px-4 py-2 bg-primary rounded-lg">
              <Text className="text-background font-semibold">Retry</Text>
            </View>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const renderIncidentCard = ({ item }: any) => (
    <Pressable
      onPress={() => {
        router.push({
          pathname: "/incident-detail",
          params: { id: item.id },
        });
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <View
        className="bg-surface rounded-2xl p-4 border mb-3"
        style={{
          borderColor: item.isPanicAlert ? PRIORITY_COLORS.critical : colors.border,
          borderLeftWidth: item.isPanicAlert ? 4 : 1,
        }}
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-lg font-bold text-foreground capitalize">
                {item.incidentType}
              </Text>
              {item.isPanicAlert && (
                <View className="px-2 py-0.5 bg-error rounded-full">
                  <Text className="text-xs font-black text-background">🚨 PANIC</Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-muted">
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </Text>
          </View>

          {/* Priority Badge */}
          <View
            className="px-3 py-1.5 rounded-full flex-row items-center gap-1"
            style={{ backgroundColor: `${PRIORITY_COLORS[item.priority] || colors.border}22` }}
          >
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: PRIORITY_COLORS[item.priority] || colors.muted }}
            />
            <Text
              className="text-xs font-bold uppercase"
              style={{ color: PRIORITY_COLORS[item.priority] || colors.foreground }}
            >
              {item.priority}
            </Text>
          </View>
        </View>

        <Text className="text-sm text-foreground mb-3 leading-snug" numberOfLines={2}>{item.description}</Text>

        {/* AI Classification */}
        {item.mlClassification && (
          <View className="bg-background rounded-xl p-2 mb-3 flex-row gap-1 items-start">
            <Text style={{ fontSize: 12 }}>🤖</Text>
            <Text className="text-xs text-muted flex-1" numberOfLines={2}>{item.mlClassification}</Text>
          </View>
        )}

        <View className="flex-row items-center justify-between">
          {item.address ? (
            <View className="flex-row items-center gap-1 flex-1">
              <IconSymbol name="location.fill" size={12} color={colors.muted} />
              <Text className="text-xs text-muted flex-1" numberOfLines={1}>{item.address}</Text>
            </View>
          ) : (
            <View />
          )}

          {/* Status Badge */}
          <View
            className="px-2 py-1 rounded-lg ml-2"
            style={{ backgroundColor: `${STATUS_COLORS[item.status] || colors.border}22` }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: STATUS_COLORS[item.status] || colors.foreground }}
            >
              {STATUS_LABELS[item.status] || item.status}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  const activeCount = incidents?.filter((i) => i.status !== "resolved").length || 0;
  const criticalCount = incidents?.filter((i) => i.priority === "critical" || i.isPanicAlert).length || 0;
  const pendingCount = incidents?.filter((i) => i.status === "pending").length || 0;

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>

        {/* Header */}
        <View className="px-5 pt-6 pb-4 border-b border-border bg-surface">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs font-medium text-muted mb-0.5">
                Welcome back, {user?.name?.split(" ")[0] || "Responder"}
              </Text>
              <Text className="text-3xl font-extrabold text-foreground">Incident Command</Text>
              <Text className="text-sm text-muted mt-1">Real-time emergency management</Text>
            </View>
            <View className="flex-row items-center gap-2">
              {/* Refresh */}
              <Pressable onPress={() => refetch()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <View className="w-10 h-10 bg-surface rounded-full items-center justify-center border border-border">
                  <IconSymbol name="arrow.clockwise" size={18} color={colors.primary} />
                </View>
              </Pressable>
              {/* Sign Out */}
              <Pressable onPress={handleLogout} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <View className="w-10 h-10 bg-surface rounded-full items-center justify-center border border-border">
                  <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color={colors.error} />
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <View className="gap-5 px-5 pt-5">

          {/* Stats Row */}
          <View className="flex-row gap-2">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border items-center">
              <Text className="text-3xl font-black text-foreground">{incidents?.length || 0}</Text>
              <Text className="text-xs text-muted font-medium mt-1">Total</Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border items-center">
              <Text className="text-3xl font-black text-primary">{activeCount}</Text>
              <Text className="text-xs text-muted font-medium mt-1">Active</Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border-2 items-center"
                  style={{ borderColor: PRIORITY_COLORS.critical + "60", backgroundColor: PRIORITY_COLORS.critical + "10" }}>
              <Text className="text-3xl font-black" style={{ color: PRIORITY_COLORS.critical }}>{criticalCount}</Text>
              <Text className="text-xs font-medium mt-1" style={{ color: PRIORITY_COLORS.critical }}>Critical</Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border items-center">
              <Text className="text-3xl font-black" style={{ color: STATUS_COLORS.pending }}>{pendingCount}</Text>
              <Text className="text-xs text-muted font-medium mt-1">Pending</Text>
            </View>
          </View>

          {/* Status Filter */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider">Filter by Status</Text>
            <View className="flex-row gap-2 flex-wrap">
              {(["all", "pending", "in_progress", "resolved"] as StatusFilter[]).map((status) => (
                <Pressable
                  key={status}
                  onPress={() => setStatusFilter(status)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor: statusFilter === status ? (status === "all" ? colors.primary : STATUS_COLORS[status] || colors.primary) : colors.surface,
                      borderColor: statusFilter === status ? (status === "all" ? colors.primary : STATUS_COLORS[status] || colors.primary) : colors.border,
                    }}
                  >
                    <Text
                      className="text-xs font-bold capitalize"
                      style={{ color: statusFilter === status ? "#FFF" : colors.foreground }}
                    >
                      {status === "all" ? "All" : STATUS_LABELS[status]}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Priority Filter */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-muted uppercase tracking-wider">Filter by Priority</Text>
            <View className="flex-row gap-2 flex-wrap">
              {(["all", "low", "medium", "high", "critical"] as PriorityFilter[]).map((priority) => (
                <Pressable
                  key={priority}
                  onPress={() => setPriorityFilter(priority)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor: priorityFilter === priority ? (priority === "all" ? colors.primary : PRIORITY_COLORS[priority] || colors.primary) : colors.surface,
                      borderColor: priorityFilter === priority ? (priority === "all" ? colors.primary : PRIORITY_COLORS[priority] || colors.primary) : colors.border,
                    }}
                  >
                    <Text
                      className="text-xs font-bold capitalize"
                      style={{ color: priorityFilter === priority ? "#FFF" : colors.foreground }}
                    >
                      {priority === "all" ? "All" : priority}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Incidents List */}
          {incidents && incidents.length > 0 ? (
            <>
              <Text className="text-xs font-bold text-muted uppercase tracking-wider">
                {incidents.length} incident{incidents.length !== 1 ? "s" : ""} found
              </Text>
              <FlatList
                data={incidents}
                renderItem={renderIncidentCard}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 0 }}
              />
            </>
          ) : (
            <View className="items-center justify-center py-16 gap-3">
              <View className="w-16 h-16 rounded-full bg-surface border border-border items-center justify-center">
                <IconSymbol name="checkmark.circle.fill" size={32} color={colors.muted} />
              </View>
              <Text className="text-lg font-bold text-foreground">All Clear</Text>
              <Text className="text-sm text-muted text-center">
                No incidents match the current filters
              </Text>
            </View>
          )}

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
