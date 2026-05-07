import { ScrollView, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  in_progress: "#3B82F6",
  resolved: "#22C55E",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export default function StatusScreen() {
  const colors = useColors();
  const { data: incidents, isLoading, error } = trpc.incidents.getMyCivilianIncidents.useQuery();

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
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
        </View>
      </ScreenContainer>
    );
  }

  const renderIncidentCard = ({ item }: any) => (
    <View className="bg-surface rounded-lg p-4 border border-border mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 gap-1">
          <Text className="text-lg font-semibold text-foreground capitalize">
            {item.incidentType}
          </Text>
          <Text className="text-sm text-muted">
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </Text>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{
            backgroundColor: `${STATUS_COLORS[item.status] || colors.border}20`,
          }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: STATUS_COLORS[item.status] || colors.foreground }}
          >
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>

      <Text className="text-sm text-foreground mb-2 line-clamp-2">{item.description}</Text>

      {item.address && (
        <View className="flex-row items-center gap-2 mt-2">
          <IconSymbol name="location.fill" size={14} color={colors.muted} />
          <Text className="text-xs text-muted flex-1">{item.address}</Text>
        </View>
      )}

      {item.isPanicAlert && (
        <View className="mt-3 px-2 py-1 bg-error rounded flex-row items-center gap-2">
          <IconSymbol name="exclamationmark.circle.fill" size={14} color={colors.background} />
          <Text className="text-xs font-semibold text-background">Panic Alert</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">My Reports</Text>
            <Text className="text-sm text-muted">
              Track the status of your emergency reports
            </Text>
          </View>

          {/* Stats */}
          {incidents && incidents.length > 0 && (
            <View className="flex-row gap-2">
              <View className="flex-1 bg-surface rounded-lg p-3 border border-border">
                <Text className="text-xs text-muted">Total Reports</Text>
                <Text className="text-2xl font-bold text-foreground">{incidents.length}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-lg p-3 border border-border">
                <Text className="text-xs text-muted">Active</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {incidents.filter((i) => i.status !== "resolved").length}
                </Text>
              </View>
            </View>
          )}

          {/* Incidents List */}
          {incidents && incidents.length > 0 ? (
            <FlatList
              data={incidents}
              renderItem={renderIncidentCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 0 }}
            />
          ) : (
            <View className="items-center justify-center py-12 gap-3">
              <IconSymbol name="doc.fill" size={48} color={colors.muted} />
              <Text className="text-lg font-semibold text-foreground">No reports yet</Text>
              <Text className="text-sm text-muted text-center">
                Your emergency reports will appear here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
