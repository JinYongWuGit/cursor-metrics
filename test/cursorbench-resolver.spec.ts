import { beforeAll, describe, expect, it, mock } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import type { CursorBenchSnapshot } from "../src/cursorbench-data";

const fixtureHtml = readFileSync(
  join(import.meta.dir, "fixtures", "cursorbench-3.2-table.html"),
  "utf8",
);

mock.module("vscode", () => ({
  Uri: {
    joinPath: (_base: unknown, ...parts: string[]) => ({
      fsPath: parts.join("/"),
      path: parts.join("/"),
      scheme: "file",
    }),
  },
  workspace: {
    fs: {
      readFile: async () => new TextEncoder().encode(
        JSON.stringify({
          version: "3.2",
          capturedAt: "2026-09-04",
          sourceUrl: "https://cursor.com/cursorbench",
          rows: [
            {
              model: "Bundled Model",
              score: 0.5,
              costPerTask: 1,
              tokensPerTask: 1000,
              stepsPerTask: 10,
            },
          ],
        }),
      ),
    },
  },
}));

let resolveCursorBenchSnapshot: typeof import("../src/cursorbench-resolver").resolveCursorBenchSnapshot;
let CACHE_KEY: string;
let CACHE_TTL_MS: number;

beforeAll(async () => {
  const mod = await import("../src/cursorbench-resolver");
  resolveCursorBenchSnapshot = mod.resolveCursorBenchSnapshot;
  CACHE_KEY = mod.CACHE_KEY;
  CACHE_TTL_MS = mod.CACHE_TTL_MS;
});

function makeContext(initial?: CursorBenchSnapshot) {
  let stored = initial ?? undefined;
  return {
    extensionUri: { fsPath: "/ext", path: "/ext", scheme: "file" } as any,
    globalState: {
      get: <T>(_key: string) => stored as T | undefined,
      update: async (_key: string, value: CursorBenchSnapshot) => {
        stored = value;
      },
    },
  } as any;
}

const sampleSnapshot: CursorBenchSnapshot = {
  version: "3.2",
  capturedAt: new Date().toISOString(),
  sourceUrl: "https://cursor.com/cursorbench",
  provenance: "live",
  rows: [
    {
      model: "Fable 5.1 Max",
      score: 0.734,
      costPerTask: 9.64,
      tokensPerTask: 72060,
      stepsPerTask: 70,
    },
  ],
};

describe("resolveCursorBenchSnapshot", () => {
  it("returns fresh cache without network call", async () => {
    const context = makeContext({ ...sampleSnapshot, provenance: "cache" });
    const fetchImpl = async () => {
      throw new Error("should not fetch");
    };

    const snap = await resolveCursorBenchSnapshot(context, { fetchImpl });
    expect(snap.provenance).toBe("cache");
    expect(snap.rows[0].model).toBe("Fable 5.1 Max");
  });

  it("fetches when cache is stale and updates globalState", async () => {
    const stale = {
      ...sampleSnapshot,
      capturedAt: new Date(Date.now() - CACHE_TTL_MS - 1000).toISOString(),
      provenance: "cache" as const,
    };
    const context = makeContext(stale);
    let fetched = false;
    const fetchImpl = async () => {
      fetched = true;
      return {
        ok: true,
        text: async () => fixtureHtml,
      } as Response;
    };

    const snap = await resolveCursorBenchSnapshot(context, { fetchImpl });
    expect(fetched).toBeTrue();
    expect(snap.provenance).toBe("live");
    expect(context.globalState.get(CACHE_KEY)?.version).toBe("3.2");
  });

  it("returns stale cache when fetch fails", async () => {
    const stale = {
      ...sampleSnapshot,
      capturedAt: new Date(Date.now() - CACHE_TTL_MS - 1000).toISOString(),
      provenance: "cache" as const,
    };
    const context = makeContext(stale);
    const fetchImpl = async () => ({ ok: false, status: 500, text: async () => "" }) as Response;

    const snap = await resolveCursorBenchSnapshot(context, { fetchImpl });
    expect(snap.provenance).toBe("cache");
    expect(snap.stale).toBeTrue();
  });

  it("force refresh bypasses fresh cache", async () => {
    const context = makeContext({ ...sampleSnapshot, provenance: "cache" });
    let fetched = false;
    const fetchImpl = async () => {
      fetched = true;
      return {
        ok: true,
        text: async () => fixtureHtml,
      } as Response;
    };

    const snap = await resolveCursorBenchSnapshot(context, { force: true, fetchImpl });
    expect(fetched).toBeTrue();
    expect(snap.provenance).toBe("live");
  });
});
