import type { CursorBenchRow } from "./cursorbench-data";

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function escAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(score: number): string {
  if (!Number.isFinite(score)) return "—";
  return `${Math.round(score * 1000) / 10}%`;
}

function baseModel(name: string): string {
  return String(name || "").replace(/\s+(Max|Extra High|High|Medium|Low)\s*$/i, "").trim();
}

export function cursorBenchMiniPlotDataUri(
  rows: CursorBenchRow[],
  opts?: { width?: number; height?: number; light?: boolean },
): string {
  const width = opts?.width ?? 360;
  const height = opts?.height ?? 140;
  const light = Boolean(opts?.light);

  const pad = { l: 36, r: 10, t: 10, b: 26 };
  const innerW = Math.max(10, width - pad.l - pad.r);
  const innerH = Math.max(10, height - pad.t - pad.b);

  const valid = (rows || []).filter((r) => Number.isFinite(r.costPerTask) && Number.isFinite(r.score));
  const xs = valid.map((r) => r.costPerTask);
  const ys = valid.map((r) => r.score);

  const xmin = Math.min(...xs, 0);
  const xmax = Math.max(...xs, 1);
  const ymin = 0.30;
  const ymax = 0.75;

  const xScale = (x: number) => {
    const t = (x - xmin) / (xmax - xmin || 1);
    // CursorBench shows higher cost on the left (descending x).
    return pad.l + (1 - clamp01(t)) * innerW;
  };
  const yScale = (y: number) => {
    const t = (y - ymin) / (ymax - ymin || 1);
    return pad.t + (1 - clamp01(t)) * innerH;
  };

  const fg = light ? "rgba(0,0,0,0.86)" : "rgba(255,255,255,0.86)";
  const muted = light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const grid = light ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const dot = light ? "rgba(0,0,0,0.70)" : "rgba(255,255,255,0.78)";
  const dotStroke = light ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.22)";

  const PALETTE = [
    "#9ec5fe", // sky blue
    "#b6e3c1", // mint
    "#f7c5a0", // peach
    "#d3b9f2", // lavender
    "#f5b8c5", // rose
    "#a7e0e0", // aqua
    "#f0d99b", // butter
    "#c9d4f0", // periwinkle
  ];

  const bases = Array.from(new Set(valid.map((r) => baseModel(r.model)))).sort((a, b) => a.localeCompare(b));
  const colorForBase = (b: string) => PALETTE[(Math.max(0, bases.indexOf(b))) % PALETTE.length]!;

  // Pick a few labeled ticks that keep the plot readable.
  const yTicks = [0.35, 0.45, 0.55, 0.65, 0.75];
  const xTicks = [0, 2, 4, 8, 12, 16, 18].filter((v) => v >= xmin && v <= xmax);

  const gridLines = [
    ...yTicks.map((y) => {
      const yy = yScale(y);
      return `<line x1="${pad.l}" y1="${yy}" x2="${pad.l + innerW}" y2="${yy}" stroke="${grid}" stroke-width="1" />`;
    }),
    ...xTicks.map((x) => {
      const xx = xScale(x);
      return `<line x1="${xx}" y1="${pad.t}" x2="${xx}" y2="${pad.t + innerH}" stroke="${grid}" stroke-width="1" />`;
    }),
  ].join("");

  const axis = [
    `<line x1="${pad.l}" y1="${pad.t + innerH}" x2="${pad.l + innerW}" y2="${pad.t + innerH}" stroke="${grid}" stroke-width="1" />`,
    `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + innerH}" stroke="${grid}" stroke-width="1" />`,
  ].join("");

  const labels = [
    ...yTicks.map((y) => {
      const yy = yScale(y);
      return `<text x="${pad.l - 6}" y="${yy + 4}" fill="${muted}" font-size="10" text-anchor="end">${Math.round(y * 100)}%</text>`;
    }),
    ...xTicks.map((x) => {
      const xx = xScale(x);
      return `<text x="${xx}" y="${pad.t + innerH + 16}" fill="${muted}" font-size="10" text-anchor="middle">${x}</text>`;
    }),
    `<text x="${pad.l + innerW}" y="${pad.t + innerH + 24}" fill="${muted}" font-size="10" text-anchor="end">Avg cost / task ($)</text>`,
    `<text x="${pad.l}" y="${pad.t - 2}" fill="${fg}" font-size="11" font-weight="600">CursorBench ${escAttr(
      rows?.[0] ? "" : "",
    )}</text>`,
  ].join("");

  // Connecting lines per base-model.
  const grouped = new Map<string, CursorBenchRow[]>();
  for (const r of valid) {
    const b = baseModel(r.model);
    const arr = grouped.get(b) ?? [];
    arr.push(r);
    grouped.set(b, arr);
  }
  const lines = Array.from(grouped.entries())
    .map(([b, arr]) => {
      arr.sort((a, c) => a.costPerTask - c.costPerTask);
      const d = arr
        .map((r, i) => `${i === 0 ? "M" : "L"} ${xScale(r.costPerTask).toFixed(2)} ${yScale(r.score).toFixed(2)}`)
        .join(" ");
      const color = colorForBase(b);
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />`;
    })
    .join("");

  // Emphasize top performers (higher score) with a slightly larger dot.
  const points = valid
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((r, idx) => {
      const cx = xScale(r.costPerTask);
      const cy = yScale(r.score);
      const radius = idx < 5 ? 3.2 : 2.4;
      const color = colorForBase(baseModel(r.model));
      const title = `${r.model} • score ${fmtPct(r.score)} • cost ${fmtUsd(r.costPerTask)}`;
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="${dotStroke}" stroke-width="1"><title>${escAttr(
        title,
      )}</title></circle>`;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="8" ry="8" fill="transparent" />
  ${gridLines}
  ${axis}
  ${lines}
  ${points}
  ${labels}
</svg>`;

  const encoded = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}

