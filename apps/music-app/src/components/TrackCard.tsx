import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MusicTrack } from "../types";
import { theme } from "../styles/theme";

interface TrackCardProps {
  track: MusicTrack;
  active?: boolean;
  onPress: () => void;
}

export default function TrackCard({ track, active = false, onPress }: TrackCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && styles.cardPressed
      ]}
    >
      <View style={styles.row}>
        <Text numberOfLines={1} style={styles.title}>
          {track.title}
        </Text>
        <Text style={styles.badge}>{track.source}</Text>
      </View>
      <Text numberOfLines={1} style={styles.artist}>
        {track.artist}
      </Text>
      {track.album ? (
        <Text numberOfLines={1} style={styles.album}>
          {track.album}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.38)",
    backgroundColor: "rgba(84, 12, 12, 0.78)",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  cardActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.cardStrong
  },
  cardPressed: {
    transform: [{ scale: 0.99 }]
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    flex: 1
  },
  artist: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontSize: 13
  },
  album: {
    color: theme.colors.textMuted,
    marginTop: 2,
    fontSize: 12
  },
  badge: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.8)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: theme.colors.accent,
    fontSize: 11,
    textTransform: "uppercase"
  }
});

