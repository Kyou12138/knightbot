import { describe, expect, test } from "vitest";
import { findActiveLyricIndex, parseLyric } from "./lyric";

describe("lyric parser", () => {
  test("parses standard lrc lines and sorts by timestamp", () => {
    const raw = `[00:12.00]第一句
[00:02.20]开头
[00:25.50]结尾`;

    const result = parseLyric(raw);

    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("开头");
    expect(result[1].text).toBe("第一句");
    expect(result[2].text).toBe("结尾");
    expect(result[0].timeMs).toBe(2200);
  });

  test("returns active index by playback position", () => {
    const lines = parseLyric(`[00:01.00]A\n[00:03.00]B\n[00:08.00]C`);
    expect(findActiveLyricIndex(lines, 500)).toBe(-1);
    expect(findActiveLyricIndex(lines, 1500)).toBe(0);
    expect(findActiveLyricIndex(lines, 3500)).toBe(1);
    expect(findActiveLyricIndex(lines, 9000)).toBe(2);
  });
});

