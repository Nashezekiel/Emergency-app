import { View, Text, Pressable, ActivityIndicator, Alert, TextInput, ScrollView } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatDistanceToNow } from "date-fns";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

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

export default function CoordinationScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { id } = useLocalSearchParams();
  const incidentId = Array.isArray(id) ? id[0] : id;
  const [newNote, setNewNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const goBackToReports = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/map");
  };

  const {
    data: responderIncidents,
    isLoading: isLoadingResponderIncidents,
    error: responderIncidentsError,
  } = trpc.incidents.getResponderDashboard.useQuery(
    { limit: 50 },
    { enabled: !incidentId }
  );

  const { data: incident, isLoading, error } = trpc.incidents.getById.useQuery({
    id: incidentId as string,
  }, { enabled: !!incidentId });

  const { data: notes, refetch: refetchNotes } = trpc.incidents.getNotes.useQuery({
    incidentId: incidentId as string,
  }, { enabled: !!incidentId });

  const { data: history } = trpc.incidents.getCaseHistory.useQuery({
    incidentId: incidentId as string,
  }, { enabled: !!incidentId });

  const updateStatusMutation = trpc.incidents.updateStatus.useMutation({
    onSuccess: async () => {
      setSelectedStatus(null);
      await Promise.all([
        utils.incidents.getResponderDashboard.invalidate(),
        utils.incidents.getMyCivilianIncidents.invalidate(),
        utils.incidents.getById.invalidate({ id: incidentId as string }),
        utils.incidents.getCaseHistory.invalidate({ incidentId: incidentId as string }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Incident status updated successfully");
    },
  });

  const addNoteMutation = trpc.incidents.addNote.useMutation({
    onSuccess: async () => {
      setNewNote("");
      refetchNotes();
      await Promise.all([
        utils.incidents.getResponderDashboard.invalidate(),
        utils.incidents.getById.invalidate({ id: incidentId as string }),
        utils.incidents.getNotes.invalidate({ incidentId: incidentId as string }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleStatusUpdate = (newStatus: string) => {
    Alert.alert(
      "Update Status",
      `Change incident status to ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: () => {
            updateStatusMutation.mutate({
              incidentId: incidentId as string,
              newStatus: newStatus as any,
              notes: `Status changed to ${newStatus}`,
            });
          },
        },
      ]
    );
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    addNoteMutation.mutate({
      incidentId: incidentId as string,
      content: newNote.trim(),
    });
  };

  if (!incidentId) {
    if (isLoadingResponderIncidents) {
      return (
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading incidents...</Text>
        </ScreenContainer>
      );
    }

    if (responderIncidentsError) {
      return (
        <ScreenContainer className="p-4">
          <View className="items-center justify-center gap-4">
            <IconSymbol name="exclamationmark.circle.fill" size={48} color={colors.error} />
            <Text className="text-lg font-semibold text-foreground">Error loading incidents</Text>
            <Text className="text-sm text-muted text-center">{responderIncidentsError.message}</Text>
          </View>
        </ScreenContainer>
      );
    }

    return (
      <ScreenContainer className="p-4">
        <View className="gap-4">
          <View>
            <Text className="text-3xl font-bold text-foreground">Coordination</Text>
            <Text className="text-sm text-muted mt-1">
              Select an incident to manage status and notes
            </Text>
          </View>

          {responderIncidents && responderIncidents.length > 0 ? (
            <View className="gap-3">
              {responderIncidents.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/coordination?id=${item.id}`)}
                  className="p-4 rounded-lg border border-border bg-surface"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-semibold text-foreground capitalize">
                        {item.incidentType}
                      </Text>
                      <Text className="text-sm text-muted" numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[item.status] || colors.muted }}
                      />
                      <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="items-center py-12 gap-3">
              <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
              <Text className="text-lg font-semibold text-foreground">No incidents to coordinate</Text>
              <Text className="text-sm text-muted text-center">
                Active incidents will appear here automatically
              </Text>
            </View>
          )}
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading incident...</Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="p-4">
        <View className="items-center justify-center gap-4">
          <IconSymbol name="exclamationmark.circle.fill" size={48} color={colors.error} />
          <Text className="text-lg font-semibold text-foreground">Error loading incident</Text>
          <Text className="text-sm text-muted text-center">{error.message}</Text>
          <Pressable onPress={goBackToReports} className="px-4 py-2 bg-primary rounded-lg">
            <Text className="text-background font-semibold">Go Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (!incident) {
    return (
      <ScreenContainer className="p-4">
        <View className="items-center justify-center gap-4">
          <IconSymbol name="exclamationmark.circle.fill" size={48} color={colors.error} />
          <Text className="text-lg font-semibold text-foreground">Incident not found</Text>
          <Pressable onPress={goBackToReports} className="px-4 py-2 bg-primary rounded-lg">
            <Text className="text-background font-semibold">Go Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        {/* Header */}
        <View className="p-4 border-b border-border">
          <Pressable onPress={goBackToReports} className="mb-4">
            <View className="flex-row items-center gap-1">
              <IconSymbol name="chevron.left" size={18} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </View>
          </Pressable>
          
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-2">
              <Text className="text-2xl font-bold text-foreground capitalize">
                {incident.incidentType} Emergency
              </Text>
              <Text className="text-sm text-muted">
                Reported {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
              </Text>
            </View>
            
            <View className="items-center gap-2">
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}>
                <Text className="text-xs font-bold text-background capitalize">
                  {incident.priority}
                </Text>
              </View>
              {incident.isPanicAlert && (
                <View className="px-3 py-1 bg-error rounded-full">
                  <Text className="text-xs font-bold text-background">SOS</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Status Update Section */}
        <View className="p-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">Status Management</Text>
          
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm text-muted">Current Status:</Text>
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[incident.status] }} />
              <Text className="text-sm font-semibold text-foreground capitalize">
                {STATUS_LABELS[incident.status]}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            {["pending", "in_progress", "resolved"].map((status) => (
              <Pressable
                key={status}
                onPress={() => setSelectedStatus(status)}
                className={`p-3 rounded-lg border ${
                  selectedStatus === status ? "border-primary bg-primary/10" : "border-border bg-surface"
                }`}
              >
                <Text className={`text-sm font-semibold ${
                  selectedStatus === status ? "text-primary" : "text-foreground"
                }`}>
                  {STATUS_LABELS[status]}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedStatus && selectedStatus !== incident.status && (
            <Pressable
              onPress={() => handleStatusUpdate(selectedStatus)}
              className="w-full p-3 bg-primary rounded-lg"
              disabled={updateStatusMutation.isPending}
            >
              <Text className="text-background font-semibold text-center">
                {updateStatusMutation.isPending ? "Updating..." : `Update to ${STATUS_LABELS[selectedStatus]}`}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Notes Section */}
        <View className="p-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">Add Note</Text>
          
          <View className="gap-3">
            <TextInput
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Enter coordination notes..."
              multiline
              numberOfLines={3}
              className="p-3 bg-surface border border-border rounded-lg text-foreground"
              style={{ minHeight: 80 }}
            />
            
            <Pressable
              onPress={handleAddNote}
              disabled={!newNote.trim() || addNoteMutation.isPending}
              className="w-full p-3 bg-primary rounded-lg disabled:opacity-50"
            >
              <Text className="text-background font-semibold text-center">
                {addNoteMutation.isPending ? "Adding..." : "Add Note"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Notes History */}
        <View className="p-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Notes History</Text>
          
          {notes && notes.length > 0 ? (
            <View className="gap-3">
              {notes.map((note) => (
                <View key={note.id} className="p-3 bg-surface rounded-lg border border-border">
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="text-sm font-semibold text-foreground">{note.authorName}</Text>
                    <Text className="text-xs text-muted">
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </Text>
                  </View>
                  <Text className="text-sm text-foreground leading-relaxed">{note.content}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-8">
              <IconSymbol name="note.text" size={48} color={colors.muted} />
              <Text className="text-sm text-muted mt-2">No notes added yet</Text>
            </View>
          )}
        </View>

        {/* Status History */}
        <View className="p-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Status History</Text>
          
          {history && history.length > 0 ? (
            <View className="gap-3">
              {history.map((entry) => (
                <View key={entry.id} className="p-3 bg-surface rounded-lg border border-border">
                  <View className="flex-row items-start gap-3">
                    <View className="w-2 self-stretch rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.newStatus] }} />
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-sm text-muted capitalize">
                          {entry.previousStatus?.replace("_", " ") || "New"}
                        </Text>
                        <IconSymbol name="arrow.right" size={14} color={colors.muted} />
                        <Text className="text-sm font-semibold text-foreground capitalize">
                          {entry.newStatus.replace("_", " ")}
                        </Text>
                      </View>
                      {entry.notes && (
                        <Text className="text-sm text-muted">{entry.notes}</Text>
                      )}
                      <Text className="text-xs text-muted">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-8">
              <IconSymbol name="clock.fill" size={48} color={colors.muted} />
              <Text className="text-sm text-muted mt-2">No status changes yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
