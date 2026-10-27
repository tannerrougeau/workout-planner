import { describe, expect, it } from "vitest";
import { EXERCISES } from "./exercises";
import { VIDEOS, videoEmbedUrl, videoSearchUrl } from "./videos";

describe("videos", () => {
  it("only lists exercises that exist, with plausible YouTube IDs", () => {
    const names = new Set(EXERCISES.map((e) => e.name));
    for (const [name, id] of Object.entries(VIDEOS)) {
      expect(names.has(name), `"${name}" is not an exercise name`).toBe(true);
      expect(id, `video ID for ${name}`).toMatch(/^[\w-]{11}$/);
    }
  });

  it("builds a YouTube form search for exercises without a picked video", () => {
    expect(videoSearchUrl("Romanian Deadlift")).toBe(
      "https://www.youtube.com/results?search_query=Romanian%20Deadlift%20exercise%20proper%20form",
    );
  });

  it("embeds picked videos without tracking cookies", () => {
    expect(videoEmbedUrl("abcdefghijk")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcdefghijk\?/);
  });
});
