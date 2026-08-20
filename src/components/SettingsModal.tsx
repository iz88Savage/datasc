import { useEffect, useState } from "react";
import { Meters, PACING, Pacing, Settings } from "../lib/engine";
import { IconAlert, IconBolt, IconGear, IconX } from "./icons";

interface Props {
  open: boolean;
  settings: Settings;
  meters: Meters;
  modeLive: boolean;
  onClose: () => void;
  onSave: (s: Settings) => void;
  onTopUp: () => void;
  onWipe: () => void;
}

export default function SettingsModal({
  open, settings, meters, modeLive, onClose, onSave, onTopUp, onWipe,
}: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [wipeArmed, setWipeArmed] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setWipeArmed(false);
    }
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const keyFields: { k: keyof Settings; label: string; hint: string; ph: string }[] = [
    { k: "psiKey", label: "PAGESPEED API KEY", hint: "Unlocks live PSI v5 pulls instead of synthetic telemetry. Free tier: 25k calls/day.", ph: "AIza…" },
    { k: "hunterKey", label: "HUNTER.IO API KEY", hint: "Fuel for the contact mapper — owner name, role, direct inbox, confidence.", ph: "hunter_…" },
    { k: "aiKey", label: "OPENAI API KEY", hint: "Feeds the ECU flash. Pitches are drafted by GPT-4o with temp 0.7.", ph: "sk-…" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="notch w-full max-w-xl border border-line bg-coal-850 shadow-(--shadow-pop) rise">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <IconGear size={16} className="text-amber" />
            <h2 className="font-display text-sm font-bold tracking-[0.2em] text-ink">RIG SETTINGS</h2>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 px-2 py-1 font-mono text-[9.5px] font-bold tracking-[0.18em] ${
                modeLive ? "bg-green/15 text-green" : "bg-amber/15 text-amber"
              }`}
            >
              <span className={`led ${modeLive ? "led-green" : "led-amber"}`} style={{ width: 6, height: 6 }} />
              {modeLive ? "LIVE MODE" : "SIM MODE"}
            </span>
            <button onClick={onClose} className="p-1 text-dim transition-colors hover:text-ink" title="Close (Esc)">
              <IconX size={16} />
            </button>
          </div>
        </div>

        <div className="scroll-thin max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* API keys */}
          <div className="space-y-4">
            {keyFields.map((f) => (
              <div key={f.k}>
                <label className="font-mono text-[10px] font-semibold tracking-[0.18em] text-mute">
                  {f.label}
                  {draft[f.k] ? <span className="ml-2 text-green">ARMED</span> : <span className="ml-2 text-dim">EMPTY</span>}
                </label>
                <input
                  value={draft[f.k] as string}
                  onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })}
                  placeholder={f.ph}
                  spellCheck={false}
                  autoComplete="off"
                  className="notch-sm mt-1.5 w-full border border-line bg-coal-900 px-3 py-2.5 font-mono text-xs text-ink placeholder:text-dim focus:border-amber/60"
                />
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-dim">{f.hint}</p>
              </div>
            ))}
            <p className="border border-dashed border-line px-3 py-2 font-mono text-[10px] leading-relaxed text-dim">
              Keys are stored in this browser only. Without all three the rig runs in SIM mode —
              telemetry is synthesized deterministically per domain, so every pull still completes.
            </p>
          </div>

          {/* pacing */}
          <div className="mt-6">
            <div className="mb-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-mute">PULL PACE</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(PACING) as Pacing[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft({ ...draft, pacing: p })}
                  className={`notch-sm border px-3 py-2.5 text-left transition-colors ${
                    draft.pacing === p
                      ? p === "redline"
                        ? "border-red/60 bg-red/10"
                        : "border-amber/60 bg-amber/10"
                      : "border-line bg-coal-900 hover:border-linehi"
                  }`}
                >
                  <div className={`font-display text-xs font-bold tracking-[0.16em] ${
                    draft.pacing === p ? (p === "redline" ? "text-red" : "text-amber") : "text-mute"
                  }`}>
                    {PACING[p].label}
                  </div>
                  <div className="mt-1 font-mono text-[9.5px] leading-snug text-dim">{PACING[p].blurb}</div>
                  <div className="mt-1 font-mono text-[9px] text-dim">
                    block risk ~{Math.round(PACING[p].blockChance * 100)}%
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* fuel */}
          <div className="mt-6 flex items-center justify-between border border-line bg-coal-900 px-4 py-3">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] text-dim">HUNTER CREDITS</div>
              <div className={`mt-0.5 font-mono text-2xl font-bold tabnums ${meters.hunter === 0 ? "text-red" : "text-ink"}`}>
                {meters.hunter}
              </div>
            </div>
            <div className="text-right">
              <button
                onClick={onTopUp}
                className="notch-sm flex items-center gap-1.5 border border-amber/50 px-3 py-2 font-mono text-[10px] font-bold tracking-[0.14em] text-amber transition-colors hover:bg-amber/15"
              >
                <IconBolt size={12} /> TOP UP +25
              </button>
              <p className="mt-1 font-mono text-[9px] text-dim">simulated — no billing on this rig</p>
            </div>
          </div>

          {/* danger */}
          <div className="mt-6 border border-red/30 bg-red/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-red">DANGER ZONE</div>
                <p className="mt-0.5 font-mono text-[10px] text-dim">Clears every pull, pitch and fault from the board.</p>
              </div>
              <button
                onClick={() => {
                  if (!wipeArmed) {
                    setWipeArmed(true);
                    setTimeout(() => setWipeArmed(false), 4000);
                  } else {
                    onWipe();
                    setWipeArmed(false);
                  }
                }}
                className={`notch-sm flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] font-bold tracking-[0.14em] transition-colors ${
                  wipeArmed ? "bg-red text-[#1c0808]" : "border border-red/50 text-red hover:bg-red/15"
                }`}
              >
                <IconAlert size={12} /> {wipeArmed ? "CONFIRM WIPE?" : "WIPE BOARD"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-mute transition-colors hover:text-ink"
          >
            CANCEL
          </button>
          <button
            onClick={() => onSave(draft)}
            className="notch-sm bg-amber px-5 py-2 font-display text-xs font-bold tracking-[0.16em] text-[#161006] transition-colors hover:bg-amberhi"
          >
            SAVE &amp; CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
