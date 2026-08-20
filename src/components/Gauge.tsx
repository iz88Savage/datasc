import { useEffect, useRef, useState } from "react";
import { bandColor, piBand } from "../lib/data";

/* rAF count-up hook */
export function useCountUp(target: number | null, duration = 900): number | null {
  const [display, setDisplay] = useState<number | null>(target);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (target === null) {
      setDisplay(null);
      fromRef.current = 0;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setDisplay(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

/* polar helpers — angle in deg, 0 = 12 o'clock, sweep ±120 */
const CX = 110;
const CY = 108;
const R = 84;
const toXY = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const arc = (fromDeg: number, toDeg: number, r: number) => {
  const [x1, y1] = toXY(fromDeg, r);
  const [x2, y2] = toXY(toDeg, r);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

export default function Gauge({
  value,
  size = 220,
  stateLabel,
}: {
  value: number | null;
  size?: number;
  stateLabel: string;
}) {
  const display = useCountUp(value, 1100);
  const needleDeg = value === null ? -120 : -120 + (Math.min(100, value) / 100) * 240;
  const band = value === null ? null : piBand(value);
  const color = band ? bandColor[band] : "#5b6878";

  const ticks = [];
  for (let v = 0; v <= 100; v += 5) {
    const deg = -120 + (v / 100) * 240;
    const major = v % 10 === 0;
    const [x1, y1] = toXY(deg, R - 8);
    const [x2, y2] = toXY(deg, R - (major ? 20 : 14));
    ticks.push(
      <line
        key={v}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={major ? "#5b6878" : "#333f50"}
        strokeWidth={major ? 2 : 1}
      />,
    );
    if (major) {
      const [lx, ly] = toXY(deg, R - 32);
      ticks.push(
        <text key={`t${v}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
          fill="#5b6878" fontSize="9" fontFamily="JetBrains Mono, monospace">
          {v}
        </text>,
      );
    }
  }

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 220 148" style={{ width: size }} className="overflow-visible">
        {/* zone arcs */}
        <path d={arc(-120, 0, R)} stroke="rgba(255,99,99,0.55)" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={arc(0, 96, R)} stroke="rgba(255,171,46,0.55)" strokeWidth="7" fill="none" />
        <path d={arc(96, 120, R)} stroke="rgba(65,226,164,0.6)" strokeWidth="7" fill="none" strokeLinecap="round" />
        {ticks}
        {/* needle */}
        <g
          style={{
            transform: `rotate(${needleDeg}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: "transform 1.15s cubic-bezier(0.18, 0.9, 0.24, 1.12)",
          }}
        >
          <path d={`M ${CX - 3.5} ${CY + 10} L ${CX} ${CY - R + 16} L ${CX + 3.5} ${CY + 10} Z`} fill={color} />
          <line x1={CX} y1={CY + 10} x2={CX} y2={CY - R + 16} stroke={color} strokeWidth="1" opacity="0.6" />
        </g>
        <circle cx={CX} cy={CY} r="9" fill="#1c2431" stroke="#3a4658" strokeWidth="1.5" />
        <circle cx={CX} cy={CY} r="3" fill={color} />
      </svg>
      <div className="-mt-7 flex flex-col items-center">
        <div
          className="font-mono text-4xl leading-none tabnums"
          style={{ color: value === null ? "#5b6878" : color, fontWeight: 700 }}
        >
          {display === null ? "--" : Math.round(display)}
        </div>
        <div className="mt-1.5 font-mono text-[10px] tracking-[0.22em] text-dim">
          {stateLabel}
        </div>
      </div>
    </div>
  );
}
