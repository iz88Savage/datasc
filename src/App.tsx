import { useEffect, useMemo, useRef, useState } from "react";
import {
  DynoRecord, Meters, Settings, StageKey, STAGES, STAGE_MS, PACING,
  createRecord, normalizeUrl, stageLogs, tryLivePSI, loadState, saveState,
  downloadCSV, hexRay, sleep,
} from "./lib/engine";
import { TIPS, generatePitch, Tone, zipInfo, generateProspects, Prospect } from "./lib/data";
import ConsoleDeck, { EnqueueResult } from "./components/Console";
import Board from "./components/Board";
import SettingsModal from "./components/SettingsModal";
import { IconBolt, IconCheck, IconGear, IconInfo, IconTacho, IconX } from "./components/icons";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  msg: string;
}

export default function App() {
  /* ---------- boot from storage ---------- */
  const [boot] = useState(loadState);
  const [records, setRecords] = useState<DynoRecord[]>(boot.records);
  const [meters, setMeters] = useState<Meters>(boot.meters);
  const [settings, setSettings] = useState<Settings>(boot.settings);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);

  const recordsRef = useRef(boot.records);
  const metersRef = useRef(boot.meters);
  const settingsRef = useRef(boot.settings);
  const queueRef = useRef<string[]>([]);
  const abortRef = useRef(false);
  const processingRef = useRef(false);

  /* ---------- persistence ---------- */
  useEffect(() => {
    saveState({ records, meters, settings });
  }, [records, meters, settings]);

  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 6000);
    return () => clearInterval(t);
  }, []);

  /* ---------- ZIP sweep state ---------- */
  const [sweepState, setSweepState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [sweepLogs, setSweepLogs] = useState<{ id: number; line: string }[]>([]);
  const [sweepProgress, setSweepProgress] = useState(0);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sweepArea, setSweepArea] = useState<string | null>(null);
  const sweepCancelRef = useRef(false);

  const slog = (line: string) =>
    setSweepLogs((ls) => [...ls.slice(-40), { id: Date.now() + Math.random(), line }]);

  const runSweep = async (zip: string) => {
    if (sweepState === "running") return;
    sweepCancelRef.current = false;
    setSweepState("running");
    setSweepLogs([]);
    setProspects([]);
    setSelectedIds(new Set());
    setSweepProgress(0);

    const info = zipInfo(zip);
    setSweepArea(`${info.city}, ${info.st}`);
    const found = generateProspects(zip);
    const total = found.length + 5 + Math.floor(Math.random() * 9);

    let cancelled = false;
    const step = async (ms: number, line: string, prog: number) => {
      await sleep(ms);
      if (sweepCancelRef.current) {
        cancelled = true;
        return;
      }
      slog(line);
      setSweepProgress(prog);
    };

    await step(480, `resolving ${zip} → ${info.city}, ${info.st} · area code ${info.area}`, 0.08);
    if (!cancelled) await step(640, `directory trawl started · maps.local/${zip} @ human pace (1 req / 1.4s)`, 0.18);
    if (!cancelled) await step(720, `page 1 · ${Math.ceil(total / 2)} listings scraped · extracting website fields`, 0.38);
    if (!cancelled) await step(720, `page 2 · ${total} listings total · ${total - found.length} have no website (skipped)`, 0.58);
    if (!cancelled) await step(560, `filter passed: ${found.length} local businesses expose a root domain`, 0.78);
    if (!cancelled) await step(460, `dedupe + normalize · staging prospects`, 0.92);
    if (!cancelled) {
      await step(380, `sweep complete — ${found.length} prospects staged for the dyno`, 1);
      setProspects(found);
      setSelectedIds(new Set(found.map((p) => p.id)));
      setSweepState("done");
      return;
    }
    slog("!! sweep aborted by operator — directory session dropped");
    setSweepState("failed");
  };

  const cancelSweep = () => {
    sweepCancelRef.current = true;
  };

  const enqueueProspects = () => {
    const picked = prospects.filter((p) => selectedIds.has(p.id));
    if (!picked.length) {
      pushToast("error", "Tick at least one prospect first.");
      return;
    }
    const known = new Set(recordsRef.current.map((r) => r.domain));
    let dupes = 0;
    const created: DynoRecord[] = [];
    for (const p of picked) {
      if (known.has(p.domain)) {
        dupes++;
        continue;
      }
      known.add(p.domain);
      const rec = createRecord(p.domain);
      rec.source = {
        zip: p.zip, city: p.city, st: p.st, name: p.name, category: p.category,
        niche: p.niche, phone: p.phone, address: p.address, rating: p.rating, reviews: p.reviews,
      };
      created.push(rec);
    }
    if (created.length) {
      queueRef.current.push(...created.map((c) => c.id));
      commit((rs) => [...created, ...rs]);
      pump();
    }
    if (created.length) {
      pushToast(
        "info",
        `${created.length} local site${created.length > 1 ? "s" : ""} queued from ${sweepArea ?? "the sweep"}${dupes ? ` · ${dupes} already on the board` : ""}`,
      );
    } else {
      pushToast("error", "Every picked site is already on the board.");
    }
    setSelectedIds(new Set());
  };

  /* ---------- state helpers (ref-synced) ---------- */
  const commit = (updater: (rs: DynoRecord[]) => DynoRecord[]) => {
    setRecords((prev) => {
      const next = updater(prev);
      recordsRef.current = next;
      return next;
    });
  };
  const patch = (id: string, p: Partial<DynoRecord>) =>
    commit((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const log = (id: string, line: string) =>
    commit((rs) => rs.map((r) => (r.id === id ? { ...r, logs: [...r.logs, { t: Date.now(), line }] } : r)));
  const bump = (fn: (m: Meters) => Meters) => {
    metersRef.current = fn(metersRef.current);
    setMeters(metersRef.current);
  };

  const pushToast = (type: Toast["type"], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, type, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  /* ---------- the dyno worker ---------- */
  const runOne = async (id: string) => {
    let cur = recordsRef.current.find((r) => r.id === id);
    if (!cur) return;
    const cfg = PACING[settingsRef.current.pacing];
    patch(id, {
      status: "running", stage: "handshake", logs: [],
      failReason: undefined, failStage: undefined, warn: undefined, finishedAt: undefined,
    });

    for (const s of STAGES) {
      if (abortRef.current) {
        patch(id, { status: "failed", failStage: s.key, failReason: "Aborted by operator — queue flushed.", finishedAt: Date.now() });
        return;
      }
      patch(id, { stage: s.key });
      const ms = STAGE_MS[s.key] * cfg.mult;
      let creditsStarved = false;

      // Cloudflare wall roll during the headless crawl
      if (s.key === "crawl" && Math.random() < cfg.blockChance) {
        log(id, `GET https://${cur.domain}/ → 403 challenge wall`);
        await sleep(Math.min(ms, 480));
        patch(id, {
          status: "failed", failStage: "crawl", finishedAt: Date.now(),
          failReason: `403 — challenge wall at ${cur.domain} (ray ${hexRay(Math.random)}). Drop to HUMAN pace or rotate proxies, then re-pull.`,
        });
        pushToast("error", `${cur.domain} hit a challenge wall at ${cfg.label} pace`);
        return;
      }

      // live PageSpeed pull when a key is armed
      if (s.key === "pagespeed" && settingsRef.current.psiKey) {
        log(id, "PSI key armed — attempting live pull (15s cap)…");
        const live = await tryLivePSI(cur.domain, settingsRef.current.psiKey);
        if (live) {
          cur = { ...cur, audit: { ...cur.audit, metrics: { ...cur.audit.metrics, ...live } }, liveTelemetry: true };
          patch(id, { audit: cur.audit, liveTelemetry: true });
          log(id, `live pull OK — score ${live.pi}/100 overrides synthetic feed`);
        } else {
          log(id, "live pull failed — synthetic telemetry engaged");
        }
      }

      // hunter credits gate
      if (s.key === "contact") {
        if (metersRef.current.hunter <= 0) {
          creditsStarved = true;
          cur = { ...cur, contact: null, warn: "Hunter credits exhausted — generic inbox fallback used for outreach." };
          patch(id, { contact: null, warn: cur.warn });
        } else {
          bump((m) => ({ ...m, hunter: m.hunter - 1 }));
        }
      }

      // ECU flash — draft the pitch before logging it
      if (s.key === "pitch" && !cur.pitch) {
        const local = cur.source ? { city: cur.source.city, niche: cur.source.niche } : null;
        const pitch = generatePitch(cur.audit, cur.domain, "brutal", 0, local);
        cur = { ...cur, pitch };
        patch(id, { pitch });
      }

      const lines =
        s.key === "contact" && creditsStarved
          ? ["hunter: credits at zero — search skipped", "falling back to generic office inbox"]
          : stageLogs(s.key, cur, Math.random);
      const step = ms / lines.length;
      for (const line of lines) {
        if (abortRef.current) break;
        await sleep(step * (0.72 + Math.random() * 0.56));
        log(id, line);
      }

      if (s.key === "pagespeed") bump((m) => ({ ...m, psi: m.psi + 1 }));
      if (s.key === "pitch" && cur.pitch) {
        const billed = cur.pitch.tokens;
        bump((m) => ({ ...m, tokens: m.tokens + billed }));
      }
    }

    if (abortRef.current) {
      patch(id, { status: "failed", failStage: cur.stage as StageKey, failReason: "Aborted by operator — queue flushed.", finishedAt: Date.now() });
      return;
    }
    patch(id, { status: "done", stage: "done", finishedAt: Date.now() });
    bump((m) => ({ ...m, runs: m.runs + 1 }));
    setFlashId(id);
    window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1800);
    pushToast("success", `${cur.domain} pulled — PI ${cur.audit.metrics.pi}/100${cur.contact ? ` · ${cur.contact.name} mapped` : ""}`);
  };

  const pump = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length) {
      if (abortRef.current) {
        queueRef.current = [];
        break;
      }
      const id = queueRef.current.shift()!;
      await runOne(id);
      if (queueRef.current.length) await sleep(PACING[settingsRef.current.pacing].gap);
    }
    processingRef.current = false;
    abortRef.current = false;
  };

  /* ---------- public actions ---------- */
  const enqueue = (raws: string[]): EnqueueResult => {
    const bad: string[] = [];
    let dupes = 0;
    const created: DynoRecord[] = [];
    const known = new Set(recordsRef.current.map((r) => r.domain));
    for (const raw of raws) {
      const n = normalizeUrl(raw);
      if (!n) { bad.push(raw.trim() || "∅"); continue; }
      if (known.has(n.domain)) { dupes++; continue; }
      known.add(n.domain);
      created.push(createRecord(n.domain));
    }
    if (created.length) {
      queueRef.current.push(...created.map((c) => c.id));
      commit((rs) => [...created, ...rs]);
      pushToast("info", `${created.length} domain${created.length > 1 ? "s" : ""} on the rollers`);
      pump();
    }
    return { added: created.length, dupes, bad };
  };

  const retry = (id: string) => {
    commit((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r, status: "queued", stage: "handshake", logs: [],
              failReason: undefined, failStage: undefined, warn: undefined,
              contact: r.audit.contact, pitch: undefined, liveTelemetry: undefined,
              createdAt: Date.now(), finishedAt: undefined,
            }
          : r,
      ),
    );
    queueRef.current.unshift(id);
    pushToast("info", "Re-pull queued");
    pump();
  };

  const remove = (id: string) => {
    queueRef.current = queueRef.current.filter((x) => x !== id);
    commit((rs) => rs.filter((r) => r.id !== id));
    if (expandedId === id) setExpandedId(null);
    pushToast("info", "Removed from the board");
  };

  const repitch = (id: string, tone: Tone) => {
    const r = recordsRef.current.find((x) => x.id === id);
    if (!r) return;
    const variant = (r.pitch?.variant ?? -1) + 1;
    const local = r.source ? { city: r.source.city, niche: r.source.niche } : null;
    const pitch = generatePitch(r.audit, r.domain, tone, variant, local);
    patch(id, { pitch });
    bump((m) => ({ ...m, tokens: m.tokens + pitch.tokens }));
    pushToast("success", `ECU reflashed — ${tone.toUpperCase()} tune loaded (+${pitch.tokens} tok)`);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast("success", `${label} copied to clipboard`);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        pushToast("success", `${label} copied to clipboard`);
      } catch {
        pushToast("error", "Clipboard blocked by the browser");
      }
      ta.remove();
    }
  };

  const exportCsv = () => {
    downloadCSV(recordsRef.current);
    pushToast("success", "Garage board exported as CSV");
  };

  const abort = () => {
    abortRef.current = true;
    queueRef.current = [];
    pushToast("error", "Abort armed — finishing current stage, queue flushed");
  };

  const applySettings = (s: Settings) => {
    settingsRef.current = s;
    setSettings(s);
  };

  const topUp = () => {
    bump((m) => ({ ...m, hunter: m.hunter + 25 }));
    pushToast("success", "+25 Hunter credits topped up (simulated)");
  };

  const wipe = () => {
    abortRef.current = true;
    queueRef.current = [];
    commit(() => []);
    setExpandedId(null);
    setSettingsOpen(false);
    pushToast("info", "Board wiped — the rollers are clean");
  };

  /* ---------- derived ---------- */
  const live = records.find((r) => r.status === "running") ?? null;
  const busy = records.some((r) => r.status === "running" || r.status === "queued");
  const queued = useMemo(
    () => queueRef.current.map((id) => records.find((r) => r.id === id)).filter(Boolean) as DynoRecord[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records],
  );
  const stats = useMemo(() => {
    const done = records.filter((r) => r.status === "done");
    const avg = done.length ? Math.round(done.reduce((s, r) => s + r.audit.metrics.pi, 0) / done.length) : null;
    return {
      runs: meters.runs,
      avgPi: avg,
      leads: done.filter((r) => r.contact?.verified).length,
      faults: records.filter((r) => r.status === "failed").length,
    };
  }, [records, meters]);

  const modeLive = Boolean(settings.psiKey && settings.hunterKey && settings.aiKey);

  /* ---------- render ---------- */
  return (
    <div className="flex min-h-screen flex-col">
      {/* ======= header ======= */}
      <header className="border-b border-line bg-coal-900/70">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 py-3.5 lg:px-8">
          <div className="notch-sm flex h-10 w-10 items-center justify-center bg-amber text-[#161006]">
            <IconTacho size={22} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold leading-none tracking-[0.1em] text-ink">
              SITE<span className="text-amber">DYNO</span>
              <span className="ml-2 align-middle font-mono text-[9px] font-medium tracking-[0.2em] text-dim">v2.4</span>
            </div>
            <div className="mt-1 truncate font-mono text-[9px] tracking-[0.22em] text-dim">
              TELEMETRY → OWNER → PITCH · FULL AUTO
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-4 md:flex">
              {[
                { k: "PSI CALLS", v: meters.psi.toLocaleString("en-US") },
                { k: "HUNTER CR", v: String(meters.hunter), warn: meters.hunter <= 3 },
                { k: "AI TOKENS", v: meters.tokens >= 1000 ? `${(meters.tokens / 1000).toFixed(1)}k` : String(meters.tokens) },
              ].map((m) => (
                <div key={m.k} className="text-right">
                  <div className={`font-mono text-sm font-bold leading-none tabnums ${m.warn ? "text-red" : "text-ink"}`}>{m.v}</div>
                  <div className="mt-0.5 font-mono text-[8.5px] tracking-[0.18em] text-dim">{m.k}</div>
                </div>
              ))}
              <div className="h-8 w-px bg-line" />
            </div>
            <span
              className={`flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.18em] ${
                modeLive ? "border-green/40 text-green" : "border-amber/40 text-amber"
              }`}
              title={modeLive ? "All API keys armed" : "Synthetic telemetry — arm keys in settings to go live"}
            >
              <span className={`led ${modeLive ? "led-green" : "led-amber"}`} />
              {modeLive ? "LIVE" : "SIM"}
            </span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center border border-line text-mute transition-all hover:rotate-45 hover:border-amber/50 hover:text-amber"
              title="Rig settings"
            >
              <IconGear size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* ======= main ======= */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:px-8">
        <ConsoleDeck
          onEnqueue={enqueue}
          onSample={(d) => enqueue([d])}
          live={live}
          queue={queued}
          busy={busy}
          pacing={settings.pacing}
          onPacing={(p) => {
            applySettings({ ...settings, pacing: p });
            pushToast("info", `Pace set to ${PACING[p].label} — ${PACING[p].blurb}`);
          }}
          onAbort={abort}
          stats={stats}
          boardEmpty={records.length === 0}
          sweep={{
            state: sweepState,
            logs: sweepLogs,
            progress: sweepProgress,
            prospects,
            selected: selectedIds,
            area: sweepArea,
            onRun: runSweep,
            onCancel: cancelSweep,
            onToggle: (id) =>
              setSelectedIds((s) => {
                const n = new Set(s);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              }),
            onToggleAll: () =>
              setSelectedIds((s) =>
                s.size === prospects.length ? new Set() : new Set(prospects.map((p) => p.id)),
              ),
            onEnqueue: enqueueProspects,
          }}
        />

        <Board
          records={records}
          expandedId={expandedId}
          flashId={flashId}
          onToggle={(id) => setExpandedId((e) => (e === id ? null : id))}
          onRetry={retry}
          onDelete={remove}
          onRepitch={repitch}
          onCopy={copy}
          onExport={exportCsv}
        />
      </main>

      {/* ======= ticker / footer ======= */}
      <footer className="border-t border-line bg-coal-900/70">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 lg:px-8">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-amber">
            <IconBolt size={11} />
            <span key={tipIdx} className="logline">{TIPS[tipIdx]}</span>
          </span>
          <span className="ml-auto font-mono text-[9px] tracking-[0.14em] text-dim">
            {modeLive
              ? "LIVE: PSI pulls are real · contact & pitch stages remain simulated"
              : "SIM MODE — telemetry synthesized per-domain in-browser · arm API keys in settings for live pulls"}
          </span>
        </div>
      </footer>

      {/* ======= settings ======= */}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        meters={meters}
        modeLive={modeLive}
        onClose={() => setSettingsOpen(false)}
        onSave={(s) => {
          applySettings(s);
          setSettingsOpen(false);
          const live = Boolean(s.psiKey && s.hunterKey && s.aiKey);
          pushToast("success", live ? "All keys armed — rig is LIVE" : "Settings saved — running in SIM mode");
        }}
        onTopUp={topUp}
        onWipe={wipe}
      />

      {/* ======= toasts ======= */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[320px] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex items-start gap-2.5 border bg-coal-800 px-3.5 py-2.5 shadow-(--shadow-pop) ${
              t.type === "success" ? "border-green/40" : t.type === "error" ? "border-red/40" : "border-linehi"
            }`}
          >
            <span className={`mt-0.5 ${t.type === "success" ? "text-green" : t.type === "error" ? "text-red" : "text-cyan"}`}>
              {t.type === "success" ? <IconCheck size={13} strokeWidth={2.4} /> : t.type === "error" ? <IconX size={13} strokeWidth={2.4} /> : <IconInfo size={13} />}
            </span>
            <p className="font-mono text-[11px] leading-snug text-ink">{t.msg}</p>
            <button
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
              className="ml-auto text-dim transition-colors hover:text-ink"
            >
              <IconX size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
