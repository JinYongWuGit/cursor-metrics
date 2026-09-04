import * as vscode from "vscode";
import {
  CURSORBENCH_BUNDLED_FILE,
  type CursorBenchSnapshot,
  loadBundledCursorBenchSnapshot,
  sanitizeCursorBenchRows,
} from "./cursorbench-data";
import { CURSORBENCH_SOURCE_URL, parseCursorBenchHtml } from "./cursorbench-parse";

export const CACHE_KEY = "cursorbench.cache";
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ResolveOptions = {
  force?: boolean;
  fetchImpl?: typeof fetch;
};

function isFresh(capturedAt: string, now = Date.now()): boolean {
  const ts = Date.parse(capturedAt);
  if (!Number.isFinite(ts)) return false;
  return now - ts < CACHE_TTL_MS;
}

function readCache(context: vscode.ExtensionContext): CursorBenchSnapshot | null {
  const cached = context.globalState.get<CursorBenchSnapshot>(CACHE_KEY);
  if (!cached || !Array.isArray(cached.rows)) return null;
  return {
    ...cached,
    rows: sanitizeCursorBenchRows(cached.rows),
  };
}

async function writeCache(context: vscode.ExtensionContext, snapshot: CursorBenchSnapshot): Promise<void> {
  await context.globalState.update(CACHE_KEY, snapshot);
}

async function fetchLiveSnapshot(fetchImpl: typeof fetch): Promise<CursorBenchSnapshot> {
  const res = await fetchImpl(CURSORBENCH_SOURCE_URL, {
    headers: {
      "User-Agent": "cursor-metrics-extension",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`CursorBench fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  const parsed = parseCursorBenchHtml(html);
  const capturedAt = new Date().toISOString();
  return {
    version: parsed.version,
    capturedAt,
    sourceUrl: CURSORBENCH_SOURCE_URL,
    rows: sanitizeCursorBenchRows(parsed.rows),
    provenance: "live",
  };
}

function asCached(snapshot: CursorBenchSnapshot, stale = false): CursorBenchSnapshot {
  return {
    ...snapshot,
    provenance: "cache",
    stale,
  };
}

export async function resolveCursorBenchSnapshot(
  context: vscode.ExtensionContext,
  options: ResolveOptions = {},
): Promise<CursorBenchSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cached = readCache(context);

  if (!options.force && cached && isFresh(cached.capturedAt)) {
    return asCached(cached, false);
  }

  try {
    const live = await fetchLiveSnapshot(fetchImpl);
    await writeCache(context, live);
    return live;
  } catch {
    if (cached) {
      return asCached(cached, true);
    }
    return loadBundledCursorBenchSnapshot(context.extensionUri);
  }
}

export { CURSORBENCH_BUNDLED_FILE };
