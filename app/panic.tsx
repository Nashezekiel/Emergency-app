import { View, Text, Pressable, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay,
  Easing
} from "react-native-reanimated";

export default function PanicScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [countdown, setCountdown] = useState(5);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const hasSubmittedRef = useRef(false);
  const retryAttemptRef = useRef(0);

  // Animation values
  const pulseScale1 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0.8);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0.8);

  // Start animations on mount
  useEffect(() => {
    pulseScale1.value = withRepeat(
      withTiming(2, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    pulseOpacity1.value = withRepeat(
      withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    pulseScale2.value = withDelay(
      1000,
      withRepeat(
        withTiming(2, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    pulseOpacity2.value = withDelay(
      1000,
      withRepeat(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
  }, [pulseOpacity1, pulseOpacity2, pulseScale1, pulseScale2]);

  const animatedStyle1 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale1.value }],
      opacity: pulseOpacity1.value,
    };
  });

  const animatedStyle2 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale2.value }],
      opacity: pulseOpacity2.value,
    };
  });

  const createIncident = trpc.incidents.create.useMutation({
    onSuccess: async () => {
      setSent(true);
      setIsDispatching(false);
      retryAttemptRef.current = 0;
      setCountdown(0);
      try {
        await Promise.all([
          utils.incidents.getMyCivilianIncidents.invalidate(),
          utils.incidents.getResponderDashboard.invalidate(),
        ]);
      } catch (err) {
        // Ignore invalidation errors so they don't block the UI navigation back
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        router.back();
      }, 2000);
    },
    onError: (error) => {
      const normalizedMessage = String(error.message || "").toLowerCase();
      const isTransientNetworkError =
        normalizedMessage.includes("abort") || normalizedMessage.includes("network request failed");
      if (isTransientNetworkError && retryAttemptRef.current < 1) {
        retryAttemptRef.current += 1;
        setTimeout(() => {
          setIsDispatching(true);
          sendPanicAlert();
        }, 1200);
        return;
      }

      setIsDispatching(false);
      hasSubmittedRef.current = false;
      retryAttemptRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Alert Failed",
        `Could not send panic alert: ${error.message}\n\nPlease call emergency services directly.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => router.back() },
          {
            text: "Retry",
            onPress: () => {
              setIsDispatching(true);
              sendPanicAlert();
            },
          },
        ]
      );
    },
  });

  const sendPanicAlert = useCallback(() => {
    createIncident.mutate({
      incidentType: "other",
      description: "PANIC ALERT - Emergency assistance needed immediately",
      latitude: location?.latitude,
      longitude: location?.longitude,
      isPanicAlert: true,
    });
  }, [createIncident.mutate, location]);

  // Get location on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission denied");
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (error) {
        console.error("Error getting location:", error);
      }
    };

    getLocation();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (isCancelled || countdown === 0) return;

    if (countdown > 0) {
       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    const timer = setTimeout(() => {
      if (countdown === 1) {
        if (hasSubmittedRef.current) return;
        hasSubmittedRef.current = true;
        setIsDispatching(true);
        setCountdown(0);
        // Send panic alert
        sendPanicAlert();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isCancelled, location, sendPanicAlert, createIncident.isPending, hasSubmittedRef]);

  const handleCancel = () => {
    setIsCancelled(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  return (
    <ScreenContainer className="items-center justify-center bg-black">
      <View className="absolute inset-0 bg-error opacity-10" />
      
      <View className="gap-12 items-center flex-1 justify-center z-10 w-full">
        {/* Title Area */}
        <View className="gap-2 items-center">
          <Text className="text-3xl font-extrabold text-white tracking-widest uppercase">
            Emergency Alert
          </Text>
          <Text className="text-lg text-white opacity-80 font-medium text-center">
            {countdown > 0
              ? "Dispatching in..."
              : isDispatching
                ? "Sending SOS alert..."
                : "Alert Sent"}
          </Text>
        </View>

        {/* Large Countdown Circle with Radar Animations */}
        <View className="items-center justify-center relative my-10">
          {/* Radar Waves */}
          <Animated.View 
            style={[styles.radarCircle, { borderColor: colors.error, backgroundColor: `${colors.error}20` }, animatedStyle1]} 
          />
          <Animated.View 
            style={[styles.radarCircle, { borderColor: colors.error, backgroundColor: `${colors.error}20` }, animatedStyle2]} 
          />
          
          {/* Center Button */}
          <View
            className="items-center justify-center rounded-full shadow-lg shadow-error/50"
            style={[
              styles.centerCircle,
              {
                backgroundColor: colors.error,
              }
            ]}
          >
            <Text className="font-bold text-white shadow-sm" style={{ fontSize: 80, lineHeight: 90 }}>
              {countdown > 0 ? countdown : isDispatching ? "..." : sent ? "✓" : "!"}
            </Text>
          </View>
        </View>


        {/* Bottom Actions Area */}
        <View className="gap-6 items-center w-full px-8 mt-4">
          {/* Location Status */}
          {location ? (
            <View className="flex-row items-center bg-white/10 px-4 py-2 rounded-full border border-white/20">
              <View className="w-2 h-2 rounded-full bg-success mr-2 shadow-sm shadow-success" />
              <Text className="text-sm text-white font-medium">GPS Located: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</Text>
            </View>
          ) : (
            <View className="flex-row items-center bg-white/10 px-4 py-2 rounded-full border border-white/20">
              <ActivityIndicator size="small" color={colors.warning} className="mr-2" />
              <Text className="text-sm text-white font-medium">Acquiring position...</Text>
            </View>
          )}

          {/* Cancel Button */}
          <Pressable
            onPress={handleCancel}
            disabled={createIncident.isPending || isDispatching}
            style={({ pressed }) => [
              {
                opacity: createIncident.isPending || isDispatching ? 0.6 : pressed ? 0.7 : 1,
                width: '100%'
              },
            ]}
          >
            <View className="w-full py-4 bg-transparent rounded-2xl border-2 border-white/30 items-center justify-center backdrop-blur-md">
              <Text className="text-xl font-bold text-white uppercase tracking-wider">Cancel Alert</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  radarCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
  },
  centerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    zIndex: 10,
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  }
});
