/* ============================================================
   SITEDYNO — synthetic telemetry + pitch generation
   All data is deterministically seeded from the domain, so a
   given site always produces the same "dyno sheet".
   ============================================================ */

export type Tone = "brutal" | "roi" | "friendly";
export type Severity = "crit" | "warn" | "info";

export interface Issue {
  id: string;
  label: string;
  detail: string;
  sev: Severity;
}

export interface Metrics {
  pi: number;      // PageSpeed performance score 0-100
  lcp: number;     // seconds
  cls: number;
  ttfb: number;    // seconds
  weightMB: number;
  requests: number;
}

export interface SiteChecks {
  sslValid: boolean;
  sslDays: number;         // days until expiry (negative = expired)
  heroMB: number | null;   // null = no hero image found
  heroPath: string | null;
  viewport: boolean;       // mobile viewport meta present
  httpsRedirect: boolean;
}

export interface Contact {
  name: string;
  firstName: string;
  role: string;
  email: string;
  pattern: string;
  confidence: number; // 0-100
  verified: boolean;
}

export interface Audit {
  company: string;
  metrics: Metrics;
  checks: SiteChecks;
  issues: Issue[];
  contact: Contact | null;
  lossMo: number;
}

export interface Pitch {
  tone: Tone;
  variant: number;
  subject: string;
  email: string;
  script: string[];
  tokens: number;
  at: number;
}

/* ---------------- seeded PRNG ---------------- */

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rnd: () => number, arr: T[]): T =>
  arr[Math.floor(rnd() * arr.length)];

const between = (rnd: () => number, lo: number, hi: number) =>
  lo + rnd() * (hi - lo);

/* ---------------- name pools ---------------- */

const FIRST = [
  "Marcus", "Dana", "Priya", "Tom", "Elena", "Ray", "Sofia", "Greg",
  "Nadia", "Carl", "Ines", "Viktor", "Lena", "Omar", "Kate", "Hugo",
  "Marta", "Dean", "Yuki", "Paula", "Seth", "Rita", "Jonas", "Alicia",
];
const LAST = [
  "Mercer", "Kowalski", "Tran", "Bishop", "Ferreira", "Lindqvist", "Okafor",
  "Delgado", "Hartmann", "Nagy", "Sullivan", "Petrov", "Moreau", "Castellano",
  "Whitfield", "Andersen", "Iversen", "Boone", "Takahashi", "Reyes", "Vance",
  "Keller", "Strand", "Duval",
];
const ROLES = [
  "Owner", "Founder", "Managing Director", "General Manager",
  "Head of Marketing", "Operations Director",
];

/* ---------------- formatting ---------------- */

export const fmtMoney = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");

export const fmt1 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function piBand(pi: number): "red" | "amber" | "green" {
  if (pi < 50) return "red";
  if (pi < 90) return "amber";
  return "green";
}

export const bandColor: Record<string, string> = {
  red: "var(--color-red)",
  amber: "var(--color-amber)",
  green: "var(--color-green)",
};

/* ---------------- audit synthesis ---------------- */

function companyFromDomain(domain: string): string {
  const sld = domain.split(".")[0] || domain;
  return sld
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const HERO_PATHS = [
  "/assets/hero.jpg",
  "/img/banner-home.png",
  "/wp-content/uploads/slider-01.jpg",
  "/static/og/hero-full.jpg",
  "/media/home/masthead.png",
];

export function analyzeDomain(domain: string, salt = 0): Audit {
  const rnd = mulberry(hashSeed(domain) ^ (salt * 0x9e3779b9));

  // --- metrics (skewed toward troubled sites — that's where the money is) ---
  const pi = Math.max(14, Math.min(97, Math.round(100 - Math.pow(rnd(), 0.7) * 84)));
  const lcp = +(1.1 + (100 - pi) * 0.072 + between(rnd, 0, 1.3)).toFixed(1);
  const cls = +Math.max(0.01, (100 - pi) * 0.008 + between(rnd, 0, 0.14)).toFixed(2);
  const ttfb = +(0.18 + (100 - pi) * 0.019 + between(rnd, 0, 0.55)).toFixed(2);
  const weightMB = +(1.1 + (100 - pi) * 0.052 + between(rnd, 0, 2.6)).toFixed(1);
  const requests = Math.round(32 + (100 - pi) * 0.85 + between(rnd, 0, 64));
  const metrics: Metrics = { pi, lcp, cls, ttfb, weightMB, requests };

  // --- visual inspection checks ---
  const sslValid = rnd() > 0.1;
  const sslDays = sslValid
    ? Math.round(between(rnd, 6, 380))
    : -Math.round(between(rnd, 1, 40));
  const hasHero = rnd() > 0.12;
  const heroMB = hasHero
    ? +Math.max(0.25, (100 - pi) * 0.05 + between(rnd, 0.2, 4.2)).toFixed(1)
    : null;
  const checks: SiteChecks = {
    sslValid,
    sslDays,
    heroMB,
    heroPath: hasHero ? pick(rnd, HERO_PATHS) : null,
    viewport: rnd() > (100 - pi) / 240,
    httpsRedirect: rnd() > 0.18,
  };

  // --- fault codes ---
  const cand: Issue[] = [];
  if (checks.heroMB && checks.heroMB > 0.9) {
    cand.push({
      id: "hero",
      label: `Hero image ${fmt1(checks.heroMB)} MB uncompressed`,
      detail: `${checks.heroPath} ships raw — one WebP pass cuts it ~78%`,
      sev: checks.heroMB > 2.6 ? "crit" : "warn",
    });
  }
  if (!checks.viewport) {
    cand.push({
      id: "viewport",
      label: "Viewport meta tag missing",
      detail: "Mobile renders a zoomed-out desktop frame — instant bounce",
      sev: "crit",
    });
  }
  if (!checks.sslValid) {
    cand.push({
      id: "ssl",
      label: `SSL certificate expired ${Math.abs(checks.sslDays)}d ago`,
      detail: "Chrome flags the domain as Not Secure at first paint",
      sev: "crit",
    });
  }
  if (lcp > 4) {
    cand.push({
      id: "lcp",
      label: `LCP at ${fmt1(lcp)}s — Google redline is 2.5s`,
      detail: "Largest contentful element paints after 3 render-blocking rounds",
      sev: "crit",
    });
  }
  cand.push({
    id: "blocking",
    label: `${Math.round(between(rnd, 3, 11))} render-blocking scripts in <head>`,
    detail: "Synchronous tags stall first paint — defer/async would free it",
    sev: pi < 60 ? "crit" : "warn",
  });
  cand.push({
    id: "compress",
    label: rnd() > 0.5 ? "No Brotli — gzip only at level 6" : "Compression disabled on static assets",
    detail: `Total transfer ${fmt1(weightMB)} MB; ~${Math.round(weightMB * 220)} KB recoverable`,
    sev: "warn",
  });
  cand.push({
    id: "cache",
    label: "Cache-Control unset on ${Math.round(between(rnd, 8, 40))} static files",
    detail: "Returning visitors re-download everything every session",
    sev: "warn",
  });
  if (cls > 0.12) {
    cand.push({
      id: "cls",
      label: `CLS ${fmt2(cls)} from unsized media`,
      detail: "Layout jumps ${Math.round(cls * 100)}% mid-load — thumbs miss buttons",
      sev: "warn",
    });
  }
  cand.push({
    id: "dom",
    label: `DOM size ${Math.round(between(rnd, 950, 2900))} nodes`,
    detail: "Page-builder bloat — style recalc cost on every interaction",
    sev: "info",
  });
  cand.push({
    id: "trackers",
    label: `${Math.round(between(rnd, 4, 14))} third-party trackers firing on load`,
    detail: "Tag-manager soup adds ${Math.round(between(rnd, 240, 900))} ms of main-thread work",
    sev: "info",
  });
  if (rnd() > 0.55) {
    cand.push({
      id: "lazy",
      label: "Below-the-fold images eager-loaded",
      detail: "loading=lazy absent — ${Math.round(between(rnd, 6, 18))} images fight for bandwidth",
      sev: "warn",
    });
  }
  if (!checks.httpsRedirect) {
    cand.push({
      id: "redirect",
      label: "No HTTP→HTTPS redirect",
      detail: "Plain-HTTP requests 404 or serve mixed content",
      sev: "warn",
    });
  }

  const sevRank: Record<Severity, number> = { crit: 0, warn: 1, info: 2 };
  const count = Math.min(cand.length, 3 + Math.floor((100 - pi) / 18));
  const issues = [...cand].sort((a, b) => sevRank[a.sev] - sevRank[b.sev]).slice(0, count);

  // --- contact mapping (Hunter-style) ---
  let contact: Contact | null = null;
  if (rnd() > 0.12) {
    const first = pick(rnd, FIRST);
    const last = pick(rnd, LAST);
    const patterns = [
      { p: "first.last@", e: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}` },
      { p: "firstlast@", e: `${first.toLowerCase()}${last.toLowerCase()}@${domain}` },
      { p: "f.last@", e: `${first[0].toLowerCase()}${last.toLowerCase()}@${domain}` },
      { p: "first@", e: `${first.toLowerCase()}@${domain}` },
    ];
    const pat = pick(rnd, patterns);
    const verified = rnd() > 0.3;
    contact = {
      name: `${first} ${last}`,
      firstName: first,
      role: pick(rnd, ROLES),
      email: pat.e,
      pattern: pat.p + "{domain}",
      confidence: verified
        ? Math.round(between(rnd, 86, 98))
        : Math.round(between(rnd, 58, 84)),
      verified,
    };
  }

  // --- revenue leak estimate ---
  const traffic = Math.round(700 + rnd() * 9200);
  const conv = between(rnd, 1.6, 4.4);
  const aov = between(rnd, 55, 460);
  const factor = Math.min(0.5, Math.max(0.05, (lcp - 2.5) * 0.07));
  const lossMo = Math.max(180, Math.round((traffic * (conv / 100) * aov * factor) / 10) * 10);

  return {
    company: companyFromDomain(domain),
    metrics,
    checks,
    issues,
    contact,
    lossMo,
  };
}

/* ---------------- pitch generation ---------------- */

const AGENT = "Alex Ryder";

function topIssues(a: Audit): [string, string] {
  const first = a.issues[0]?.label.toLowerCase() ?? "slow asset delivery";
  const second = a.issues[1]?.label.toLowerCase() ?? "uncompressed media";
  return [first, second];
}

export function generatePitch(a: Audit, domain: string, tone: Tone, variant: number): Pitch {
  const rnd = mulberry(hashSeed(domain + tone) ^ (variant * 7919));
  const owner = a.contact?.firstName ?? "there";
  const { pi, lcp, cls } = a.metrics;
  const [t1, t2] = topIssues(a);
  const loss = fmtMoney(a.lossMo);
  const co = a.company;

  let subject = "";
  let email = "";
  let script: string[] = [];

  if (tone === "brutal") {
    if (variant % 2 === 0) {
      subject = `${co} scored ${pi}/100 — here's the receipt`;
      email =
        `${owner}, I put ${domain} on a performance dyno this morning: ${pi}/100 on mobile, LCP at ${fmt1(lcp)}s — Google draws the red line at 2.5s, and ${t1} is the main reason you're over it. ` +
        `Every extra second of load shaves ~7% off conversions, which at your traffic is about ${loss}/month quietly walking out the door. ` +
        `I fix exactly this for a flat fee — reply "report" and I'll send the full teardown before your competitors read this email.`;
    } else {
      subject = `Your homepage is costing you ${loss}/month`;
      email =
        `${owner} — ${co} just pulled a ${pi}/100 on Google's own speed test, dragged down by ${t1} and ${t2}. ` +
        `That's not a vanity metric: slow pages lose ~7% of buyers per second of delay, which is ≈${loss}/month at your traffic. ` +
        `I'll fix it for a flat fee and show you before/after numbers — want the free 2-minute teardown first?`;
    }
    script = [
      `[0–5s] "Hi ${owner}, this is ${AGENT}. Twenty seconds, promise — I ran ${domain} through Google's own speed test this morning."`,
      `[5–12s] "It scored ${pi} out of 100 on mobile. Big offender: ${t1}. First paint takes ${fmt1(lcp)} seconds — Google wants 2.5."`,
      `[12–22s] "Rough math at your traffic, that delay bleeds about ${loss} a month in bounced buyers — and it drags your rankings with it."`,
      `[22–28s] "I fix this for a flat fee. Can I send a 2-minute teardown video of your homepage?"`,
      `[if no] "Fair enough — I'll email you the free report anyway. Sixty seconds to read. Sound fair?"`,
    ];
  } else if (tone === "roi") {
    subject = `Quick math on ${domain}: ${loss}/month on the table`;
    email =
      `Hi ${owner} — ran ${domain} through a full mobile performance audit: ${pi}/100, LCP ${fmt1(lcp)}s, layout shift ${fmt2(cls)}, with ${t1} as the biggest offender. ` +
      `Industry data puts the cost of that delay at ~${loss}/month in lost conversions at your traffic level. ` +
      `I fix this for a flat fee with measurable before/after numbers — open to a 15-minute walkthrough this week?`;
    script = [
      `[0–5s] "Hi ${owner}, it's ${AGENT}. I audit site performance for a living — do you have twenty seconds?"`,
      `[5–14s] "${co} currently scores ${pi}/100 on mobile. The gap between that and 90+ is mostly ${t1}."`,
      `[14–23s] "The math: at your traffic, that's roughly ${loss} a month in recoverable conversions. The fix is a one-time flat fee."`,
      `[23–30s] "I'll send a one-page ROI breakdown with the numbers. What's the best email?"`,
      `[if no] "No problem — I'll leave the audit link on your voicemail. It's free either way."`,
    ];
  } else {
    subject = `A free speed report for ${co}`;
    email =
      `Hi ${owner} — I run website performance audits and ${domain} caught my eye: it's scoring ${pi}/100 on mobile, mostly because of ${t1}. ` +
      `Fixes like this usually pay for themselves within weeks — every second of load time is worth ~7% of conversions (≈${loss}/month here). ` +
      `Happy to send the full report and talk it through, no strings — want a look?`;
    script = [
      `[0–5s] "Hi ${owner}, this is ${AGENT} — not selling anything in the first minute, promise."`,
      `[5–14s] "I ran ${domain} through a speed test this morning and it came back at ${pi}/100 on phones — ${t1} is the main culprit."`,
      `[14–24s] "Most sites like yours recover around ${loss} a month once that's fixed. I do the fixes for a flat fee."`,
      `[24–30s] "Either way the full report is free — where should I send it?"`,
      `[if no] "Totally fine. I'll drop the link in an email and you can peek when it suits you."`,
    ];
  }

  const tokens = Math.round((subject.length + email.length + script.join("").length) / 4 + between(rnd, 20, 60));
  return { tone, variant, subject, email, script, tokens, at: Date.now() };
}

/* ---------------- constants ---------------- */

export const SAMPLE_DOMAINS = [
  "harborandmain.com",
  "cedarcrestroofing.com",
  "brightsmiledental.co",
  "peaktrailgear.com",
  "lunabaycafe.com",
];

export const TIPS = [
  "CLOUDFLARE BANS ~50 REQ/MIN — KEEP THE PACE HUMAN",
  "PAGESPEED QUOTA: 25K CALLS/DAY FREE — BATCH OFF-PEAK",
  "HUNTER CREDITS BURN PER SEARCH — QUALIFY BEFORE YOU PULL",
  "AI INVENTS FACTS ON MESSY FEEDS — REVIEW EVERY PITCH BEFORE SEND",
  "WORST PI SCORES = HOTTEST LEADS — SORT ASCENDING",
  "PROXY ROTATION BEATS IP BANS WHEN YOU REDLINE",
  "A 1s LCP FIX ≈ 7% MORE CONVERSIONS — SELL THE DELTA",
  "NEVER PITCH INFO@ — THE OWNER'S DIRECT INBOX CLOSES 3× COLDER",
];
