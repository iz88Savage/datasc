import {
  Audit,
  Contact,
  Metrics,
  Pitch,
  analyzeDomain,
  generatePitch,
} from "./data";

/* ---------------- record model ---------------- */

export type Pacing = "human" | "sport" | "redline";
export type Status = "queued" | "running" | "done" | "failed";
export type StageKey = "handshake" | "crawl" | "pagespeed" | "contact" | "pitch";

export interface LogLine {
  t: number;
  line: string;
}

export interface DynoRecord {
  id: string;
  domain: string;
  company: string;
  status: Status;
  stage: StageKey | "done";
  failReason?: string;
  failStage?: StageKey;
  warn?: string;
  logs: LogLine[];
  audit: Audit;
  contact: Contact | null; // may be nulled at runtime (credits / no match)
  pitch?: Pitch;
  liveTelemetry?: boolean;
  createdAt: number;
  finishedAt?: number;
}

export interface Meters {
  psi: number;    // PageSpeed calls
  hunter: number; // remaining Hunter credits
  tokens: number; // AI tokens billed
  runs: number;   // completed pulls
}

export interface Settings {
  psiKey: string;
  hunterKey: string;
  aiKey: string;
  pacing: Pacing;
}

export const STAGES: { key: StageKey; label: string; short: string }[] = [
  { key: "handshake", label: "SSL / HANDSHAKE", short: "DNS+TLS" },
  { key: "crawl", label: "HEADLESS CRAWL", short: "CRAWL" },
  { key: "pagespeed", label: "PAGESPEED PULL", short: "PSI" },
  { key: "contact", label: "FUEL MAP · HUNTER", short: "HUNTER" },
  { key: "pitch", label: "ECU FLASH · AI", short: "AI" },
];

export const stageIndex = (s: StageKey | "done") =>
  s === "done" ? STAGES.length : STAGES.findIndex((x) => x.key === s);

/** has the run progressed past `key`? */
export const past = (r: DynoRecord, key: StageKey) =>
  stageIndex(r.stage) > STAGES.findIndex((x) => x.key === key);

/* ---------------- pacing ---------------- */

export const PACING: Record<
  Pacing,
  { label: string; blurb: string; mult: number; blockChance: number; gap: number }
> = {
  human: { label: "HUMAN", blurb: "≈1 site / 8s — ghost mode", mult: 1, blockChance: 0.02, gap: 900 },
  sport: { label: "SPORT", blurb: "≈1 site / 4s — warm tires", mult: 0.5, gap: 420, blockChance: 0.07 },
  redline: { label: "REDLINE", blurb: "flat out — expect walls", mult: 0.24, gap: 130, blockChance: 0.24 },
};

export const STAGE_MS: Record<StageKey, number> = {
  handshake: 1250,
  crawl: 2050,
  pagespeed: 1900,
  contact: 1450,
  pitch: 1650,
};

/* ---------------- helpers ---------------- */

export const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export function normalizeUrl(raw: string): { domain: string } | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) return null;
  return { domain: s };
}

export function createRecord(domain: string, salt = 0): DynoRecord {
  const audit = analyzeDomain(domain, salt);
  return {
    id: uid(),
    domain,
    company: audit.company,
    status: "queued",
    stage: "handshake",
    logs: [],
    audit,
    contact: audit.contact,
    createdAt: Date.now(),
  };
}

/* ---------------- stage log scripts ---------------- */

export function stageLogs(stage: StageKey, r: DynoRecord, rnd: () => number): string[] {
  const { metrics: m, checks: c } = r.audit;
  const ip = `${20 + Math.floor(rnd() * 180)}.${Math.floor(rnd() * 255)}.${Math.floor(
    rnd() * 255,
  )}.${Math.floor(rnd() * 255)}`;
  switch (stage) {
    case "handshake":
      return [
        `resolve ${r.domain} → ${ip}`,
        c.sslValid
          ? `TLS 1.3 handshake OK · cert valid ${c.sslDays}d`
          : `TLS warning: certificate EXPIRED ${Math.abs(c.sslDays)}d ago`,
        c.httpsRedirect ? "HTTP→HTTPS redirect in place" : "no HTTPS redirect — mixed content risk",
      ];
    case "crawl":
      return [
        "headless chromium 126 · viewport 390×844",
        `viewport meta: ${c.viewport ? "present" : "MISSING"}`,
        c.heroMB
          ? `hero asset ${c.heroPath} → ${c.heroMB.toFixed(1)} MB ${c.heroMB > 2.6 ? "!! heavy" : ""}`
          : "no hero raster found (vector/CSS)",
        `page weight ${m.weightMB.toFixed(1)} MB · ${m.requests} requests`,
      ];
    case "pagespeed":
      return [
        `PSI v5 · strategy=mobile · cat=performance`,
        `LCP ${m.lcp.toFixed(1)}s · CLS ${m.cls.toFixed(2)} · TTFB ${m.ttfb.toFixed(2)}s`,
        `performance score locked: ${m.pi}/100`,
      ];
    case "contact":
      return r.contact
        ? [
            `hunter: ${1 + Math.floor(rnd() * 6)} emails indexed on ${r.domain}`,
            `best match ${r.contact.email} · confidence ${r.contact.confidence}%${
              r.contact.verified ? " · verified" : ""
            }`,
            `${r.contact.name} — ${r.contact.role}`,
          ]
        : [`hunter: 0 verified inboxes on ${r.domain}`, "falling back to generic office address"];
    case "pitch": {
      const p = r.pitch;
      return [
        `model gpt-4o · temp 0.7 · tone=${p?.tone ?? "brutal"}`,
        `cold email: 3 sentences · subject A/B armed`,
        `call script: 30s · ${p ? p.script.length : 5} beats`,
        `tokens billed: ${p?.tokens ?? 0}`,
      ];
    }
  }
}

/* ---------------- optional live PageSpeed pull ---------------- */

export async function tryLivePSI(
  domain: string,
  key: string,
): Promise<Pick<Metrics, "pi" | "lcp" | "cls" | "ttfb"> | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    const url =
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=" +
      encodeURIComponent(`https://${domain}`) +
      "&strategy=mobile&category=performance&key=" +
      encodeURIComponent(key);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const lr = j?.lighthouseResult;
    if (!lr) return null;
    const pi = Math.round((lr.categories?.performance?.score ?? 0) * 100);
    const lcp = +(lr.audits?.["largest-contentful-paint"]?.numericValue / 1000 || 0).toFixed(1);
    const cls = +(lr.audits?.["cumulative-layout-shift"]?.numericValue || 0).toFixed(2);
    const ttfb = +(lr.audits?.["server-response-time"]?.numericValue / 1000 || 0).toFixed(2);
    if (!pi && !lcp) return null;
    return { pi, lcp: lcp || 2.5, cls, ttfb: ttfb || 0.4 };
  } catch {
    return null;
  }
}

/* ---------------- CSV export ---------------- */

export function recordsToCSV(records: DynoRecord[]): string {
  const done = records.filter((r) => r.status === "done");
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = [
    "URL", "Company", "PI Score", "LCP (s)", "CLS", "TTFB (s)", "Weight (MB)",
    "Top issues", "Owner", "Role", "Email", "Verified", "Subject", "Cold email",
    "Call script", "Tone", "Pulled at",
  ];
  const rows = done.map((r) => {
    const m = r.audit.metrics;
    const c = r.contact;
    const p = r.pitch;
    return [
      `https://${r.domain}`, r.company, m.pi, m.lcp.toFixed(1), m.cls.toFixed(2),
      m.ttfb.toFixed(2), m.weightMB.toFixed(1),
      r.audit.issues.map((i) => i.label).join("; "),
      c?.name ?? "—", c?.role ?? "—", c?.email ?? `info@${r.domain}`,
      c?.verified ? "yes" : "no",
      p?.subject ?? "", p?.email ?? "", p?.script.join(" | ") ?? "", p?.tone ?? "",
      new Date(r.finishedAt ?? r.createdAt).toISOString(),
    ].map(esc).join(",");
  });
  return [head.map(esc).join(","), ...rows].join("\n");
}

export function downloadCSV(records: DynoRecord[]) {
  const blob = new Blob([recordsToCSV(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sitedyno-board-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- persistence ---------------- */

const LS_KEY = "sitedyno.board.v1";

export interface PersistedState {
  records: DynoRecord[];
  meters: Meters;
  settings: Settings;
}

export const DEFAULT_METERS: Meters = { psi: 0, hunter: 25, tokens: 0, runs: 0 };
export const DEFAULT_SETTINGS: Settings = { psiKey: "", hunterKey: "", aiKey: "", pacing: "human" };

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { records: [], meters: { ...DEFAULT_METERS }, settings: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as PersistedState;
    // anything mid-flight when the tab died becomes a retryable fault
    const records = (parsed.records ?? []).map((r) =>
      r.status === "running" || r.status === "queued"
        ? { ...r, status: "failed" as Status, failStage: r.stage as StageKey, failReason: "Run interrupted by shutdown — hit RETRY to re-pull." }
        : r,
    );
    return {
      records: records.slice(0, 80),
      meters: { ...DEFAULT_METERS, ...(parsed.meters ?? {}) },
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { records: [], meters: { ...DEFAULT_METERS }, settings: { ...DEFAULT_SETTINGS } };
  }
}

export function saveState(state: PersistedState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — run continues in memory */
  }
}

/* ---------------- misc ---------------- */

export function reflashPitch(r: DynoRecord, tone: Pitch["tone"], variant: number): Pitch {
  return generatePitch(r.audit, r.domain, tone, variant);
}

export const hexRay = (rnd: () => number) =>
  Array.from({ length: 16 }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join("");
