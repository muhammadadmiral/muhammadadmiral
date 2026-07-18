/**
 * generate-profile-svgs.mjs
 * ─────────────────────────
 * Fetches live GitHub data and writes all profile SVG cards
 * to assets/. Run locally or via GitHub Actions.
 *
 * Env:
 *   GH_TOKEN  — GitHub PAT (read:user, repo)
 *               Falls back to GITHUB_TOKEN (Actions auto-token)
 * Usage:
 *   node scripts/generate-profile-svgs.mjs
 */

import { createWriteStream, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, "../assets");
mkdirSync(ASSETS, { recursive: true });

// ─── constants ────────────────────────────────────────────────────────────────
const USERNAME = "muhammadadmiral";
const TOKEN = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_BASE = "https://api.github.com";

// ─── helpers ──────────────────────────────────────────────────────────────────
async function restGet(path, fallback = null) {
  const headers = { "User-Agent": "profile-svg-gen/1.0", Accept: "application/vnd.github+json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
  try {
    const res = await fetch(`${REST_BASE}${path}`, { headers });
    if (!res.ok) {
      if (fallback !== null) { console.warn(`\u26a0\ufe0f  REST ${path} \u2192 ${res.status} (fallback)`); return fallback; }
      throw new Error(`REST ${path} \u2192 ${res.status}`);
    }
    return res.json();
  } catch (e) {
    if (fallback !== null) { console.warn(`\u26a0\ufe0f  ${e.message} (fallback)`); return fallback; }
    throw e;
  }
}

async function graphql(query, variables = {}) {
  if (!TOKEN) throw new Error("GH_TOKEN required for GraphQL");
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-svg-gen/1.0" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ─── data fetching ────────────────────────────────────────────────────────────
async function fetchAll() {
  console.log("⏳  Fetching GitHub data…");

  // ── Fallback user data (known values as of Jul 2026) ────────────────────
  const FALLBACK_USER = {
    login: USERNAME, public_repos: 21, followers: 14, following: 11,
    created_at: "2023-12-11T11:57:16Z",
  };

  // 1. User profile
  const user = await restGet(`/users/${USERNAME}`, FALLBACK_USER);

  // 2. Repos for language breakdown (REST)
  let repos = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await restGet(`/users/${USERNAME}/repos?per_page=100&page=${page}&sort=pushed`, []);
    if (!batch.length) break;
    repos = repos.concat(batch);
    if (batch.length < 100) break;
  }

  // 3. Language bytes aggregate
  const langBytes = {};
  await Promise.all(
    repos
      .filter((r) => !r.fork) // exclude forks for cleaner data
      .map(async (r) => {
        try {
          const langs = await restGet(`/repos/${USERNAME}/${r.name}/languages`, {});
          for (const [lang, bytes] of Object.entries(langs)) {
            langBytes[lang] = (langBytes[lang] ?? 0) + bytes;
          }
        } catch (_) {}
      })
  );
  const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0);
  // Fallback language data (fetched from GitHub API on 2026-07-18, real bytes)
  const FALLBACK_LANGS = [
    { name: "TypeScript", pct: 51.6 }, { name: "Python", pct: 16.4 },
    { name: "Kotlin",     pct: 15.1 }, { name: "C",      pct: 10.9 },
    { name: "CSS",        pct: 1.1  }, { name: "PLpgSQL", pct: 1.0 },
    { name: "JavaScript", pct: 0.3  }, { name: "Other",   pct: 3.6  },
  ];
  const languages = totalBytes > 0
    ? Object.entries(langBytes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, bytes]) => ({ name, pct: +((bytes / totalBytes) * 100).toFixed(1) }))
    : FALLBACK_LANGS;

  // 4. GraphQL: contributions + streak + pinned repos
  let contributions = { total: 0, calendar: [], currentStreak: 0, longestStreak: 0, longestStart: "", longestEnd: "", streakStart: "", streakEnd: "" };
  let pinnedRepos = [];

  if (TOKEN) {
    const gql = await graphql(
      `query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            totalCommitContributions
            totalPullRequestContributions
            totalIssueContributions
            totalRepositoryContributions
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
          pinnedItems(first: 6, types: [REPOSITORY]) {
            nodes {
              ... on Repository {
                name
                description
                url
                primaryLanguage { name color }
                stargazerCount
                forkCount
                updatedAt
              }
            }
          }
        }
      }`,
      { login: USERNAME }
    );

    const cc = gql.user.contributionsCollection;
    contributions.total = cc.contributionCalendar.totalContributions;
    contributions.commits = cc.totalCommitContributions;
    contributions.prs = cc.totalPullRequestContributions;
    contributions.issues = cc.totalIssueContributions;

    // Flatten days
    const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
    contributions.calendar = days; // array of {date, contributionCount}

    // Streak calculation
    const today = new Date().toISOString().slice(0, 10);
    let cur = 0;
    let curStart = today;
    let longest = 0;
    let longStart = "";
    let longEnd = "";
    let inStreak = false;

    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d.contributionCount > 0) {
        if (!inStreak) { inStreak = true; curStart = d.date; }
        cur++;
        if (cur > longest) { longest = cur; longStart = d.date; longEnd = days[i + (cur - 1)]?.date ?? today; }
      } else {
        if (i < days.length - 1) break; // allow today to have no contribution yet
        inStreak = false;
        cur = 0;
      }
    }
    contributions.currentStreak = cur;
    contributions.streakStart = curStart;
    contributions.streakEnd = today;
    contributions.longestStreak = longest;
    contributions.longestStart = longStart;
    contributions.longestEnd = longEnd;

    pinnedRepos = gql.user.pinnedItems.nodes;
  }

  // 5. Star count across non-fork repos
  const totalStars = repos.filter((r) => !r.fork).reduce((a, r) => a + r.stargazers_count, 0);

  console.log(`✅  Data fetched — ${contributions.total} contributions, ${languages.length} languages, ${pinnedRepos.length} pinned repos`);

  return { user, repos, languages, contributions, pinnedRepos, totalStars };
}

// ─── SVG generators ───────────────────────────────────────────────────────────

// Shared defs used across multiple cards
const SHARED_DEFS = `
  <linearGradient id="valG" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#c084fc"/>
    <stop offset="100%" stop-color="#67e8f9"/>
  </linearGradient>
  <linearGradient id="cardBorder" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#c084fc" stop-opacity="0.8"/>
    <stop offset="50%" stop-color="#67e8f9" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="#f472b6" stop-opacity="0.8"/>
    <animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;360 .5 .5" dur="8s" repeatCount="indefinite"/>
  </linearGradient>
  <linearGradient id="shimmer" x1="-100%" y1="0%" x2="200%" y2="0%">
    <stop offset="0%"   stop-color="#ffffff" stop-opacity="0"/>
    <stop offset="50%"  stop-color="#ffffff" stop-opacity="0.06"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    <animate attributeName="x1" values="-100%;200%;-100%" dur="5s" repeatCount="indefinite"/>
    <animate attributeName="x2" values="0%;400%;0%"       dur="5s" repeatCount="indefinite"/>
  </linearGradient>
  <filter id="fog" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="48"/></filter>
  <filter id="cardDepth" x="-8%" y="-8%" width="116%" height="120%">
    <feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#7c3aed" flood-opacity="0.22"/>
  </filter>
  <filter id="titleGlow" x="-20%" y="-50%" width="140%" height="200%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="numDepth" x="-15%" y="-20%" width="130%" height="140%">
    <feDropShadow dx="1" dy="3" stdDeviation="4" flood-color="#c084fc" flood-opacity="0.55"/>
  </filter>
  <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="3"/>
  </filter>
`;

// ── 1. STATS CARD ──────────────────────────────────────────────────────────────
function genStatsCard(data) {
  const { user, contributions, totalStars } = data;
  const publicRepos  = user.public_repos;
  const followers    = user.followers;
  const memberSince  = new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const totalContrib = contributions.total;
  const commits      = contributions.commits ?? "—";
  const prs          = contributions.prs ?? "—";
  const issues       = contributions.issues ?? "—";

  return `<svg width="900" height="240" viewBox="0 0 900 240" xmlns="http://www.w3.org/2000/svg">
<defs>${SHARED_DEFS}
  <linearGradient id="arcG" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#f472b6"/>
    <stop offset="50%" stop-color="#c084fc"/>
    <stop offset="100%" stop-color="#67e8f9"/>
  </linearGradient>
</defs>
<rect width="900" height="240" fill="#03001a"/>
<ellipse cx="100" cy="190" rx="160" ry="100" fill="#7c3aed" opacity="0.17" filter="url(#fog)">
  <animate attributeName="cx" values="100;155;100" dur="9s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="820" cy="60" rx="140" ry="90" fill="#0891b2" opacity="0.13" filter="url(#fog)">
  <animate attributeName="cy" values="60;90;60" dur="7s" repeatCount="indefinite"/>
</ellipse>
<rect x="56" y="20" width="788" height="198" rx="24" fill="#07031a" stroke="url(#cardBorder)" stroke-width="1.5" filter="url(#cardDepth)"/>
<rect x="58" y="22" width="784" height="3" rx="1.5" fill="#ffffff" opacity="0.14"/>
<rect x="56" y="20" width="788" height="198" rx="24" fill="url(#shimmer)"/>

<text x="450" y="58" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="16" font-weight="800" letter-spacing="3" fill="url(#valG)" filter="url(#titleGlow)">📊 GITHUB STATS — @${esc(USERNAME)}</text>

<line x1="196" y1="32" x2="196" y2="208" stroke="#c084fc" stroke-width="0.8" opacity="0.2"/>

<!-- Avatar -->
<circle cx="118" cy="125" r="44" fill="#0e0830" stroke="#c084fc" stroke-width="1.5" opacity="0.8"/>
<text x="118" y="140" text-anchor="middle" font-size="40">⬡</text>
<circle cx="162" cy="125" r="3.5" fill="#f472b6">
  <animateTransform attributeName="transform" type="rotate" values="0 118 125;360 118 125" dur="5s" repeatCount="indefinite"/>
</circle>
<circle cx="74" cy="125" r="2.5" fill="#67e8f9">
  <animateTransform attributeName="transform" type="rotate" values="0 118 125;-360 118 125" dur="7s" repeatCount="indefinite"/>
</circle>
<text x="118" y="190" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="11.5" font-weight="700" fill="#ddd6fe">${esc(USERNAME)}</text>
<text x="118" y="206" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="10" fill="#7c6fc0">Since ${esc(memberSince)}</text>

<!-- Stats grid -->
${[
  { label: "⭐ TOTAL STARS",       val: fmt(totalStars),  x: 220 },
  { label: "📝 COMMITS (yr)",      val: fmt(commits),     x: 380 },
  { label: "🔀 PULL REQUESTS",     val: fmt(prs),         x: 540 },
  { label: "🐛 ISSUES",           val: fmt(issues),       x: 700 },
].map(({ label, val, x }) => `
<g transform="translate(${x},72)">
  <text x="0" y="0" font-family="'Segoe UI',sans-serif" font-size="10" fill="#6b7280" letter-spacing="0.8">${esc(label)}</text>
  <text x="0" y="24" font-family="'Segoe UI',sans-serif" font-size="26" font-weight="900" fill="url(#valG)" filter="url(#numDepth)">${esc(val)}</text>
</g>`).join("")}

${[
  { label: "📦 PUBLIC REPOS", val: fmt(publicRepos), x: 220 },
  { label: "👥 FOLLOWERS",    val: fmt(followers),   x: 380 },
  { label: "🔥 CONTRIBUTIONS",val: fmt(totalContrib),x: 540 },
].map(({ label, val, x }) => `
<g transform="translate(${x},148)">
  <text x="0" y="0" font-family="'Segoe UI',sans-serif" font-size="10" fill="#6b7280" letter-spacing="0.8">${esc(label)}</text>
  <text x="0" y="24" font-family="'Segoe UI',sans-serif" font-size="26" font-weight="900" fill="url(#valG)" filter="url(#numDepth)">${esc(val)}</text>
</g>`).join("")}

<!-- Rank badge -->
<g transform="translate(748,62)">
  <circle cx="40" cy="40" r="40" fill="#0e0830" stroke="url(#arcG)" stroke-width="2.5"/>
  <circle cx="40" cy="40" r="35" fill="none" stroke="url(#arcG)" stroke-width="3.5"
          stroke-dasharray="154 66" stroke-linecap="round" transform="rotate(-90 40 40)" opacity="0.75">
    <animate attributeName="stroke-dasharray" values="0 220;154 66;154 66" dur="2s" fill="freeze"/>
  </circle>
  <text x="40" y="34" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="10" fill="#9ca3af" letter-spacing="1">RANK</text>
  <text x="40" y="58" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="24" font-weight="900" fill="#ffffff" filter="url(#numDepth)">B+</text>
</g>

<circle cx="86" cy="32" r="1.8" fill="#c084fc" opacity="0.8">
  <animateTransform attributeName="transform" type="translate" values="0,0;5,-12;0,0" dur="4.4s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.8;0.1;0.8" dur="4.4s" repeatCount="indefinite"/>
</circle>
</svg>`;
}

// ── 2. LANGUAGES CARD ─────────────────────────────────────────────────────────
const LANG_COLORS = {
  TypeScript: "#3178c6", JavaScript: "#f7df1e", Python: "#3776ab",
  Kotlin: "#7f52ff", CSS: "#264de4", HTML: "#e34c26", C: "#555599",
  Java: "#b07219", Rust: "#dea584", Go: "#00add8", Vue: "#42b883",
  PLpgSQL: "#336791", Dockerfile: "#384d54", PowerShell: "#012456",
  Makefile: "#427819", Shell: "#89e051",
};
function langColor(name) { return LANG_COLORS[name] ?? "#8b949e"; }

function genLangsCard(data) {
  const { languages } = data;
  const maxPct = languages[0]?.pct ?? 100;
  const BAR_W  = 800; // available bar width

  return `<svg width="900" height="${60 + languages.length * 36 + 24}" viewBox="0 0 900 ${60 + languages.length * 36 + 24}" xmlns="http://www.w3.org/2000/svg">
<defs>${SHARED_DEFS}</defs>
<rect width="900" height="${60 + languages.length * 36 + 24}" fill="#020c18"/>
<ellipse cx="120" cy="50" rx="130" ry="80" fill="#0891b2" opacity="0.12" filter="url(#fog)">
  <animate attributeName="cx" values="120;170;120" dur="9s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="800" cy="${60 + languages.length * 36}" rx="130" ry="80" fill="#4ade80" opacity="0.08" filter="url(#fog)"/>

<rect x="56" y="10" width="788" height="${40 + languages.length * 36 + 24}" rx="24" fill="#02080e" stroke="url(#cardBorder)" stroke-width="1.5" filter="url(#cardDepth)"/>
<rect x="58" y="12" width="784" height="3" rx="1.5" fill="#ffffff" opacity="0.14"/>
<rect x="56" y="10" width="788" height="${40 + languages.length * 36 + 24}" rx="24" fill="url(#shimmer)"/>

<text x="450" y="44" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="16" font-weight="800" letter-spacing="3" fill="url(#valG)" filter="url(#titleGlow)">MOST USED LANGUAGES</text>

${languages.map(({ name, pct }, i) => {
  const y   = 56 + i * 36;
  const col = langColor(name);
  const barW = Math.round((pct / maxPct) * (BAR_W - 10));
  return `
<g transform="translate(72,${y})">
  <text x="0" y="0" font-family="'Segoe UI',sans-serif" font-size="12.5" font-weight="700" fill="${esc(col)}">${esc(name)}</text>
  <text x="760" y="0" text-anchor="end" font-family="'Segoe UI',sans-serif" font-size="11" fill="#6b7280">${pct}%</text>
  <!-- Track -->
  <rect x="0" y="8" width="${BAR_W - 10}" height="10" rx="5" fill="#0a1525"/>
  <!-- 3D bar shadow -->
  <rect x="2" y="10" width="${barW - 2}" height="6" rx="3" fill="${esc(col)}" opacity="0.25"/>
  <!-- Bar — animate ONCE (fill=freeze) -->
  <rect x="0" y="8" width="0" height="10" rx="5" fill="${esc(col)}">
    <animate attributeName="width" from="0" to="${barW}" dur="1.4s" fill="freeze" begin="${0.15 * i + 0.1}s"/>
  </rect>
  <!-- Shimmer sweep over bar — fires once -->
  <rect x="0" y="8" width="60" height="10" rx="5" fill="#ffffff" opacity="0">
    <animate attributeName="x" from="-60" to="${barW}" dur="1.4s" fill="freeze" begin="${0.15 * i + 0.1}s"/>
    <animate attributeName="opacity" values="0;0.28;0" dur="1.4s" fill="freeze" begin="${0.15 * i + 0.1}s"/>
  </rect>
</g>`;
}).join("")}
</svg>`;
}

// ── 3. STREAK CARD ────────────────────────────────────────────────────────────
function genStreakCard(data) {
  const { contributions } = data;
  const { total, currentStreak, longestStreak, streakStart, streakEnd, longestStart, longestEnd, calendar } = contributions;

  // Build mini 13-week heatmap (rightmost 13 weeks of calendar)
  const allDays = calendar ?? [];
  const last13w = allDays.slice(-91); // up to 91 days
  const maxDay  = Math.max(...last13w.map((d) => d.contributionCount), 1);

  function heatColor(count) {
    if (count === 0) return "#1a1030";
    const t = Math.min(count / maxDay, 1);
    if (t < 0.25) return "#44106a";
    if (t < 0.5)  return "#7c3aed";
    if (t < 0.75) return "#a855f7";
    return "#c084fc";
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

  const totalFmt = fmt(total || 0);
  const HMAP_X = 280;
  const HMAP_Y = 48;
  const CELL = 14;
  const GAP  = 3;

  let heatmapCells = "";
  last13w.forEach((day, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    const x = HMAP_X + col * (CELL + GAP);
    const y = HMAP_Y + row * (CELL + GAP);
    const color = heatColor(day.contributionCount);
    const opacity = day.contributionCount > 0 ? 1 : 0.5;
    heatmapCells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="${color}" opacity="${opacity}"${day.contributionCount > 0 ? ` filter="url(#dotGlow)"` : ""}/>`;
  });

  // Week labels (Mon, Tue ... )
  const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayLabelsSvg = dayLabels.map((d, i) =>
    `<text x="${HMAP_X - 4}" y="${HMAP_Y + i * (CELL + GAP) + 11}" text-anchor="end" font-family="'Segoe UI',monospace" font-size="8" fill="#4b5563">${d}</text>`
  ).join("");

  return `<svg width="900" height="228" viewBox="0 0 900 228" xmlns="http://www.w3.org/2000/svg">
<defs>${SHARED_DEFS}
  <linearGradient id="fireG" x1="0%" y1="100%" x2="0%" y2="0%">
    <stop offset="0%" stop-color="#dc2626"/>
    <stop offset="40%" stop-color="#ea580c"/>
    <stop offset="80%" stop-color="#fbbf24"/>
    <stop offset="100%" stop-color="#fef08a"/>
  </linearGradient>
  <filter id="fireGlow" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur stdDeviation="12" result="b"/>
    <feFlood flood-color="#ea580c" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="900" height="228" fill="#060010"/>
<ellipse cx="140" cy="180" rx="160" ry="100" fill="#dc2626" opacity="0.12" filter="url(#fog)">
  <animate attributeName="cx" values="140;200;140" dur="9s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="820" cy="60" rx="140" ry="90" fill="#f59e0b" opacity="0.08" filter="url(#fog)"/>

<rect x="56" y="14" width="788" height="200" rx="24" fill="#07020e" stroke="url(#cardBorder)" stroke-width="1.5" filter="url(#cardDepth)"/>
<rect x="58" y="16" width="784" height="3" rx="1.5" fill="#ffffff" opacity="0.14"/>
<rect x="56" y="14" width="788" height="200" rx="24" fill="url(#shimmer)"/>

<!-- Left: Current streak -->
<text x="170" y="50" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="11" fill="#9ca3af" letter-spacing="2">CURRENT STREAK</text>
<!-- Fire glow blob behind number -->
<circle cx="170" cy="110" r="46" fill="#ea580c" opacity="0.15" filter="url(#fog)">
  <animate attributeName="r" values="40;54;40" dur="2s" repeatCount="indefinite"/>
</circle>
<!-- Fire emoji -->
<text x="174" y="130" text-anchor="middle" font-size="52" filter="url(#fireGlow)">🔥
  <animateTransform attributeName="transform" type="translate" values="0,0;2,-3;-1,-1;0,0" dur="0.7s" repeatCount="indefinite"/>
</text>
<text x="170" y="85" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="46" font-weight="900" fill="url(#fireG)" filter="url(#numDepth)">${esc(String(currentStreak ?? 0))}</text>
<text x="170" y="98" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="10" fill="#f59e0b">days</text>
<text x="170" y="154" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="10" fill="#6b7280">${esc(fmtDate(streakStart))} — ${esc(fmtDate(streakEnd))}</text>

<!-- Vertical divider -->
<line x1="262" y1="28" x2="262" y2="200" stroke="#4b5563" stroke-width="0.8" stroke-dasharray="4 4" opacity="0.4"/>

<!-- Middle: heatmap -->
${dayLabelsSvg}
${heatmapCells}

<!-- Bottom stats under heatmap -->
<text x="${HMAP_X + 91}" y="172" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="11" fill="#9ca3af" letter-spacing="2">TOTAL CONTRIBUTIONS</text>
<text x="${HMAP_X + 91}" y="196" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="22" font-weight="900" fill="url(#valG)" filter="url(#numDepth)">${esc(totalFmt)}</text>

<!-- Right divider -->
<line x1="738" y1="28" x2="738" y2="200" stroke="#4b5563" stroke-width="0.8" stroke-dasharray="4 4" opacity="0.4"/>

<!-- Right: Longest streak -->
<text x="818" y="50" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="11" fill="#9ca3af" letter-spacing="2">LONGEST STREAK</text>
<text x="818" y="110" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="46" font-weight="900" fill="url(#fireG)" filter="url(#numDepth)">${esc(String(longestStreak ?? 0))}</text>
<text x="818" y="124" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="10" fill="#f59e0b">days</text>
<text x="818" y="150" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="10" fill="#6b7280">${esc(fmtDate(longestStart))}</text>
<text x="818" y="164" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="10" fill="#6b7280">— ${esc(fmtDate(longestEnd))}</text>
<text x="818" y="192" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="11" fill="#f59e0b">🏆 Personal Best</text>

<!-- Sparks -->
<circle cx="110" cy="30" r="2" fill="#fbbf24" opacity="0.9">
  <animateTransform attributeName="transform" type="translate" values="0,0;6,-18;-2,-30;0,0" dur="2.3s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.9;0.3;0;0.9" dur="2.3s" repeatCount="indefinite"/>
</circle>
<circle cx="220" cy="45" r="1.5" fill="#ea580c" opacity="0.8">
  <animateTransform attributeName="transform" type="translate" values="0,0;-4,-16;2,-26;0,0" dur="3s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.8;0.2;0;0.8" dur="3s" repeatCount="indefinite"/>
</circle>
</svg>`;
}

// ── 4. ACTIVITY GRAPH ─────────────────────────────────────────────────────────
function genActivityGraph(data) {
  const { contributions } = data;
  const calendar = contributions.calendar ?? [];

  // Group by week (13 weeks), sum per week
  const weeks = [];
  for (let i = 0; i < 52; i++) {
    const chunk = calendar.slice(i * 7, i * 7 + 7);
    weeks.push({ sum: chunk.reduce((a, d) => a + d.contributionCount, 0), start: chunk[0]?.date ?? "" });
  }

  const maxWeek = Math.max(...weeks.map((w) => w.sum), 1);
  const GRAPH_X = 40, GRAPH_Y = 55, GRAPH_W = 820, GRAPH_H = 120;

  // Build polyline points
  const pts = weeks.map((w, i) => {
    const x = GRAPH_X + (i / (weeks.length - 1)) * GRAPH_W;
    const y = GRAPH_Y + GRAPH_H - (w.sum / maxWeek) * GRAPH_H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyPts = pts.join(" ");
  const areaPath = `M ${pts[0]} ${pts.slice(1).map((p) => `L ${p}`).join(" ")} L ${GRAPH_X + GRAPH_W},${GRAPH_Y + GRAPH_H} L ${GRAPH_X},${GRAPH_Y + GRAPH_H} Z`;

  // Month labels (every 4 weeks)
  const monthLabels = [];
  for (let i = 0; i < 52; i += 4) {
    const d = weeks[i]?.start;
    if (!d) continue;
    const x = GRAPH_X + (i / (weeks.length - 1)) * GRAPH_W;
    const label = new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    monthLabels.push(`<text x="${x.toFixed(1)}" y="196" text-anchor="middle" font-family="'Segoe UI',monospace" font-size="9.5" fill="#4b5563">${esc(label)}</text>`);
  }

  return `<svg width="900" height="210" viewBox="0 0 900 210" xmlns="http://www.w3.org/2000/svg">
<defs>${SHARED_DEFS}
  <linearGradient id="areaFill" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="areaFill2" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#67e8f9" stop-opacity="0.3"/>
    <stop offset="100%" stop-color="#67e8f9" stop-opacity="0"/>
  </linearGradient>
  <filter id="lineGlow" x="-10%" y="-40%" width="120%" height="180%">
    <feGaussianBlur stdDeviation="3" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <pattern id="graphGrid" width="63" height="30" patternUnits="userSpaceOnUse">
    <line x1="0" y1="0" x2="0" y2="180" stroke="#67e8f9" stroke-width="0.3" opacity="0.1"/>
    <line x1="0" y1="30" x2="900" y2="30" stroke="#c084fc" stroke-width="0.3" opacity="0.1"/>
  </pattern>
</defs>
<rect width="900" height="210" fill="#020810"/>
<ellipse cx="200" cy="170" rx="200" ry="100" fill="#7c3aed" opacity="0.09" filter="url(#fog)">
  <animate attributeName="cx" values="200;280;200" dur="10s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="750" cy="50" rx="180" ry="90" fill="#0891b2" opacity="0.07" filter="url(#fog)"/>

<rect x="10" y="10" width="880" height="188" rx="22" fill="#020810" stroke="url(#cardBorder)" stroke-width="1.5" filter="url(#cardDepth)"/>
<rect x="12" y="12" width="876" height="3" rx="1.5" fill="#ffffff" opacity="0.14"/>
<rect x="10" y="10" width="880" height="188" rx="22" fill="url(#shimmer)"/>

<text x="450" y="42" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="15" font-weight="800" letter-spacing="3" fill="url(#valG)" filter="url(#titleGlow)">CONTRIBUTION ACTIVITY — ${new Date().getFullYear()}</text>

<!-- Graph grid -->
<rect x="${GRAPH_X}" y="${GRAPH_Y}" width="${GRAPH_W}" height="${GRAPH_H}" fill="url(#graphGrid)"/>

<!-- Area fills -->
<path d="${areaPath}" fill="url(#areaFill)" opacity="0.7"/>
<path d="${areaPath}" fill="url(#areaFill2)" opacity="0.5"/>

<!-- Shadow line -->
<polyline points="${polyPts}" fill="none" stroke="#7c3aed" stroke-width="3" stroke-linejoin="round" opacity="0.4"/>
<!-- Main glow line -->
<polyline points="${polyPts}" fill="none" stroke="#c084fc" stroke-width="2.5" stroke-linejoin="round" filter="url(#lineGlow)"/>

<!-- Animated dot along path -->
<circle r="5" fill="#c084fc" filter="url(#lineGlow)">
  <animateMotion repeatCount="indefinite" dur="12s">
    <mpath/>
  </animateMotion>
</circle>

<!-- Month labels -->
${monthLabels.join("\n")}
</svg>`;
}

// ── 5. PINNED REPOS ───────────────────────────────────────────────────────────
function genPinnedRepos(data) {
  const { pinnedRepos, repos } = data;

  // Fallback to top non-fork repos if pinned empty
  let items = pinnedRepos.length
    ? pinnedRepos.slice(0, 4)
    : repos.filter((r) => !r.fork).slice(0, 4).map((r) => ({
        name: r.name,
        description: r.description,
        url: r.html_url,
        primaryLanguage: r.language ? { name: r.language, color: langColor(r.language) } : null,
        stargazerCount: r.stargazers_count,
        forkCount: r.forks_count,
      }));

  // 2 per row
  const rows = [items.slice(0, 2), items.slice(2, 4)].filter((r) => r.length);
  const height = rows.length === 1 ? 200 : 370;

  const BORDERS = ["#f472b6", "#67e8f9", "#c084fc", "#4ade80"];
  const FILLS = ["#10030c", "#020c10", "#060310", "#021008"];
  const GLOWS = ["#db2777", "#0891b2", "#7c3aed", "#059669"];
  const TITLE_COLORS = ["#f9a8d4", "#a5f3fc", "#ddd6fe", "#86efac"];

  let cards = "";
  rows.forEach((row, ri) => {
    const y0 = ri === 0 ? 60 : 230;
    row.forEach((repo, ci) => {
      const x0 = ci === 0 ? 16 : 462;
      const idx = ri * 2 + ci;
      const border = BORDERS[idx % BORDERS.length];
      const fill   = FILLS[idx % FILLS.length];
      const glow   = GLOWS[idx % GLOWS.length];
      const titleC = TITLE_COLORS[idx % TITLE_COLORS.length];
      const langName = repo.primaryLanguage?.name ?? "Unknown";
      const langC    = repo.primaryLanguage?.color ?? "#8b949e";
      const desc = (repo.description ?? "No description provided.").slice(0, 60) + ((repo.description?.length ?? 0) > 60 ? "…" : "");

      cards += `
<!-- Card ${idx} -->
<rect x="${x0 + 4}" y="${y0 + 4}" width="422" height="152" rx="18" fill="${glow}" opacity="0.12"/>
<rect x="${x0}" y="${y0}" width="422" height="152" rx="18" fill="${fill}">
  <animate attributeName="fill-opacity" values="1;0.95;1" dur="${3 + idx * 0.4}s" repeatCount="indefinite"/>
</rect>
<rect x="${x0}" y="${y0}" width="422" height="152" rx="18" fill="none" stroke="${border}" stroke-width="1.8">
  <!-- no filter on border rect so it doesn't bleed into text -->
</rect>
<rect x="${x0 + 2}" y="${y0 + 2}" width="418" height="3" rx="1.5" fill="#ffffff" opacity="0.16"/>
<!-- Glow blob under card -->
<ellipse cx="${x0 + 211}" cy="${y0 + 76}" rx="180" ry="70" fill="${glow}" opacity="0.07" filter="url(#fog)"/>

<text x="${x0 + 24}" y="${y0 + 36}" font-family="'Segoe UI',sans-serif" font-size="17" font-weight="800" fill="${titleC}">${esc(repo.name ?? "")}</text>
<text x="${x0 + 24}" y="${y0 + 58}" font-family="'Segoe UI',sans-serif" font-size="12" fill="#9ca3af">${esc(desc)}</text>

<!-- Language dot + name -->
<circle cx="${x0 + 24}" cy="${y0 + 82}" r="5" fill="${esc(langC)}"/>
<text x="${x0 + 36}" y="${y0 + 87}" font-family="'Segoe UI',sans-serif" font-size="11.5" fill="#d1d5db">${esc(langName)}</text>

<!-- Stars + forks -->
<text x="${x0 + 24}" y="${y0 + 110}" font-family="'Segoe UI',sans-serif" font-size="11" fill="#6b7280">⭐ ${esc(String(repo.stargazerCount ?? 0))}  &nbsp;&nbsp;  🍴 ${esc(String(repo.forkCount ?? 0))}</text>

<!-- Animated accent bar -->
<rect x="${x0 + 24}" y="${y0 + 130}" width="0" height="2" rx="1" fill="${border}" opacity="0.8">
  <animate attributeName="width" from="0" to="374" dur="1.6s" fill="freeze" begin="${idx * 0.2}s"/>
</rect>
`;
    });
  });

  return `<svg width="900" height="${height}" viewBox="0 0 900 ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>${SHARED_DEFS}</defs>
<rect width="900" height="${height}" fill="#04020e"/>
<ellipse cx="150" cy="${height - 50}" rx="160" ry="100" fill="#7c3aed" opacity="0.1" filter="url(#fog)">
  <animate attributeName="cx" values="150;210;150" dur="10s" repeatCount="indefinite"/>
</ellipse>
<ellipse cx="780" cy="60" rx="150" ry="90" fill="#0891b2" opacity="0.08" filter="url(#fog)"/>

<text x="450" y="38" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="18" font-weight="800" letter-spacing="2" fill="url(#valG)" filter="url(#titleGlow)">📦 projects.pinned()</text>
<rect x="330" y="45" width="240" height="1.5" rx="0.75" fill="url(#valG)" opacity="0.4"/>

${cards}
</svg>`;
}

// ── 6. TROPHIES / BADGES ──────────────────────────────────────────────────────
function genTrophies(data) {
  const { user, contributions, totalStars, repos } = data;
  const items = [
    { icon: "🏆", label: "COMMITS",      val: fmt(contributions.commits ?? contributions.total ?? 0) },
    { icon: "🥇", label: "REPOS",        val: fmt(user.public_repos) },
    { icon: "🥈", label: "FOLLOWERS",    val: fmt(user.followers) },
    { icon: "⭐", label: "STARS EARNED", val: fmt(totalStars) },
    { icon: "🏅", label: "PULL REQUESTS",val: fmt(contributions.prs ?? 0) },
    { icon: "🎯", label: "JOINED",        val: new Date(user.created_at).getFullYear().toString() },
    { icon: "⚡", label: "STREAK",        val: `${contributions.currentStreak ?? 0}d` },
  ];

  const COLORS = ["#fbbf24","#fbbf24","#e2e8f0","#fcd34d","#e2e8f0","#fbbf24","#f472b6"];

  return `<svg width="900" height="152" viewBox="0 0 900 152" xmlns="http://www.w3.org/2000/svg">
<defs>${SHARED_DEFS}
  <filter id="trophyGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="900" height="152" fill="#050300"/>
<ellipse cx="450" cy="90" rx="400" ry="80" fill="#f59e0b" opacity="0.06" filter="url(#fog)">
  <animate attributeName="opacity" values="0.06;0.1;0.06" dur="5s" repeatCount="indefinite"/>
</ellipse>

${items.map(({ icon, label, val }, i) => {
  const x = 64 + i * 110;
  const c = COLORS[i];
  return `
<g transform="translate(${x},76)">
  <text x="0" y="0"  text-anchor="middle" font-size="34">${esc(icon)}</text>
  <text x="0" y="24" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="9.5" fill="${esc(c)}" font-weight="700" letter-spacing="0.5">${esc(label)}</text>
  <text x="0" y="44" text-anchor="middle" font-family="'Segoe UI',sans-serif" font-size="15" fill="#ffffff" font-weight="900" filter="url(#numDepth)">${esc(val)}</text>
  <animate attributeName="opacity" values="1;0.75;1" dur="${2.4 + i * 0.3}s" repeatCount="indefinite" begin="${i * 0.2}s"/>
</g>`;
}).join("")}
</svg>`;
}

// ── 7. SNAKE REPLACEMENT — animated code rain card ────────────────────────────
function genSnake(_data) {
  // Generate a pseudo-random but deterministic snake path through a grid
  // 18 cols × 7 rows grid, snake body cells highlighted
  const COLS = 52, ROWS = 7;
  const CELL = 14, GAP = 3;
  const W = COLS * (CELL + GAP) + GAP;
  const H = ROWS * (CELL + GAP) + GAP + 60;

  // Snake as a pre-defined sinusoidal path (looks like it's eating commits)
  const snakePath = [];
  let col = 0, dir = 1;
  for (let r = 0; r < ROWS; r++) {
    if (dir === 1) for (let c = 0; c < COLS; c++) snakePath.push([c, r]);
    else           for (let c = COLS - 1; c >= 0; c--) snakePath.push([c, r]);
    dir *= -1;
  }

  const snakeSet = new Set();
  const HEAD_IDX = Math.floor(snakePath.length * 0.72);
  for (let i = HEAD_IDX - 12; i <= HEAD_IDX; i++) {
    if (i >= 0) snakeSet.add(`${snakePath[i][0]},${snakePath[i][1]}`);
  }

  // "Contribution" grid cells — random-ish using index math
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${c},${r}`;
      const isSnake = snakeSet.has(key);
      const isHead  = (c === snakePath[HEAD_IDX][0] && r === snakePath[HEAD_IDX][1]);
      // Pseudo activity level
      const level = ((c * 7 + r * 13 + c * r) % 5);
      cells.push({ c, r, level, isSnake, isHead });
    }
  }

  const LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

  return `<svg width="${W + 40}" height="${H}" viewBox="0 0 ${W + 40} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>${SHARED_DEFS}
  <filter id="snakeGlow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feFlood flood-color="#4ade80" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="headGlow" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feFlood flood-color="#86efac" result="c"/>
    <feComposite in="c" in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="${W + 40}" height="${H}" fill="#0d1117"/>
<rect x="18" y="48" width="${W + 4}" height="${ROWS * (CELL + GAP) + 4}" rx="8"
      fill="none" stroke="#21262d" stroke-width="1"/>

<text x="${(W + 40) / 2}" y="32" text-anchor="middle"
      font-family="'Segoe UI',sans-serif" font-size="14" font-weight="700" letter-spacing="2"
      fill="url(#valG)" filter="url(#titleGlow)">🐍 CONTRIBUTION SNAKE</text>

${cells.map(({ c, r, level, isSnake, isHead }) => {
  const x = 20 + c * (CELL + GAP);
  const y = 52 + r * (CELL + GAP);
  if (isHead) {
    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="#86efac" filter="url(#headGlow)">
  <animate attributeName="fill" values="#86efac;#4ade80;#86efac" dur="0.6s" repeatCount="indefinite"/>
</rect>
<text x="${x + 7}" y="${y + 11}" text-anchor="middle" font-size="10">👀</text>`;
  }
  if (isSnake) {
    const shade = isSnake ? `fill="#4ade80"` : `fill="${LEVEL_COLORS[level]}"`;
    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" ${shade} filter="url(#snakeGlow)" opacity="0.9"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="${LEVEL_COLORS[level]}" opacity="0.9"/>`;
}).join("\n")}
</svg>`;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const data = await fetchAll();

  const files = [
    ["stats-card.svg",    genStatsCard(data)],
    ["langs-card.svg",    genLangsCard(data)],
    ["streak-card.svg",   genStreakCard(data)],
    ["activity-graph.svg",genActivityGraph(data)],
    ["pinned-repos.svg",  genPinnedRepos(data)],
    ["trophies.svg",      genTrophies(data)],
    ["snake-contrib.svg", genSnake(data)],
  ];

  await Promise.all(
    files.map(async ([name, svg]) => {
      const path = resolve(ASSETS, name);
      await writeFile(path, svg, "utf8");
      console.log(`✅  Written → assets/${name}`);
    })
  );

  console.log("\n🎉  All SVGs generated successfully!");
}

main().catch((err) => {
  console.error("❌ ", err.message);
  process.exit(1);
});
