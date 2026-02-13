export type MusicSource = "netease" | "tencent" | "kugou" | "xiami" | "baidu";

export type MusicQuality = "128" | "320";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  source: MusicSource;
  urlId?: string;
  picId?: string;
  lyricId?: string;
  directUrl?: string;
  directCover?: string;
  directLyric?: string;
}

export interface PlayerTrack extends MusicTrack {
  playUrl: string;
  coverUrl?: string;
  lyricText?: string;
}

