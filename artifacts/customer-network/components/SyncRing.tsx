import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

// Small multicolor rotating + "breathing" ring shown while a background
// refresh is in flight over already-visible (cached) data — distinct from
// the full-screen loader used only on a cold start with no cache yet.
export default function SyncRing({ size = 18, backgroundColor }: { size?: number; backgroundColor: string }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    spin.start();
    pulse.start();
    return () => { spin.stop(); pulse.stop(); };
  }, [rotate, breathe]);

  const spinDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] });
  const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const holeInset = size * 0.18;
  const holeSize = size * 0.64;

  return (
    <Animated.View
      testID="sync-ring"
      style={{ width: size, height: size, transform: [{ rotate: spinDeg }, { scale }], opacity }}
    >
      <LinearGradient
        colors={["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#6366f1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2 }}
      />
      <View
        style={{
          position: "absolute",
          top: holeInset,
          left: holeInset,
          width: holeSize,
          height: holeSize,
          borderRadius: holeSize / 2,
          backgroundColor,
        }}
      />
    </Animated.View>
  );
}
