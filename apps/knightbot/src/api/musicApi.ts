import type { MusicQuality, MusicSource, MusicTrack } from "../types";

const API_BASE = "https://music-api.gdstudio.xyz/api.php";

const DEFAULT_TIMEOUT_MS = 12000;

function buildUrl(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  return `${API_BASE}?${query.toString()}`;
}

async function fetchWithTimeout(url: string, timeout = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonOrText(url: string): Promise<unknown> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const rawText = await response.text();
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object") {
    const maybeObject = data as Record<string, unknown>;
    if (Array.isArray(maybeObject.data)) {
      return maybeObject.data;
    }
    if (Array.isArray(maybeObject.result)) {
      return maybeObject.result;
    }
    if (Array.isArray(maybeObject.list)) {
      return maybeObject.list;
    }
  }
  return [];
}

function normalizeTrack(raw: Record<string, unknown>, source: MusicSource): MusicTrack {
  const id = String(raw.id ?? raw.songid ?? raw.mid ?? raw.hash ?? "");
  const title = String(raw.name ?? raw.songname ?? raw.title ?? "未知歌曲");
  const artist = String(raw.artist ?? raw.author ?? raw.singer ?? "未知歌手");
  const albumValue = raw.album ?? raw.albumname;

  return {
    id,
    title,
    artist,
    album: albumValue ? String(albumValue) : undefined,
    source,
    urlId: raw.url_id ? String(raw.url_id) : undefined,
    picId: raw.pic_id ? String(raw.pic_id) : undefined,
    lyricId: raw.lyric_id ? String(raw.lyric_id) : undefined,
    directUrl: raw.url ? String(raw.url) : undefined,
    directCover: raw.pic ? String(raw.pic) : undefined,
    directLyric: raw.lrc ? String(raw.lrc) : undefined
  };
}

function normalizeUrl(data: unknown): string | null {
  if (typeof data === "string") {
    return data.startsWith("http") ? data : null;
  }
  if (data && typeof data === "object") {
    const item = data as Record<string, unknown>;
    const direct = item.url ?? item.data ?? item.play_url ?? item.playUrl;
    if (typeof direct === "string" && direct.startsWith("http")) {
      return direct;
    }
    if (direct && typeof direct === "object") {
      const nested = direct as Record<string, unknown>;
      if (typeof nested.url === "string" && nested.url.startsWith("http")) {
        return nested.url;
      }
    }
  }
  return null;
}

function normalizeText(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data && typeof data === "object") {
    const item = data as Record<string, unknown>;
    const raw = item.lyric ?? item.lrc ?? item.data ?? item.url;
    if (typeof raw === "string") {
      return raw;
    }
  }
  return "";
}

export async function searchTracks(input: {
  keyword: string;
  source: MusicSource;
  count?: number;
  page?: number;
}): Promise<MusicTrack[]> {
  const keyword = input.keyword.trim();
  if (!keyword) {
    return [];
  }

  const url = buildUrl({
    types: "search",
    source: input.source,
    name: keyword,
    count: input.count ?? 20,
    pages: input.page ?? 1
  });

  const payload = await fetchJsonOrText(url);
  const rows = asArray(payload);
  return rows
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => normalizeTrack(item, input.source))
    .filter((item) => !!item.id);
}

export async function getTrackUrl(input: {
  track: MusicTrack;
  quality: MusicQuality;
}): Promise<string> {
  if (input.track.directUrl?.startsWith("http")) {
    return input.track.directUrl;
  }

  const id = input.track.urlId || input.track.id;
  const url = buildUrl({
    types: "url",
    source: input.track.source,
    id,
    br: input.quality
  });

  const payload = await fetchJsonOrText(url);
  const playUrl = normalizeUrl(payload);
  if (!playUrl) {
    throw new Error("未拿到可播放链接，请更换音源或音质重试。");
  }
  return playUrl;
}

export async function getTrackCover(track: MusicTrack): Promise<string | undefined> {
  if (track.directCover?.startsWith("http")) {
    return track.directCover;
  }

  const id = track.picId || track.id;
  const url = buildUrl({
    types: "pic",
    source: track.source,
    id
  });
  const payload = await fetchJsonOrText(url);
  const cover = normalizeText(payload);
  return cover.startsWith("http") ? cover : undefined;
}

export async function getTrackLyric(track: MusicTrack): Promise<string> {
  if (track.directLyric) {
    return track.directLyric;
  }

  const id = track.lyricId || track.id;
  const url = buildUrl({
    types: "lyric",
    source: track.source,
    id
  });
  const payload = await fetchJsonOrText(url);
  return normalizeText(payload);
}

