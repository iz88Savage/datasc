import { useEffect, useRef, useState } from "react";
import { DynoRecord, PACING, Pacing, STAGES, past, stageIndex } from "../lib/engine";
import { SAMPLE_DOMAINS, piBand, bandColor } from "../lib/data";
import Gauge from "./Gauge";
import {
  IconBolt, IconSpinner, IconStop, IconTacho, IconWrench, IconX, IconCheck, IconQueue,
} from "./icons";

export interface EnqueueResult {
  added: number;
  dupes: number;
  bad: string[];
}

interface Props {
  onEnqueue: (raw: string[]) => EnqueueResult;
  onSample: (domain: string) => void;
  live: DynoRecord | null;
  queue: DynoRecord[];
  busy: boolean;
  pacing: Pacing;
  onPacing: (p: Pacing) => void;
  onAbort: () => void;
  stats: { runs: number; avgPi: number | null; leads: number; faults: number };
  boardEmpty: boolean;
}

export default function ConsoleDeck({
  onEnqueue, onSample, live, queue, busy, pacing, onPacing, onAbort, stats, boardEmpty,
}: Props) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [single, setSingle] = useState("");
  const [batch, setBatch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const raw = mode === "single" ? [single] : batch.split(/[\n,]+/).filter((s) => s.trim());
    if (!raw.length) {
      setError("Feed the dyno a domain first.");
      return;
    }
    const res = onEnqueue(raw);
    if (res.added > 0) {
      setError(
        res.bad.length
          ? `${res.added} queued · skipped invalid: ${res.bad.slice(0, 2).join(", ")}${res.bad.length > 2 ? "…" : ""}`
          : null,
      );
      if (!res.bad.length) {
        setSingle("");
        setBatch("");
      }
    } else if (res.dupes && !res.bad.length) {
      setError("Already on the board — this one's been pulled.");
    } else {
      setError(`Not a domain the rig recognizes: ${res.bad.slice(0, 2).join(", ")}`);
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-12">
      {/* ------------ INTAKE ------------ */}
      <div className="lg:col-span-7 rise">
        <div className="panel notch relative overflow-hidden border border-line bg-coal-850 shadow-(--shadow-panel)">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="led led-amber" />
              <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-ink">
                INTAKE <span className="text-dim">//</span>{" "}
                <span className="text-mute">PUT IT ON THE ROLLERS</span>
              </h2>
            </div>
            {/* pacing selector */}
            <div className="flex items-center gap-1 rounded-sm border border-line bg-coal-900 p-0.5">
              {(Object.keys(PACING) as Pacing[]).map((p) => (
                <button
                  key={p}
                  onClick={() => onPacing(p)}
                  title={PACING[p].blurb}
                  className={`px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] transition-colors ${
                    pacing === p
                      ? p === "redline"
                        ? "bg-red/20 text-red"
                        : "bg-amber/20 text-amber"
                      : "text-dim hover:text-mute"
                  }`}
                >
                  {PACING[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {/* mode tabs */}
            <div className="mb-3 flex items-center gap-4">
              {(["single", "batch"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`font-display text-xs font-semibold tracking-[0.2em] transition-colors ${
                    mode === m ? "text-amber" : "text-dim hover:text-mute"
                  }`}
                >
                  <span className={mode === m ? "text-amber" : "text-coal-600"}>▸ </span>
                  {m === "single" ? "SINGLE PULL" : "BATCH FEED"}
                </button>
              ))}
              <span className="ml-auto hidden font-mono text-[10px] tracking-widest text-dim sm:block">
                {PACING[pacing].blurb.toUpperCase()}
              </span>
            </div>

            {mode === "single" ? (
              <div className="flex gap-2">
                <input
                  value={single}
                  onChange={(e) => { setSingle(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="e.g. cedarcrestroofing.com"
                  spellCheck={false}
                  className="notch-sm min-w-0 flex-1 border border-line bg-coal-900 px-4 py-3 font-mono text-sm text-ink placeholder:text-dim focus:border-amber/60"
                />
                <button
                  onClick={submit}
                  className="notch-sm group flex items-center gap-2 bg-amber px-5 py-3 font-display text-sm font-bold tracking-[0.14em] text-[#161006] transition-all hover:bg-amberhi active:translate-y-px"
                >
                  <IconWrench size={16} strokeWidth={2.2} />
                  RUN DYNO
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  value={batch}
                  onChange={(e) => { setBatch(e.target.value); setError(null); }}
                  placeholder={"one domain per line…\nharborandmain.com\nlunabaycafe.com\npeaktrailgear.com"}
                  spellCheck={false}
                  rows={4}
                  className="notch-sm w-full resize-none border border-line bg-coal-900 px-4 py-3 font-mono text-sm leading-relaxed text-ink placeholder:text-dim focus:border-amber/60"
                />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-widest text-dim">
                    {batch.split(/[\n,]+/).filter((s) => s.trim()).length} DOMAINS IN FEED · RUNS SEQUENTIAL AT {PACING[pacing].label} PACE
                  </span>
                  <button
                    onClick={submit}
                    className="notch-sm flex items-center gap-2 bg-amber px-5 py-2.5 font-display text-sm font-bold tracking-[0.14em] text-[#161006] transition-all hover:bg-amberhi active:translate-y-px"
                  >
                    <IconBolt size={15} strokeWidth={2.2} />
                    QUEUE ALL
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="logline mt-3 flex items-start gap-2 font-mono text-[11px] leading-relaxed text-red">
                <IconX size={12} className="mt-0.5 flex-none" strokeWidth={2.4} />
                {error}
              </p>
            )}

            {boardEmpty && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-4">
                <span className="font-mono text-[10px] tracking-[0.18em] text-dim">COLD START — PULL A SAMPLE:</span>
                {SAMPLE_DOMAINS.map((d) => (
                  <button
                    key={d}
                    onClick={() => onSample(d)}
                    className="notch-sm border border-line bg-coal-800 px-2.5 py-1 font-mono text-[11px] text-mute transition-colors hover:border-amber/50 hover:text-amber"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* stat strip */}
          <div className="grid grid-cols-4 divide-x divide-line border-t border-line bg-coal-900/60">
            {[
              { k: "PULLS RUN", v: String(stats.runs) },
              { k: "AVG PI", v: stats.avgPi === null ? "--" : String(stats.avgPi), c: stats.avgPi !== null ? bandColor[piBand(stats.avgPi)] : undefined },
              { k: "VERIFIED LEADS", v: String(stats.leads) },
              { k: "FAULTS", v: String(stats.faults), c: stats.faults > 0 ? "var(--color-red)" : undefined },
            ].map((s) => (
              <div key={s.k} className="px-4 py-3">
                <div className="font-mono text-lg font-bold leading-none tabnums" style={{ color: s.c ?? "var(--color-ink)" }}>
                  {s.v}
                </div>
                <div className="mt-1 font-mono text-[9px] tracking-[0.18em] text-dim">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------ LIVE PULL ------------ */}
      <div className="lg:col-span-5 rise rise-1">
        <div className="panel notch scanline relative flex h-full flex-col overflow-hidden border border-line bg-coal-850 shadow-(--shadow-panel)">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className={`led ${live ? "led-amber" : "led-dim"}`} />
              <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-ink">
                LIVE PULL <span className="text-dim">//</span>{" "}
                <span className="text-mute">TELEMETRY FEED</span>
              </h2>
            </div>
            {busy && (
              <button
                onClick={onAbort}
                className="flex items-center gap-1.5 border border-red/40 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-red transition-colors hover:bg-red/15"
                title="Kill the current run and flush the queue"
              >
                <IconStop size={12} /> ABORT
              </button>
            )}
          </div>

          <div className="flex flex-1 flex-col p-5">
            {live ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg font-bold text-ink">{live.domain}</div>
                    <div className="font-mono text-[10px] tracking-[0.18em] text-dim">
                      {live.company.toUpperCase()} · PULL #{String(live.createdAt).slice(-5)}
                    </div>
                  </div>
                  <Gauge
                    value={past(live, "pagespeed") ? live.audit.metrics.pi : null}
                    size={148}
                    stateLabel={
                      live.status === "failed" ? "FAULT" : past(live, "pagespeed") ? "PI LOCKED" : "PULLING…"
                    }
                  />
                </div>

                {/* stage checklist */}
                <ol className="space-y-1">
                  {STAGES.map((s, i) => {
                    const cur = stageIndex(live.stage);
                    const failed = live.status === "failed" && live.failStage === s.key;
                    const doneStage = live.status === "done" || cur > i || (live.status === "failed" && cur > i);
                    const active = live.status !== "failed" && live.status !== "done" && cur === i;
                    return (
                      <li key={s.key}>
                        <div className="flex items-center gap-3 px-1 py-[5px]">
                          <span className="font-mono text-[10px] text-dim">0{i + 1}</span>
                          <span
                            className={`font-mono text-[11px] tracking-[0.12em] ${
                              failed ? "text-red" : doneStage ? "text-mute" : active ? "text-amber" : "text-coal-600"
                            }`}
                          >
                            {s.label}
                          </span>
                          <span className="ml-auto">
                            {failed ? (
                              <IconX size={13} className="text-red" strokeWidth={2.4} />
                            ) : doneStage ? (
                              <IconCheck size={13} className="text-green" strokeWidth={2.4} />
                            ) : active ? (
                              <IconSpinner size={13} className="text-amber" />
                            ) : (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-coal-600" />
                            )}
                          </span>
                        </div>
                        {active && (
                          <div className="ml-9 mr-1 h-1 overflow-hidden bg-coal-700">
                            <div className="stripes h-full w-full" />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {/* log terminal */}
                <LogTerm lines={live.logs.slice(-6)} failed={live.status === "failed"} />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                <IconTacho size={44} className="text-coal-600" strokeWidth={1.4} />
                <div className="font-display text-sm font-semibold tracking-[0.2em] text-dim">NO LOAD</div>
                <p className="max-w-[240px] font-mono text-[11px] leading-relaxed text-dim">
                  Dyno idle. Feed it a domain and watch the pull happen stage by stage.
                </p>
              </div>
            )}

            {/* queue strip */}
            {queue.length > 0 && (
              <div className="mt-4 border-t border-dashed border-line pt-3">
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-dim">
                  <IconQueue size={12} /> IN QUEUE — {queue.length}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {queue.slice(0, 8).map((r, i) => (
                    <span key={r.id} className="logline notch-sm border border-line bg-coal-800 px-2 py-0.5 font-mono text-[10px] text-mute">
                      <span className="text-amber">{i + 1}.</span> {r.domain}
                    </span>
                  ))}
                  {queue.length > 8 && (
                    <span className="px-1 font-mono text-[10px] text-dim">+{queue.length - 8} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LogTerm({ lines, failed }: { lines: { t: number; line: string }[]; failed: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);
  return (
    <div
      ref={ref}
      className="scroll-thin mt-4 h-[128px] overflow-y-auto border border-line bg-coal-950/80 p-3"
    >
      {lines.map((l, i) => (
        <div key={`${l.t}-${i}`} className="logline flex gap-2 font-mono text-[10.5px] leading-[1.7]">
          <span className="flex-none text-coal-600">
            {new Date(l.t).toLocaleTimeString("en-GB", { hour12: false })}
          </span>
          <span className={l.line.includes("!!") || l.line.includes("MISSING") || l.line.includes("EXPIRED") || l.line.includes("challenge wall") || failed ? "text-amber" : "text-cyan/85"}>
            {l.line}
          </span>
        </div>
      ))}
      <div className="flex gap-2 font-mono text-[10.5px]">
        <span className="text-coal-600">&gt;</span>
        <span className="blink text-mute">▮</span>
      </div>
    </div>
  );
}
