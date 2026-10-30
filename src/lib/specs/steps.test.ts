import { describe, expect, it } from "vitest";
import { parseSseBuffer } from "./client";
import { stepFor } from "./steps";

describe("stepFor", () => {
  it("maps each saved status to the step that handles it", () => {
    expect(stepFor("draft")).toBe("request");
    expect(stepFor("questions_ready")).toBe("questions");
    expect(stepFor("answered")).toBe("generate");
    expect(stepFor("generating")).toBe("generate");
    expect(stepFor("failed")).toBe("generate");
    expect(stepFor("done")).toBe("result");
  });
});

describe("parseSseBuffer", () => {
  it("parses complete events and keeps an unfinished one for later", () => {
    const first = parseSseBuffer('event: progress\ndata: {"chars":12}\n\nevent: spec\ndata: {"spec"');
    expect(first.events).toEqual([{ event: "progress", data: '{"chars":12}' }]);
    expect(first.rest).toBe('event: spec\ndata: {"spec"');

    const second = parseSseBuffer(`${first.rest}:1}\n\n`);
    expect(second.events).toEqual([{ event: "spec", data: '{"spec":1}' }]);
    expect(second.rest).toBe("");
  });

  it("joins multi-line data and skips blocks without an event name", () => {
    const parsed = parseSseBuffer("data: orphan\n\nevent: error\ndata: a\ndata: b\n\n");
    expect(parsed.events).toEqual([{ event: "error", data: "a\nb" }]);
  });
});
