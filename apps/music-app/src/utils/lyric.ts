export interface LyricLine {
  timeMs: number;
  text: string;
}

const timeTagRegex = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;

function parseMs(minute: string, second: string, fraction?: string): number {
  const m = Number(minute) || 0;
  const s = Number(second) || 0;
  const ms = Number((fraction || "0").padEnd(3, "0").slice(0, 3)) || 0;
  return m * 60_000 + s * 1000 + ms;
}

export function parseLyric(rawText: string): LyricLine[] {
  const text = rawText.trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const parsed: LyricLine[] = [];

  for (const line of lines) {
    const tags = Array.from(line.matchAll(timeTagRegex));
    const pureText = line.replace(timeTagRegex, "").trim();
    if (tags.length === 0) {
      continue;
    }

    for (const tag of tags) {
      parsed.push({
        timeMs: parseMs(tag[1], tag[2], tag[3]),
        text: pureText || "..."
      });
    }
  }

  parsed.sort((a, b) => a.timeMs - b.timeMs);
  return parsed;
}

export function findActiveLyricIndex(lines: LyricLine[], positionMs: number): number {
  if (!lines.length) return -1;
  let low = 0;
  let high = lines.length - 1;
  let answer = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].timeMs <= positionMs) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer;
}

