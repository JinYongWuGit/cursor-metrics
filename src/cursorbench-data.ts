import * as vscode from "vscode";

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
};

export async function loadCursorBenchSnapshot(
  extensionUri: vscode.Uri,
): Promise<CursorBenchSnapshot> {
  const uri = vscode.Uri.joinPath(extensionUri, "media", "cursorbench", "cursorbench-3.1.json");
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(bytes).toString("utf8");
  const parsed = JSON.parse(text) as CursorBenchSnapshot;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("CursorBench snapshot is not an object");
  }
  if (!Array.isArray(parsed.rows)) {
    throw new Error("CursorBench snapshot missing rows[]");
  }

  // Minimal runtime validation to avoid webview crashes.
  parsed.rows = parsed.rows
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

  return parsed;
}

