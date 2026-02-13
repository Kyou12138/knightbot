import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import FestiveBackground from "./src/components/FestiveBackground";
import TrackCard from "./src/components/TrackCard";
import { getTrackCover, getTrackLyric, getTrackUrl, searchTracks } from "./src/api/musicApi";
import { useAudioPlayer } from "./src/hooks/useAudioPlayer";
import type { MusicQuality, MusicSource, MusicTrack, PlayerTrack } from "./src/types";
import { theme } from "./src/styles/theme";
import { findActiveLyricIndex, parseLyric, type LyricLine } from "./src/utils/lyric";

const SOURCE_OPTIONS: MusicSource[] = ["netease", "tencent", "kugou"];
const QUALITY_OPTIONS: MusicQuality[] = ["128", "320"];
const PLAY_MODE_OPTIONS = [
  { value: "order", label: "顺序播放" },
  { value: "single", label: "单曲循环" },
  { value: "shuffle", label: "随机播放" }
] as const;
const FESTIVE_QUICK_KEYWORDS = ["春节序曲", "恭喜发财", "好运来", "难忘今宵", "新年快乐"];

type PlayMode = (typeof PLAY_MODE_OPTIONS)[number]["value"];

function formatMillis(ms: number): string {
  if (!ms || ms < 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function App() {
  const { width } = useWindowDimensions();
  const [keyword, setKeyword] = useState("春节");
  const [source, setSource] = useState<MusicSource>("netease");
  const [quality, setQuality] = useState<MusicQuality>("320");
  const [playMode, setPlayMode] = useState<PlayMode>("order");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [searching, setSearching] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [progressWidth, setProgressWidth] = useState(1);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [trackFinishedTick, setTrackFinishedTick] = useState(0);

  const lastRequestAt = useRef(0);
  const lyricScrollRef = useRef<ScrollView | null>(null);
  const lyricLinePositionRef = useRef<Record<number, number>>({});

  const player = useAudioPlayer({
    onTrackEnd: () => {
      setTrackFinishedTick((prev) => prev + 1);
    }
  });

  const isWide = width >= 980;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < tracks.length - 1;

  const headerText = useMemo(
    () =>
      currentTrack
        ? `正在播放：${currentTrack.title} - ${currentTrack.artist}`
        : "新春音乐会 · Music App",
    [currentTrack]
  );

  const activeLyricIndex = useMemo(
    () => findActiveLyricIndex(lyricLines, player.snapshot.positionMillis),
    [lyricLines, player.snapshot.positionMillis]
  );

  useEffect(() => {
    lyricLinePositionRef.current = {};
    setLyricLines(parseLyric(currentTrack?.lyricText ?? ""));
  }, [currentTrack?.lyricText]);

  useEffect(() => {
    if (activeLyricIndex < 0) return;
    const y = lyricLinePositionRef.current[activeLyricIndex];
    if (typeof y !== "number") return;
    lyricScrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
  }, [activeLyricIndex]);

  const waitForRateLimitWindow = useCallback(async () => {
    const now = Date.now();
    const delta = now - lastRequestAt.current;
    if (delta < 1050) {
      await new Promise((resolve) => setTimeout(resolve, 1050 - delta));
    }
    lastRequestAt.current = Date.now();
  }, []);

  const runApiCall = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      await waitForRateLimitWindow();
      return fn();
    },
    [waitForRateLimitWindow]
  );

  const playTrack = useCallback(
    async (track: MusicTrack, index: number) => {
      setErrorText("");
      setLoadingTrack(true);

      try {
        const playUrl = await runApiCall(() => getTrackUrl({ track, quality }));
        const coverUrl = await runApiCall(() => getTrackCover(track).catch(() => undefined));
        const lyricText = await runApiCall(() => getTrackLyric(track).catch(() => ""));

        await player.loadAndPlay(playUrl);
        setCurrentTrack({
          ...track,
          playUrl,
          coverUrl,
          lyricText
        });
        setCurrentIndex(index);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "播放失败，请稍后重试。");
      } finally {
        setLoadingTrack(false);
      }
    },
    [player, quality, runApiCall]
  );

  const playByIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      await playTrack(tracks[index], index);
    },
    [playTrack, tracks]
  );

  useEffect(() => {
    if (!trackFinishedTick) return;
    if (!tracks.length || currentIndex < 0) return;

    const autoAdvance = async () => {
      if (playMode === "single") {
        await playByIndex(currentIndex);
        return;
      }

      if (playMode === "shuffle") {
        if (tracks.length === 1) {
          await playByIndex(0);
          return;
        }
        let randomIndex = currentIndex;
        while (randomIndex === currentIndex) {
          randomIndex = Math.floor(Math.random() * tracks.length);
        }
        await playByIndex(randomIndex);
        return;
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex < tracks.length) {
        await playByIndex(nextIndex);
      } else {
        setErrorText("播放列表已结束，可切换随机模式继续畅听。");
      }
    };

    void autoAdvance();
  }, [trackFinishedTick, playMode, playByIndex, tracks.length, currentIndex]);

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) {
      setErrorText("请输入歌曲关键词。");
      return;
    }
    setErrorText("");
    setSearching(true);
    try {
      const result = await runApiCall(() => searchTracks({ keyword, source, count: 20, page: 1 }));
      setTracks(result);
      if (!result.length) {
        setErrorText("未搜索到结果，请换关键词或音源重试。");
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "搜索失败，请稍后重试。");
    } finally {
      setSearching(false);
    }
  }, [keyword, runApiCall, source]);

  const handlePrev = useCallback(async () => {
    if (!canPrev) return;
    await playByIndex(currentIndex - 1);
  }, [canPrev, currentIndex, playByIndex]);

  const handleNext = useCallback(async () => {
    if (!canNext) return;
    await playByIndex(currentIndex + 1);
  }, [canNext, currentIndex, playByIndex]);

  const handleQualityChange = useCallback(
    async (nextQuality: MusicQuality) => {
      setQuality(nextQuality);
      if (currentIndex >= 0 && tracks[currentIndex]) {
        await playTrack(tracks[currentIndex], currentIndex);
      }
    },
    [currentIndex, playTrack, tracks]
  );

  const onProgressLayout = useCallback((event: LayoutChangeEvent) => {
    setProgressWidth(Math.max(1, event.nativeEvent.layout.width));
  }, []);

  const seekFromPress = useCallback(
    (x: number) => {
      const ratio = x / progressWidth;
      void player.seekToRatio(ratio);
    },
    [player, progressWidth]
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.backgroundTop} />
        <View style={styles.backgroundBottom} />
        <FestiveBackground />

        <View style={[styles.page, isWide && styles.pageWide]}>
          <View style={[styles.leftPane, isWide && styles.leftPaneWide]}>
            <Text style={styles.title}>Music App</Text>
            <Text style={styles.subTitle}>年味播放器 · 免费跨平台</Text>

            <View style={styles.searchCard}>
              <Text style={styles.sectionTitle}>搜索音乐</Text>
              <TextInput
                value={keyword}
                onChangeText={setKeyword}
                placeholder="输入歌曲名、歌手名"
                placeholderTextColor="#B88666"
                style={styles.input}
                onSubmitEditing={() => {
                  void handleSearch();
                }}
              />

              <View style={styles.quickKeywords}>
                {FESTIVE_QUICK_KEYWORDS.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.quickKeyword}
                    onPress={() => {
                      setKeyword(item);
                      setTimeout(() => {
                        void handleSearch();
                      }, 0);
                    }}
                  >
                    <Text style={styles.quickKeywordText}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.optionRow}>
                {SOURCE_OPTIONS.map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.pill, item === source && styles.pillActive]}
                    onPress={() => setSource(item)}
                  >
                    <Text style={[styles.pillText, item === source && styles.pillTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
                onPress={() => {
                  void handleSearch();
                }}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator color="#5E0D0D" />
                ) : (
                  <Text style={styles.searchButtonText}>敲锣开场，开始搜索</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.listCard}>
              <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>歌曲列表</Text>
                <Text style={styles.listMeta}>{tracks.length} 首</Text>
              </View>
              <ScrollView style={styles.listScroller} contentContainerStyle={styles.listScrollerContent}>
                {tracks.map((track, index) => (
                  <TrackCard
                    key={`${track.source}-${track.id}-${index}`}
                    track={track}
                    active={currentTrack?.id === track.id && currentTrack.source === track.source}
                    onPress={() => {
                      void playTrack(track, index);
                    }}
                  />
                ))}
                {!searching && tracks.length === 0 ? (
                  <Text style={styles.emptyText}>
                    还没有结果，试试“恭喜发财”“春节序曲”等关键词。
                  </Text>
                ) : null}
              </ScrollView>
            </View>
          </View>

          <View style={[styles.rightPane, isWide && styles.rightPaneWide]}>
            <View style={styles.playerCard}>
              <Text style={styles.sectionTitle}>播放控制</Text>
              <Text numberOfLines={1} style={styles.nowPlaying}>
                {headerText}
              </Text>

              <View style={styles.coverWrapper}>
                {currentTrack?.coverUrl ? (
                  <Image source={{ uri: currentTrack.coverUrl }} style={styles.cover} />
                ) : (
                  <View style={styles.coverFallback}>
                    <Text style={styles.coverFallbackText}>福</Text>
                  </View>
                )}
              </View>

              <View style={styles.controlRow}>
                <Pressable
                  style={[styles.controlBtn, !canPrev && styles.controlBtnDisabled]}
                  onPress={() => {
                    void handlePrev();
                  }}
                >
                  <Text style={styles.controlBtnText}>上一首</Text>
                </Pressable>
                <Pressable
                  style={styles.controlBtnMain}
                  onPress={() => {
                    if (!currentTrack) return;
                    if (player.snapshot.isPlaying) {
                      void player.pause();
                    } else {
                      void player.play();
                    }
                  }}
                >
                  <Text style={styles.controlBtnMainText}>
                    {player.snapshot.isPlaying ? "暂停" : "播放"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.controlBtn, !canNext && styles.controlBtnDisabled]}
                  onPress={() => {
                    void handleNext();
                  }}
                >
                  <Text style={styles.controlBtnText}>下一首</Text>
                </Pressable>
              </View>

              <View style={styles.progressWrap} onLayout={onProgressLayout}>
                <Pressable
                  style={styles.progressTrack}
                  onPress={(event) => seekFromPress(event.nativeEvent.locationX)}
                >
                  <View style={[styles.progressValue, { width: `${player.progress * 100}%` }]} />
                </Pressable>
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatMillis(player.snapshot.positionMillis)}</Text>
                  <Text style={styles.timeText}>{formatMillis(player.snapshot.durationMillis)}</Text>
                </View>
              </View>

              <Text style={styles.modeTitle}>播放模式</Text>
              <View style={styles.optionRow}>
                {PLAY_MODE_OPTIONS.map((item) => (
                  <Pressable
                    key={item.value}
                    style={[styles.pill, playMode === item.value && styles.pillActive]}
                    onPress={() => setPlayMode(item.value)}
                  >
                    <Text style={[styles.pillText, playMode === item.value && styles.pillTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.modeTitle}>音质</Text>
              <View style={styles.optionRow}>
                {QUALITY_OPTIONS.map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.pill, item === quality && styles.pillActive]}
                    onPress={() => {
                      void handleQualityChange(item);
                    }}
                  >
                    <Text style={[styles.pillText, item === quality && styles.pillTextActive]}>
                      {item}k
                    </Text>
                  </Pressable>
                ))}
              </View>

              {loadingTrack || player.isBuffering ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={theme.colors.accent} />
                  <Text style={styles.loadingText}>正在缓冲...</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.lyricCard}>
              <Text style={styles.sectionTitle}>歌词</Text>
              <ScrollView
                ref={lyricScrollRef}
                style={styles.lyricScroller}
                contentContainerStyle={styles.lyricScrollerContent}
              >
                {lyricLines.length > 0 ? (
                  lyricLines.map((line, index) => (
                    <View
                      key={`${line.timeMs}-${index}`}
                      onLayout={(event) => {
                        lyricLinePositionRef.current[index] = event.nativeEvent.layout.y;
                      }}
                    >
                      <Text style={[styles.lyricText, index === activeLyricIndex && styles.lyricTextActive]}>
                        {line.text}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.lyricText}>
                    {currentTrack?.lyricText?.trim() || "选择歌曲后将在这里展示歌词。"}
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>
        </View>

        {errorText ? (
          <View style={styles.toastError}>
            <Text style={styles.toastErrorText}>{errorText}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.pageBottom
  },
  backgroundTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.pageTop,
    opacity: 0.9
  },
  backgroundBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.pageBottom,
    transform: [{ translateY: 220 }]
  },
  page: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  pageWide: {
    flexDirection: "row",
    gap: theme.spacing.lg
  },
  leftPane: {
    flex: 1.1,
    minHeight: 0
  },
  leftPaneWide: {
    marginRight: theme.spacing.sm
  },
  rightPane: {
    flex: 1,
    minHeight: 0,
    marginTop: theme.spacing.md
  },
  rightPaneWide: {
    marginTop: 0
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  subTitle: {
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: theme.spacing.md,
    fontSize: 14
  },
  searchCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.55)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "800"
  },
  input: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.46)",
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(255, 241, 211, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#5E0D0D",
    fontSize: 15
  },
  quickKeywords: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickKeyword: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.5)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(74, 11, 11, 0.72)"
  },
  quickKeywordText: {
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  optionRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pill: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.5)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: "rgba(107, 18, 18, 0.72)"
  },
  pillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accentDark
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  pillTextActive: {
    color: "#5E0D0D"
  },
  searchButton: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CF9B20"
  },
  searchButtonPressed: {
    opacity: 0.92
  },
  searchButtonText: {
    color: "#5E0D0D",
    fontWeight: "800",
    fontSize: 14
  },
  listCard: {
    marginTop: theme.spacing.md,
    backgroundColor: "rgba(66, 10, 10, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.45)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flex: 1,
    minHeight: 280
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  listMeta: {
    color: theme.colors.textMuted,
    fontSize: 12
  },
  listScroller: {
    marginTop: theme.spacing.sm
  },
  listScrollerContent: {
    paddingBottom: theme.spacing.sm
  },
  emptyText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    lineHeight: 20
  },
  playerCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.5)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md
  },
  nowPlaying: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 13
  },
  coverWrapper: {
    marginTop: theme.spacing.md,
    alignItems: "center"
  },
  cover: {
    width: 188,
    height: 188,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.accent
  },
  coverFallback: {
    width: 188,
    height: 188,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(140, 20, 20, 0.95)",
    justifyContent: "center",
    alignItems: "center"
  },
  coverFallbackText: {
    color: theme.colors.accent,
    fontSize: 86,
    fontWeight: "900"
  },
  controlRow: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.55)",
    borderRadius: theme.radius.sm,
    alignItems: "center",
    backgroundColor: "rgba(95, 15, 15, 0.92)"
  },
  controlBtnMain: {
    flex: 1.3,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.accentDark,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    backgroundColor: theme.colors.accent
  },
  controlBtnDisabled: {
    opacity: 0.4
  },
  controlBtnText: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  controlBtnMainText: {
    color: "#5E0D0D",
    fontWeight: "900"
  },
  progressWrap: {
    marginTop: theme.spacing.md
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: "rgba(255, 236, 194, 0.22)",
    overflow: "hidden"
  },
  progressValue: {
    height: "100%",
    backgroundColor: theme.colors.accent
  },
  timeRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  modeTitle: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: 12
  },
  loadingRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  loadingText: {
    color: theme.colors.textSecondary
  },
  lyricCard: {
    marginTop: theme.spacing.md,
    backgroundColor: "rgba(66, 10, 10, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.45)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flex: 1,
    minHeight: 240
  },
  lyricScroller: {
    marginTop: theme.spacing.sm
  },
  lyricScrollerContent: {
    paddingBottom: theme.spacing.md
  },
  lyricText: {
    color: theme.colors.textSecondary,
    lineHeight: 24,
    fontSize: 13,
    marginBottom: 5
  },
  lyricTextActive: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: "800"
  },
  toastError: {
    position: "absolute",
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    backgroundColor: "rgba(83, 8, 8, 0.97)",
    borderWidth: 1,
    borderColor: "#CE6B6B",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  toastErrorText: {
    color: theme.colors.danger,
    fontSize: 13
  }
});
