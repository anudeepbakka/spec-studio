import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseAndValidate, stripCodeFences } from "./json";

describe("stripCodeFences", () => {
  it("leaves plain JSON unchanged", () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });

  it("removes a json code fence", () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("removes a bare code fence and surrounding whitespace", () => {
    expect(stripCodeFences('  ```\n{"a":1}\n```  ')).toBe('{"a":1}');
  });
});

describe("parseAndValidate", () => {
  const schema = z.object({ name: z.string(), count: z.number() });

  it("returns the validated value", () => {
    expect(parseAndValidate(schema, '```json\n{"name":"x","count":2}\n```')).toEqual({
      ok: true,
      value: { name: "x", count: 2 },
    });
  });

  it("reports invalid JSON without echoing the output", () => {
    expect(parseAndValidate(schema, "{not json")).toEqual({
      ok: false,
      errors: ["response is not valid JSON"],
    });
  });

  it("reports each schema error with its path", () => {
    const result = parseAndValidate(schema, '{"name":"x","count":"two"}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([expect.stringMatching(/^count: /)]);
    }
  });
});
