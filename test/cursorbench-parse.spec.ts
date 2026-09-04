import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseCursorBenchHtml } from "../src/cursorbench-parse";

const fixturePath = join(import.meta.dir, "fixtures", "cursorbench-3.2-table.html");

describe("parseCursorBenchHtml", () => {
  it("parses fixture HTML into expected rows", () => {
    const html = readFileSync(fixturePath, "utf8");
    const { version, rows } = parseCursorBenchHtml(html);

    expect(version).toBe("3.2");
    expect(rows).toHaveLength(3);
    expect(rows[0].model).toBe("Fable 5.1 Max");
    expect(rows[0].score).toBeCloseTo(0.734, 5);
    expect(rows[0].costPerTask).toBe(9.64);
    expect(rows[0].tokensPerTask).toBe(72060);
    expect(rows[0].stepsPerTask).toBe(70);
    expect(rows[1].model).toBe("Grok 4.6 Extra High");
    expect(rows[1].score).toBeCloseTo(0.708, 5);
    expect(rows[2].costPerTask).toBe(0.44);
  });

  it("throws when leaderboard table is missing", () => {
    expect(() => parseCursorBenchHtml("<html><body><h1>No table</h1></body></html>"))
      .toThrow("leaderboard table not found");
  });

  it("ignores malformed rows without crashing", () => {
    const html = readFileSync(fixturePath, "utf8");
    const { rows } = parseCursorBenchHtml(html);
    expect(rows.some((r) => r.model === "Broken Row")).toBeFalse();
  });
});
