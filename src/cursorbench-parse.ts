import type { CursorBenchRow } from "./cursorbench-data";

export const CURSORBENCH_SOURCE_URL = "https://cursor.com/cursorbench";

function stripHtml(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePercent(text: string): number | null {
  const cleaned = stripHtml(text).replace(/%/g, "").trim();
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n / 100 : null;
}

function parseMoney(text: string): number | null {
  const cleaned = stripHtml(text).replace(/[^0-9.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(text: string): number | null {
  const cleaned = stripHtml(text).replace(/,/g, "").trim();
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function isValidRow(row: CursorBenchRow): boolean {
  return Boolean(
    row.model
    && Number.isFinite(row.score)
    && Number.isFinite(row.costPerTask)
    && Number.isFinite(row.tokensPerTask)
    && Number.isFinite(row.stepsPerTask),
  );
}

function extractCells(trHtml: string): string[] {
  const cells: string[] = [];
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellRe.exec(trHtml)) !== null) {
    cells.push(match[1]);
  }
  return cells;
}

function findLeaderboardTable(html: string): string | null {
  const preferred = html.match(
    /<table[^>]*class="[^"]*w-full[^"]*table-fixed[^"]*border-collapse[^"]*"[^>]*>[\s\S]*?<\/table>/i,
  );
  if (preferred?.[0]) return preferred[0];

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const table of tables) {
    const header = stripHtml(table.slice(0, 1200)).toLowerCase();
    if (header.includes("model") && header.includes("score") && header.includes("cost")) {
      return table;
    }
  }
  return null;
}

export function parseCursorBenchHtml(html: string): { version: string; rows: CursorBenchRow[] } {
  const versionMatch = html.match(/CursorBench\s+(\d+\.\d+)/i);
  const version = versionMatch?.[1] ?? "unknown";

  const table = findLeaderboardTable(html);
  if (!table) {
    throw new Error("CursorBench leaderboard table not found");
  }

  const rows: CursorBenchRow[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(table)) !== null) {
    const cells = extractCells(rowMatch[1]);
    if (cells.length < 6) continue;

    const headerText = stripHtml(cells[1]).toLowerCase();
    if (headerText === "model") continue;

    const model = stripHtml(cells[1]);
    const score = parsePercent(cells[2]);
    const costPerTask = parseMoney(cells[3]);
    const tokensPerTask = parseInteger(cells[4]);
    const stepsPerTask = parseInteger(cells[5]);

    if (score === null || costPerTask === null || tokensPerTask === null || stepsPerTask === null) {
      continue;
    }

    const row: CursorBenchRow = {
      model,
      score: Math.round(score * 10000) / 10000,
      costPerTask,
      tokensPerTask,
      stepsPerTask,
    };
    if (isValidRow(row)) rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("CursorBench leaderboard table had no parseable rows");
  }

  return { version, rows };
}
