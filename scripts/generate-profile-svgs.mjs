/**
 * generate-profile-svgs.mjs — BRUTAL 3D EDITION ⚡
 * ─────────────────────────────────────────────────
 * Fetches live GitHub data and renders brutally 3D SVG cards.
 * Run: node scripts/generate-profile-svgs.mjs
 * Env: GH_TOKEN or GITHUB_TOKEN (GitHub Personal Access Token)
 *      Scopes needed: read:user, repo
 */

import { mkdirSync }  from "node:fs";
import { writeFile }  from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath }    from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS    = resolve(__dirname, "../assets");
mkdirSync(ASSETS, { recursive: true });

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ✏️  CUSTOMIZE — Edit here to personalize your profile cards            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// // USERNAME: Your GitHub username
const USERNAME = "muhammadadmiral";

// // BIO: Short tagline shown under stats card username
// // Also update the typing SVG URL in readme.md for the animated bio text
const BIO = "React / NestJS Developer";

// // FALLBACK_PINNED: Hardcode pinned repos here as backup.
// // Used when GH_PAT is missing or your profile has no pinned repos.
// // Remove the leading // on each entry line to activate it.
const FALLBACK_PINNED = [
  // { name: "Sereluna",           description: "Capstone Project Bangkit 2024 — Mobile Health App",      language: "Kotlin",     languageColor: "#A97BFF", stars: 0, forks: 0 },
  // { name: "sereluna-ai-engine", description: "Machine learning backend powering Sereluna AI",          language: "Python",     languageColor: "#3572A5", stars: 0, forks: 0 },
  // { name: "your-project-3",     description: "Add a description for your third project here",          language: "TypeScript", languageColor: "#3178c6", stars: 0, forks: 0 },
  // { name: "your-project-4",     description: "Add a description for your fourth project here",         language: "JavaScript", languageColor: "#f7df1e", stars: 0, forks: 0 },
];

// // THEME: Global color palette — change hex values to switch the entire theme
const T = {
  bg:        "#030010",   // outermost canvas background
  card:      "#07031a",   // card face color
  edgeDeep:  "#0a0318",   // 3D card deep edge (darkest)
  edgeMid:   "#06011a",   // 3D card mid edge
  p1:        "#c084fc",   // primary accent — purple
  p2:        "#67e8f9",   // secondary accent — cyan
  p3:        "#f472b6",   // tertiary accent — pink
  green:     "#4ade80",   // snake / success
  greenHead: "#86efac",   // snake head (brighter)
  fire:      "#ea580c",   // streak fire orange
  gold:      "#fbbf24",   // stars / trophies gold
  text:      "#e2e8f0",   // primary text
  muted:     "#9ca3af",   // muted text
  dim:       "#6b7280",   // dim text
  dimmer:    "#4b5563",   // very dim text
};

// ══════════════════════════════════════════════════════════════════════════════

const TOKEN       = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_BASE   = "https://api.github.com";

// ─── API helpers ──────────────────────────────────────────────────────────────
async function restGet(path, fallback = null) {
  const h = { "User-Agent": "profile-svg-gen/3.0", Accept: "application/vnd.github+json" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  try {
    const res = await fetch(`${REST_BASE}${path}`, { headers: h });
    if (!res.ok) {
      if (fallback !== null) { console.warn(`⚠️  REST ${path} → ${res.status} (using fallback)`); return fallback; }
      throw new Error(`REST ${path} → ${res.status}`);
    }
    return res.json();
  } catch (e) {
    if (fallback !== null) { console.warn(`⚠️  ${e.message} (using fallback)`); return fallback; }
    throw e;
  }
}

async function graphqlFetch(query, vars = {}) {
  if (!TOKEN) throw new Error("GH_TOKEN required for GraphQL queries");
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "profile-svg-gen/3.0",
    },
    body: JSON.stringify({ query, variables: vars }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// ─── Utility functions ────────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmt = (n) => {
  n = +n;
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return String(n);
};

const fmtDate = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

const f2 = (n) => n.toFixed(2);

// ─── Dynamic rank calculator ──────────────────────────────────────────────────
function calcRank({ commits, prs, stars, followers, repos, issues }) {
  const score =
    (commits || 0) * 2 +
    (prs     || 0) * 3 +
    (stars   || 0) * 4 +
    (followers||0) * 1.5 +
    (repos   || 0) * 0.5 +
    (issues  || 0);

  const C = 264; // circumference of r=42 circle: 2 * pi * 42 ≈ 264
  if (score >= 10000) return { grade: "S+", pct: 99, arc: Math.round(C * 0.99) };
  if (score >=  5000) return { grade: "S",  pct: 97, arc: Math.round(C * 0.97) };
  if (score >=  2000) return { grade: "A+", pct: 90, arc: Math.round(C * 0.90) };
  if (score >=   800) return { grade: "A",  pct: 80, arc: Math.round(C * 0.80) };
  if (score >=   400) return { grade: "B+", pct: 65, arc: Math.round(C * 0.65) };
  if (score >=   150) return { grade: "B",  pct: 50, arc: Math.round(C * 0.50) };
  if (score >=    50) return { grade: "C+", pct: 35, arc: Math.round(C * 0.35) };
  return                     { grade: "C",  pct: 20, arc: Math.round(C * 0.20) };
}

// ─── Language colors ──────────────────────────────────────────────────────────
const LANG_COLORS = {
  TypeScript:  "#3178c6", JavaScript: "#f7df1e", Python:     "#3776ab",
  Kotlin:      "#7f52ff", CSS:        "#264de4", HTML:       "#e34c26",
  C:           "#555599", "C++":      "#f34b7d", Java:       "#b07219",
  Rust:        "#dea584", Go:         "#00add8", Vue:        "#42b883",
  PLpgSQL:     "#336791", Dockerfile: "#384d54", PowerShell: "#012456",
  Swift:       "#ffac45", Dart:       "#00b4ab", PHP:        "#4F5D95",
  Ruby:        "#701516", Shell:      "#89e051", Makefile:   "#427819",
  Svelte:      "#ff3e00", "C#":       "#178600", R:          "#198CE7",
};
const langColor = (n) => LANG_COLORS[n] ?? "#8b949e";

// ─── Fetch all GitHub data ────────────────────────────────────────────────────
async function fetchAll() {
  console.log("⏳  Fetching GitHub data…");

  const FALLBACK_USER = {
    login: USERNAME, public_repos: 21, followers: 14, following: 11,
    created_at: "2023-12-11T11:57:16Z",
  };
  const user = await restGet(`/users/${USERNAME}`, FALLBACK_USER);

  // Paginate all repos (up to 500)
  let repos = [];
  for (let pg = 1; pg <= 5; pg++) {
    const batch = await restGet(
      `/users/${USERNAME}/repos?per_page=100&page=${pg}&sort=pushed`,
      []
    );
    if (!batch.length) break;
    repos = repos.concat(batch);
    if (batch.length < 100) break;
  }

  // Aggregate language bytes across non-fork repos
  const langBytes = {};
  await Promise.all(
    repos.filter((r) => !r.fork).map(async (r) => {
      try {
        const lgs = await restGet(`/repos/${USERNAME}/${r.name}/languages`, {});
        for (const [lang, bytes] of Object.entries(lgs))
          langBytes[lang] = (langBytes[lang] ?? 0) + bytes;
      } catch (_) {}
    })
  );
  const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0);
  const FALLBACK_LANGS = [
    { name: "TypeScript", pct: 51.6 }, { name: "Python",     pct: 16.4 },
    { name: "Kotlin",     pct: 15.1 }, { name: "C",          pct: 10.9 },
    { name: "CSS",        pct: 1.1  }, { name: "JavaScript", pct: 0.3  },
  ];
  const languages =
    totalBytes > 0
      ? Object.entries(langBytes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, bytes]) => ({
            name,
            pct: +((bytes / totalBytes) * 100).toFixed(1),
          }))
      : FALLBACK_LANGS;

  let contributions = {
    total: 0, calendar: [],
    currentStreak: 0, longestStreak: 0,
    longestStart: "", longestEnd: "",
    streakStart: "", streakEnd: "",
    commits: 0, prs: 0, issues: 0,
  };
  let pinnedRepos = [];

  if (TOKEN) {
    try {
      const gqlData = await graphqlFetch(
        `query($login: String!) {
          user(login: $login) {
            contributionsCollection {
              totalCommitContributions
              totalPullRequestContributions
              totalIssueContributions
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays { contributionCount date }
                }
              }
            }
            pinnedItems(first: 6, types: [REPOSITORY]) {
              nodes {
                ... on Repository {
                  name description url updatedAt
                  primaryLanguage { name color }
                  stargazerCount forkCount
                }
              }
            }
          }
        }`,
        { login: USERNAME }
      );

      const cc = gqlData.user.contributionsCollection;
      contributions.total   = cc.contributionCalendar.totalContributions;
      contributions.commits = cc.totalCommitContributions;
      contributions.prs     = cc.totalPullRequestContributions;
      contributions.issues  = cc.totalIssueContributions;

      const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
      contributions.calendar = days;

      // ── Streak calculation ──────────────────────────────────────────────────
      const today = new Date().toISOString().slice(0, 10);
      let cur = 0, curStart = today;
      let longest = 0, longStart = "", longEnd = "";
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].contributionCount > 0) {
          if (cur === 0) curStart = days[i].date;
          cur++;
          if (cur > longest) {
            longest   = cur;
            longStart = days[i].date;
            longEnd   = days[Math.min(days.length - 1, i + cur - 1)]?.date ?? today;
          }
        } else {
          if (i < days.length - 1) break; // allow gap at today
          cur = 0;
        }
      }
      contributions.currentStreak = cur;
      contributions.streakStart   = curStart;
      contributions.streakEnd     = today;
      contributions.longestStreak = longest;
      contributions.longestStart  = longStart;
      contributions.longestEnd    = longEnd;

      pinnedRepos = gqlData.user.pinnedItems.nodes;
    } catch (e) {
      console.warn("⚠️  GraphQL error:", e.message);
    }
  }

  // ── Pinned repos fallback chain ─────────────────────────────────────────────
  if (!pinnedRepos.length && FALLBACK_PINNED.length) {
    pinnedRepos = FALLBACK_PINNED.map((r) => ({
      name: r.name, description: r.description, url: "#",
      primaryLanguage: r.language
        ? { name: r.language, color: r.languageColor }
        : null,
      stargazerCount: r.stars ?? 0,
      forkCount: r.forks ?? 0,
      updatedAt: null,
    }));
  }
  if (!pinnedRepos.length) {
    pinnedRepos = repos
      .filter((r) => !r.fork)
      .slice(0, 6)
      .map((r) => ({
        name: r.name, description: r.description, url: r.html_url,
        primaryLanguage: r.language
          ? { name: r.language, color: langColor(r.language) }
          : null,
        stargazerCount: r.stargazers_count,
        forkCount: r.forks_count,
        updatedAt: r.updated_at,
      }));
  }

  const totalStars = repos
    .filter((r) => !r.fork)
    .reduce((a, r) => a + r.stargazers_count, 0);

  console.log(
    `✅  Data fetched — ${contributions.total} contributions | ` +
    `${languages.length} languages | ${pinnedRepos.length} pinned repos`
  );
  return { user, repos, languages, contributions, pinnedRepos, totalStars };
}

// ─── Shared SVG defs (injected into every SVG) ────────────────────────────────
const DEFS = `
  <linearGradient id="gPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#c084fc"/>
    <stop offset="100%" stop-color="#67e8f9"/>
  </linearGradient>
  <linearGradient id="gBorder" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="#c084fc" stop-opacity="0.95"/>
    <stop offset="40%"  stop-color="#67e8f9" stop-opacity="0.65"/>
    <stop offset="100%" stop-color="#f472b6" stop-opacity="0.95"/>
    <animateTransform attributeName="gradientTransform" type="rotate"
      values="0 .5 .5;360 .5 .5" dur="5s" repeatCount="indefinite"/>
  </linearGradient>
  <linearGradient id="gShimmer" x1="-100%" y1="0%" x2="200%" y2="0%">
    <stop offset="0%"   stop-color="#ffffff" stop-opacity="0"/>
    <stop offset="50%"  stop-color="#ffffff" stop-opacity="0.07"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    <animate attributeName="x1" values="-100%;200%;-100%" dur="4s" repeatCount="indefinite"/>
    <animate attributeName="x2" values="0%;400%;0%"       dur="4s" repeatCount="indefinite"/>
  </linearGradient>
  <linearGradient id="gFire" x1="0%" y1="100%" x2="0%" y2="0%">
    <stop offset="0%"   stop-color="#dc2626"/>
    <stop offset="35%"  stop-color="#ea580c"/>
    <stop offset="70%"  stop-color="#fbbf24"/>
    <stop offset="100%" stop-color="#fef08a"/>
  </linearGradient>
  <linearGradient id="gRank" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="#f472b6"/>
    <stop offset="50%"  stop-color="#c084fc"/>
    <stop offset="100%" stop-color="#67e8f9"/>
  </linearGradient>
  <filter id="fFog" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="42"/>
  </filter>
  <filter id="fCard" x="-8%" y="-8%" width="116%" height="122%">
    <feDropShadow dx="0"  dy="6"  stdDeviation="10" flood-color="#7c3aed" flood-opacity="0.28"/>
    <feDropShadow dx="0"  dy="20" stdDeviation="30" flood-color="#000000" flood-opacity="0.55"/>
  </filter>
  <filter id="fGlow" x="-25%" y="-60%" width="150%" height="220%">
    <feGaussianBlur stdDeviation="9" result="b1"/>
    <feGaussianBlur stdDeviation="4" result="b2"/>
    <feMerge><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="fNumGlow" x="-20%" y="-25%" width="140%" height="150%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feFlood flood-color="#c084fc" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="fDot" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="2.5"/>
  </filter>
  <filter id="fFireGlow" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur stdDeviation="14" result="b"/>
    <feFlood flood-color="#ea580c" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="fSnake" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="4" result="b"/>
    <feFlood flood-color="#4ade80" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="fHead" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feFlood flood-color="#86efac" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="fGold" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feFlood flood-color="#fbbf24" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="fLineGlow" x="-10%" y="-40%" width="120%" height="180%">
    <feGaussianBlur stdDeviation="3" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
`;

// ─── Building-block helpers ───────────────────────────────────────────────────

/** 3-layer 3D card with animated border and shimmer */
function card3d(x, y, w, h, rx = 24) {
  const D = 7;
  return `
<rect x="${x+D}"   y="${y+D}"   width="${w}" height="${h}" rx="${rx}" fill="${T.edgeDeep}" opacity="0.92"/>
<rect x="${x+D/2}" y="${y+D/2}" width="${w}" height="${h}" rx="${rx}" fill="${T.edgeMid}"  opacity="0.70"/>
<rect x="${x}"     y="${y}"     width="${w}" height="${h}" rx="${rx}" fill="${T.card}"
      stroke="url(#gBorder)" stroke-width="1.6" filter="url(#fCard)"/>
<rect x="${x+2}"   y="${y+2}"   width="${w-4}" height="3.5" rx="1.75" fill="#ffffff" opacity="0.13"/>
<rect x="${x+2}"   y="${y+h-4}" width="${w-4}" height="2"   rx="1"    fill="#000000" opacity="0.22"/>
<rect x="${x}"     y="${y}"     width="${w}" height="${h}" rx="${rx}"   fill="url(#gShimmer)"/>`;
}

/** Animated ambient nebula orbs */
function nebulaBg(W, H, fill = "#030010") {
  return `<rect width="${W}" height="${H}" fill="${fill}"/>
<ellipse cx="${(W*0.12).toFixed(0)}" cy="${(H*0.75).toFixed(0)}"
  rx="${(W*0.20).toFixed(0)}" ry="${(H*0.55).toFixed(0)}"
  fill="#7c3aed" opacity="0.16" filter="url(#fFog)">
  <animate attributeName="cx" values="${(W*0.12).toFixed(0)};${(W*0.19).toFixed(0)};${(W*0.12).toFixed(0)}" dur="9s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="${(W*0.88).toFixed(0)}" cy="${(H*0.22).toFixed(0)}"
  rx="${(W*0.18).toFixed(0)}" ry="${(H*0.45).toFixed(0)}"
  fill="#0891b2" opacity="0.12" filter="url(#fFog)">
  <animate attributeName="cy" values="${(H*0.22).toFixed(0)};${(H*0.38).toFixed(0)};${(H*0.22).toFixed(0)}" dur="7s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="${(W*0.50).toFixed(0)}" cy="${(H*0.90).toFixed(0)}"
  rx="${(W*0.14).toFixed(0)}" ry="${(H*0.28).toFixed(0)}"
  fill="#db2777" opacity="0.07" filter="url(#fFog)">
  <animate attributeName="opacity" values="0.07;0.12;0.07" dur="5.5s" repeatCount="indefinite"/>
</ellipse>`;
}

/** SVG donut/annular sector arc path */
function arcPath(cx, cy, R, ri, a1deg, a2deg) {
  const r2 = Math.PI / 180;
  const x1 = cx + R  * Math.cos(a1deg * r2), y1 = cy + R  * Math.sin(a1deg * r2);
  const x2 = cx + R  * Math.cos(a2deg * r2), y2 = cy + R  * Math.sin(a2deg * r2);
  const xi1= cx + ri * Math.cos(a1deg * r2), yi1= cy + ri * Math.sin(a1deg * r2);
  const xi2= cx + ri * Math.cos(a2deg * r2), yi2= cy + ri * Math.sin(a2deg * r2);
  const lg  = (a2deg - a1deg > 180) ? 1 : 0;
  return `M ${f2(x1)} ${f2(y1)} A ${R} ${R} 0 ${lg} 1 ${f2(x2)} ${f2(y2)}`
       + ` L ${f2(xi2)} ${f2(yi2)} A ${ri} ${ri} 0 ${lg} 0 ${f2(xi1)} ${f2(yi1)} Z`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 1. STATS CARD — dynamic rank + 3D orbital avatar ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function genStatsCard(data) {
  // Layout: card x=16..884, avatar col x=16..198, stats x=206..748, rank x=756..884
  const { user, contributions, totalStars } = data;
  const W = 900, H = 290;
  const CX = 107; // avatar center X
  const CY = 152; // avatar center Y
  const AV_R = 54; // avatar radius
  const initial = (user.login ?? USERNAME).slice(0,1).toUpperCase();

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const commits   = contributions.commits ?? contributions.total ?? 0;
  const prs       = contributions.prs    ?? 0;
  const issues    = contributions.issues ?? 0;
  const total     = contributions.total  ?? 0;
  const repos     = user.public_repos    ?? 0;
  const followers = user.followers       ?? 0;
  const stars     = totalStars ?? 0;
  const rank      = calcRank({ commits, prs, stars, followers, repos, issues });

  // Card: x=16..884 (w=868). Avatar col: 16..200. Stats: 208..740. Rank: 748..884.
  // Rank badge: cx=816, r=44 → rightmost=860 < 884 ✓
  const RANK_CX = 820, RANK_CY = 152, RANK_R = 44;

  const topStats = [
    { icon: "⭐", label: "TOTAL STARS",   val: fmt(stars)    },
    { icon: "📝", label: "COMMITS (yr)",  val: fmt(commits)  },
    { icon: "🔀", label: "PULL REQUESTS", val: fmt(prs)      },
    { icon: "🐛", label: "ISSUES",        val: fmt(issues)   },
  ];
  const botStats = [
    { icon: "📦", label: "REPOS",          val: fmt(repos)     },
    { icon: "👥", label: "FOLLOWERS",      val: fmt(followers)  },
    { icon: "🔥", label: "CONTRIBS",       val: fmt(total)      },
  ];
  // Stats columns within x=208..735 (width 527 / 4 cols = 131 each)
  const xTop = [214, 346, 478, 610];
  const xBot = [214, 394, 574];

  // Initial letter avatar (GitHub blocks <image> in SVGs)
  const avatarInitial = (user.login ?? USERNAME).slice(0, 1).toUpperCase();

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}
  <radialGradient id="gAvatar" cx="40%" cy="35%" r="60%">
    <stop offset="0%"   stop-color="#3b0d8c"/>
    <stop offset="100%" stop-color="#0a0220"/>
  </radialGradient>
  <radialGradient id="gRankBg" cx="50%" cy="50%" r="50%">
    <stop offset="0%"   stop-color="#1a0540"/>
    <stop offset="100%" stop-color="#07031a"/>
  </radialGradient>
</defs>
${nebulaBg(W, H)}
${card3d(16, 10, 868, 270, 24)}

<!-- ── Title ── -->
<text x="${W/2}" y="50" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="14" font-weight="800"
  letter-spacing="3" fill="url(#gPrimary)" filter="url(#fGlow)">📊 GITHUB STATS — @${esc(USERNAME)}</text>

<!-- Vertical divider: avatar | stats -->
<line x1="200" y1="24" x2="200" y2="270" stroke="${T.p1}" stroke-width="0.7"
  stroke-dasharray="3 5" opacity="0.18"/>
<!-- Vertical divider: stats | rank -->
<line x1="748" y1="24" x2="748" y2="270" stroke="${T.p1}" stroke-width="0.7"
  stroke-dasharray="3 5" opacity="0.18"/>

<!-- ── Avatar — stylized initial letter (GitHub blocks <image> in SVGs) ── -->
<!-- Outer pulse ring -->
<circle cx="108" cy="${CY}" r="60" fill="none" stroke="${T.p1}" stroke-width="0.8" opacity="0.18">
  <animate attributeName="r"       values="58;64;58"    dur="3.2s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.18;0.45;0.18" dur="3.2s" repeatCount="indefinite"/>
</circle>
<!-- Avatar circle -->
<circle cx="108" cy="${CY}" r="${AV_R}" fill="url(#gAvatar)" stroke="${T.p1}" stroke-width="1.5"/>
<!-- Initial letter -->
<text x="108" y="164" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="44" font-weight="900"
  fill="url(#gPrimary)" opacity="0.9">${avatarInitial}</text>
<!-- Orbital ring 1 (wide, tilted) -->
<ellipse cx="108" cy="${CY}" rx="70" ry="21" fill="none"
  stroke="${T.p1}" stroke-width="1" opacity="0.3" stroke-dasharray="4 4">
  <animateTransform attributeName="transform" type="rotate"
    values="0 108 152;360 108 152" dur="8s" repeatCount="indefinite"/>
</ellipse>
<circle cx="178" cy="${CY}" r="4.5" fill="${T.p3}" filter="url(#fDot)">
  <animateTransform attributeName="transform" type="rotate"
    values="0 108 152;360 108 152" dur="8s" repeatCount="indefinite"/>
</circle>
<!-- Orbital ring 2 -->
<ellipse cx="108" cy="${CY}" rx="58" ry="15" fill="none"
  stroke="${T.p2}" stroke-width="0.8" opacity="0.2">
  <animateTransform attributeName="transform" type="rotate"
    values="60 108 152;-300 108 152" dur="5s" repeatCount="indefinite"/>
</ellipse>
<circle cx="166" cy="${CY}" r="3" fill="${T.p2}" opacity="0.85" filter="url(#fDot)">
  <animateTransform attributeName="transform" type="rotate"
    values="60 108 152;-300 108 152" dur="5s" repeatCount="indefinite"/>
</circle>
<!-- Username & bio -->
<text x="108" y="220" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="11.5" font-weight="800"
  fill="${T.text}">${esc(USERNAME)}</text>
<text x="108" y="236" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="9" fill="${T.muted}">${esc(BIO)}</text>
<text x="108" y="254" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" fill="${T.dim}">Since ${esc(memberSince)}</text>

<!-- ── Top stats row ── -->
${topStats.map(({ icon, label, val }, i) => `
<g transform="translate(${xTop[i]},72)">
  <text x="0" y="0" font-family="'Segoe UI',system-ui,sans-serif"
    font-size="8.5" fill="${T.dimmer}" letter-spacing="0.8">${icon} ${label}</text>
  <text x="0" y="28" font-family="'Segoe UI',system-ui,sans-serif"
    font-size="28" font-weight="900" fill="url(#gPrimary)" filter="url(#fNumGlow)">${esc(val)}</text>
</g>`).join("")}

<!-- ── Bottom stats row ── -->
${botStats.map(({ icon, label, val }, i) => `
<g transform="translate(${xBot[i]},160)">
  <text x="0" y="0" font-family="'Segoe UI',system-ui,sans-serif"
    font-size="8.5" fill="${T.dimmer}" letter-spacing="0.8">${icon} ${label}</text>
  <text x="0" y="28" font-family="'Segoe UI',system-ui,sans-serif"
    font-size="28" font-weight="900" fill="url(#gPrimary)" filter="url(#fNumGlow)">${esc(val)}</text>
</g>`).join("")}

<!-- ── Rank badge — contained within x=748..884 ── -->
<!-- Rank ambient glow -->
<circle cx="${RANK_CX}" cy="${RANK_CY}" r="52" fill="#120040" opacity="0.9"/>
<!-- Track ring -->
<circle cx="${RANK_CX}" cy="${RANK_CY}" r="${RANK_R}" fill="none" stroke="#1a0540" stroke-width="5"/>
<!-- Progress arc -->
<circle cx="${RANK_CX}" cy="${RANK_CY}" r="${RANK_R}" fill="none" stroke="url(#gRank)" stroke-width="4.5"
  stroke-dasharray="${rank.arc} 264" stroke-linecap="round"
  transform="rotate(-90 ${RANK_CX} ${RANK_CY})" opacity="0.92">
  <animate attributeName="stroke-dasharray"
    values="0 264;${rank.arc} 264" dur="1.8s" fill="freeze" begin="0.2s"/>
</circle>
<!-- Inner face -->
<circle cx="${RANK_CX}" cy="${RANK_CY}" r="${RANK_R - 10}" fill="url(#gRankBg)" stroke="${T.p1}" stroke-width="0.4" opacity="0.7"/>
<!-- RANK label -->
<text x="${RANK_CX}" y="${RANK_CY - 8}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" fill="${T.muted}" letter-spacing="2">RANK</text>
<!-- Grade -->
<text x="${RANK_CX}" y="${RANK_CY + 16}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="24" font-weight="900"
  fill="#ffffff" filter="url(#fNumGlow)">${esc(rank.grade)}</text>
<!-- Pct label -->
<text x="${RANK_CX}" y="${RANK_CY + 32}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" fill="${T.dim}">Top ${rank.pct}%</text>
<!-- Orbiting dots on rank ring -->
<circle cx="${RANK_CX + RANK_R}" cy="${RANK_CY}" r="3" fill="${T.p3}" filter="url(#fDot)">
  <animateTransform attributeName="transform" type="rotate"
    values="0 ${RANK_CX} ${RANK_CY};360 ${RANK_CX} ${RANK_CY}" dur="9s" repeatCount="indefinite"/>
</circle>
<circle cx="${RANK_CX - RANK_R}" cy="${RANK_CY}" r="2.2" fill="${T.p2}" filter="url(#fDot)">
  <animateTransform attributeName="transform" type="rotate"
    values="0 ${RANK_CX} ${RANK_CY};-360 ${RANK_CX} ${RANK_CY}" dur="6s" repeatCount="indefinite"/>
</circle>

<!-- Floating sparkles -->
<circle cx="320" cy="24" r="1.5" fill="${T.p1}" opacity="0.7">
  <animate attributeName="opacity" values="0.7;0.1;0.7" dur="3.3s" repeatCount="indefinite"/>
  <animateTransform attributeName="transform" type="translate" values="0,0;3,-7;0,0" dur="3.3s" repeatCount="indefinite"/>
</circle>
<circle cx="570" cy="20" r="1.8" fill="${T.p2}" opacity="0.6">
  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2.8s" repeatCount="indefinite" begin="0.6s"/>
  <animateTransform attributeName="transform" type="translate" values="0,0;-4,-8;0,0" dur="2.8s" repeatCount="indefinite" begin="0.6s"/>
</circle>
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 2. LANGUAGES CARD — 3D donut chart + animated bars ────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function genLangsCard(data) {
  const { languages } = data;
  if (!languages.length) return `<svg width="900" height="60" viewBox="0 0 900 60" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="60" fill="${T.bg}"/></svg>`;

  const ROW_H   = 38;
  const H       = 68 + languages.length * ROW_H + 24;
  const W       = 900;
  // Card: x=16..884. Donut center at x=130.
  // Bar area: x=248 to x=868 (card right edge 884 minus 16 padding) → BAR_W=620
  // Max bar right edge: 248 + 616 = 864 < 884 ✓, % label at 248+616-2=862 ✓
  const DONUT_X = 130;
  const DONUT_Y = Math.max(110, 36 + languages.length * ROW_H / 2);
  const BAR_X   = 248;
  const BAR_W   = 616;
  const maxPct  = languages[0]?.pct ?? 100;
  const totalPct= languages.reduce((a, l) => a + l.pct, 0);

  // Build donut segments
  let angleCursor = -90;
  const donutSegs = languages.map((lang, i) => {
    const sweep = (lang.pct / totalPct) * 360;
    const GAP   = languages.length > 1 ? 2.5 : 0;
    const a1    = angleCursor + GAP / 2;
    const a2    = angleCursor + sweep - GAP / 2;
    angleCursor += sweep;
    const col   = langColor(lang.name);
    // 3D depth layer (darker, offset)
    const dp    = arcPath(DONUT_X + 3, DONUT_Y + 4, 88, 58, a1, a2);
    // Main face
    const fp    = arcPath(DONUT_X,     DONUT_Y,     90, 60, a1, a2);
    return `
<path d="${esc(dp)}" fill="${col}" opacity="0.20"/>
<path d="${esc(fp)}" fill="${col}" opacity="0.88">
  <animate attributeName="opacity" values="0.88;1;0.88" dur="${2.4 + i * 0.3}s" repeatCount="indefinite"/>
</path>`;
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}
  <clipPath id="clipBar">
    <rect x="0" y="0" width="${BAR_W}" height="${H}"/>
  </clipPath>
</defs>
${nebulaBg(W, H, "#020c18")}
${card3d(16, 10, 868, H - 20, 24)}

<text x="${W/2}" y="46" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="14" font-weight="800"
  letter-spacing="3" fill="url(#gPrimary)" filter="url(#fGlow)">🧬 MOST USED LANGUAGES</text>

<!-- Vertical divider: donut | bars -->
<line x1="232" y1="58" x2="232" y2="${H - 16}" stroke="${T.p1}" stroke-width="0.6"
  stroke-dasharray="3 5" opacity="0.2"/>

<!-- 3D Donut chart (cx=130, r=90 → from x=40 to x=220, inside card x=16..884) -->
${donutSegs.join("")}
<!-- Donut center hole -->
<circle cx="${DONUT_X}" cy="${DONUT_Y}" r="56" fill="${T.card}" opacity="0.97"/>
<text x="${DONUT_X}" y="${DONUT_Y - 4}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="9" fill="${T.muted}" letter-spacing="1">LANG</text>
<text x="${DONUT_X}" y="${DONUT_Y + 14}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="900"
  fill="url(#gPrimary)" filter="url(#fNumGlow)">${languages.length}</text>

<!-- Bar chart — BAR_X=${BAR_X}, BAR_W=${BAR_W}, rightmost=${BAR_X+BAR_W}=864 < 884 ✓ -->
${languages.map(({ name, pct }, i) => {
  const y   = 58 + i * ROW_H;
  const col = langColor(name);
  const bw  = Math.max(4, Math.round((pct / maxPct) * (BAR_W - 52)));
  return `
<g transform="translate(${BAR_X},${y})">
  <circle cx="5" cy="7" r="5" fill="${col}" filter="url(#fDot)"/>
  <text x="17" y="12" font-family="'Segoe UI',system-ui,sans-serif"
    font-size="12" font-weight="700" fill="${col}">${esc(name)}</text>
  <text x="${BAR_W - 4}" y="12" text-anchor="end"
    font-family="'Segoe UI',system-ui,sans-serif" font-size="10.5" fill="${T.dim}">${pct}%</text>
  <rect x="0" y="18" width="${BAR_W - 50}" height="10" rx="5" fill="#0a1530"/>
  <rect x="2" y="20" width="${Math.max(2, bw - 4)}" height="6" rx="3" fill="${col}" opacity="0.22"/>
  <rect x="0" y="18" width="0" height="10" rx="5" fill="${col}">
    <animate attributeName="width" from="0" to="${bw}" dur="1.3s" fill="freeze" begin="${0.12*i+0.05}s"/>
  </rect>
</g>`;
}).join("")}
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 3. STREAK CARD — INFERNO redesign (total rombak) ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function genStreakCard(data) {
  const { contributions } = data;
  const {
    total, currentStreak, longestStreak,
    streakStart, streakEnd, longestStart, longestEnd,
    calendar,
  } = contributions;

  // Layout: W=900, H=300, Card x=16..884
  // LEFT PANEL (current streak ring): center at cx=230
  // Divider at x=450
  // RIGHT PANEL (longest + mini heatmap): x=458..880
  const W = 900, H = 300;
  const allDays = calendar ?? [];
  const last8w  = allDays.slice(-56); // 8 weeks for mini heatmap
  const maxDay  = Math.max(...last8w.map((d) => d.contributionCount), 1);

  function heatColor(count) {
    if (count === 0) return "#1a0c28";
    const t = Math.min(count / maxDay, 1);
    if (t < 0.25) return "#5b1a8a";
    if (t < 0.5)  return "#7c3aed";
    if (t < 0.75) return "#a855f7";
    return "#e879f9";
  }

  const CELL = 12, STEP = 15;
  const NUM_WEEKS = 8;
  // Heatmap: x=560..560+8*15=680, y=192..192+7*15=297
  const HX = 560, HY = 190;

  let hMonLbls = "";
  let lastHMon = -1;
  for (let wk = 0; wk < NUM_WEEKS; wk++) {
    const day = last8w[wk * 7];
    if (day?.date) {
      const d = new Date(day.date + "T12:00:00");
      const m = d.getMonth();
      if (m !== lastHMon) {
        lastHMon = m;
        const lbl = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        hMonLbls += `<text x="${HX + wk * STEP}" y="${HY - 6}"
  font-family="'Segoe UI',monospace,sans-serif" font-size="8" fill="${T.dimmer}">${esc(lbl)}</text>`;
      }
    }
  }

  let hCells = "";
  last8w.forEach((day, i) => {
    const wk  = Math.floor(i / 7);
    const row = i % 7;
    hCells += `<rect x="${HX + wk * STEP}" y="${HY + row * STEP}" width="${CELL}" height="${CELL}" rx="2.5"
  fill="${heatColor(day.contributionCount)}" opacity="${day.contributionCount > 0 ? 1 : 0.4}"/>`;
  });

  const DAY_ABBR = ["S","M","T","W","T","F","S"];
  const hDayLbls = DAY_ABBR.map((d, i) =>
    `<text x="${HX - 5}" y="${HY + i * STEP + 10}" text-anchor="end"
  font-family="'Segoe UI',monospace,sans-serif" font-size="8" fill="${T.dimmer}">${d}</text>`
  ).join("");

  // Streak ring: cx=226, cy=170, r=100
  const SCX = 226, SCY = 170, SR = 100;
  const streakFrac = Math.min(currentStreak ?? 0, 365) / 365;
  const C2  = 2 * Math.PI * SR;
  const streakArcLen = Math.round(streakFrac * C2);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}
  <radialGradient id="gFireBg" cx="50%" cy="50%" r="50%">
    <stop offset="0%"   stop-color="#dc2626" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#dc2626" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="gStreakArc" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="#dc2626"/>
    <stop offset="50%"  stop-color="#ea580c"/>
    <stop offset="100%" stop-color="#fbbf24"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="#050010"/>
<!-- Fire ambient blob -->\n<ellipse cx="${SCX}" cy="${SCY}" rx="280" ry="200" fill="url(#gFireBg)" filter="url(#fFog)">
  <animate attributeName="rx" values="260;310;260" dur="5s" repeatCount="indefinite"/>
</ellipse>
<!-- Purple ambient right -->
<ellipse cx="700" cy="160" rx="200" ry="150" fill="#7c3aed" opacity="0.1" filter="url(#fFog)"/>
<!-- Card -->
${card3d(16, 10, 868, 280, 24)}

<!-- Title -->
<text x="${W/2}" y="44" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="14" font-weight="800"
  letter-spacing="3" fill="url(#gPrimary)" filter="url(#fGlow)">\ud83d\udd25 CONTRIBUTION STREAK</text>

<!-- Center divider -->
<line x1="448" y1="56" x2="448" y2="282" stroke="${T.dimmer}" stroke-width="0.8"
  stroke-dasharray="4 5" opacity="0.5"/>

<!-- \u2550\u2550\u2550 LEFT: CURRENT STREAK RING \u2550\u2550\u2550 -->
<!-- Outer glow aura -->
<circle cx="${SCX}" cy="${SCY}" r="${SR + 10}" fill="url(#gFireBg)" opacity="0.5">
  <animate attributeName="r" values="${SR+6};${SR+14};${SR+6}" dur="2.5s" repeatCount="indefinite"/>
</circle>
<!-- Track ring (dark) -->
<circle cx="${SCX}" cy="${SCY}" r="${SR}" fill="none" stroke="#280d0d" stroke-width="10"/>
<!-- Progress arc (gradient) -->
<circle cx="${SCX}" cy="${SCY}" r="${SR}" fill="none" stroke="url(#gStreakArc)" stroke-width="9"
  stroke-dasharray="${streakArcLen} ${Math.ceil(C2)}" stroke-linecap="round"
  transform="rotate(-90 ${SCX} ${SCY})">
  <animate attributeName="stroke-dasharray"
    values="0 ${Math.ceil(C2)};${streakArcLen} ${Math.ceil(C2)}" dur="1.5s" fill="freeze" begin="0.1s"/>
</circle>
<!-- Inner circle face -->
<circle cx="${SCX}" cy="${SCY}" r="${SR - 14}" fill="#080018" opacity="0.97"/>
<!-- Rotating tick marks on ring -->
<circle cx="${SCX}" cy="${SCY - SR}" r="3.5" fill="${T.gold}" filter="url(#fDot)">
  <animateTransform attributeName="transform" type="rotate"
    values="0 ${SCX} ${SCY};360 ${SCX} ${SCY}" dur="12s" repeatCount="indefinite"/>
</circle>
<!-- Fire emoji -->
<text x="${SCX}" y="${SCY - 18}" text-anchor="middle" font-size="30" filter="url(#fFireGlow)">\ud83d\udd25
  <animateTransform attributeName="transform" type="translate"
    values="0,0;1,-4;-1,-2;0,0" dur="0.7s" repeatCount="indefinite"/>
</text>
<!-- Big streak number -->
<text x="${SCX}" y="${SCY + 26}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="50" font-weight="900"
  fill="url(#gFire)" filter="url(#fNumGlow)">${esc(String(currentStreak ?? 0))}</text>
<!-- "days" label -->
<text x="${SCX}" y="${SCY + 46}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="${T.gold}" letter-spacing="1">DAYS</text>
<!-- Section title -->
<text x="${SCX}" y="68" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="9" fill="${T.muted}" letter-spacing="2">CURRENT STREAK</text>
<!-- Date range -->
<text x="${SCX}" y="282" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.dim}">${esc(fmtDate(streakStart))} \u2192 ${esc(fmtDate(streakEnd))}</text>
<!-- Rising sparks -->
<circle cx="148" cy="110" r="2.2" fill="${T.gold}" opacity="0.9">
  <animateTransform attributeName="transform" type="translate" values="0,0;7,-26;-4,-46;0,0" dur="2.6s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.9;0.5;0;0.9" dur="2.6s" repeatCount="indefinite"/>
</circle>
<circle cx="300" cy="98" r="1.6" fill="${T.fire}" opacity="0.8">
  <animateTransform attributeName="transform" type="translate" values="0,0;-6,-22;3,-38;0,0" dur="3.2s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.8;0.3;0;0.8" dur="3.2s" repeatCount="indefinite"/>
</circle>
<circle cx="226" cy="82" r="1.3" fill="#fef08a" opacity="0.7">
  <animateTransform attributeName="transform" type="translate" values="0,0;-4,-28;5,-46;0,0" dur="2.9s" repeatCount="indefinite" begin="0.4s"/>
  <animate attributeName="opacity" values="0.7;0.2;0;0.7" dur="2.9s" repeatCount="indefinite" begin="0.4s"/>
</circle>

<!-- \u2550\u2550\u2550 RIGHT PANEL: LONGEST STREAK + HEATMAP \u2550\u2550\u2550 -->
<!-- Longest streak section -->
<text x="668" y="68" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="9" fill="${T.muted}" letter-spacing="2">LONGEST STREAK</text>
<text x="668" y="118" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="44" font-weight="900"
  fill="url(#gFire)" filter="url(#fNumGlow)">${esc(String(longestStreak ?? 0))}</text>
<text x="668" y="136" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="11" fill="${T.gold}">days \ud83c\udfc6</text>
<text x="668" y="156" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.dim}">${esc(fmtDate(longestStart))} \u2014 ${esc(fmtDate(longestEnd))}</text>

<!-- Sub-divider line -->
<line x1="460" y1="170" x2="882" y2="170" stroke="${T.dimmer}" stroke-width="0.6" stroke-dasharray="3 4" opacity="0.4"/>

<!-- Mini heatmap (8 weeks) -->
<text x="668" y="184" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="8" fill="${T.dimmer}" letter-spacing="2">RECENT ACTIVITY</text>
${hMonLbls}
${hDayLbls}
${hCells}

<!-- Total contributions footer -->
<text x="668" y="272" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="9.5" fill="${T.muted}" letter-spacing="1">TOTAL THIS YEAR</text>
<text x="668" y="288" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="18" font-weight="900"
  fill="url(#gPrimary)" filter="url(#fNumGlow)">${esc(fmt(total || 0))} contributions</text>
</svg>`;
}



  function heatColor(count) {
    if (count === 0) return "#1a1030";
    const t = Math.min(count / maxDay, 1);
    if (t < 0.25) return "#44106a";
    if (t < 0.5)  return "#7c3aed";
    if (t < 0.75) return "#a855f7";
    return "#c084fc";
  }

  const CELL = 14, STEP = 17;
  const HMAP_X = 276, HMAP_Y = 52;
  const NUM_WEEKS = 13;

  // Dynamic month labels from actual dates
  let monthLabelsSvg = "";
  let lastMon = -1;
  for (let wk = 0; wk < NUM_WEEKS; wk++) {
    const day = last13w[wk * 7];
    if (day?.date) {
      const d = new Date(day.date + "T12:00:00");
      const m = d.getMonth();
      if (m !== lastMon) {
        lastMon = m;
        const lbl = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        monthLabelsSvg += `<text x="${HMAP_X + wk * STEP}" y="${HMAP_Y - 6}"
  font-family="'Segoe UI',monospace,sans-serif" font-size="8.5" fill="${T.dimmer}">${esc(lbl)}</text>`;
      }
    }
  }

  // Heatmap cells
  let cells = "";
  last13w.forEach((day, i) => {
    const wk  = Math.floor(i / 7);
    const row = i % 7;
    const cx  = HMAP_X + wk  * STEP;
    const cy  = HMAP_Y + row * STEP;
    const col = heatColor(day.contributionCount);
    const has = day.contributionCount > 0;
    cells += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="3"
  fill="${col}" opacity="${has ? 1 : 0.4}"${has ? ` filter="url(#fDot)"` : ""}/>`;
  });

  const DAY_LBL = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dayLblSvg = DAY_LBL.map((d, i) =>
    `<text x="${HMAP_X - 5}" y="${HMAP_Y + i*STEP + 11}" text-anchor="end"
  font-family="'Segoe UI',monospace,sans-serif" font-size="8" fill="${T.dimmer}">${d}</text>`
  ).join("");

  const heatCenterX = HMAP_X + (NUM_WEEKS * STEP) / 2;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}</defs>
${nebulaBg(W, H, "#060010")}
<ellipse cx="140" cy="${H*0.8}" rx="160" ry="110" fill="#dc2626" opacity="0.12" filter="url(#fFog)">
  <animate attributeName="cx" values="140;195;140" dur="8s" repeatCount="indefinite"/>
</ellipse>
${card3d(50, 14, 800, H - 28, 24)}

<!-- CURRENT STREAK (left) -->
<text x="170" y="46" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.muted}" letter-spacing="2">CURRENT STREAK</text>
<circle cx="170" cy="112" r="52" fill="#ea580c" opacity="0.14" filter="url(#fFog)">
  <animate attributeName="r" values="46;58;46" dur="1.8s" repeatCount="indefinite"/>
</circle>
<text x="174" y="134" text-anchor="middle" font-size="54" filter="url(#fFireGlow)">🔥
  <animateTransform attributeName="transform" type="translate" values="0,0;2,-4;-1,-2;0,0" dur="0.65s" repeatCount="indefinite"/>
</text>
<text x="170" y="90" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="50" font-weight="900"
  fill="url(#gFire)" filter="url(#fNumGlow)">${esc(String(currentStreak ?? 0))}</text>
<text x="170" y="104" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10.5" fill="${T.gold}">days</text>
<text x="170" y="164" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.dim}">${esc(fmtDate(streakStart))} — ${esc(fmtDate(streakEnd))}</text>
<!-- Sparks -->
<circle cx="112" cy="36" r="2"   fill="${T.gold}" opacity="0.9">
  <animateTransform attributeName="transform" type="translate" values="0,0;5,-18;-2,-30;0,0" dur="2.4s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.9;0.3;0;0.9" dur="2.4s" repeatCount="indefinite"/>
</circle>
<circle cx="224" cy="48" r="1.5" fill="${T.fire}" opacity="0.8">
  <animateTransform attributeName="transform" type="translate" values="0,0;-4,-16;2,-26;0,0" dur="3.1s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.8;0.2;0;0.8" dur="3.1s" repeatCount="indefinite"/>
</circle>
<circle cx="152" cy="42" r="1.2" fill="#fef08a" opacity="0.7">
  <animateTransform attributeName="transform" type="translate" values="0,0;-2,-20;4,-34;0,0" dur="2.8s" repeatCount="indefinite" begin="0.5s"/>
  <animate attributeName="opacity" values="0.7;0.2;0;0.7" dur="2.8s" repeatCount="indefinite" begin="0.5s"/>
</circle>

<!-- Dividers -->
<line x1="258" y1="26" x2="258" y2="222" stroke="${T.dimmer}" stroke-width="0.8" stroke-dasharray="4 5" opacity="0.4"/>
<line x1="734" y1="26" x2="734" y2="222" stroke="${T.dimmer}" stroke-width="0.8" stroke-dasharray="4 5" opacity="0.4"/>

<!-- HEATMAP (center) -->
${monthLabelsSvg}
${dayLblSvg}
${cells}
<text x="${heatCenterX}" y="182" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.muted}" letter-spacing="2">TOTAL CONTRIBUTIONS</text>
<text x="${heatCenterX}" y="208" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="24" font-weight="900"
  fill="url(#gPrimary)" filter="url(#fNumGlow)">${esc(fmt(total || 0))}</text>

<!-- LONGEST STREAK (right) -->
<text x="818" y="46" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.muted}" letter-spacing="2">LONGEST STREAK</text>
<text x="818" y="108" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="50" font-weight="900"
  fill="url(#gFire)" filter="url(#fNumGlow)">${esc(String(longestStreak ?? 0))}</text>
<text x="818" y="124" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10.5" fill="${T.gold}">days</text>
<text x="818" y="150" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.dim}">${esc(fmtDate(longestStart))}</text>
<text x="818" y="165" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${T.dim}">— ${esc(fmtDate(longestEnd))}</text>
<text x="818" y="196" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="11.5" fill="${T.gold}" filter="url(#fGold)">🏆 Personal Best</text>
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 4. ACTIVITY GRAPH — dynamic month labels + glowing area chart ──────────────
// ══════════════════════════════════════════════════════════════════════════════
function genActivityGraph(data) {
  const { contributions } = data;
  const calendar = contributions.calendar ?? [];
  const W = 900, H = 220;

  const weeks = [];
  for (let i = 0; i < 52; i++) {
    const chunk = calendar.slice(i * 7, i * 7 + 7);
    weeks.push({
      sum: chunk.reduce((a, d) => a + d.contributionCount, 0),
      startDate: chunk[0]?.date ?? "",
    });
  }
  const maxWeek = Math.max(...weeks.map((w) => w.sum), 1);
  const GX = 44, GY = 52, GW = 814, GH = 118;

  const pts = weeks.map((w, i) => ({
    x: GX + (i / (weeks.length - 1)) * GW,
    y: GY + GH - (w.sum / maxWeek) * GH,
  }));
  const polyPts  = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} `
    + pts.slice(1).map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    + ` L ${GX+GW},${GY+GH} L ${GX},${GY+GH} Z`;

  // Dynamic month labels
  let lastMon2 = -1;
  const monthLabels = [];
  weeks.forEach((w, i) => {
    if (!w.startDate) return;
    const d = new Date(w.startDate + "T12:00:00");
    const m = d.getMonth();
    if (m !== lastMon2) {
      lastMon2 = m;
      monthLabels.push({
        x: GX + (i / (weeks.length - 1)) * GW,
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      });
    }
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}
  <linearGradient id="gArea" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="#7c3aed" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.02"/>
  </linearGradient>
  <linearGradient id="gArea2" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="#67e8f9" stop-opacity="0.28"/>
    <stop offset="100%" stop-color="#67e8f9" stop-opacity="0"/>
  </linearGradient>
  <pattern id="pGrid" width="63" height="29.5" patternUnits="userSpaceOnUse">
    <line x1="0" y1="0" x2="0"   y2="180" stroke="${T.p2}" stroke-width="0.3" opacity="0.1"/>
    <line x1="0" y1="0" x2="900" y2="0"   stroke="${T.p1}" stroke-width="0.3" opacity="0.08"/>
  </pattern>
</defs>
${nebulaBg(W, H, "#020810")}
${card3d(8, 8, 884, H - 16, 22)}

<text x="${W/2}" y="40" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="14" font-weight="800"
  letter-spacing="3" fill="url(#gPrimary)" filter="url(#fGlow)">📈 CONTRIBUTION ACTIVITY — ${new Date().getFullYear()}</text>

<rect x="${GX}" y="${GY}" width="${GW}" height="${GH}" fill="url(#pGrid)"/>
<path d="${esc(areaPath)}" fill="url(#gArea)"  opacity="0.75"/>
<path d="${esc(areaPath)}" fill="url(#gArea2)" opacity="0.5"/>
<polyline points="${polyPts}" fill="none" stroke="#7c3aed" stroke-width="3.5"
  stroke-linejoin="round" opacity="0.35"/>
<polyline points="${polyPts}" fill="none" stroke="${T.p1}" stroke-width="2.5"
  stroke-linejoin="round" filter="url(#fLineGlow)"/>

${monthLabels.map(({ x, label }) =>
  `<text x="${x.toFixed(1)}" y="${GY + GH + 18}" text-anchor="middle"
  font-family="'Segoe UI',monospace,sans-serif" font-size="9.5" fill="${T.dimmer}">${esc(label)}</text>`
).join("\n")}
<text x="${GX - 4}" y="${GY}"      text-anchor="end" font-family="'Segoe UI',monospace,sans-serif" font-size="9" fill="${T.dim}">${maxWeek}</text>
<text x="${GX - 4}" y="${GY + GH}" text-anchor="end" font-family="'Segoe UI',monospace,sans-serif" font-size="9" fill="${T.dim}">0</text>
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 5. CONTRIBUTION SNAKE — realtime grid + animated snake + month labels ──────
// ══════════════════════════════════════════════════════════════════════════════
function genSnake(data) {
  const { contributions } = data;
  const calendar = contributions.calendar ?? [];

  const COLS = 52, ROWS = 7;
  const CELL = 13, GAP  = 3, STEP = CELL + GAP;
  const ML   = 50;  // margin left (day labels)
  const MT   = 46;  // margin top  (month labels + title)
  const W    = ML + COLS * STEP + 24;   // ≈ 918px
  const H    = MT + ROWS * STEP + 52;   // ≈ 214px

  // Level colors for contribution heat
  const LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

  // Build 52×7 grid from real GitHub contribution calendar
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const maxCount = Math.max(...calendar.map((d) => d.contributionCount), 1);

  calendar.forEach((day, idx) => {
    const col = Math.floor(idx / 7);
    const row = idx % 7;
    if (col < COLS && row < ROWS) {
      const count = day.contributionCount;
      const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
      grid[row][col] = { date: day.date, count, level };
    }
  });
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!grid[r][c]) grid[r][c] = { date: "", count: 0, level: 0 };

  // Month labels (dynamic from actual dates in grid)
  let lastMon3 = -1;
  const monthLblSvg = [];
  for (let c = 0; c < COLS; c++) {
    const day = grid[0][c];
    if (day?.date) {
      const d = new Date(day.date + "T12:00:00");
      const m = d.getMonth();
      if (m !== lastMon3) {
        lastMon3 = m;
        const lbl = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        monthLblSvg.push(
          `<text x="${ML + c * STEP}" y="${MT - 6}"
  font-family="'Segoe UI',monospace,sans-serif" font-size="9" fill="${T.dimmer}">${esc(lbl)}</text>`
        );
      }
    }
  }

  // Day-of-week labels on left
  const DAY_LBL = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dayLblSvg = DAY_LBL.map((d, i) =>
    `<text x="${ML - 5}" y="${MT + i * STEP + 10}" text-anchor="end"
  font-family="'Segoe UI',monospace,sans-serif" font-size="8" fill="${T.dimmer}">${d}</text>`
  ).join("");

  // Snake path: boustrophedon (zigzag) through all 364 cells
  const snakePath = [];
  for (let r = 0; r < ROWS; r++) {
    if (r % 2 === 0) { for (let c = 0; c < COLS; c++) snakePath.push([c, r]); }
    else             { for (let c = COLS - 1; c >= 0; c--) snakePath.push([c, r]); }
  }

  // Index map: "col,row" → position in snake path
  const pIdx = {};
  snakePath.forEach(([c, r], i) => { pIdx[`${c},${r}`] = i; });

  // Animation parameters
  const BODY_LEN = 14;
  const FRAME_S  = 0.065;  // seconds per step
  const N        = snakePath.length;
  const LOOP_DUR = (N * FRAME_S).toFixed(2); // ≈23.66s per loop

  // Generate all grid cells with SMIL discrete animate for snake movement
  let cellsSvg = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell  = grid[r][c];
      const p     = pIdx[`${c},${r}`];
      const base  = LEVEL_COLORS[cell.level];
      const cx    = ML + c * STEP;
      const cy    = MT + r * STEP;
      const eps   = 0.0005;

      // Build discrete keyframe animation:
      // base → snake head → snake body → base
      const headT  = p / N;
      const bodyT  = (p + 1)             / N;
      const clearT = Math.min((p + BODY_LEN + 1) / N, 1.0);

      const kts  = [];
      const vals = [];

      if (headT > eps) {
        kts.push("0");                     vals.push(base);
        kts.push((headT - eps).toFixed(4)); vals.push(base);
      } else {
        kts.push("0"); vals.push(T.greenHead);
      }

      kts.push(headT.toFixed(4));  vals.push(T.greenHead); // 🐍 head
      kts.push(bodyT.toFixed(4));  vals.push(T.green);     // body

      if (clearT < 1.0 - eps) {
        kts.push(clearT.toFixed(4));          vals.push(base);
        kts.push((clearT + eps).toFixed(4));  vals.push(base);
        kts.push("1");                         vals.push(base);
      } else {
        kts.push("1"); vals.push(base);
      }

      cellsSvg += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="3"
  fill="${base}" opacity="0.9">
  <animate attributeName="fill" dur="${LOOP_DUR}s" repeatCount="indefinite"
    calcMode="discrete" keyTimes="${kts.join(";")}" values="${vals.join(";")}"/>
</rect>`;
    }
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}</defs>
<rect width="${W}" height="${H}" fill="#0d1117"/>
<ellipse cx="${(W*0.5).toFixed(0)}" cy="${(H*0.85).toFixed(0)}" rx="${(W*0.35).toFixed(0)}" ry="${(H*0.6).toFixed(0)}"
  fill="#166534" opacity="0.07" filter="url(#fFog)">
  <animate attributeName="opacity" values="0.07;0.12;0.07" dur="5s" repeatCount="indefinite"/>
</ellipse>

<!-- Grid border -->
<rect x="${ML - 2}" y="${MT - 2}" width="${COLS * STEP + 8}" height="${ROWS * STEP + 6}"
  rx="8" fill="none" stroke="#21262d" stroke-width="1"/>

<!-- Title -->
<text x="${(W/2).toFixed(0)}" y="26" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="14" font-weight="700"
  letter-spacing="2" fill="url(#gPrimary)" filter="url(#fGlow)">🐍 CONTRIBUTION SNAKE</text>

<!-- Dynamic month labels -->
${monthLblSvg.join("\n")}
<!-- Day labels -->
${dayLblSvg}
<!-- Grid cells with snake animation -->
${cellsSvg}

<!-- Legend -->
<text x="${ML}" y="${H - 6}"
  font-family="'Segoe UI',monospace,sans-serif" font-size="8.5" fill="${T.dimmer}">Less</text>
${LEVEL_COLORS.map((col, i) =>
  `<rect x="${ML + 34 + i * 17}" y="${H - 16}" width="12" height="12" rx="2.5" fill="${col}"/>`
).join("")}
<text x="${ML + 34 + LEVEL_COLORS.length * 17}" y="${H - 6}"
  font-family="'Segoe UI',monospace,sans-serif" font-size="8.5" fill="${T.dimmer}">More</text>
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 6. PINNED REPOS — glassmorphism 3D cards with dynamic API data ─────────────
// ══════════════════════════════════════════════════════════════════════════════
function genPinnedRepos(data) {
  const { pinnedRepos } = data;
  const items  = pinnedRepos.slice(0, 4);
  const rows   = [items.slice(0, 2), items.slice(2, 4)].filter((r) => r.length);
  const height = rows.length === 1 ? 222 : 402;
  const W      = 900;

  const BORDERS  = ["#f472b6", "#67e8f9", "#c084fc", "#4ade80"];
  const FILLS    = ["#10030c", "#020c10", "#060310", "#021008"];
  const GLOWS    = ["#db2777", "#0891b2", "#7c3aed", "#059669"];
  const TITLE_C  = ["#f9a8d4", "#a5f3fc", "#ddd6fe", "#86efac"];

  let cards = "";
  rows.forEach((row, ri) => {
    const y0 = ri === 0 ? 62 : 240;
    row.forEach((repo, ci) => {
      const x0  = ci === 0 ? 18 : 464;
      const idx = ri * 2 + ci;
      const bdr = BORDERS[idx % BORDERS.length];
      const fil = FILLS  [idx % FILLS.length];
      const glo = GLOWS  [idx % GLOWS.length];
      const tc  = TITLE_C[idx % TITLE_C.length];
      const D   = 5;
      const ln  = repo.primaryLanguage?.name  ?? "Unknown";
      const lc  = repo.primaryLanguage?.color ?? "#8b949e";
      const raw = repo.description ?? "No description provided.";
      const dsc = raw.length > 58 ? raw.slice(0, 58) + "…" : raw;
      const upd = repo.updatedAt
        ? new Date(repo.updatedAt).toLocaleDateString("en-US", { month:"short", year:"numeric" })
        : "";

      cards += `
<!-- Pinned Repo ${idx}: ${esc(repo.name ?? "")} -->
<rect x="${x0+D}" y="${y0+D}" width="418" height="162" rx="18" fill="${glo}" opacity="0.18"/>
<rect x="${x0+2}" y="${y0+2}" width="418" height="162" rx="18" fill="${fil}" opacity="0.7"/>
<rect x="${x0}"   y="${y0}"   width="418" height="162" rx="18" fill="${fil}"
  stroke="${bdr}" stroke-width="1.8">
  <animate attributeName="fill-opacity" values="1;0.93;1" dur="${3.2 + idx*0.5}s" repeatCount="indefinite"/>
</rect>
<rect x="${x0+2}"   y="${y0+2}"    width="414" height="3.5" rx="1.75" fill="#fff" opacity="0.14"/>
<ellipse cx="${x0+209}" cy="${y0+81}" rx="180" ry="70" fill="${glo}" opacity="0.06" filter="url(#fFog)"/>
<text x="${x0+22}" y="${y0+36}" font-family="'Segoe UI',system-ui,sans-serif"
  font-size="17" font-weight="800" fill="${tc}">${esc(repo.name ?? "")}</text>
<text x="${x0+22}" y="${y0+58}" font-family="'Segoe UI',system-ui,sans-serif"
  font-size="11.5" fill="${T.muted}">${esc(dsc)}</text>
<circle cx="${x0+22}" cy="${y0+84}" r="5.5" fill="${esc(lc)}" filter="url(#fDot)"/>
<text x="${x0+35}"  y="${y0+89}" font-family="'Segoe UI',system-ui,sans-serif"
  font-size="11.5" fill="${T.text}">${esc(ln)}</text>
<text x="${x0+22}"  y="${y0+116}" font-family="'Segoe UI',system-ui,sans-serif"
  font-size="11" fill="${T.dim}">⭐ ${esc(String(repo.stargazerCount ?? 0))}</text>
<text x="${x0+80}"  y="${y0+116}" font-family="'Segoe UI',system-ui,sans-serif"
  font-size="11" fill="${T.dim}">🍴 ${esc(String(repo.forkCount ?? 0))}</text>
${upd ? `<text x="${x0+396}" y="${y0+116}" text-anchor="end"
  font-family="'Segoe UI',monospace,sans-serif" font-size="9.5" fill="${T.dimmer}">↻ ${esc(upd)}</text>` : ""}
<rect x="${x0+22}" y="${y0+142}" width="0" height="2.5" rx="1.25" fill="${bdr}" opacity="0.88">
  <animate attributeName="width" from="0" to="372" dur="1.5s" fill="freeze" begin="${idx * 0.22}s"/>
</rect>`;
    });
  });

  return `<svg width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}</defs>
${nebulaBg(W, height, "#04020e")}

<text x="${W/2}" y="38" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="17" font-weight="800"
  letter-spacing="2" fill="url(#gPrimary)" filter="url(#fGlow)">📦 projects.pinned()</text>
<rect x="328" y="46" width="244" height="1.5" rx="0.75" fill="url(#gPrimary)" opacity="0.4"/>

${items.length === 0 ? `<text x="${W/2}" y="${height/2}" text-anchor="middle"
  font-family="'Segoe UI',system-ui,sans-serif" font-size="14" fill="${T.muted}">
  No pinned repos — add entries to FALLBACK_PINNED in the script</text>` : ""}

${cards}
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 7. TROPHIES — dynamic 3D badge grid ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function genTrophies(data) {
  const { user, contributions, totalStars } = data;
  const W = 900, H = 180;

  const items = [
    { icon: "🏆", label: "COMMITS",     val: fmt(contributions.commits ?? contributions.total ?? 0), col: "#fbbf24" },
    { icon: "🥇", label: "REPOS",       val: fmt(user.public_repos),   col: "#fbbf24" },
    { icon: "🥈", label: "FOLLOWERS",   val: fmt(user.followers),      col: "#e2e8f0" },
    { icon: "⭐", label: "STARS",       val: fmt(totalStars),          col: "#fcd34d" },
    { icon: "🔀", label: "PULL REQS",   val: fmt(contributions.prs ?? 0), col: "#e2e8f0" },
    { icon: "🎯", label: "JOINED",      val: new Date(user.created_at).getFullYear().toString(), col: "#fbbf24" },
    { icon: "⚡", label: "CUR STREAK",  val: `${contributions.currentStreak ?? 0}d`, col: "#f472b6" },
  ];

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<defs>${DEFS}</defs>
<rect width="${W}" height="${H}" fill="#050300"/>
<ellipse cx="450" cy="100" rx="400" ry="90" fill="#d97706" opacity="0.07" filter="url(#fFog)">
  <animate attributeName="opacity" values="0.07;0.12;0.07" dur="5s" repeatCount="indefinite"/>
</ellipse>

${items.map(({ icon, label, val, col }, i) => {
  const x = 64 + i * 112;
  return `
<g transform="translate(${x},90)">
  <circle cx="4"  cy="8"  r="40" fill="${col}" opacity="0.08"/>
  <circle cx="0"  cy="0"  r="40" fill="#0e0a00" stroke="${col}" stroke-width="1.2" opacity="0.85"/>
  <text x="0" y="14" text-anchor="middle" font-size="30" filter="url(#fGold)">${esc(icon)}</text>
  <text x="0" y="56" text-anchor="middle"
    font-family="'Segoe UI',system-ui,sans-serif" font-size="15" font-weight="900"
    fill="#ffffff" filter="url(#fNumGlow)">${esc(val)}</text>
  <text x="0" y="72" text-anchor="middle"
    font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" fill="${esc(col)}"
    font-weight="700" letter-spacing="0.5">${esc(label)}</text>
  <animate attributeName="opacity" values="1;0.78;1"
    dur="${2.4 + i * 0.3}s" repeatCount="indefinite" begin="${i * 0.18}s"/>
</g>`;
}).join("")}
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── main ──────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  const data = await fetchAll();

  const files = [
    ["stats-card.svg",     genStatsCard(data)],
    ["langs-card.svg",     genLangsCard(data)],
    ["streak-card.svg",    genStreakCard(data)],
    ["activity-graph.svg", genActivityGraph(data)],
    ["snake-contrib.svg",  genSnake(data)],
    ["pinned-repos.svg",   genPinnedRepos(data)],
    ["trophies.svg",       genTrophies(data)],
  ];

  await Promise.all(
    files.map(async ([name, svg]) => {
      const path = resolve(ASSETS, name);
      await writeFile(path, svg, "utf8");
      console.log(`✅  Written → assets/${name}`);
    })
  );

  console.log("\n🎉  All SVG cards generated successfully!");
}

main().catch((err) => {
  console.error("❌ ", err.message);
  process.exit(1);
});
