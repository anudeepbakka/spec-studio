import { describe, expect, it } from "vitest";
import { estimatedProgress, matchesQuery, relativeDate, stageForProgress } from "./format";

const NOW = new Date("2026-10-30T12:00:00.000Z");

describe("relativeDate", () => {
  it("reads recent times in plain words", () => {
    expect(relativeDate("2026-10-30T11:59:40.000Z", NOW)).toBe("just now");
    expect(relativeDate("2026-10-30T11:48:00.000Z", NOW)).toBe("12 min ago");
    expect(relativeDate("2026-10-30T09:00:00.000Z", NOW)).toBe("3 h ago");
    expect(relativeDate("2026-10-29T10:00:00.000Z", NOW)).toBe("yesterday");
    expect(relativeDate("2026-10-27T10:00:00.000Z", NOW)).toBe("3 days ago");
  });

  it("falls back to a short date after a week", () => {
    expect(relativeDate("2026-10-01T10:00:00.000Z", NOW)).toBe("Oct 1, 2026");
  });
});

describe("generation stages", () => {
  it("advances with the streamed count and stays on the last stage", () => {
    expect(stageForProgress(0)).toBe(0);
    expect(stageForProgress(450)).toBe(1);
    expect(stageForProgress(1500)).toBe(2);
    expect(stageForProgress(9000)).toBe(4);
  });

  it("estimates progress from a typical length, and never reports done early", () => {
    expect(estimatedProgress(2000)).toBe(0.5);
    expect(estimatedProgress(100000)).toBe(0.95);
  });
});

describe("matchesQuery", () => {
  it("matches the title or the status label, ignoring case and extra spaces", () => {
    expect(matchesQuery("Export order history", "Done", "  ORDER   history ")).toBe(true);
    expect(matchesQuery("Export order history", "Done", "failed")).toBe(false);
    expect(matchesQuery("Export order history", "Failed", "failed")).toBe(true);
  });

  it("shows everything for an empty query", () => {
    expect(matchesQuery("Anything", "Draft", "   ")).toBe(true);
  });
});
