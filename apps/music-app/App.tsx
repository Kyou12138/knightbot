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
import { loadFavorites, loadRecents, saveFavorites, saveRecents } from "./src/storage/libraryStorage";
import type { MusicQuality, MusicSource, MusicTrack, PlayerTrack } from "./src/types";
import { theme } from "./src/styles/theme";
import { findActiveLyricIndex, parseLyric, type LyricLine } from "./src/utils/lyric";

const SOURCE_OPTIONS: MusicSource[] = ["netease", "tencent", "kugou"];
const QUALITY_OPTIONS: MusicQuality[] = ["128", "320"];
const PLAY_MODE_OPTIONS = [
  { value: "order", label: "顺序" },
  { value: "single", label: "单曲" },
  { value: "shuffle", label: "随机" }
] as const;
const MOBILE_TABS = [
  { value: "discover", label: "发现" },
  { value: "library", label: "收藏" },
  { value: "player", label: "播放" }
] as const;
const FESTIVE_QUICK_KEYWORDS = ["春节序曲", "恭喜发财", "好运来", "难忘今宵", "新年快乐"];
const MAX_RECENTS = 30;
const MAX_PINNED_LIBRARY = 6;

type PlayMode = (typeof PLAY_MODE_OPTIONS)[number]["value"];
type MobileTab = (typeof MOBILE_TABS)[number]["value"];

function trackKey(track: MusicTrack): string {
  return `${track.source}:${track.id}`;
}

function normalizeTrack(track: MusicTrack): MusicTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    source: track.source,
    urlId: track.urlId,
    picId: track.picId,
    lyricId: track.lyricId,
    directUrl: track.directUrl,
    directCover: track.directCover,
    directLyric: track.directLyric
  };
}

function formatMillis(ms: number): string {
  if (!ms || ms < 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function App() {
  const { width } = useWindowDimensions();
  const isMobile = width < 960;
  const compact = width < 420;
  const coverSize = isMobile ? Math.min(Math.max(width * 0.48, 150), 220) : 220;

  const [keyword, setKeyword] = useState("春节");
  const [source, setSource] = useState<MusicSource>("netease");
  const [quality, setQuality] = useState<MusicQuality>("320");
  const [playMode, setPlayMode] = useState<PlayMode>("order");
  const [mobileTab, setMobileTab] = useState<MobileTab>("discover");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [favorites, setFavorites] = useState<MusicTrack[]>([]);
  const [recents, setRecents] = useState<MusicTrack[]>([]);
  const [storageReady, setStorageReady] = useState(false);
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

  const currentIsFavorite = useMemo(() => {
    if (!currentTrack) return false;
    const key = trackKey(currentTrack);
    return favorites.some((item) => trackKey(item) === key);
  }, [currentTrack, favorites]);

  useEffect(() => {
    const bootstrapStorage = async () => {
      const [storedFavorites, storedRecents] = await Promise.all([loadFavorites(), loadRecents()]);
      setFavorites(storedFavorites);
      setRecents(storedRecents);
      setStorageReady(true);
    };

    bootstrapStorage().catch(() => {
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveFavorites(favorites).catch(() => undefined);
  }, [favorites, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    saveRecents(recents).catch(() => undefined);
  }, [recents, storageReady]);

  useEffect(() => {
    lyricLinePositionRef.current = {};
    setLyricLines(parseLyric(currentTrack?.lyricText ?? ""));
  }, [currentTrack?.lyricText]);

  useEffect(() => {
    if (activeLyricIndex < 0) return;
    const y = lyricLinePositionRef.current[activeLyricIndex];
    if (typeof y !== "number") return;
    lyricScrollRef.current?.scrollTo({ y: Math.max(0, y - 110), animated: true });
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

  const pushRecent = useCallback((track: MusicTrack) => {
    const normalized = normalizeTrack(track);
    const key = trackKey(normalized);
    setRecents((prev) => [normalized, ...prev.filter((item) => trackKey(item) !== key)].slice(0, MAX_RECENTS));
  }, []);

  const playTrack = useCallback(
    async (track: MusicTrack, indexHint?: number) => {
      setErrorText("");
      setLoadingTrack(true);

      try {
        const playUrl = await runApiCall(() => getTrackUrl({ track, quality }));
        const coverUrl = await runApiCall(() => getTrackCover(track).catch(() => undefined));
        const lyricText = await runApiCall(() => getTrackLyric(track).catch(() => ""));

        await player.loadAndPlay(playUrl);

        const resolvedIndex =
          typeof indexHint === "number" && indexHint >= 0
            ? indexHint
            : tracks.findIndex((item) => trackKey(item) === trackKey(track));

        setCurrentTrack({
          ...track,
          playUrl,
          coverUrl,
          lyricText
        });
        setCurrentIndex(resolvedIndex);
        pushRecent(track);
        if (isMobile) {
          setMobileTab("player");
        }
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "播放失败，请稍后重试。");
      } finally {
        setLoadingTrack(false);
      }
    },
    [isMobile, player, pushRecent, quality, runApiCall, tracks]
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

  const searchByKeyword = useCallback(
    async (value: string) => {
      const input = value.trim();
      if (!input) {
        setErrorText("请输入歌曲关键词。");
        return;
      }

      setErrorText("");
      setSearching(true);
      try {
        const result = await runApiCall(() => searchTracks({ keyword: input, source, count: 20, page: 1 }));
        setTracks(result);
        if (!result.length) {
          setErrorText("未搜索到结果，请换关键词或音源重试。");
        }
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "搜索失败，请稍后重试。");
      } finally {
        setSearching(false);
      }
    },
    [runApiCall, source]
  );

  const toggleFavorite = useCallback((track: MusicTrack) => {
    const normalized = normalizeTrack(track);
    const key = trackKey(normalized);
    setFavorites((prev) => {
      if (prev.some((item) => trackKey(item) === key)) {
        return prev.filter((item) => trackKey(item) !== key);
      }
      return [normalized, ...prev];
    });
  }, []);

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

  const renderSearchSection = () => (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>搜索音乐</Text>
      <TextInput
        value={keyword}
        onChangeText={setKeyword}
        placeholder="输入歌曲名、歌手名"
        placeholderTextColor="#C58C6A"
        style={[styles.input, compact && styles.inputCompact]}
        onSubmitEditing={() => {
          void searchByKeyword(keyword);
        }}
      />

      <View style={styles.quickKeywords}>
        {FESTIVE_QUICK_KEYWORDS.map((item) => (
          <Pressable
            key={item}
            style={styles.quickKeyword}
            onPress={() => {
              setKeyword(item);
              void searchByKeyword(item);
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
            <Text style={[styles.pillText, item === source && styles.pillTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.searchButton, pressed && styles.buttonPressed]}
        onPress={() => {
          void searchByKeyword(keyword);
        }}
        disabled={searching}
      >
        {searching ? <ActivityIndicator color="#5E0D0D" /> : <Text style={styles.searchButtonText}>敲锣开场，开始搜索</Text>}
      </Pressable>
    </View>
  );

  const renderTracksSection = (heightLimited = false) => (
    <View style={[styles.card, styles.listCard, heightLimited && styles.flexGrow]}>
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
          <Text style={styles.emptyText}>还没有结果，试试“恭喜发财”“春节序曲”等关键词。</Text>
        ) : null}
      </ScrollView>
    </View>
  );

  const renderLibrarySection = () => (
    <View style={styles.card}>
      <View style={styles.libraryHeader}>
        <Text style={styles.sectionTitle}>我的音乐</Text>
        <Pressable
          onPress={() => setRecents([])}
          style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.linkButtonText}>清空最近播放</Text>
        </Pressable>
      </View>

      <Text style={styles.libraryLabel}>收藏歌曲</Text>
      {favorites.slice(0, MAX_PINNED_LIBRARY).map((item) => (
        <Pressable
          key={`fav-${trackKey(item)}`}
          style={styles.libraryItem}
          onPress={() => {
            void playTrack(item);
          }}
        >
          <Text numberOfLines={1} style={styles.libraryItemTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.libraryItemMeta}>
            {item.artist}
          </Text>
        </Pressable>
      ))}
      {favorites.length === 0 ? <Text style={styles.libraryEmpty}>暂无收藏，播放时可一键加入。</Text> : null}

      <Text style={[styles.libraryLabel, styles.libraryLabelGap]}>最近播放</Text>
      {recents.slice(0, MAX_PINNED_LIBRARY).map((item) => (
        <Pressable
          key={`recent-${trackKey(item)}`}
          style={styles.libraryItem}
          onPress={() => {
            void playTrack(item);
          }}
        >
          <Text numberOfLines={1} style={styles.libraryItemTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.libraryItemMeta}>
            {item.artist}
          </Text>
        </Pressable>
      ))}
      {recents.length === 0 ? <Text style={styles.libraryEmpty}>最近还没有播放记录。</Text> : null}
    </View>
  );

  const renderPlayerSection = () => (
    <View style={styles.cardStrong}>
      <Text style={styles.sectionTitle}>播放控制</Text>
      <Text numberOfLines={1} style={styles.nowPlaying}>
        {headerText}
      </Text>

      <View style={styles.coverWrapper}>
        {currentTrack?.coverUrl ? (
          <Image source={{ uri: currentTrack.coverUrl }} style={[styles.cover, { width: coverSize, height: coverSize }]} />
        ) : (
          <View style={[styles.coverFallback, { width: coverSize, height: coverSize }]}>
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
          <Text style={styles.controlBtnMainText}>{player.snapshot.isPlaying ? "暂停" : "播放"}</Text>
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
        <Pressable style={styles.progressTrack} onPress={(event) => seekFromPress(event.nativeEvent.locationX)}>
          <View style={[styles.progressValue, { width: `${player.progress * 100}%` }]} />
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatMillis(player.snapshot.positionMillis)}</Text>
          <Text style={styles.timeText}>{formatMillis(player.snapshot.durationMillis)}</Text>
        </View>
      </View>

      <View style={styles.favoriteRow}>
        <Text style={styles.modeTitle}>收藏</Text>
        <Pressable
          disabled={!currentTrack}
          style={({ pressed }) => [
            styles.favoriteButton,
            !currentTrack && styles.controlBtnDisabled,
            pressed && styles.buttonPressed
          ]}
          onPress={() => {
            if (!currentTrack) return;
            toggleFavorite(currentTrack);
          }}
        >
          <Text style={styles.favoriteButtonText}>{currentIsFavorite ? "取消收藏" : "加入收藏"}</Text>
        </Pressable>
      </View>

      <Text style={styles.modeTitle}>播放模式</Text>
      <View style={styles.optionRow}>
        {PLAY_MODE_OPTIONS.map((item) => (
          <Pressable
            key={item.value}
            style={[styles.pill, playMode === item.value && styles.pillActive]}
            onPress={() => setPlayMode(item.value)}
          >
            <Text style={[styles.pillText, playMode === item.value && styles.pillTextActive]}>{item.label}</Text>
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
            <Text style={[styles.pillText, item === quality && styles.pillTextActive]}>{item}k</Text>
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
  );

  const renderLyricSection = () => (
    <View style={[styles.card, styles.flexGrow]}>
      <Text style={styles.sectionTitle}>歌词</Text>
      <ScrollView ref={lyricScrollRef} style={styles.lyricScroller} contentContainerStyle={styles.lyricScrollerContent}>
        {lyricLines.length > 0 ? (
          lyricLines.map((line, index) => (
            <View
              key={`${line.timeMs}-${index}`}
              onLayout={(event) => {
                lyricLinePositionRef.current[index] = event.nativeEvent.layout.y;
              }}
            >
              <Text style={[styles.lyricText, index === activeLyricIndex && styles.lyricTextActive]}>{line.text}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.lyricText}>{currentTrack?.lyricText?.trim() || "选择歌曲后将在这里展示歌词。"}</Text>
        )}
      </ScrollView>
    </View>
  );

  const renderMobileContent = () => {
    if (mobileTab === "discover") {
      return (
        <View style={styles.mobilePane}>
          {renderSearchSection()}
          {renderTracksSection(true)}
        </View>
      );
    }
    if (mobileTab === "library") {
      return <ScrollView style={styles.mobilePane}>{renderLibrarySection()}</ScrollView>;
    }
    return (
      <ScrollView style={styles.mobilePane}>
        {renderPlayerSection()}
        {renderLyricSection()}
      </ScrollView>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.backgroundTop} />
        <View style={styles.backgroundBottom} />
        <View style={styles.orbA} />
        <View style={styles.orbB} />
        <FestiveBackground />

        <View style={[styles.page, !isMobile && styles.pageDesktop]}>
          <View style={styles.heroRow}>
            <View>
              <Text style={[styles.title, compact && styles.titleCompact]}>Music App</Text>
              <Text style={styles.subTitle}>新春声场，喜乐流动</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>除夕特别版</Text>
            </View>
          </View>

          {isMobile ? (
            <>
              <View style={styles.mobileTabBar}>
                {MOBILE_TABS.map((item) => (
                  <Pressable
                    key={item.value}
                    style={[styles.mobileTab, mobileTab === item.value && styles.mobileTabActive]}
                    onPress={() => setMobileTab(item.value)}
                  >
                    <Text style={[styles.mobileTabText, mobileTab === item.value && styles.mobileTabTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.mobileBody}>{renderMobileContent()}</View>
            </>
          ) : (
            <View style={styles.desktopGrid}>
              <View style={styles.desktopColLeft}>
                {renderSearchSection()}
                {renderTracksSection(true)}
                {renderLibrarySection()}
              </View>
              <View style={styles.desktopColRight}>
                {renderPlayerSection()}
                {renderLyricSection()}
              </View>
            </View>
          )}
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
    backgroundColor: theme.colors.pageTop
  },
  backgroundBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.pageBottom,
    transform: [{ translateY: 180 }],
    opacity: 0.92
  },
  orbA: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(247, 201, 72, 0.09)",
    top: -70,
    right: -80
  },
  orbB: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255, 191, 107, 0.08)",
    bottom: 110,
    left: -60
  },
  page: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pageDesktop: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 1320,
    paddingHorizontal: 18
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  titleCompact: {
    fontSize: 30
  },
  subTitle: {
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontSize: 14
  },
  heroBadge: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.8)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(95, 18, 28, 0.8)"
  },
  heroBadgeText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "700"
  },
  mobileTabBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8
  },
  mobileTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.42)",
    backgroundColor: "rgba(80, 12, 21, 0.65)",
    borderRadius: 999,
    alignItems: "center",
    paddingVertical: 9
  },
  mobileTabActive: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accent
  },
  mobileTabText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  mobileTabTextActive: {
    color: "#5E0D0D"
  },
  mobileBody: {
    flex: 1
  },
  mobilePane: {
    flex: 1
  },
  desktopGrid: {
    flex: 1,
    flexDirection: "row",
    gap: 14
  },
  desktopColLeft: {
    flex: 1,
    minHeight: 0
  },
  desktopColRight: {
    flex: 1,
    minHeight: 0
  },
  card: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.48)",
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12
  },
  cardStrong: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.62)",
    backgroundColor: theme.colors.cardStrong,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12
  },
  flexGrow: {
    flex: 1,
    minHeight: 0
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "800"
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.46)",
    borderRadius: 12,
    backgroundColor: "rgba(255, 240, 215, 0.96)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#5E0D0D",
    fontSize: 15
  },
  inputCompact: {
    fontSize: 14
  },
  quickKeywords: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickKeyword: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.52)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(80, 12, 21, 0.65)"
  },
  quickKeywordText: {
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  optionRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pill: {
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.5)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(96, 14, 24, 0.72)"
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
    marginTop: 12,
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.accentDark
  },
  searchButtonText: {
    color: "#5E0D0D",
    fontWeight: "800",
    fontSize: 14
  },
  buttonPressed: {
    opacity: 0.82
  },
  listCard: {
    minHeight: 230
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  listMeta: {
    color: theme.colors.textMuted,
    fontSize: 12
  },
  listScroller: {
    marginTop: 10
  },
  listScrollerContent: {
    paddingBottom: 8
  },
  emptyText: {
    marginTop: 10,
    color: theme.colors.textMuted,
    lineHeight: 20
  },
  libraryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  linkButton: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  linkButtonText: {
    color: theme.colors.textMuted,
    fontSize: 12
  },
  libraryLabel: {
    marginTop: 10,
    color: theme.colors.accent,
    fontSize: 12
  },
  libraryLabelGap: {
    marginTop: 14
  },
  libraryItem: {
    marginTop: 7,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.38)",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(84, 12, 12, 0.65)"
  },
  libraryItemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13
  },
  libraryItemMeta: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: 11
  },
  libraryEmpty: {
    marginTop: 8,
    color: theme.colors.textMuted,
    fontSize: 12
  },
  nowPlaying: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 13
  },
  coverWrapper: {
    marginTop: 12,
    alignItems: "center"
  },
  cover: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.accent
  },
  coverFallback: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(140, 20, 20, 0.95)",
    justifyContent: "center",
    alignItems: "center"
  },
  coverFallbackText: {
    color: theme.colors.accent,
    fontSize: 82,
    fontWeight: "900"
  },
  controlRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(230, 190, 98, 0.55)",
    borderRadius: 11,
    alignItems: "center",
    backgroundColor: "rgba(95, 15, 15, 0.92)"
  },
  controlBtnMain: {
    flex: 1.3,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.accentDark,
    borderRadius: 11,
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
    marginTop: 12
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
  favoriteRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modeTitle: {
    marginTop: 10,
    color: theme.colors.textMuted,
    fontSize: 12
  },
  favoriteButton: {
    borderWidth: 1,
    borderColor: theme.colors.accentDark,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.accent
  },
  favoriteButtonText: {
    color: "#5E0D0D",
    fontSize: 12,
    fontWeight: "800"
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  loadingText: {
    color: theme.colors.textSecondary
  },
  lyricScroller: {
    marginTop: 10
  },
  lyricScrollerContent: {
    paddingBottom: 8
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
    left: 14,
    right: 14,
    bottom: 14,
    backgroundColor: "rgba(83, 8, 8, 0.97)",
    borderWidth: 1,
    borderColor: "#CE6B6B",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  toastErrorText: {
    color: theme.colors.danger,
    fontSize: 13
  }
});
