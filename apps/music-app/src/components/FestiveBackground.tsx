import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { theme } from "../styles/theme";

export default function FestiveBackground() {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseA, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseA, { toValue: 0, duration: 1800, useNativeDriver: true })
      ])
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseB, { toValue: 1, duration: 2300, useNativeDriver: true }),
        Animated.timing(pulseB, { toValue: 0, duration: 2300, useNativeDriver: true })
      ])
    );
    loopA.start();
    loopB.start();
    return () => {
      loopA.stop();
      loopB.stop();
    };
  }, [pulseA, pulseB]);

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View
        style={[
          styles.lantern,
          styles.lanternLeft,
          {
            opacity: pulseA.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] }),
            transform: [
              { scale: pulseA.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }
            ]
          }
        ]}
      />
      <Animated.View
        style={[
          styles.lantern,
          styles.lanternRight,
          {
            opacity: pulseB.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.7] }),
            transform: [
              { scale: pulseB.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }
            ]
          }
        ]}
      />
      <View style={styles.windowPattern} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject
  },
  lantern: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(206, 42, 42, 0.30)"
  },
  lanternLeft: {
    top: -56,
    left: -48
  },
  lanternRight: {
    top: 70,
    right: -60
  },
  windowPattern: {
    position: "absolute",
    bottom: -30,
    left: -20,
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: "rgba(230, 190, 98, 0.18)",
    transform: [{ rotate: "45deg" }]
  }
});

