import * as vscode from "vscode";

export type CursorBenchProvenance = "live" | "cache" | "bundled";

export type CursorBenchRow = {
  model: string;
  score: number;
  costPerTask: number;
  tokensPerTask: number;
  stepsPerTask: number;
};

export type CursorBenchSnapshot = {
  version: string;
  capturedAt: string;
  sourceUrl: string;
  rows: CursorBenchRow[];
  provenance: CursorBenchProvenance;
  stale?: boolean;
};

export const CURSORBENCH_BUNDLED_FILE = "cursorbench-latest.json";

export function sanitizeCursorBenchRows(rows: CursorBenchRow[]): CursorBenchRow[] {
  return rows
    .filter((r) =>
      r
      && typeof r.model === "string"
      && Number.isFinite(r.score)
      && Number.isFinite(r.costPerTask)
      && Number.isFinite(r.tokensPerTask)
      && Number.isFinite(r.stepsPerTask),
    )
    .map((r) => ({
      model: r.model,
      score: r.score,
      costPerTask: r.costPerTask,
      tokensPerTask: r.tokensPerTask,
      stepsPerTask: r.stepsPerTask,
    }));
}

export async function loadBundledCursorBenchSnapshot(
  extensionUri: vscode.Uri,
): Promise<CursorBenchSnapshot> {
  const uri = vscode.Uri.joinPath(extensionUri, "media", "cursorbench", CURSORBENCH_BUNDLED_FILE);
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(bytes).toString("utf8");
  const parsed = JSON.parse(text) as Omit<CursorBenchSnapshot, "provenance" | "stale">;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("CursorBench snapshot is not an object");
  }
  if (!Array.isArray(parsed.rows)) {
    throw new Error("CursorBench snapshot missing rows[]");
  }

  return {
    version: parsed.version ?? "unknown",
    capturedAt: parsed.capturedAt ?? "",
    sourceUrl: parsed.sourceUrl ?? "https://cursor.com/cursorbench",
    rows: sanitizeCursorBenchRows(parsed.rows),
    provenance: "bundled",
  };
}
