import { describe, expect, it } from "vitest";
import { distanceKm, eventLink, eventStatus, formatDistance, mediaProblem, parseEventLink, roundToKm } from "./format";

const ID = "3f2b9a64-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

describe("event links", () => {
  it("builds a clean link from the current page, with the invite code only when given", () => {
    expect(eventLink("https://example.com/app/?event=old#top", ID)).toBe(`https://example.com/app/?event=${ID}`);
    expect(eventLink("https://example.com/app/", ID, "a1b2c3d4e5f6")).toBe(`https://example.com/app/?event=${ID}&code=a1b2c3d4e5f6`);
  });

  it("parses valid links and ignores malformed ones", () => {
    expect(parseEventLink(`?event=${ID}&code=a1b2c3d4e5f6`)).toEqual({ eventId: ID, code: "a1b2c3d4e5f6" });
    expect(parseEventLink(`?event=${ID}&code=nope`)).toEqual({ eventId: ID });
    expect(parseEventLink("?event=not-an-id")).toBeUndefined();
    expect(parseEventLink("")).toBeUndefined();
  });
});

describe("distances", () => {
  it("measures great-circle distance", () => {
    // Central Park to Times Square is roughly 2.5 km.
    const km = distanceKm({ lat: 40.7829, lng: -73.9654 }, { lat: 40.758, lng: -73.9855 });
    expect(km).toBeGreaterThan(2.9);
    expect(km).toBeLessThan(3.4);
  });

  it("formats short and long distances", () => {
    expect(formatDistance(0.04)).toBe("100 m");
    expect(formatDistance(0.46)).toBe("500 m");
    expect(formatDistance(3.24)).toBe("3.2 km");
    expect(formatDistance(18.6)).toBe("19 km");
  });

  it("rounds a home location to about a kilometre", () => {
    expect(roundToKm({ lat: 40.712776, lng: -74.005974 })).toEqual({ lat: 40.71, lng: -74.01 });
  });
});

describe("mediaProblem", () => {
  it("accepts photos and videos within the size limit", () => {
    expect(mediaProblem({ type: "image/jpeg", size: 3_000_000 })).toBeUndefined();
    expect(mediaProblem({ type: "video/mp4", size: 40 * 1024 * 1024 })).toBeUndefined();
  });

  it("rejects other file types and files over 50 MB", () => {
    expect(mediaProblem({ type: "application/pdf", size: 1000 })).toMatch(/photo|video/i);
    expect(mediaProblem({ type: "video/mp4", size: 51 * 1024 * 1024 })).toMatch(/50 MB/);
  });
});

describe("eventStatus", () => {
  const base = { cancelled: false, starts_at: "2026-10-30T10:00:00Z", duration_min: 60, capacity: 10, going: 3 };
  const at = (iso: string) => new Date(iso);

  it("is open before the start, live during, ended after", () => {
    expect(eventStatus(base, at("2026-10-30T09:00:00Z"))).toBe("open");
    expect(eventStatus(base, at("2026-10-30T10:30:00Z"))).toBe("live");
    expect(eventStatus(base, at("2026-10-30T11:01:00Z"))).toBe("ended");
  });

  it("reports full and cancelled events", () => {
    expect(eventStatus({ ...base, going: 10 }, at("2026-10-30T09:00:00Z"))).toBe("full");
    expect(eventStatus({ ...base, capacity: null, going: 99 }, at("2026-10-30T09:00:00Z"))).toBe("open");
    expect(eventStatus({ ...base, cancelled: true }, at("2026-10-30T09:00:00Z"))).toBe("cancelled");
  });
});
