import { View, Text, Pressable, ActivityIndicator, Alert, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";

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

function openMaps(lat: number, lng: number, address?: string | null) {
  const label = encodeURIComponent(address || "Incident Location");
  
  if (Platform.OS === "ios") {
    Linking.openURL(`maps:0,0?q=${label}@${lat},${lng}`);
  } else if (Platform.OS === "android") {
    Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}(${label})`);
  } else {
    Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
  }
}

export default function MapScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: incidents, isLoading, error, refetch } = trpc.incidents.getResponderDashboard.useQuery({
    limit: 100,
  });

  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const updateStatusMutation = trpc.incidents.updateStatus.useMutation({
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([
        utils.incidents.getResponderDashboard.invalidate(),
        utils.incidents.getMyCivilianIncidents.invalidate(),
      ]);
      refetch();
    },
    onError: (mutationError) => {
      Alert.alert("Status update failed", mutationError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
  const deleteIncidentMutation = trpc.incidents.delete.useMutation({
    onSuccess: async () => {
      setSelectedIncident(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([
        utils.incidents.getResponderDashboard.invalidate(),
        utils.incidents.getMyCivilianIncidents.invalidate(),
      ]);
      refetch();
    },
    onError: (mutationError) => {
      Alert.alert("Delete failed", mutationError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading incidents...</Text>
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
          <Pressable onPress={() => refetch()} className="px-4 py-2 bg-primary rounded-lg">
            <Text className="text-background font-semibold">Retry</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const handleIncidentPress = (incidentId: string) => {
    setSelectedIncident(incidentId === selectedIncident ? null : incidentId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleGetDirections = (incident: any) => {
    if (incident.latitude && incident.longitude) {
      openMaps(incident.latitude, incident.longitude, incident.address);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Alert.alert("Location Error", "No location data available for this incident");
    }
  };

  const handleViewDetails = (incidentId: string) => {
    router.push(`/incident-detail?id=${incidentId}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleStatusUpdate = (incidentId: string, newStatus: "pending" | "in_progress" | "resolved") => {
    updateStatusMutation.mutate({
      incidentId,
      newStatus,
      notes: `Updated from map to ${newStatus.replace("_", " ")}`,
    });
  };

  const handleDeleteIncident = (incidentId: string) => {
    Alert.alert(
      "Delete Report",
      "This will permanently remove the report and its notes/history. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteIncidentMutation.mutate({ incidentId });
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-0">
      <View className="flex-1">
        {/* Header */}
        <View className="p-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Live Incident Map</Text>
          <Text className="text-sm text-muted mt-1">
            {incidents?.length || 0} active incidents
          </Text>
        </View>

        {/* Map Placeholder */}
        <View className="h-56 bg-surface items-center justify-center border-b border-border">
          <View className="items-center gap-4">
            <IconSymbol name="map.fill" size={64} color={colors.muted} />
            <Text className="text-lg font-semibold text-foreground">Map View</Text>
            <Text className="text-sm text-muted text-center">
              Interactive map with incident locations will be implemented here
            </Text>
            <Text className="text-xs text-muted text-center">
              For now, use the incident list below
            </Text>
          </View>
        </View>

        {/* Incident List */}
        <View className="flex-1">
          <View className="p-4 border-b border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Incident List</Text>
          </View>
          
          {incidents && incidents.length > 0 ? (
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
              {incidents.map((incident) => (
                <Pressable
                  key={incident.id}
                  onPress={() => handleIncidentPress(incident.id)}
                  className={`p-4 border-b border-border ${
                    selectedIncident === incident.id ? "bg-primary/10" : ""
                  }`}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 gap-2">
                      <View className="flex-row items-center gap-2">
                        <View
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}
                        />
                        <Text className="text-sm font-semibold text-foreground capitalize">
                          {incident.incidentType}
                        </Text>
                        {incident.isPanicAlert && (
                          <View className="px-2 py-1 bg-error rounded">
                            <Text className="text-xs font-bold text-background">SOS</Text>
                          </View>
                        )}
                      </View>
                      
                      <Text className="text-sm text-muted" numberOfLines={2}>
                        {incident.description}
                      </Text>
                      
                      <View className="flex-row items-center gap-4 mt-2">
                        <Text className="text-xs text-muted">
                          {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <View
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[incident.status] }}
                          />
                          <Text className="text-xs text-muted capitalize">
                            {incident.status.replace("_", " ")}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View className="items-center gap-2">
                      {incident.latitude && incident.longitude && (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            handleGetDirections(incident);
                          }}
                          className="p-2 bg-primary rounded-lg"
                        >
                          <IconSymbol name="location.fill" size={16} color="#FFF" />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          handleViewDetails(incident.id);
                        }}
                        className="p-2 bg-surface rounded-lg border border-border"
                      >
                        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                      </Pressable>
                    </View>
                  </View>
                  {selectedIncident === incident.id && (
                    <View className="mt-3 gap-2">
                      <Text className="text-xs font-semibold text-muted">Quick Status</Text>
                      <View className="flex-row gap-2">
                        {(["pending", "in_progress", "resolved"] as const).map((status) => (
                          <Pressable
                            key={status}
                            onPress={(event) => {
                              event.stopPropagation();
                              handleStatusUpdate(incident.id, status);
                            }}
                            disabled={updateStatusMutation.isPending}
                            className={`px-3 py-2 rounded-full border ${
                              incident.status === status ? "bg-primary border-primary" : "bg-surface border-border"
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                incident.status === status ? "text-background" : "text-foreground"
                              }`}
                            >
                              {status.replace("_", " ")}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          router.push(`/coordination?id=${incident.id}`);
                        }}
                        className="self-start px-3 py-2 rounded-lg bg-surface border border-border"
                      >
                        <Text className="text-xs font-semibold text-foreground">Open Coordination</Text>
                      </Pressable>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          handleDeleteIncident(incident.id);
                        }}
                        disabled={deleteIncidentMutation.isPending}
                        className="self-start px-3 py-2 rounded-lg bg-error/10 border border-error/40"
                      >
                        <Text className="text-xs font-semibold text-error">
                          {deleteIncidentMutation.isPending ? "Deleting..." : "Delete Report"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center p-8">
              <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
              <Text className="text-lg font-semibold text-foreground mt-4">No Active Incidents</Text>
              <Text className="text-sm text-muted text-center">
                All incidents have been resolved
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
