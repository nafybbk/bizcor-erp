import React from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 3;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

// Pinch-to-zoom + pan + double-tap, using react-native-gesture-handler's
// modern Gesture API + reanimated worklets — both were already installed
// as (unused) dependencies, just needed the babel plugin wired up. This
// replaces an earlier PanResponder/classic-handler attempt that didn't
// reliably recognize two-finger pinches on device.
export default function ZoomableImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const settleTranslate = () => {
    "worklet";
    const maxX = Math.max(0, (width * (scale.value - 1)) / 2);
    const maxY = Math.max(0, (height * (scale.value - 1)) / 2);
    const clampedX = clamp(translateX.value, -maxX, maxX);
    const clampedY = clamp(translateY.value, -maxY, maxY);
    translateX.value = withSpring(clampedX);
    translateY.value = withSpring(clampedY);
    savedTranslateX.value = clampedX;
    savedTranslateY.value = clampedY;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }
      savedScale.value = scale.value;
      settleTranslate();
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      if (savedScale.value <= 1.01) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      if (savedScale.value <= 1.01) return;
      settleTranslate();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={{ width, height, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Animated.Image source={{ uri }} resizeMode="contain" style={[{ width, height }, animatedStyle]} />
      </Animated.View>
    </GestureDetector>
  );
}
