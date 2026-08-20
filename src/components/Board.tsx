import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DynoRecord } from "../lib/engine";
import { Tone, bandColor, fmt1, fmt2, fmtMoney, hashSeed, mulberry, piBand } from "../lib/data";
import {
  IconAlert, IconBolt, IconChevron, IconCopy, IconDownload, IconEye, IconImage,
  IconMail, IconPhone, IconRefresh, IconSearch, IconShield, IconTrash, IconFlag, IconSpinner,
} from "./icons";

/* ---------------- favicon with fallback ---------------- */

export function SiteMark({ domain, size = 26 }: { domain: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="notch-sm flex flex-none items-center justify-center bg-coal-700 font-display font-bold text-mute"
        style={{ width: size, height: size, fontSize: size * 0.46 }}
      >
        {domain[0].toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
      alt=""
      width={size}
      height={size}
      className="notch-sm flex-none bg-coal-700"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

/* ---------------- seeded transfer curve ---------------- */

function TransferCurve({ domain }: { domain: string }) {
  const pts = useMemo(() => {
    const rnd = mulberry(hashSeed(domain + "curve"));
    const n = 44;
    let y = 4;
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      y += rnd() * 9 + (i < 8 ? 6 : 1.5);
      arr.push(y);
    }
    const max = arr[arr.length - 1];
    return arr.map((v, i) => `${((i / (n - 1)) * 240).toFixed(1)},${(56 - (v / max) * 50).toFixed(1)}`).join(" ");
  }, [domain]);
  return (
    <svg viewBox="0 0 240 60" className="h-[56px] w-full" preserveAspectRatio="none">
      <polyline points={`0,58 ${pts}`} fill="none" stroke="rgba(73,217,230,0.75)" strokeWidth="1.6" />
      <polygon points={`0,58 ${pts} 240,58`} fill="rgba(73,217,230,0.07)" stroke="none" />
    </svg>
  );
}

/* ---------------- board ---------------- */

type Filter = "all" | "red" | "amber" | "green";
type Sort = "new" | "pi-asc" | "pi-desc";

interface Props {
  records: DynoRecord[];
  expandedId: string | null;
  flashId: string | null;
  onToggle: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onRepitch: (id: string, tone: Tone) => void;
  onCopy: (text: string, label: string) => void;
  onExport: () => void;
}

export default function Board({
  records, expandedId, flashId, onToggle, onRetry, onDelete, onRepitch, onCopy, onExport,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("new");

  const counts = useMemo(() => {
    const done = records.filter((r) => r.status === "done");
    return {
      all: records.length,
      red: done.filter((r) => piBand(r.audit.metrics.pi) === "red").length,
      amber: done.filter((r) => piBand(r.audit.metrics.pi) === "amber").length,
      green: done.filter((r) => piBand(r.audit.metrics.pi) === "green").length,
    };
  }, [records]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = records.filter((r) => {
      if (filter !== "all") {
        if (r.status !== "done") return false;
        if (piBand(r.audit.metrics.pi) !== filter) return false;
      }
      if (!q) return true;
      return (
        r.domain.includes(q) ||
        r.company.toLowerCase().includes(q) ||
        (r.contact?.name.toLowerCase().includes(q) ?? false) ||
        (r.contact?.email.includes(q) ?? false)
      );
    });
    list = [...list].sort((a, b) => {
      const active = (r: DynoRecord) => (r.status === "running" || r.status === "queued" ? 1 : 0);
      if (active(a) !== active(b)) return active(b) - active(a);
      if (sort === "new") return b.createdAt - a.createdAt;
      const pa = a.status === "done" ? a.audit.metrics.pi : -1;
      const pb = b.status === "done" ? b.audit.metrics.pi : -1;
      return sort === "pi-asc" ? pa - pb : pb - pa;
    });
    return list;
  }, [records, search, filter, sort]);

  const doneCount = records.filter((r) => r.status === "done").length;
  const nextSort: Record<Sort, Sort> = { new: "pi-asc", "pi-asc": "pi-desc", "pi-desc": "new" };
  const sortLabel: Record<Sort, string> = { new: "SORT: NEWEST", "pi-asc": "SORT: PI ↑ WORST FIRST", "pi-desc": "SORT: PI ↓ BEST FIRST" };

  return (
    <section className="rise rise-2 mt-4">
      <div className="panel notch border border-line bg-coal-850 shadow-(--shadow-panel)">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
          <h2 className="mr-1 font-display text-sm font-semibold tracking-[0.18em] text-ink">
            GARAGE BOARD
          </h2>
          <span className="notch-sm bg-coal-700 px-2 py-0.5 font-mono text-[10px] font-semibold text-mute">
            {counts.all}
          </span>

          <div className="ml-2 hidden items-center gap-1 md:flex">
            {(["all", "red", "amber", "green"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] transition-colors ${
                  filter === f
                    ? "border-linehi bg-coal-700 text-ink"
                    : "border-line text-dim hover:border-linehi hover:text-mute"
                }`}
              >
                {f !== "all" && (
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: bandColor[f] }}
                  />
                )}
                {f === "all" ? "ALL" : f === "red" ? "<50" : f === "amber" ? "50–89" : "90+"}
                <span className="text-dim">{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 border border-line bg-coal-900 px-2.5 py-1.5">
              <IconSearch size={13} className="text-dim" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="domain, owner, email…"
                className="w-36 bg-transparent font-mono text-[11px] text-ink placeholder:text-dim focus:outline-none"
              />
            </div>
            <button
              onClick={() => setSort(nextSort[sort])}
              className="border border-line px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-mute transition-colors hover:border-linehi hover:text-ink"
              title="Cycle sort order"
            >
              {sortLabel[sort]}
            </button>
            <button
              onClick={onExport}
              disabled={doneCount === 0}
              className="flex items-center gap-1.5 border border-line px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-mute transition-colors hover:border-amber/50 hover:text-amber disabled:cursor-not-allowed disabled:opacity-40"
              title="Export completed pulls to CSV"
            >
              <IconDownload size={13} /> CSV
            </button>
          </div>
        </div>

        {/* table */}
        {records.length === 0 ? (
          <EmptyGarage />
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center font-mono text-xs text-dim">
            No pulls match this filter. Widen the search or clear the band filter.
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[9.5px] tracking-[0.18em] text-dim">
                  <th className="py-2.5 pl-5 pr-2 font-medium">STATUS</th>
                  <th className="px-2 py-2.5 font-medium">SITE</th>
                  <th className="px-2 py-2.5 font-medium">PI</th>
                  <th className="px-2 py-2.5 font-medium">LCP</th>
                  <th className="px-2 py-2.5 font-medium">CLS</th>
                  <th className="px-2 py-2.5 font-medium">OWNER</th>
                  <th className="px-2 py-2.5 font-medium">EMAIL</th>
                  <th className="px-2 py-2.5 font-medium">AI PITCH</th>
                  <th className="py-2.5 pl-2 pr-4 text-right font-medium">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row
                    key={r.id}
                    r={r}
                    expanded={expandedId === r.id}
                    flash={flashId === r.id}
                    onToggle={() => onToggle(r.id)}
                    onRetry={() => onRetry(r.id)}
                    onDelete={() => onDelete(r.id)}
                    onRepitch={(t) => onRepitch(r.id, t)}
                    onCopy={onCopy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- row ---------------- */

function Row({
  r, expanded, flash, onToggle, onRetry, onDelete, onRepitch, onCopy,
}: {
  r: DynoRecord;
  expanded: boolean;
  flash: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onRepitch: (t: Tone) => void;
  onCopy: (text: string, label: string) => void;
}) {
  const done = r.status === "done";
  const band = done ? piBand(r.audit.metrics.pi) : null;
  const color = band ? bandColor[band] : undefined;
  const m = r.audit.metrics;
  const c = r.contact;

  return (
    <>
      <tr
        onClick={onToggle}
        className={`group cursor-pointer border-b border-line/70 transition-colors hover:bg-coal-800/70 ${
          expanded ? "bg-coal-800" : ""
        } ${flash ? "row-flash" : ""}`}
      >
        {/* status */}
        <td className="py-3 pl-5 pr-2 align-top">
          <div className="flex flex-col items-start gap-1">
            <span
              className={`led ${
                r.status === "done" ? (band === "red" ? "led-red" : band === "amber" ? "led-amber" : "led-green")
                : r.status === "failed" ? "led-red"
                : r.status === "running" ? "led-amber" : "led-dim"
              } ${r.status === "running" ? "" : ""}`}
            />
            <span className="font-mono text-[9px] tracking-wider text-dim">
              {r.status === "done" ? "LOCKED" : r.status === "failed" ? "FAULT" : r.status === "running" ? "PULLING" : "QUEUED"}
            </span>
          </div>
        </td>
        {/* site */}
        <td className="px-2 py-3 align-top">
          <div className="flex items-center gap-2.5">
            <SiteMark domain={r.domain} />
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight text-ink">{r.domain}</div>
              <div className="truncate font-mono text-[10px] text-dim">{r.company}</div>
            </div>
          </div>
        </td>
        {/* PI */}
        <td className="px-2 py-3 align-top">
          {done ? (
            <div>
              <div className="font-mono text-base font-bold tabnums" style={{ color }}>{m.pi}</div>
              <div className="mt-1 h-1 w-14 bg-coal-700">
                <div className="h-full" style={{ width: `${m.pi}%`, background: color }} />
              </div>
            </div>
          ) : r.status === "failed" ? (
            <span className="font-mono text-xs text-red">FAULT</span>
          ) : r.status === "running" ? (
            <IconSpinner size={14} className="mt-1 text-amber" />
          ) : (
            <span className="font-mono text-xs text-dim">…</span>
          )}
        </td>
        {/* LCP / CLS */}
        <td className="px-2 py-3 font-mono text-xs tabnums text-mute">{done ? `${fmt1(m.lcp)}s` : "—"}</td>
        <td className="px-2 py-3 font-mono text-xs tabnums text-mute">{done ? fmt2(m.cls) : "—"}</td>
        {/* owner */}
        <td className="px-2 py-3 align-top">
          {done && c ? (
            <div>
              <div className="text-[13px] font-semibold leading-tight text-ink">{c.name}</div>
              <div className="font-mono text-[9.5px] tracking-wide text-dim">{c.role.toUpperCase()}</div>
            </div>
          ) : done ? (
            <span className="font-mono text-[10px] text-amber/80">no direct inbox</span>
          ) : (
            <span className="font-mono text-xs text-dim">—</span>
          )}
        </td>
        {/* email */}
        <td className="px-2 py-3 align-top">
          {done ? (
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(c?.email ?? `info@${r.domain}`, "email"); }}
              className="flex items-center gap-1.5 font-mono text-[11px] text-cyan/90 transition-colors hover:text-cyan"
              title="Copy email"
            >
              <span className="max-w-[170px] truncate">{c?.email ?? `info@${r.domain}`}</span>
              <IconCopy size={11} className="flex-none opacity-50 group-hover:opacity-100" />
            </button>
          ) : (
            <span className="font-mono text-xs text-dim">—</span>
          )}
          {done && c && (
            <span
              className={`mt-1 inline-block px-1.5 py-px font-mono text-[8.5px] font-semibold tracking-[0.12em] ${
                c.verified ? "bg-green/15 text-green" : "bg-amber/15 text-amber"
              }`}
            >
              {c.verified ? "VERIFIED" : `${c.confidence}% MATCH`}
            </span>
          )}
        </td>
        {/* pitch */}
        <td className="max-w-[260px] px-2 py-3 align-top">
          {done && r.pitch ? (
            <p className="truncate font-mono text-[10.5px] text-mute" title={r.pitch.email}>
              {r.pitch.email}
            </p>
          ) : r.status === "failed" ? (
            <p className="truncate font-mono text-[10.5px] text-red/80">{r.failReason}</p>
          ) : (
            <span className="font-mono text-xs text-dim">…</span>
          )}
        </td>
        {/* actions */}
        <td className="py-3 pl-2 pr-4 text-right align-top">
          <div className="flex items-center justify-end gap-1">
            {r.status === "failed" && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
                className="flex items-center gap-1 border border-amber/40 px-2 py-1 font-mono text-[9.5px] font-semibold tracking-wider text-amber transition-colors hover:bg-amber/15"
                title="Re-pull this domain"
              >
                <IconRefresh size={11} /> RETRY
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-dim transition-colors hover:text-red"
              title="Remove from board"
            >
              <IconTrash size={13} />
            </button>
            <IconChevron
              size={15}
              className={`text-dim transition-transform duration-200 ${expanded ? "rotate-180 text-amber" : ""}`}
            />
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-line bg-coal-900/60">
          <td colSpan={9} className="p-0">
            {r.status === "failed" ? (
              <FaultDrawer r={r} onRetry={onRetry} />
            ) : (
              <Drawer r={r} onRepitch={onRepitch} onCopy={onCopy} onToggle={onToggle} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ---------------- drawers ---------------- */

function FaultDrawer({ r, onRetry }: { r: DynoRecord; onRetry: () => void }) {
  return (
    <div className="logline flex flex-col items-start gap-3 px-6 py-5 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 flex-none items-center justify-center border border-red/40 bg-red/10 text-red">
        <IconAlert size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-bold tracking-[0.14em] text-red">PULL FAILED AT {String(r.failStage ?? "crawl").toUpperCase()}</div>
        <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-mute">{r.failReason}</p>
        <p className="mt-1 font-mono text-[10px] text-dim">
          TIP: drop the pace to HUMAN, or rotate proxies before redlining this target again.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="notch-sm flex items-center gap-2 bg-amber px-4 py-2 font-display text-xs font-bold tracking-[0.14em] text-[#161006] transition-colors hover:bg-amberhi"
      >
        <IconRefresh size={13} strokeWidth={2.2} /> RE-PULL
      </button>
    </div>
  );
}

function Drawer({
  r, onRepitch, onCopy, onToggle,
}: {
  r: DynoRecord;
  onRepitch: (t: Tone) => void;
  onCopy: (text: string, label: string) => void;
  onToggle: () => void;
}) {
  const m = r.audit.metrics;
  const chk = r.audit.checks;
  const band = piBand(m.pi);
  const color = bandColor[band];
  const p = r.pitch;
  const c = r.contact;

  const checkRows: { icon: ReactNode; label: string; ok: boolean; note: string }[] = [
    {
      icon: <IconShield size={13} />,
      label: "SSL CERT",
      ok: chk.sslValid,
      note: chk.sslValid ? `valid · expires in ${chk.sslDays}d` : `EXPIRED ${Math.abs(chk.sslDays)}d ago`,
    },
    {
      icon: <IconImage size={13} />,
      label: "HERO IMAGE",
      ok: chk.heroMB !== null && chk.heroMB <= 2,
      note: chk.heroMB === null ? "no hero raster found" : `${fmt1(chk.heroMB)} MB ${chk.heroMB > 2 ? "· over 2 MB budget" : "· within budget"}`,
    },
    {
      icon: <IconEye size={13} />,
      label: "VIEWPORT META",
      ok: chk.viewport,
      note: chk.viewport ? "mobile frame present" : "MISSING — desktop zoom-out on phones",
    },
    {
      icon: <IconBolt size={13} />,
      label: "HTTPS REDIRECT",
      ok: chk.httpsRedirect,
      note: chk.httpsRedirect ? "HTTP→HTTPS enforced" : "no redirect — mixed content risk",
    },
  ];

  return (
    <div className="logline grid gap-5 border-t border-dashed border-line px-6 py-5 lg:grid-cols-[280px_1fr_1.25fr]">
      {/* -------- telemetry -------- */}
      <div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-4xl font-bold tabnums" style={{ color }}>{m.pi}</span>
          <span className="font-mono text-[10px] tracking-[0.18em]" style={{ color }}>
            {band === "red" ? "CRITICAL" : band === "amber" ? "NEEDS WORK" : "CLEAN"}
          </span>
        </div>
        <div className="mt-1 font-mono text-[9.5px] tracking-[0.16em] text-dim">
          PERFORMANCE INDEX · MOBILE {r.liveTelemetry ? "· LIVE PSI" : "· SYNTHETIC"}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px border border-line bg-line">
          {[
            ["LCP", `${fmt1(m.lcp)}s`, m.lcp <= 2.5],
            ["CLS", fmt2(m.cls), m.cls <= 0.1],
            ["TTFB", `${fmt2(m.ttfb)}s`, m.ttfb <= 0.8],
            ["WEIGHT", `${fmt1(m.weightMB)} MB`, m.weightMB <= 2],
            ["REQUESTS", String(m.requests), m.requests <= 60],
            ["LEAK EST.", `${fmtMoney(r.audit.lossMo)}/mo`, false],
          ].map(([k, v, good]) => (
            <div key={k as string} className="bg-coal-850 px-3 py-2">
              <div className="font-mono text-[9px] tracking-[0.16em] text-dim">{k}</div>
              <div className={`mt-0.5 font-mono text-sm font-semibold tabnums ${good ? "text-green" : k === "LEAK EST." ? "text-red" : "text-ink"}`}>
                {v}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 border border-line bg-coal-850 p-2.5">
          <div className="mb-1 font-mono text-[9px] tracking-[0.16em] text-dim">CUMULATIVE TRANSFER — FIRST 10S</div>
          <TransferCurve domain={r.domain} />
        </div>

        <ul className="mt-3 space-y-1.5">
          {checkRows.map((cr) => (
            <li key={cr.label} className="flex items-center gap-2.5 font-mono text-[10.5px]">
              <span className={cr.ok ? "text-green" : "text-red"}>{cr.icon}</span>
              <span className="w-[104px] flex-none tracking-[0.12em] text-mute">{cr.label}</span>
              <span className={cr.ok ? "text-dim" : "text-amber"}>{cr.note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* -------- fault codes -------- */}
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 font-display text-[11px] font-semibold tracking-[0.2em] text-mute">
          <IconFlag size={13} className="text-amber" /> FAULT CODES — {r.audit.issues.length}
        </div>
        <ul className="space-y-2">
          {r.audit.issues.map((iss) => (
            <li key={iss.id} className="border border-line bg-coal-850 px-3 py-2.5 transition-colors hover:border-linehi">
              <div className="flex items-center gap-2">
                <span
                  className={`px-1.5 py-px font-mono text-[8.5px] font-bold tracking-[0.14em] ${
                    iss.sev === "crit" ? "bg-red/15 text-red" : iss.sev === "warn" ? "bg-amber/15 text-amber" : "bg-cyan/12 text-cyan"
                  }`}
                >
                  {iss.sev.toUpperCase()}
                </span>
                <span className="text-[13px] font-semibold text-ink">{iss.label}</span>
              </div>
              <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-dim">{iss.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* -------- outreach -------- */}
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-display text-[11px] font-semibold tracking-[0.2em] text-mute">OUTREACH — AI TUNE</span>
          {(["brutal", "roi", "friendly"] as Tone[]).map((t) => (
            <button
              key={t}
              onClick={() => onRepitch(t)}
              className={`px-2 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.14em] transition-colors ${
                p?.tone === t ? "bg-amber text-[#161006]" : "border border-line text-dim hover:border-amber/40 hover:text-amber"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {r.warn && (
          <div className="logline mb-2 flex items-start gap-2 border border-amber/40 bg-amber/10 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-amber">
            <IconAlert size={11} className="mt-0.5 flex-none" /> {r.warn}
          </div>
        )}

        {p && (
          <>
            <div className="border border-line bg-coal-850">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <div className="flex items-center gap-2 font-mono text-[10px] text-dim">
                  <IconMail size={12} className="text-cyan" />
                  <span className="truncate">TO: {c?.email ?? `info@${r.domain}`}</span>
                </div>
                <button
                  onClick={() => onCopy(`Subject: ${p.subject}\n\n${p.email}`, "cold email")}
                  className="flex items-center gap-1 border border-line px-2 py-1 font-mono text-[9.5px] font-semibold tracking-wider text-mute transition-colors hover:border-cyan/50 hover:text-cyan"
                >
                  <IconCopy size={11} /> COPY
                </button>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[13px] font-bold text-ink">{p.subject}</div>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-mute">{p.email}</p>
              </div>
            </div>

            <div className="mt-2.5 border border-line bg-coal-850">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-dim">
                  <IconPhone size={12} className="text-cyan" /> 30-SECOND CALL SCRIPT
                </div>
                <button
                  onClick={() => onCopy(p.script.join("\n"), "call script")}
                  className="flex items-center gap-1 border border-line px-2 py-1 font-mono text-[9.5px] font-semibold tracking-wider text-mute transition-colors hover:border-cyan/50 hover:text-cyan"
                >
                  <IconCopy size={11} /> COPY
                </button>
              </div>
              <ol className="space-y-1.5 px-3 py-2.5">
                {p.script.map((line, i) => (
                  <li key={i} className="font-mono text-[10.5px] leading-relaxed text-mute">
                    <span className="text-amber/80">{line.slice(0, line.indexOf("]") + 1)}</span>
                    <span className="text-mute">{line.slice(line.indexOf("]") + 1)}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-2 flex items-center gap-3 font-mono text-[9px] tracking-[0.14em] text-dim">
              <span>GPT-4O · TEMP 0.7</span>
              <span>{p.tokens} TOKENS</span>
              <span>
                {new Date(p.at).toLocaleTimeString("en-GB", { hour12: false })}
              </span>
              <span className="ml-auto flex items-center gap-1 text-amber/70">
                <IconAlert size={10} /> REVIEW BEFORE SEND
              </span>
            </div>
          </>
        )}

        <button
          onClick={onToggle}
          className="mt-3 flex items-center gap-1 font-mono text-[10px] tracking-[0.16em] text-dim transition-colors hover:text-mute"
        >
          <IconChevron size={12} className="rotate-180" /> COLLAPSE
        </button>
      </div>
    </div>
  );
}

function EmptyGarage() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center border border-line bg-coal-800 text-coal-600">
        <IconFlag size={26} strokeWidth={1.5} />
      </div>
      <div className="font-display text-base font-bold tracking-[0.2em] text-mute">GARAGE EMPTY</div>
      <p className="max-w-md font-mono text-[11px] leading-relaxed text-dim">
        Nothing on the rollers yet. Drop a domain in the intake above — or hit a cold-start sample —
        and the rig will pull telemetry, map the owner, and flash a pitch in about eight seconds.
      </p>
    </div>
  );
}
