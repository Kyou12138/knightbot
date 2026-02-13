import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MusicTrack } from "../types";

const FAVORITES_KEY = "music-app:favorites";
const RECENTS_KEY = "music-app:recents";
const MAX_RECENTS = 30;

function dedupeTracks(list: MusicTrack[]): MusicTrack[] {
  const seen = new Set<string>();
  const output: MusicTrack[] = [];
  for (const track of list) {
    const key = `${track.source}:${track.id}`;
    if (!track.id || seen.has(key)) continue;
    seen.add(key);
    output.push(track);
  }
  return output;
}

async function safeRead(key: string): Promise<MusicTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeTracks(parsed.filter((item) => item && typeof item === "object") as MusicTrack[]);
  } catch {
    return [];
  }
}

async function safeWrite(key: string, value: MusicTrack[]): Promise<void> {
  const normalized = dedupeTracks(value);
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
}

export async function loadFavorites(): Promise<MusicTrack[]> {
  return safeRead(FAVORITES_KEY);
}

export async function saveFavorites(value: MusicTrack[]): Promise<void> {
  return safeWrite(FAVORITES_KEY, value);
}

export async function loadRecents(): Promise<MusicTrack[]> {
  return safeRead(RECENTS_KEY);
}

export async function saveRecents(value: MusicTrack[]): Promise<void> {
  await safeWrite(RECENTS_KEY, value.slice(0, MAX_RECENTS));
}

