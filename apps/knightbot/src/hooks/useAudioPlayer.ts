import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio, AVPlaybackStatus, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

export interface PlaybackSnapshot {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
}

const initialSnapshot: PlaybackSnapshot = {
  isLoaded: false,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 0
};

export function useAudioPlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(initialSnapshot);
  const [isBuffering, setIsBuffering] = useState(false);

  const onStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setSnapshot(initialSnapshot);
      setIsBuffering(false);
      return;
    }
    setSnapshot({
      isLoaded: status.isLoaded,
      isPlaying: status.isPlaying,
      positionMillis: status.positionMillis ?? 0,
      durationMillis: status.durationMillis ?? 0
    });
    setIsBuffering(Boolean(status.isBuffering));
  }, []);

  useEffect(() => {
    const configure = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
    };

    configure().catch(() => {
      // Keep silent here; runtime errors are surfaced when playback starts.
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const loadAndPlay = useCallback(
    async (url: string) => {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, progressUpdateIntervalMillis: 400 },
        onStatusUpdate
      );
      soundRef.current = sound;
    },
    [onStatusUpdate]
  );

  const play = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
    }
  }, []);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
    }
  }, []);

  const seekToRatio = useCallback(
    async (ratio: number) => {
      if (!soundRef.current || snapshot.durationMillis <= 0) {
        return;
      }
      const clamped = Math.max(0, Math.min(1, ratio));
      await soundRef.current.setPositionAsync(Math.floor(snapshot.durationMillis * clamped));
    },
    [snapshot.durationMillis]
  );

  const unload = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setSnapshot(initialSnapshot);
    }
  }, []);

  const progress = useMemo(() => {
    if (!snapshot.durationMillis) {
      return 0;
    }
    return Math.max(0, Math.min(1, snapshot.positionMillis / snapshot.durationMillis));
  }, [snapshot.durationMillis, snapshot.positionMillis]);

  return {
    snapshot,
    isBuffering,
    progress,
    loadAndPlay,
    play,
    pause,
    seekToRatio,
    unload
  };
}

