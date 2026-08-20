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

/* Translate a technical fault into words an everyday person gets. */
function plainSpeak(id: string): string {
  switch (id) {
    case "hero": return "the big photo up top is way too heavy to download";
    case "viewport": return "the site doesn't fit phone screens, so people have to pinch and zoom";
    case "ssl": return "phones slap a \u201CNot Secure\u201D warning on your page before it even loads";
    case "lcp": return "customers stare at a blank screen way too long before anything shows up";
    case "blocking": return "the site does a pile of extra chores before it even appears";
    case "compress": return "the files being sent are much bigger than they need to be";
    case "cache": return "people who come back re-download the whole thing on every visit";
    case "cls": return "the page jumps around while people try to tap the buttons";
    case "dom": return "the page is built out of far too many moving pieces";
    case "trackers": return "a swarm of ad trackers is slowing your page down";
    case "lazy": return "pictures way down the page load before anyone even scrolls to them";
    case "redirect": return "the site doesn't automatically use the secure address";
    default: return "the site is loading slower than it should";
  }
}

function topIssues(a: Audit): [string, string] {
  const first = plainSpeak(a.issues[0]?.id ?? "lcp");
  const second = plainSpeak(a.issues[1]?.id ?? "compress");
  return [first, second];
}

export function generatePitch(a: Audit, domain: string, tone: Tone, variant: number): Pitch {
  const rnd = mulberry(hashSeed(domain + tone) ^ (variant * 7919));
  const owner = a.contact?.firstName ?? "there";
  const { pi, lcp } = a.metrics;
  const [t1, t2] = topIssues(a);
  const loss = fmtMoney(a.lossMo);
  const co = a.company;

  let subject = "";
  let email = "";
  let script: string[] = [];

  if (tone === "brutal") {
    if (variant % 2 === 0) {
      subject = `${co} is losing customers before the page even loads`;
      email =
        `${owner}, I opened ${domain} on a phone this morning and timed it — it takes ${fmt1(lcp)} seconds before customers see anything, and people start giving up after about two and a half. ` +
        `The biggest reason is that ${t1}, and every one of those lost seconds pushes about ${loss} a month of buyers out your front door. ` +
        `I fix exactly this for one flat price — reply \u201Creport\u201D and I\u2019ll show you what\u2019s wrong before your competitor does.`;
    } else {
      subject = `Your website is costing you about ${loss} a month`;
      email =
        `${owner} — I ran ${domain} through Google\u2019s own speed test on a phone and it scored ${pi} out of 100, mostly because ${t1} — and on top of that, ${t2}. ` +
        `Here\u2019s the simple math: when a page is slow, people tap the back button and buy from someone else — that\u2019s roughly ${loss} a month walking away. ` +
        `I\u2019ll fix it for one flat price and show you the before-and-after — want me to send a free 2-minute video of what\u2019s wrong first?`;
    }
    script = [
      `[0\u20135s] \u201CHi ${owner}, this is ${AGENT}. Give me twenty seconds \u2014 I opened ${domain} on a phone this morning.\u201D`,
      `[5\u201313s] \u201CIt takes ${fmt1(lcp)} seconds before anything shows up. People give up after about two and a half.\u201D`,
      `[13\u201322s] \u201CSo customers tap the back button and buy somewhere else. At your size, that\u2019s about ${loss} a month walking away.\u201D`,
      `[22\u201328s] \u201CI fix this for one flat price. Can I send you a short video of exactly what\u2019s slowing it down?\u201D`,
      `[if no] \u201CNo worries \u2014 I\u2019ll email you the free report anyway. It takes one minute to read. Fair?\u201D`,
    ];
  } else if (tone === "roi") {
    subject = `About ${loss} a month is slipping away from ${domain}`;
    email =
      `Hi ${owner} — I tested ${domain} the way a customer on a phone would, and it scored ${pi} out of 100 for speed; the main problem is that ${t1}. ` +
      `Slow pages quietly lose sales, and at your level of traffic that adds up to about ${loss} a month. ` +
      `I fix this for one flat price and I\u2019ll show you the numbers before and after — free to talk for fifteen minutes this week?`;
    script = [
      `[0\u20135s] \u201CHi ${owner}, it\u2019s ${AGENT}. I test websites for a living \u2014 got twenty seconds?\u201D`,
      `[5\u201314s] \u201C${co}\u2019s site scores ${pi} out of 100 on phones. The biggest thing holding it back is that ${t1}.\u201D`,
      `[14\u201323s] \u201CThe simple math: at your traffic, that slowness costs about ${loss} a month in lost sales. The fix is one flat price.\u201D`,
      `[23\u201330s] \u201CI\u2019ll send a one-page summary with the numbers. What\u2019s the best email for you?\u201D`,
      `[if no] \u201CNo problem \u2014 I\u2019ll leave the free report on your voicemail. It\u2019s yours either way.\u201D`,
    ];
  } else {
    subject = `A free speed check-up for ${co}`;
    email =
      `Hi ${owner} — I check website speed for a living, and ${domain} caught my eye: it scores ${pi} out of 100 on phones, mostly because ${t1}. ` +
      `Speed-ups like this usually pay for themselves fast — a quicker page means fewer people give up, and here that\u2019s worth about ${loss} a month. ` +
      `I\u2019m happy to send the full report and walk you through it, no pressure at all — want a look?`;
    script = [
      `[0\u20135s] \u201CHi ${owner}, this is ${AGENT} \u2014 not selling you anything in the first minute, promise.\u201D`,
      `[5\u201314s] \u201CI tested ${domain} on a phone this morning and it came back at ${pi} out of 100 \u2014 ${t1} is the main thing slowing it down.\u201D`,
      `[14\u201324s] \u201CMost sites like yours get back around ${loss} a month once that\u2019s fixed. I do the fix for one flat price.\u201D`,
      `[24\u201330s] \u201CThe full report is free either way \u2014 where should I send it?\u201D`,
      `[if no] \u201CTotally fine. I\u2019ll drop the link in an email and you can peek whenever suits you.\u201D`,
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
