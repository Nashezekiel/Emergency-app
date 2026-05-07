import { ScrollView, Text, View, Pressable, ActivityIndicator, TextInput, Linking, Platform } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";
import { FirestoreIncident, FirestoreNote, FirestoreStatusUpdate, FirestoreMedia } from "@/types/incident";

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

const PRIORITY_COLORS: Record<string, string> = {
  low: "#3B82F6",
  medium: "#F59E0B",
  high: "#EF4444",
  critical: "#7C3AED",
};

function openMaps(lat: string, lng: string, address?: string | null) {
  const label = encodeURIComponent(address || "Incident Location");
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (Platform.OS === "ios") {
    Linking.openURL(`maps:0,0?q=${label}@${latNum},${lngNum}`);
  } else if (Platform.OS === "android") {
    Linking.openURL(`geo:${latNum},${lngNum}?q=${latNum},${lngNum}(${label})`);
  } else {
    Linking.openURL(`https://www.google.com/maps?q=${latNum},${lngNum}`);
  }
}

export default function IncidentDetail() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { id } = useLocalSearchParams();
  const [newNote, setNewNote] = useState("");
  const goBackToReports = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/map");
  };

  const { data: incident, isLoading, error } = trpc.incidents.getById.useQuery({
    id: id as string,
  });

  const { data: notes, refetch: refetchNotes } = trpc.incidents.getNotes.useQuery({
    incidentId: id as string,
  });

  const { data: history } = trpc.incidents.getCaseHistory.useQuery({
    incidentId: id as string,
  });

  const { data: mediaFiles } = trpc.incidents.getMedia.useQuery({
    incidentId: id as string,
  });

  const addNoteMutation = trpc.incidents.addNote.useMutation({
    onSuccess: async () => {
      setNewNote("");
      refetchNotes();
      await Promise.all([
        utils.incidents.getResponderDashboard.invalidate(),
        utils.incidents.getById.invalidate({ id: id as string }),
        utils.incidents.getNotes.invalidate({ incidentId: id as string }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateStatusMutation = trpc.incidents.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.incidents.getResponderDashboard.invalidate(),
        utils.incidents.getMyCivilianIncidents.invalidate(),
        utils.incidents.getById.invalidate({ id: id as string }),
        utils.incidents.getCaseHistory.invalidate({ incidentId: id as string }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updatePriorityMutation = trpc.incidents.updatePriority.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.incidents.getResponderDashboard.invalidate(),
        utils.incidents.getById.invalidate({ id: id as string }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate({
      incidentId: id as string,
      content: newNote,
    });
  };

  const handleUpdateStatus = (status: "pending" | "in_progress" | "resolved") => {
    updateStatusMutation.mutate({
      incidentId: id as string,
      newStatus: status,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleUpdatePriority = (priority: "low" | "medium" | "high" | "critical") => {
    updatePriorityMutation.mutate({
      incidentId: id as string,
      priority,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (error || !incident) {
    return (
      <ScreenContainer className="p-4">
        <View className="items-center justify-center gap-4">
          <IconSymbol name="exclamationmark.circle.fill" size={48} color={colors.error} />
          <Text className="text-lg font-semibold text-foreground">Incident not found</Text>
          <Pressable onPress={goBackToReports}>
            <View className="px-4 py-2 bg-primary rounded-lg">
              <Text className="text-background font-semibold">Go Back</Text>
            </View>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>

        {/* Header */}
        <View
          className="px-5 pt-6 pb-5"
          style={{ backgroundColor: PRIORITY_COLORS[incident.priority] + "18", borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <Pressable onPress={goBackToReports} className="mb-4">
            <View className="flex-row items-center gap-1">
              <IconSymbol name="chevron.left" size={18} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </View>
          </Pressable>

          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-2">
              <Text className="text-3xl font-extrabold text-foreground capitalize">
                {incident.incidentType} Emergency
              </Text>
              <Text className="text-sm text-muted">
                Reported {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
              </Text>

              {/* Badges */}
              <View className="flex-row gap-2 flex-wrap mt-1">
                {incident.isPanicAlert && (
                  <View className="px-3 py-1 bg-error rounded-full flex-row items-center gap-1">
                    <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.background} />
                    <Text className="text-xs font-bold text-background">PANIC ALERT</Text>
                  </View>
                )}
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLORS[incident.priority] + "25" }}
                >
                  <Text className="text-xs font-bold uppercase" style={{ color: PRIORITY_COLORS[incident.priority] }}>
                    {incident.priority}
                  </Text>
                </View>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[incident.status] + "25" }}
                >
                  <Text className="text-xs font-semibold" style={{ color: STATUS_COLORS[incident.status] }}>
                    {STATUS_LABELS[incident.status]}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className="gap-5 px-5 pt-5">

          {/* Description */}
          <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
            <View className="flex-row items-center gap-2 mb-1">
              <IconSymbol name="doc.text.fill" size={16} color={colors.primary} />
              <Text className="text-sm font-bold text-foreground uppercase tracking-wide">Description</Text>
            </View>
            <Text className="text-base text-foreground leading-relaxed">{incident.description}</Text>
          </View>

          {/* ML Classification */}
          {incident.mlClassification && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
              <View className="flex-row items-center gap-2 mb-1">
                <Text style={{ fontSize: 16 }}>🤖</Text>
                <Text className="text-sm font-bold text-foreground uppercase tracking-wide">AI Assessment</Text>
              </View>
              <Text className="text-sm text-muted leading-relaxed">{incident.mlClassification}</Text>
            </View>
          )}

          {/* Location + Navigation */}
          {(incident.address || incident.latitude) && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="location.fill" size={16} color={colors.primary} />
                  <Text className="text-sm font-bold text-foreground uppercase tracking-wide">Location</Text>
                </View>
                {incident.latitude && incident.longitude && (
                  <Pressable
                    onPress={() => openMaps(incident.latitude!, incident.longitude!, incident.address)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View className="flex-row items-center gap-1 px-3 py-1.5 bg-primary rounded-full">
                      <IconSymbol name="map.fill" size={12} color={colors.background} />
                      <Text className="text-xs font-bold text-background">Open Maps</Text>
                    </View>
                  </Pressable>
                )}
              </View>
              {incident.address && (
                <Text className="text-base text-foreground">{incident.address}</Text>
              )}
              {incident.latitude && incident.longitude && (
                <Text className="text-xs text-muted font-mono">
                  {parseFloat(incident.latitude).toFixed(6)}, {parseFloat(incident.longitude).toFixed(6)}
                </Text>
              )}
            </View>
          )}

          {/* Status Update */}
          <View className="gap-3">
            <Text className="text-sm font-bold text-foreground uppercase tracking-wide">Update Status</Text>
            <View className="flex-row gap-2">
              {(["pending", "in_progress", "resolved"] as const).map((status) => {
                const isActive = incident.status === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => handleUpdateStatus(status)}
                    style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      className="py-3 rounded-xl items-center border"
                      style={{
                        backgroundColor: isActive ? STATUS_COLORS[status] : colors.surface,
                        borderColor: isActive ? STATUS_COLORS[status] : colors.border,
                      }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: isActive ? "#FFF" : colors.foreground }}
                      >
                        {STATUS_LABELS[status]}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Priority Update */}
          <View className="gap-3">
            <Text className="text-sm font-bold text-foreground uppercase tracking-wide">Priority Override</Text>
            <View className="flex-row gap-2">
              {(["low", "medium", "high", "critical"] as const).map((priority) => {
                const isActive = incident.priority === priority;
                return (
                  <Pressable
                    key={priority}
                    onPress={() => handleUpdatePriority(priority)}
                    style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      className="py-3 rounded-xl items-center border"
                      style={{
                        backgroundColor: isActive ? PRIORITY_COLORS[priority] : colors.surface,
                        borderColor: isActive ? PRIORITY_COLORS[priority] : colors.border,
                      }}
                    >
                      <Text
                        className="text-xs font-bold capitalize"
                        style={{ color: isActive ? "#FFF" : colors.foreground }}
                      >
                        {priority}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Media Attachments */}
          {mediaFiles && mediaFiles.length > 0 && (
            <View className="gap-3">
              <Text className="text-sm font-bold text-foreground uppercase tracking-wide">
                Evidence ({mediaFiles.length} file{mediaFiles.length > 1 ? "s" : ""})
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {mediaFiles.map((file) => (
                  <Pressable key={file.id} onPress={() => Linking.openURL(file.fileUrl)}>
                    <View className="w-20 h-20 bg-surface rounded-xl border border-border items-center justify-center">
                      <IconSymbol name="photo.fill" size={28} color={colors.muted} />
                      <Text className="text-xs text-muted mt-1">View</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Coordination Notes */}
          <View className="gap-3">
            <Text className="text-sm font-bold text-foreground uppercase tracking-wide">Coordination Notes</Text>

            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <TextInput
                placeholder="Add a coordination note..."
                placeholderTextColor={colors.muted}
                value={newNote}
                onChangeText={setNewNote}
                multiline
                numberOfLines={3}
                className="text-foreground text-base"
                style={{ minHeight: 70, textAlignVertical: "top" }}
              />
              <Pressable
                onPress={handleAddNote}
                disabled={!newNote.trim() || addNoteMutation.isPending}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  className="p-3 rounded-xl items-center"
                  style={{ backgroundColor: newNote.trim() ? colors.primary : colors.border }}
                >
                  {addNoteMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text className="font-bold text-sm text-background">Add Note</Text>
                  )}
                </View>
              </Pressable>
            </View>

            {notes && notes.length > 0 && (
              <View className="gap-2">
                {notes.map((note) => (
                  <View key={note.id} className="bg-surface rounded-2xl p-4 border border-border">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-1">
                        <IconSymbol name="person.fill" size={12} color={colors.muted} />
                        <Text className="text-xs font-semibold text-muted">Responder Note</Text>
                      </View>
                      <Text className="text-xs text-muted">
                        {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                      </Text>
                    </View>
                    <Text className="text-sm text-foreground leading-relaxed">{note.content}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Case History */}
          {history && history.length > 0 && (
            <View className="gap-3">
              <Text className="text-sm font-bold text-foreground uppercase tracking-wide">Case History</Text>
              <View className="gap-2">
                {history.map((entry) => (
                  <View key={entry.id} className="bg-surface rounded-2xl p-4 border border-border flex-row gap-3">
                    <View className="w-2 self-stretch rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.newStatus] }} />
                    <View className="flex-1 gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-xs font-bold text-foreground capitalize">
                          {entry.previousStatus?.replace("_", " ")} → {entry.newStatus?.replace("_", " ")}
                        </Text>
                        <Text className="text-xs text-muted">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </Text>
                      </View>
                      {entry.notes && <Text className="text-sm text-muted">{entry.notes}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
