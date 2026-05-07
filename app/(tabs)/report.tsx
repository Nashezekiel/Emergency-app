import {
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

type IncidentType = "medical" | "fire" | "crime" | "other";

const INCIDENT_TYPES: { label: string; value: IncidentType; color: string; icon: string }[] = [
  { label: "🏥 Medical", value: "medical", color: "#EF4444", icon: "cross.fill" },
  { label: "🔥 Fire", value: "fire", color: "#F59E0B", icon: "flame.fill" },
  { label: "🚔 Crime", value: "crime", color: "#8B5CF6", icon: "shield.fill" },
  { label: "⚠️ Other", value: "other", color: "#3B82F6", icon: "info.circle.fill" },
];

type PickedMedia = {
  uri: string;
  base64: string;
  type: "photo" | "video";
  mimeType: string;
  fileName: string;
};

export default function ReportScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [incidentType, setIncidentType] = useState<IncidentType>("medical");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [pickedMedia, setPickedMedia] = useState<PickedMedia[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const normalizedDescription = description.replace(/\s+/g, " ").trim();
  const normalizedDescriptionLength = normalizedDescription.length;

  const createIncident = trpc.incidents.create.useMutation({
    onSuccess: async (data: any) => {
      // After incident created, upload any attached media
      const createdIncidentId = data?.id;
      if (pickedMedia.length > 0 && createdIncidentId) {
        setIsUploadingMedia(true);
        try {
          for (const m of pickedMedia) {
            try {
              await uploadMedia.mutateAsync({
                incidentId: createdIncidentId,
                fileBase64: m.base64,
                fileType: m.type,
                fileName: m.fileName,
                mimeType: m.mimeType,
              });
            } catch (e) {
              console.warn("Media upload failed:", e);
            }
          }
        } finally {
          setIsUploadingMedia(false);
        }
      }
      await Promise.all([
        utils.incidents.getMyCivilianIncidents.invalidate(),
        utils.incidents.getResponderDashboard.invalidate(),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message);
    },
  });

  const uploadMedia = trpc.incidents.uploadMedia.useMutation();

  const handleGetLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission was denied.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (reverseGeocode.length > 0) {
          const addr = reverseGeocode[0];
          const addressStr = `${addr.street || ""} ${addr.city || ""} ${addr.region || ""}`.trim();
          setAddress(addressStr);
        }
      } catch (e) {
        console.log("Reverse geocode failed:", e);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Error", "Failed to get location");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Media library access is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets) {
      const newMedia: PickedMedia[] = result.assets
        .filter((asset) => asset.base64)
        .map((asset) => ({
          uri: asset.uri,
          base64: asset.base64!,
          type: asset.type === "video" ? "video" : "photo",
          mimeType: asset.mimeType || "image/jpeg",
          fileName: asset.fileName || `media_${Date.now()}.jpg`,
        }));
      setPickedMedia((prev) => [...prev, ...newMedia].slice(0, 5)); // max 5 files
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.base64) {
      const asset = result.assets[0];
      setPickedMedia((prev) =>
        [...prev, {
          uri: asset.uri,
          base64: asset.base64!,
          type: "photo" as const,
          mimeType: "image/jpeg",
          fileName: `photo_${Date.now()}.jpg`,
        }].slice(0, 5)
      );
    }
  };

  const handleRemoveMedia = (index: number) => {
    setPickedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!normalizedDescription) {
      Alert.alert("Validation", "Please describe the incident");
      return;
    }
    if (normalizedDescriptionLength < 10) {
      Alert.alert("Validation", "Description must be at least 10 characters");
      return;
    }
    createIncident.mutate({
      incidentType,
      description: normalizedDescription,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      address: address || undefined,
      isPanicAlert: false,
    });
  };

  const isValid = normalizedDescriptionLength >= 10 && normalizedDescriptionLength <= 2000;
  const isBusy = createIncident.isPending || isUploadingMedia;
  const remainingChars = Math.max(0, 10 - normalizedDescriptionLength);

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>

        {/* Header */}
        <View className="px-5 pt-6 pb-4 border-b border-border bg-surface">
          <Text className="text-3xl font-extrabold text-foreground tracking-tight">Report Emergency</Text>
          <Text className="text-sm text-muted mt-1">Provide details so responders can help you fast</Text>
        </View>

        <View className="gap-6 px-5 pt-5">

          {/* Incident Type Selector */}
          <View className="gap-3">
            <Text className="text-base font-bold text-foreground uppercase tracking-wide">Type of Emergency</Text>
            <View className="flex-row flex-wrap gap-2">
              {INCIDENT_TYPES.map((type) => {
                const isSelected = incidentType === type.value;
                return (
                  <Pressable
                    key={type.value}
                    onPress={() => {
                      setIncidentType(type.value);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1, minWidth: "45%" }]}
                  >
                    <View
                      className="p-4 rounded-2xl items-center border-2"
                      style={{
                        borderColor: isSelected ? type.color : colors.border,
                        backgroundColor: isSelected ? `${type.color}18` : colors.surface,
                      }}
                    >
                      <Text style={{ fontSize: 26, marginBottom: 4 }}>
                        {type.label.split(" ")[0]}
                      </Text>
                      <Text
                        className="font-semibold text-sm"
                        style={{ color: isSelected ? type.color : colors.foreground }}
                      >
                        {type.label.split(" ")[1]}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Description */}
          <View className="gap-2">
            <Text className="text-base font-bold text-foreground uppercase tracking-wide">What Happened?</Text>
            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <TextInput
                placeholder="Describe the emergency situation in detail..."
                placeholderTextColor={colors.muted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                className="p-4 text-foreground text-base"
                style={{ minHeight: 120, textAlignVertical: "top" }}
              />
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted">{remainingChars > 0 ? `${remainingChars} more chars needed` : "✓ Good"}</Text>
              <Text className="text-xs text-muted">{description.length}/2000</Text>
            </View>
          </View>

          {/* Location */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-foreground uppercase tracking-wide">Location</Text>
              <Pressable
                onPress={handleGetLocation}
                disabled={isLoadingLocation}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="flex-row items-center gap-2 px-4 py-2 bg-primary rounded-full">
                  {isLoadingLocation ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <>
                      <IconSymbol name="location.fill" size={14} color={colors.background} />
                      <Text className="text-sm font-bold text-background">Use GPS</Text>
                    </>
                  )}
                </View>
              </Pressable>
            </View>

            {latitude && longitude && (
              <View className="p-3 bg-surface rounded-xl border border-border flex-row items-center gap-2">
                <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} />
                <Text className="text-xs text-muted font-mono">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </Text>
              </View>
            )}

            <TextInput
              placeholder="Or enter address manually..."
              placeholderTextColor={colors.muted}
              value={address}
              onChangeText={setAddress}
              className="p-4 bg-surface rounded-2xl text-foreground border border-border text-base"
            />
          </View>

          {/* Multimedia Upload */}
          <View className="gap-3">
            <Text className="text-base font-bold text-foreground uppercase tracking-wide">
              Evidence (Optional)
            </Text>
            <Text className="text-xs text-muted -mt-2">Attach up to 5 photos or videos to help responders</Text>

            <View className="flex-row gap-2">
              <Pressable
                onPress={handlePickImage}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="border-2 border-dashed border-border rounded-2xl p-4 items-center gap-2">
                  <IconSymbol name="photo.fill" size={24} color={colors.muted} />
                  <Text className="text-xs text-muted font-medium">Gallery</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleTakePhoto}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="border-2 border-dashed border-border rounded-2xl p-4 items-center gap-2">
                  <IconSymbol name="camera.fill" size={24} color={colors.muted} />
                  <Text className="text-xs text-muted font-medium">Camera</Text>
                </View>
              </Pressable>
            </View>

            {/* Media Previews */}
            {pickedMedia.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {pickedMedia.map((m, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: m.uri }}
                      className="rounded-xl"
                      style={{ width: 80, height: 80 }}
                    />
                    <Pressable
                      onPress={() => handleRemoveMedia(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-error rounded-full items-center justify-center shadow"
                    >
                      <Text className="text-white font-bold" style={{ fontSize: 12 }}>✕</Text>
                    </Pressable>
                    {m.type === "video" && (
                      <View className="absolute bottom-1 left-1 bg-black/60 rounded px-1">
                        <Text className="text-white text-xs">▶</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ML Info Note */}
          <View className="bg-surface rounded-2xl p-4 border border-border flex-row gap-3 items-start">
            <Text style={{ fontSize: 18 }}>🤖</Text>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">AI-Assisted Prioritization</Text>
              <Text className="text-xs text-muted mt-0.5">
                Your report will be automatically analyzed and prioritized by our emergency AI.
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || isBusy}
            style={({ pressed }) => [{
              opacity: !isValid || isBusy ? 0.5 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed && isValid && !isBusy ? 0.98 : 1 }],
            }]}
          >
            <View className="bg-error p-5 rounded-2xl items-center flex-row justify-center gap-3">
              {isBusy ? (
                <>
                  <ActivityIndicator size="small" color={colors.background} />
                  <Text className="text-lg font-bold text-background">
                    {isUploadingMedia ? "Uploading Media..." : "Submitting..."}
                  </Text>
                </>
              ) : (
                <>
                  <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.background} />
                  <Text className="text-lg font-bold text-background">Submit Emergency Report</Text>
                </>
              )}
            </View>
          </Pressable>

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
