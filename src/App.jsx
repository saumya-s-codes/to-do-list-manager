import React, { useState, useEffect, useMemo, useRef } from "react";
import { downloadExport } from "./exportData.js";
import {
  Download, Sun, Pencil, Plus, Moon, Check, X, Eye, LayoutGrid, CalendarDays, Timer,
  BarChart3, CheckCircle2, MoreHorizontal, Zap, Target, ClipboardList, Hourglass,
  Trash2, ArrowRight, Calendar, Inbox, RotateCcw, Sparkles, AlertCircle, ArrowUp,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════════════
   THEME SYSTEM
   ────────────────────────────────────────────────────────────────────────────
   Every colour, font, radius and shadow in the app comes from a CSS variable
   set by the active theme. No component hard-codes a colour.

   TO ADD A THEME: add one entry to THEMES below (copy any existing one).
     • vars        → the CSS variables (full list is visible in the entries)
     • catPalette  → [background, text] pairs; categories cycle through these
     • swatches    → 4 colours shown in the theme picker
   Nothing else needs to change. The picker in Settings lists every entry.
   ════════════════════════════════════════════════════════════════════════════ */

const THEMES = {
  earthy: {
    name: "Earthy & Refined",
    blurb: "Warm, grounded, timeless",
    dark: false,
    swatches: ["#B8532F", "#E2C6A6", "#8A8A66", "#5A3A26"],
    catPalette: [
      ["#DDE0EA", "#4A5578"], ["#F5D2C8", "#9A3E24"], ["#E3DCEF", "#5B4C8A"],
      ["#DCE5CF", "#4E6B34"], ["#E9E0D1", "#6B5A45"], ["#F1DDC0", "#8A5A1C"],
    ],
    vars: {
      "--bg": "linear-gradient(180deg,#FBF3E8 0%,#F4E6D5 100%)",
      "--panel": "#EFE0CD",
      "--card": "#FCF7EF",
      "--text": "#2D1F17",
      "--muted": "#7B6757",
      "--line": "rgba(70,40,20,.13)",
      "--accent": "#B8532F",
      "--accent-ink": "#FFF7EE",
      "--accent-soft": "#F0D5C6",
      "--btn-bg": "#B8532F",
      "--btn-ink": "#FFF7EE",
      "--danger": "#B3261E",
      "--font-display": "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif",
      "--font-body": "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
      "--display-weight": "500",
      "--display-transform": "none",
      "--display-spacing": "-0.01em",
      "--radius-lg": "22px",
      "--radius-md": "14px",
      "--radius-pill": "999px",
      "--shadow": "0 6px 18px rgba(90,50,20,.10)",
      "--nav-bg": "rgba(252,247,239,.92)",
      "--nav-active": "#B8532F",
      "--scrim": "rgba(45,31,23,.38)",
      "--q1": "#7E8B5A", "--q1-bg": "#DFE5CB",
      "--q2": "#C4573A", "--q2-bg": "#F3D3C7",
      "--q3": "#C89A5E", "--q3-bg": "#F2E2C3",
      "--q4": "#8F7D66", "--q4-bg": "#E8DDCB",
    },
  },

  minimal: {
    name: "Minimal & Professional",
    blurb: "Clean, high contrast, no noise",
    dark: false,
    swatches: ["#171717", "#B9B9B9", "#DCDCDC", "#555555"],
    catPalette: [
      ["#ECECEA", "#3C3C3C"], ["#E2E2E0", "#2A2A2A"], ["#F0F0EE", "#5A5A5A"],
      ["#E6E6E4", "#4A4A4A"], ["#EEEEEC", "#333333"], ["#E0E0DE", "#666666"],
    ],
    vars: {
      "--bg": "#F7F7F5",
      "--panel": "#EEEEEC",
      "--card": "#FFFFFF",
      "--text": "#151515",
      "--muted": "#707070",
      "--line": "rgba(0,0,0,.09)",
      "--accent": "#171717",
      "--accent-ink": "#FFFFFF",
      "--accent-soft": "#E6E6E4",
      "--btn-bg": "#1B1B1B",
      "--btn-ink": "#FFFFFF",
      "--danger": "#C0392B",
      "--font-display": "-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif",
      "--font-body": "-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif",
      "--display-weight": "700",
      "--display-transform": "none",
      "--display-spacing": "-0.03em",
      "--radius-lg": "18px",
      "--radius-md": "12px",
      "--radius-pill": "999px",
      "--shadow": "0 1px 2px rgba(0,0,0,.05)",
      "--nav-bg": "rgba(255,255,255,.94)",
      "--nav-active": "#151515",
      "--scrim": "rgba(0,0,0,.35)",
      "--q1": "#3F3F3F", "--q1-bg": "#E9E9E7",
      "--q2": "#171717", "--q2-bg": "#DCDCDA",
      "--q3": "#8A8A8A", "--q3-bg": "#F0F0EE",
      "--q4": "#B5B5B3", "--q4-bg": "#F4F4F2",
    },
  },

  vibrant: {
    name: "Vibrant & Gamer",
    blurb: "Dark, glowing, high-energy",
    dark: true,
    swatches: ["#FF8A1F", "#A855F7", "#22D3EE", "#FF4FA3"],
    catPalette: [
      ["rgba(34,211,238,.16)", "#52DDF2"], ["rgba(255,79,163,.18)", "#FF86BE"],
      ["rgba(168,85,247,.22)", "#C994FF"], ["rgba(74,222,128,.16)", "#62E692"],
      ["rgba(255,138,31,.2)", "#FFA54F"], ["rgba(250,204,21,.16)", "#F7D446"],
    ],
    vars: {
      "--bg": "radial-gradient(120% 60% at 50% 0%,#241A4A 0%,#0E0B1E 60%)",
      "--panel": "#1A1536",
      "--card": "#1F1940",
      "--text": "#FFFFFF",
      "--muted": "#A9A2CC",
      "--line": "rgba(255,255,255,.11)",
      "--accent": "#FF8A1F",
      "--accent-ink": "#1A1030",
      "--accent-soft": "rgba(255,138,31,.2)",
      "--btn-bg": "linear-gradient(90deg,#FF8A1F 0%,#FF4FA3 55%,#A855F7 100%)",
      "--btn-ink": "#FFFFFF",
      "--danger": "#FF6B6B",
      "--font-display": "'Arial Black','Helvetica Neue',Arial,sans-serif",
      "--font-body": "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
      "--display-weight": "900",
      "--display-transform": "uppercase",
      "--display-spacing": "0.01em",
      "--radius-lg": "20px",
      "--radius-md": "13px",
      "--radius-pill": "999px",
      "--shadow": "0 0 0 1px rgba(255,255,255,.04), 0 8px 24px rgba(0,0,0,.45)",
      "--nav-bg": "rgba(16,12,36,.94)",
      "--nav-active": "#FF8A1F",
      "--scrim": "rgba(0,0,0,.6)",
      "--scheme": "dark",
      "--q1": "#22D3EE", "--q1-bg": "rgba(34,211,238,.14)",
      "--q2": "#FF4FA3", "--q2-bg": "rgba(255,79,163,.16)",
      "--q3": "#A855F7", "--q3-bg": "rgba(168,85,247,.18)",
      "--q4": "#FACC15", "--q4-bg": "rgba(250,204,21,.13)",
    },
  },
};
const DEFAULT_THEME = "earthy";

/* ═══════════════════════════ helpers & data ═══════════════════════════════ */

const pad = (n) => String(n).padStart(2, "0");
const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const offsetDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtShort = (s) => parseDay(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
// "3 days overdue" / "Due today" / "Fri, Oct 16"
const dueInfo = (due) => {
  const t = iso();
  if (due === t) return { text: "Due today", cls: "today" };
  if (due < t) {
    const n = Math.round((parseDay(t) - parseDay(due)) / 864e5);
    return { text: `${n} ${n === 1 ? "day" : "days"} overdue`, cls: "over" };
  }
  return { text: fmtShort(due), cls: "" };
};
// Keeps items consistent: Watching items carry no date; only Today items carry a Today position (pos) and only Watching items a Watching position (wpos)
const normalizeItem = (i) => {
  let o = i;
  if (o.status === "watching" && o.due) o = { ...o, due: null };
  if (o.status !== "today" && o.pos != null) o = { ...o, pos: null };
  if (o.status !== "watching" && o.wpos != null) o = { ...o, wpos: null };
  return o;
};
// Today's order: your manual order first; anything new (no position yet) follows, due-today ones first
const todaySort = (list) => {
  const t = iso();
  return [...list].sort((a, b) => {
    const ap = a.pos != null, bp = b.pos != null;
    if (ap && bp) return a.pos - b.pos;
    if (ap !== bp) return ap ? -1 : 1;
    return Number(b.due === t) - Number(a.due === t);
  });
};
const isToday = (ms) => !!ms && new Date(ms).toDateString() === new Date().toDateString();
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_CATS = ["School", "Personal", "Work", "Career", "Health", "Digital"];

const QUADS = [
  { key: "quick-high", n: 1, title: "Quick Wins", sub: "Quick · High — do first when free.", Icon: Zap },
  { key: "deep-high", n: 2, title: "Major Focus", sub: "Deep · High — plan intentionally.", Icon: Target },
  { key: "quick-low", n: 3, title: "Admin / Fillers", sub: "Quick · Low — batch at end of day.", Icon: ClipboardList },
  { key: "deep-low", n: 4, title: "Deferral", sub: "Deep · Low — rethink, delegate, or push out.", Icon: Hourglass },
];
const quadOf = (i) => (i.effort && i.impact ? `${i.effort}-${i.impact}` : null);

// Inbox cards stay in the deck until they are saved, however many labels they already have.
// (Future items that somehow lack labels also wait here.)
const isUnlabeled = (i) =>
  i.status === "inbox" || (i.status === "future" && !i.someday && (!i.category || !i.effort || !i.impact));

function makeSeed() {
  const mk = (title, category, effort, impact, status, due = null, extra = {}) => ({
    id: uid(), title, category, effort, impact, status, due, someday: false,
    createdAt: Date.now(), doneAt: null, doneFrom: null, ...extra,
  });
  const done = (title, category, effort, impact) =>
    mk(title, category, effort, impact, "done", null, { doneAt: Date.now(), doneFrom: "today" });
  const someday = (title, category, effort, impact) => mk(title, category, effort, impact, "future", null, { someday: true });

  return [
    /* ── Today: a realistic mix, two due today, one major-focus task ── */
    mk("Finish bio notes", "School", "deep", "high", "today"),
    mk("Submit lab report", "School", "deep", "high", "today", offsetDay(0)),
    mk("Reply to club emails", "Personal", "quick", "low", "today"),
    mk("Read article for class", "School", "deep", "low", "today"),
    mk("Buy groceries", "Personal", "quick", "low", "today", offsetDay(0)),
    mk("Plan tomorrow", "Personal", "quick", "high", "today"),
    done("Morning workout", "Health", "quick", "high"),
    done("Pay phone bill", "Personal", "quick", "low"),

    /* ── Future matrix: all four quadrants, some dated, two overdue ── */
    mk("Book dentist appointment", "Health", "quick", "high", "future", offsetDay(2)),
    mk("Plan birthday gift", "Personal", "quick", "high", "future", offsetDay(5)),
    mk("Email advisor about spring classes", "School", "quick", "high", "future", offsetDay(1)),
    mk("Renew passport", "Personal", "quick", "high", "future", offsetDay(20)),
    mk("Study for chem midterm", "School", "deep", "high", "future", offsetDay(4)),
    mk("Draft internship cover letter", "Career", "deep", "high", "future", offsetDay(6)),
    mk("Research study abroad", "School", "deep", "high", "future"),
    mk("Work on portfolio", "Career", "deep", "high", "future", offsetDay(14)),
    mk("Organize downloads", "Digital", "quick", "low", "future"),
    mk("Update resume format", "Career", "quick", "low", "future", offsetDay(9)),
    mk("Clean out backpack", "Personal", "quick", "low", "future"),
    mk("Back up laptop", "Digital", "quick", "low", "future", offsetDay(7)),
    mk("Learn new design tool", "Career", "deep", "low", "future"),
    mk("Reorganize photo library", "Digital", "deep", "low", "future"),
    // due today: these get moved to the Today page automatically
    mk("Call insurance about claim", "Personal", "quick", "high", "future", offsetDay(0)),
    mk("Pick up prescription", "Health", "quick", "high", "future", offsetDay(0)),
    mk("Renew library books", "Personal", "quick", "low", "future", offsetDay(-1)),
    mk("Return package to store", "Personal", "quick", "high", "future", offsetDay(-3)),

    /* ── Someday ── */
    someday("Learn guitar", "Personal", "deep", "low"),
    someday("Visit Kyoto", "Personal", "deep", "high"),
    someday("Start a podcast", "Career", "deep", "low"),

    /* ── Watching: dated, undated, and one overdue ── */
    mk("Check if project released yet", "School", null, null, "watching"),
    mk("See if internship applications are open", "Career", null, null, "watching"),
    mk("Follow up with professor", "School", null, null, "watching"),
    mk("Track flight prices to Japan", "Personal", null, null, "watching"),
    mk("Waiting on scholarship decision", "School", null, null, "watching"),
    mk("Reply from landlord", "Personal", null, null, "watching"),
    mk("Check club event details", "Personal", null, null, "watching"),

    /* ── Inbox deck: 12 cards, two partly labeled to test prefilled fields ── */
    mk("Call grandma", null, null, null, "inbox"),
    mk("Look into gym membership", null, null, null, "inbox"),
    mk("Sign up for intramural volleyball", null, null, null, "inbox"),
    mk("Ask TA about regrade", "School", null, null, "inbox"),
    mk("Fix bike tire", "Personal", "deep", null, "inbox"),
    mk("Book flight home for break", null, null, null, "inbox"),
    mk("Look up grad school deadlines", null, null, null, "inbox"),
    mk("Buy a birthday card for Maya", null, null, null, "inbox"),
    mk("Clean desk", null, null, null, "inbox"),
    mk("Try that ramen place on 5th", null, null, null, "inbox"),
    mk("Update LinkedIn photo", null, null, null, "inbox"),
    mk("Cancel unused streaming subscription", null, null, null, "inbox"),
  ];
}

const STORAGE_KEY = "clear-the-deck:v4";   // bumped so the richer sample data loads fresh
async function loadState() {
  try { const r = await window.storage.get(STORAGE_KEY); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function saveState(s) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: stay in memory */ }
}

/* ═══════════════════════════════ styles ═══════════════════════════════════ */

const CSS = `
.cd-outer{position:fixed;inset:0;display:flex;justify-content:center;align-items:stretch;background:#CFC8BC;overflow:hidden;overscroll-behavior:none}
.cd, .cd *{box-sizing:border-box}
.cd{position:relative;width:100%;max-width:430px;height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden;
  background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:15px;line-height:1.4;-webkit-font-smoothing:antialiased}
@media(min-width:520px){.cd-outer{align-items:center;padding:20px 0}.cd{height:min(880px,calc(100vh - 40px));border-radius:38px;box-shadow:0 30px 80px rgba(0,0,0,.35)}}
:where(.cd) button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cd button:focus-visible,.cd input:focus-visible,.cd textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
:where(.cd) input,:where(.cd) textarea{font:inherit;color:var(--text)}
/* iOS Safari zooms the page when a field under 16px gets focus, so every field is 16px */
.cd input,.cd textarea,.cd select{font-size:16px !important}
.cd-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:18px 20px 28px;scrollbar-width:none}
.cd-scroll::-webkit-scrollbar{display:none}

.cd-date{color:var(--muted);font-size:14px}
.cd-h1{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:34px;line-height:1.08;margin:4px 0 4px}
.cd-sub{color:var(--muted);font-size:14.5px;margin:0}
.cd-h2{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:21px;margin:0}
.cd-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.cd-iconbtn{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:var(--accent);flex:none}
.cd-plus{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink);flex:none;box-shadow:var(--shadow)}

.cd-panel{background:var(--panel);border-radius:var(--radius-lg);padding:16px;margin-top:18px}
.cd-panel h3{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:19px;margin:0}
.cd-panel p{margin:2px 0 12px;color:var(--muted);font-size:13.5px}
.cd-dump{position:relative;background:var(--card);border-radius:var(--radius-md)}
.cd-dump textarea{display:block;width:100%;min-height:110px;resize:none;border:0;background:transparent;padding:14px;outline-offset:-2px;border-radius:var(--radius-md)}
.cd-dump textarea::placeholder{color:var(--muted)}
.cd-dumprow{display:flex;align-items:stretch;gap:10px}
.cd-dumprow .cd-dump{flex:1;min-width:0}
.cd-dumpbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;flex:none;width:76px;border-radius:var(--radius-md);background:var(--card);color:var(--muted);font-size:14px;font-weight:700;box-shadow:var(--shadow);transition:background .15s,color .15s,transform .1s}
.cd-dumpbtn.on{background:var(--btn-bg);color:var(--btn-ink)}
.cd-dumpbtn:active{transform:scale(.98)}

.cd-sec{display:flex;align-items:center;justify-content:space-between;margin:26px 0 6px}
.cd-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
.cd-row:last-child{border-bottom:0}
.cd-row-main{flex:1;min-width:0;display:block;text-align:left}
.cd-row-title{display:block;font-weight:500;line-height:1.3;overflow-wrap:anywhere}
.cd-row.done{opacity:.5;transition:opacity .2s}
.cd-row.done .cd-row-title{text-decoration:line-through;color:var(--muted)}
.cd-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:3px;color:var(--muted);font-size:12.5px}
.cd-cattext{display:inline-flex;align-items:center;gap:5px;font-weight:600}
.cd-cattext i{width:7px;height:7px;border-radius:50%;display:block}
.cd-meta .over{color:var(--danger);font-weight:600}
.cd-check{width:26px;height:26px;border-radius:50%;border:2px solid var(--accent);display:grid;place-items:center;flex:none;color:var(--accent-ink)}
.cd-check.on{background:var(--accent)}
.cd-more{width:34px;height:34px;display:grid;place-items:center;color:var(--muted);flex:none;border-radius:50%}
.cd-chip{display:inline-block;padding:3px 11px;border-radius:var(--radius-pill);font-size:12.5px;font-weight:500;white-space:nowrap}
.cd-pill{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;flex:none;border-radius:var(--radius-pill);font-size:12.5px;font-weight:600;background:var(--accent-soft);color:var(--accent)}
.cd-empty{text-align:center;color:var(--muted);padding:30px 10px}
.cd-empty b{display:block;color:var(--text);font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:19px;margin-bottom:4px}

.cd-nav{display:flex;border-top:1px solid var(--line);background:var(--nav-bg);padding:8px 4px calc(10px + env(safe-area-inset-bottom));backdrop-filter:blur(10px)}
.cd-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:var(--muted);position:relative;padding:4px 0}
.cd-tab.on{color:var(--nav-active);font-weight:600}
.cd-badge{position:absolute;top:-1px;left:calc(50% + 6px);min-width:17px;height:17px;border-radius:9px;background:var(--accent);color:var(--accent-ink);font-size:10.5px;font-weight:700;display:grid;place-items:center;padding:0 4px}

.cd-seg{display:flex;gap:8px;margin-top:16px;overflow-x:auto;scrollbar-width:none}
.cd-seg::-webkit-scrollbar{display:none}
.cd-segbtn{padding:8px 16px;border-radius:var(--radius-pill);background:var(--panel);color:var(--muted);font-weight:500;white-space:nowrap;flex:none}
.cd-segbtn.on{background:var(--accent);color:var(--accent-ink)}
.cd-segbtn.sm{padding:5px 13px;font-size:13.5px}
.cd-segbtn.sm.on{background:var(--accent-soft);color:var(--accent);box-shadow:inset 0 0 0 1.5px var(--accent)}

.cd-group{border-radius:var(--radius-lg);margin-top:14px;overflow:hidden;background:var(--card);box-shadow:var(--shadow)}
.cd-ghead{display:flex;align-items:center;gap:10px;padding:13px 16px}
.cd-ghead .t{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:18px}
.cd-ghead .s{font-size:12.5px;color:var(--muted);margin-top:1px}
.cd-gcount{margin-left:auto;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;background:var(--card);color:var(--text);flex:none}
.cd-gbody{padding:0 16px 4px;background:var(--card)}
.cd-datehead{font-weight:600;margin:20px 0 2px;font-size:14px;color:var(--muted)}

.cd-row.cd-wrow{gap:14px;padding:14px 4px 14px 14px;margin-bottom:10px;border:0;border-radius:var(--radius-lg);background:var(--card);box-shadow:var(--shadow)}
.cd-wrow .eye{width:44px;height:44px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex:none}
.cd-wrow .cd-row-title{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:17px;line-height:1.25}
.cd-wrow .cd-meta{margin-top:5px;font-size:13.5px}
.cd-wrow .cd-more{width:30px}
.cd-host{flex:1;min-height:0;position:relative;display:flex;flex-direction:column}
.cd-host .cd-scroll{flex:1;min-height:0}
.cd-float{position:absolute;right:16px;bottom:16px;display:flex;align-items:center;gap:10px;z-index:5}
.cd-float .cd-undo{height:48px;padding:0 18px;background:var(--card);box-shadow:var(--shadow);border:1px solid var(--line);font-size:14.5px}
.cd-float .cd-plus{width:56px;height:56px}
.cd-swrap{position:relative;margin-bottom:10px;touch-action:pan-y;-webkit-touch-callout:none}
.cd-swrap .cd-row.cd-wrow{margin-bottom:0;position:relative;z-index:1;touch-action:pan-y;transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .2s,background .2s}
.cd-swact{position:absolute;inset:0;display:block;background:none;border-radius:var(--radius-lg);opacity:0;pointer-events:none;transition:opacity 0s linear .3s;z-index:0}
.cd-swact.on{opacity:1;pointer-events:auto;transition:none}
.cd-swcol{position:absolute;right:10px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:stretch;transform-origin:right center}
.cd-swpill{height:48px;border-radius:24px;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;padding-left:12px;overflow:hidden;flex:none}
.cd-swlbl{margin-top:5px;font-size:12px;font-weight:600;color:var(--muted);text-align:center;white-space:nowrap}
.cd-swact.armed .cd-swpill svg{transform:scale(1.2)}
.cd-swpill svg{transition:transform .15s;flex:none}
.cd-swrap .cd-row.cd-wrow.swiping{background:var(--panel)}
.cd-swrap.cd-lifting{z-index:6}
.cd-swrap.cd-lifting .cd-wrow{box-shadow:0 12px 30px rgba(0,0,0,.2)}
.cd-gh{display:flex;align-items:center;gap:8px;margin:18px 4px 10px;font-weight:700;font-size:14px}
.cd-gh:first-child{margin-top:8px}
.cd-gh i{width:9px;height:9px;border-radius:50%;flex:none}
.cd-gh .n{color:var(--muted);font-weight:500;font-size:13px}

.cd-progress{height:6px;border-radius:3px;background:var(--panel);overflow:hidden;margin-top:6px}
.cd-progress i{display:block;height:100%;background:var(--accent);border-radius:3px;transition:width .3s}
.cd-card{position:relative;background:var(--card);border-radius:var(--radius-lg);box-shadow:var(--shadow);padding:6px 16px 8px;z-index:1;touch-action:none;user-select:none;-webkit-user-select:none;will-change:transform}
.cd-card-title{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:32px;text-align:center;line-height:1.12;padding:26px 8px 10px;overflow-wrap:anywhere}
.cd-hint{text-align:center;font-size:12.5px;color:var(--muted);margin-top:14px}
.cd-cardact{position:absolute;right:8px;bottom:8px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:transparent;color:var(--muted);opacity:.55;z-index:2}
.cd-cardact:active{opacity:1;color:var(--danger)}
.cd .cd-card-edit{display:block;width:100%;border:0;background:transparent;resize:none;overflow:hidden;text-align:center;
  font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);
  line-height:1.12;padding:0;margin:0;outline:none;user-select:text;-webkit-user-select:text;touch-action:auto;
  font-size:var(--edit-size,32px) !important}

.cd-card-d{background:var(--card);border-radius:var(--radius-lg);box-shadow:var(--shadow);padding:16px;margin-top:14px}
.cd-card-d .hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
.cd-card-d .hd span{font-size:12.5px;color:var(--muted)}
.cd-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 8px;text-align:center}
.cd-stat b{display:block;font-family:var(--font-display);font-weight:var(--display-weight);font-size:30px;line-height:1.1}
.cd-stat span{font-size:12.5px;color:var(--muted)}
.cd-stat.warn b{color:var(--danger)}
.cd-stat.hot b{color:var(--accent)}
.cd-focus{display:flex;align-items:center;gap:16px}
.cd-focus .n{font-family:var(--font-display);font-weight:var(--display-weight);font-size:44px;color:var(--accent);line-height:1}
.cd-bar{flex:1;height:9px;border-radius:5px;background:var(--panel);overflow:hidden;margin:6px 0 8px}
.cd-bar i{display:block;height:100%;border-radius:5px;transition:width .3s}
.cd-cat{display:grid;grid-template-columns:88px 1fr 22px;align-items:center;gap:10px;margin:9px 0;font-size:13.5px}
.cd-cat .tr{height:14px;border-radius:7px;background:var(--panel);overflow:hidden}
.cd-cat .tr i{display:block;height:100%;border-radius:7px}
.cd-cat em{font-style:normal;text-align:right;color:var(--muted)}
.cd-donut{display:flex;align-items:center;gap:20px}
.cd-legend{display:flex;flex-direction:column;gap:9px;font-size:13.5px;flex:1}
.cd-legend div{display:flex;align-items:center;gap:8px}
.cd-legend i{width:10px;height:10px;border-radius:50%;flex:none}
.cd-legend em{margin-left:auto;font-style:normal;color:var(--muted)}

.cd-scrim{position:absolute;inset:0;touch-action:none;overscroll-behavior:none;background:var(--scrim);display:flex;align-items:flex-end;z-index:20}
.cd-sheet{width:100%;max-height:94%;overflow:hidden;overscroll-behavior:none;background:var(--card);border-radius:26px 26px 0 0;padding:6px 20px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:cd-up .22s ease-out;scrollbar-width:none}
.cd-sheet::-webkit-scrollbar{display:none}
@keyframes cd-up{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}
.cd-dragzone{padding:4px 0 12px;touch-action:none;cursor:grab}
.cd-grab{width:40px;height:4px;border-radius:2px;background:var(--line);margin:0 auto}
.cd-shead{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.cd-x{width:36px;height:36px;border-radius:50%;background:var(--panel);display:grid;place-items:center;flex:none;color:var(--muted)}
.cd-pills{display:flex;gap:6px}
.cd-pills .cd-segbtn{flex:1;text-align:center;padding:9px 4px}
.cd-two2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cd-stitle{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:22px;margin:0;flex:1;min-width:0;overflow-wrap:anywhere}
.cd-menu button{display:flex;align-items:center;gap:12px;width:100%;padding:14px 4px;border-bottom:1px solid var(--line);text-align:left;font-weight:500}
.cd-menu button:last-child{border-bottom:0}
.cd-menu .del{color:var(--danger)}
.cd-input{width:100%;padding:12px 14px;border-radius:var(--radius-md);border:1.5px solid var(--line);background:var(--panel)}
.cd-fl{font-size:11.5px;font-weight:600;letter-spacing:.02em;color:var(--muted);margin:14px 0 5px}
.cd-primary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border-radius:var(--radius-lg);background:var(--btn-bg);color:var(--btn-ink);font-weight:700;margin-top:18px}
.cd-primary:disabled{opacity:.45;cursor:default}
.cd-ghost{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;border-radius:var(--radius-lg);background:var(--panel);font-weight:600;margin-top:10px}
.cd-themes{display:grid;gap:10px}
.cd-theme{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:var(--radius-md);background:var(--panel);text-align:left;border:2px solid transparent;width:100%}
.cd-theme.on{border-color:var(--accent)}
.cd-theme b{display:block;font-weight:600}
.cd-theme small{color:var(--muted);font-size:12.5px}
.cd-sw{display:flex;flex:none}
.cd-sw i{width:18px;height:34px;display:block}
.cd-sw i:first-child{border-radius:9px 0 0 9px}.cd-sw i:last-child{border-radius:0 9px 9px 0}
.cd-toast{position:absolute;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);background:var(--text);color:var(--card);padding:10px 18px;border-radius:var(--radius-pill);font-size:13.5px;font-weight:500;z-index:40;box-shadow:var(--shadow);max-width:88%;text-align:center;pointer-events:none;animation:cd-drop .22s ease-out}
.cd-toast.act{pointer-events:auto;display:flex;align-items:center;gap:14px;padding:7px 7px 7px 18px}
.cd-toast.act button{padding:7px 15px;border-radius:var(--radius-pill);background:var(--accent);color:var(--accent-ink);font-weight:700;font-size:13.5px;flex:none}
@keyframes cd-drop{from{transform:translate(-50%,-14px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
.cd-addrow{display:flex;gap:8px;margin-top:10px}
.cd-addrow .cd-input{flex:1}
.cd-addrow button{padding:0 16px;border-radius:var(--radius-md);background:var(--accent);color:var(--accent-ink);font-weight:600}
.cd-evebar{padding:8px 20px 12px;border-top:1px solid var(--line)}
.cd-evebtn{display:flex;align-items:center;gap:12px;width:100%;padding:11px 16px 11px 12px;border-radius:var(--radius-lg);background:var(--btn-bg);color:var(--btn-ink);text-align:left;box-shadow:var(--shadow)}
.cd-evebtn .ic{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;flex:none}
.cd-evebtn .tx{flex:1;min-width:0}
.cd-evebtn b{display:block;font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:17px;line-height:1.2}
.cd-evebtn small{display:block;opacity:.88;font-size:12.5px;margin-top:1px}
.cd-evebtn.closed{background:var(--panel);color:var(--text);box-shadow:none}
.cd-evebtn.closed .ic{background:var(--accent);color:var(--accent-ink)}
.cd-evetitle{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:25px;text-align:center;line-height:1.2;padding:22px 6px 12px;overflow-wrap:anywhere}
.cd-evegrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.cd-evego{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:14px;border-radius:var(--radius-md);background:var(--panel);text-align:left;font-weight:600}
.cd-evego small{font-weight:400;font-size:12px;color:var(--muted)}
.cd-evego svg{color:var(--accent);margin-bottom:4px}
.cd-evego.pri{background:var(--accent);color:var(--accent-ink)}
.cd-evego.pri small{color:inherit;opacity:.85}
.cd-evego.pri svg{color:inherit}
.cd-sumrow{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.cd-sumrow b{font-family:var(--font-display);font-weight:var(--display-weight);font-size:18px}
.cd-scroll.lock{overflow:hidden;touch-action:none;overscroll-behavior:none}
@media(max-height:720px){.cd-h1{font-size:28px}.cd-stack2{margin-top:12px}.cd-scroll{padding-top:12px}}
.cd-stack2{position:relative;margin-top:18px}
.cd-under{position:absolute;inset:0;background:var(--card);border-radius:var(--radius-lg);box-shadow:var(--shadow);border:1px solid var(--line);transform-origin:50% 100%;will-change:transform}
.cd-selwrap{position:relative}
.cd-select{display:block;width:100%;appearance:none;-webkit-appearance:none;padding:12px 40px 12px 14px;border-radius:var(--radius-md);border:1.5px solid var(--line);background:var(--panel);color:var(--text);font:inherit;font-weight:500;color-scheme:var(--scheme,light);cursor:pointer}
.cd-select.empty{color:var(--muted);font-weight:400}
.cd-chev{position:absolute;right:14px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--muted)}
.cd-addrow button.alt{background:var(--panel);color:var(--muted);padding:0 12px;display:grid;place-items:center}
.cd-scroll.lock{display:flex;flex-direction:column}
.cd-scroll.lock .cd-stack2{flex:1;min-height:0;margin-top:14px}
.cd-scroll.lock .cd-card{height:100%;display:flex;flex-direction:column;padding:0 16px}
.cd-scroll.lock .cd-card-title{flex:1;display:flex;align-items:center;justify-content:center;padding:18px 6px;min-height:0;overflow:hidden}
.cd-under{display:flex;flex-direction:column;padding:0 16px}
.cd-under .cd-card-title{flex:1;display:flex;align-items:center;justify-content:center;padding:18px 6px;opacity:1}
@media(max-height:720px){.cd-scroll.lock .cd-card-title{padding:12px 6px}}
.cd-headrow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cd-undo{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:var(--radius-pill);background:var(--panel);font-weight:600;font-size:13.5px;color:var(--text);flex:none}
.cd-undo:disabled{opacity:.35;cursor:default}
.cd-meta .today{color:var(--accent);font-weight:600}
.cd-focuspill{display:inline-block;padding:2px 9px;border-radius:var(--radius-pill);background:var(--accent-soft);color:var(--accent);font-weight:600;font-size:11.5px;white-space:nowrap}
.cd-group.attn{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--danger) 45%,transparent),var(--shadow)}
.cd-group.attn .cd-ghead{background:color-mix(in srgb,var(--danger) 13%,var(--card))}
.cd-gcount.warn{background:var(--danger);color:#fff}
.cd-badge.warn{background:var(--danger);color:#fff}
@media(max-height:720px){.cd-scroll.lock .cd-progress{display:none}.cd-scroll.lock .cd-sub{font-size:12.5px}.cd-undo{padding:6px 12px}}
/* Inbox control dock */
.cd-dock{flex:none;padding:4px 22px 32px}
.cd-catrow{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.cd-catrow .lbl{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:14.5px;flex:none}
.cd-catrow .cd-selwrap{flex:none;min-width:156px}
.cd-catrow .cd-addrow{flex:1;min-width:0;margin-top:0;gap:10px}
.cd-addrow .cd-input{min-width:0}
.cd-addrow button{flex:none;height:44px}
.cd-addrow button.alt{width:44px;padding:0;border-radius:50%}
.cd-catrow .cd-input{background:var(--card);box-shadow:var(--shadow);height:44px;padding-top:0;padding-bottom:0}
.cd-selwrap.pill .cd-select{border-radius:var(--radius-pill);padding:9px 38px 9px 34px;background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow);font-weight:600;font-size:15px}
.cd-selwrap.pill .cd-select.empty{font-weight:500}
.cd-selwrap.pill .dot{position:absolute;left:15px;top:50%;width:10px;height:10px;border-radius:50%;transform:translateY(-50%);pointer-events:none}
.cd-tgrid{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}
.cd-tleft{display:grid;grid-template-rows:1fr 1fr;gap:12px}
.cd-tcard{position:relative;display:block;text-align:left;border-radius:var(--radius-lg);padding:14px 14px 12px;border:1px solid var(--line);color:var(--text);min-width:0}
.cd-tcard .ic{display:block}
.cd-tcard b{display:block;font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:20px;line-height:1.1;margin-top:10px}
.cd-tcard small{display:block;color:var(--muted);font-size:12.5px;line-height:1.25;margin-top:3px}
.cd-tcard .go{position:absolute;top:11px;right:11px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--muted)}
.cd-tcard.someday{background:var(--q2-bg)}
.cd-tcard.someday .ic{color:var(--q2)}
.cd-tcard.watch{background:var(--q1-bg)}
.cd-tcard.watch .ic{color:var(--q1)}
.cd-tcard.prio{background:color-mix(in srgb,var(--q2-bg) 70%,var(--card))}
.cd-tcard.prio .ic{color:var(--q2)}
.cd-tcard.prio .go.ready{background:var(--accent);color:var(--accent-ink)}
.cd-trows{margin-top:10px;border-top:1px solid var(--line)}
.cd-trow{display:flex;align-items:center;gap:6px;padding:8px 0;color:var(--muted);font-size:13px}
.cd-trow + .cd-trow{border-top:1px solid var(--line);padding-bottom:0}
.cd-trow .lbl{flex:1;min-width:0;white-space:nowrap}
.cd-mini{display:flex;align-items:center;justify-content:space-between;gap:4px;flex:none;width:84px;border-radius:var(--radius-pill);padding:7px 9px 7px 13px;background:var(--card);border:1px solid var(--line);color:var(--muted);font-weight:500;font-size:13.5px;transition:background .15s,transform .1s}
.cd-mini:active{transform:scale(.96)}
.cd-mini.set{background:var(--q1-bg);color:var(--text);font-weight:600}
.cd-mini svg{flex:none;color:var(--muted)}
@media(max-height:760px){.cd-dock{padding:2px 20px 14px}.cd-catrow{margin-bottom:8px}.cd-tgrid,.cd-tleft{gap:8px}.cd-tcard{padding:10px 11px 8px}.cd-tcard b{font-size:17px;margin-top:6px}.cd-tcard small{display:none}.cd-tcard .go{width:26px;height:26px;top:8px;right:8px}.cd-trows{margin-top:6px}.cd-trow{padding:5px 0}.cd-mini{padding:5px 8px 5px 11px}}
.cd-tfull{position:absolute;inset:0;width:100%;border-radius:inherit;z-index:0}
.cd-tfull:active{background:color-mix(in srgb,var(--text) 6%,transparent)}
.cd-tcard.prio>*:not(.cd-tfull){position:relative;z-index:1;pointer-events:none}
.cd-tcard.prio>.go{position:absolute}
.cd-tcard.prio .cd-mini{pointer-events:auto}
.cd-tcard.prio.ready{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.cd-evehead{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cd-evecard{margin-top:12px;padding:18px 12px 16px;border-radius:var(--radius-lg);background:var(--panel);text-align:center;animation:cd-evein .42s cubic-bezier(.2,.9,.3,1.15) both}
.cd-evecard .cd-evetitle{padding:6px 6px 10px}
.cd-evecard.out{animation:none;transform:translateX(calc(var(--from,44px) * -1)) scale(.94);opacity:0;transition:transform .17s ease-in,opacity .17s ease-in}
@keyframes cd-evein{0%{opacity:0;transform:translateX(var(--from,44px)) scale(.92)}55%{opacity:1}100%{opacity:1;transform:none}}
.cd-bump{display:inline-block;animation:cd-bump .35s ease-out}
@keyframes cd-bump{0%{transform:scale(1.7);color:var(--accent);font-weight:700}100%{transform:none}}
@media(max-height:720px){.cd-sumrow{padding:6px 0}.cd-sheet .cd-hint{margin-top:6px}.cd-sheet .cd-fl{margin-top:8px}.cd-sheet .cd-primary{margin-top:12px}}
.cd-list{position:relative}
.cd-row{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.cd-row.cd-lifting{position:relative;z-index:6;background:var(--card);border-radius:var(--radius-md);box-shadow:0 12px 30px rgba(0,0,0,.2);border-bottom-color:transparent;margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px}
.cd-reorder-hint{font-size:12.5px;color:var(--muted);margin:-2px 0 4px}
@media(prefers-reduced-motion:reduce){.cd *{animation:none!important;transition:none!important}}
`;

/* ═══════════════════════════ small components ═════════════════════════════ */

function Sheet({ title, onClose, children }) {
  const [dy, setDy] = useState(0);
  const [drag, setDrag] = useState(false);
  const startY = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const down = (e) => { startY.current = e.clientY; setDrag(true); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (startY.current !== null) setDy(Math.max(0, e.clientY - startY.current)); };
  const up = () => {
    if (startY.current === null) return;
    const d = dy; startY.current = null; setDrag(false);
    if (d > 90) onClose(); else setDy(0);
  };

  return (
    <div className="cd-scrim" onClick={onClose}>
      <div className="cd-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: drag ? "none" : "transform .2s" }}>
        <div className="cd-dragzone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><div className="cd-grab" /></div>
        <div className="cd-shead">
          <h3 className="cd-stitle">{title}</h3>
          <button className="cd-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Chip({ name, catStyle }) {
  if (!name) return null;
  const [bg, fg] = catStyle(name);
  return <span className="cd-chip" style={{ background: bg, color: fg }}>{name}</span>;
}

function Check_({ done, onClick, label }) {
  return (
    <button className={"cd-check" + (done ? " on" : "")} onClick={onClick} aria-label={label}>
      {done && <Check size={15} strokeWidth={3} />}
    </button>
  );
}

function CategoryPicker({ categories, value, onChange, onAdd, placeholder = "Choose a category", pill = false, dot = null, label = null }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const rowRef = useRef(null);
  const cancel = () => { setName(""); setCreating(false); };
  const commit = () => {
    const n = name.trim();
    if (n) { onAdd(n); onChange(n); }
    cancel();
  };

  if (creating) {
    return (
      <div className="cd-addrow" ref={rowRef}>
        <input className="cd-input" autoFocus placeholder="New category name" value={name} maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          // tapping anywhere else (with nothing typed) backs out
          onBlur={(e) => { if (!name.trim() && !rowRef.current?.contains(e.relatedTarget)) cancel(); }}
          enterKeyHint="done" aria-label="New category name" />
        <button onClick={commit}>Add</button>
        <button className="alt" onClick={cancel} aria-label="Cancel new category"><X size={20} /></button>
      </div>
    );
  }

  return (
    <>
      {label && <span className="lbl">{label}</span>}
      <div className={"cd-selwrap" + (pill ? " pill" : "")}>
        {pill && dot && <i className="dot" style={{ background: dot }} />}
        <select className={"cd-select" + (value ? "" : " empty")} value={value || ""} aria-label="Category"
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__new") setCreating(true); else onChange(v || null);
          }}>
          <option value="">{placeholder}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__new">+ Create new…</option>
        </select>
        <svg className="cd-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </div>
    </>
  );
}

const ChevRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);
const Bars = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 20v-5M12 20V9M18 20V4" /></svg>
);
const FolderIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);

// A pill you tap to flip: first tap picks the first option, every tap after flips between the two.
// The up/down caret tells you it's pressable.
function MiniToggle({ value, onChange, options, label }) {
  const cur = options.find((o) => o.v === value);
  const next = !cur ? options[0] : options[(options.indexOf(cur) + 1) % options.length];
  return (
    <button type="button" className={"cd-mini" + (cur ? " set" : "")} onClick={() => onChange(next.v)}
      aria-label={`${label}: ${cur ? cur.label : "not set"}. Tap to set ${next.label}.`}>
      <span className="val">{cur ? cur.label : "Pick"}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>
    </button>
  );
}

const EFFORT_OPTS = [
  { v: "quick", label: "Quick", hint: "< 15 min", tone: "--q1" },
  { v: "deep", label: "Deep", hint: "> 15 min", tone: "--q4" },
];
const IMPACT_OPTS = [
  { v: "high", label: "High", hint: "meaningful", tone: "--q2" },
  { v: "low", label: "Low", hint: "nice to have", tone: "--q3" },
];

function Pills({ options, value, onChange }) {
  return (
    <div className="cd-pills">
      {options.map((o) => (
        <button key={o.v} className={"cd-segbtn sm" + (value === o.v ? " on" : "")} onClick={() => onChange(value === o.v ? null : o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

// Press-and-hold (touch) or click-and-drag (mouse) to reorder a list of rows.
// `ids` = current order, `onCommit(newIds)` is called on drop, `scrollRef` = the scrolling container (for auto-scroll).
function useReorder(ids, onCommit, scrollRef) {
  const [drag, setDrag] = useState(null);   // { id, dy, to } while a row is lifted
  const contRef = useRef(null);
  const st = useRef(null);                   // gesture state
  const swallow = useRef(false);             // swallow the click that follows a drop
  const idsRef = useRef(ids); idsRef.current = ids;
  const commitRef = useRef(onCommit); commitRef.current = onCommit;

  // while a row is lifted, the page must not scroll under the finger
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const block = (e) => { if (st.current && st.current.active) e.preventDefault(); };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const place = () => {
    const s = st.current;
    if (!s) return;
    const sc = scrollRef.current;
    const me = s.rects[s.idx];
    let dy = (s.lastY - s.startY) + ((sc ? sc.scrollTop : 0) - s.startScroll);
    const last = s.rects[s.rects.length - 1];
    dy = Math.max(s.rects[0].top - me.top, Math.min(last.top + last.h - (me.top + me.h), dy));
    // use the edge that leads the movement, so tall and short rows both reach the first / last slot
    let to = s.idx;
    if (dy >= 0) {
      const edge = me.top + me.h + dy;
      s.rects.forEach((r, i) => { if (i > s.idx && r.top + r.h / 2 < edge) to += 1; });
    } else {
      const edge = me.top + dy;
      s.rects.forEach((r, i) => { if (i < s.idx && r.top + r.h / 2 > edge) to -= 1; });
    }
    s.to = to;
    setDrag({ id: s.id, dy, to });
  };

  const tick = () => {
    const s = st.current;
    if (!s || !s.active) return;
    const sc = scrollRef.current;
    if (sc) {
      const r = sc.getBoundingClientRect(), edge = 70;
      let v = 0;
      if (s.lastY < r.top + edge) v = -Math.ceil((r.top + edge - s.lastY) / 6);
      else if (s.lastY > r.bottom - edge) v = Math.ceil((s.lastY - (r.bottom - edge)) / 6);
      if (v) { sc.scrollTop += v; place(); }
    }
    s.raf = requestAnimationFrame(tick);
  };

  const activate = () => {
    const s = st.current;
    if (!s || s.active) return;
    s.active = true;
    try { s.el.setPointerCapture(s.pointerId); } catch (_) { /* ignore */ }
    if (navigator.vibrate) navigator.vibrate(8);
    place();
    s.raf = requestAnimationFrame(tick);
  };

  const begin = (id, e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest(".cd-check, .cd-more, .cd-pill, .cd-swact")) return;
    const cont = contRef.current, sc = scrollRef.current;
    if (!cont) return;
    const rows = [...cont.querySelectorAll("[data-rid]")];
    const rects = rows.map((r) => ({ id: r.dataset.rid, top: r.offsetTop, h: r.offsetHeight + (parseFloat(getComputedStyle(r).marginBottom) || 0) }));
    const idx = rects.findIndex((r) => r.id === id);
    if (idx < 0) return;
    st.current = {
      id, idx, to: idx, rects, el: e.currentTarget, pointerId: e.pointerId, type: e.pointerType,
      startX: e.clientX, startY: e.clientY, lastY: e.clientY, startScroll: sc ? sc.scrollTop : 0, active: false, timer: null, raf: 0,
    };
    // touch: pick up after a short hold, so ordinary scrolling still works
    if (e.pointerType !== "mouse") st.current.timer = setTimeout(activate, 300);
  };

  const move = (e) => {
    const s = st.current;
    if (!s || e.pointerId !== s.pointerId) return;
    s.lastY = e.clientY;
    if (!s.active) {
      const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
      if (s.type === "mouse") {
        if (dist > 5) {
          if (Math.abs(e.clientY - s.startY) >= Math.abs(e.clientX - s.startX)) activate();
          else { clearTimeout(s.timer); st.current = null; }   // sideways drag: not a reorder
        }
      }
      else if (dist > 10) { clearTimeout(s.timer); st.current = null; }   // finger moved first: that's a scroll
      return;
    }
    place();
  };

  const end = (e) => {
    const s = st.current;
    if (!s || (e && e.pointerId !== s.pointerId)) return;
    clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    st.current = null;
    if (!s.active) return;
    swallow.current = true;
    setTimeout(() => { swallow.current = false; }, 80);
    setDrag(null);
    if (s.to !== s.idx) {
      const order = idsRef.current.filter((x) => x !== s.id);
      order.splice(s.to, 0, s.id);
      commitRef.current(order);
    }
  };

  const rowProps = (id) => {
    let style, cls = "";
    const s = st.current;
    if (drag && s) {
      if (drag.id === id) {
        style = { transform: `translateY(${drag.dy}px) scale(1.02)`, transition: "none" };
        cls = " cd-lifting";
      } else {
        const h = s.rects[s.idx].h, i = s.rects.findIndex((r) => r.id === id);
        let shift = 0;
        if (s.idx < drag.to && i > s.idx && i <= drag.to) shift = -h;
        else if (s.idx > drag.to && i < s.idx && i >= drag.to) shift = h;
        style = { transform: `translateY(${shift}px)`, transition: "transform .18s" };
      }
    }
    return {
      "data-rid": id, className: cls, style,
      onPointerDown: (e) => begin(id, e), onPointerMove: move, onPointerUp: end, onPointerCancel: end,
      onClickCapture: (e) => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); } },
      onContextMenu: (e) => { if (st.current) e.preventDefault(); },
    };
  };

  return { contRef, rowProps, dragging: !!drag };
}

function CatText({ name, catStyle }) {
  if (!name) return null;
  const [, fg] = catStyle(name);
  return <span className="cd-cattext" style={{ color: fg }}><i style={{ background: fg }} />{name}</span>;
}

function ItemRow({ item, ctx, trailing, hideDue = false, focusLabel = false, rowProps }) {
  const done = item.status === "done";
  const showDue = item.due && !hideDue;
  const di = item.due ? (done ? { text: fmtShort(item.due), cls: "" } : dueInfo(item.due)) : null;
  const isFocus = focusLabel && item.effort === "deep" && item.impact === "high";
  const hasMeta = item.category || showDue || isFocus;
  const { className: extraCls = "", ...rp } = rowProps || {};
  return (
    <div className={"cd-row" + (done ? " done" : "") + extraCls} {...rp}>
      <Check_ done={done} onClick={() => ctx.toggleDone(item.id)} label={done ? "Mark not done" : "Mark done"} />
      <button className="cd-row-main" onClick={() => ctx.openMenu(item.id)} aria-label={`Options for ${item.title}`}>
        <span className="cd-row-title">
          {item.title}
        </span>
        {hasMeta && (
          <span className="cd-meta">
            <CatText name={item.category} catStyle={ctx.catStyle} />
            {showDue && <span className={di.cls}>{di.text}</span>}
            {isFocus && <span className="cd-focuspill">Major focus</span>}
          </span>
        )}
      </button>
      {trailing || (
        <button className="cd-more" onClick={() => ctx.openMenu(item.id)} aria-label="More actions"><MoreHorizontal size={20} /></button>
      )}
    </div>
  );
}

/* ════════════════════════════════ TODAY ═══════════════════════════════════ */

function TodayView({ ctx, items }) {
  const [text, setText] = useState("");
  const dumpRef = useRef(null);
  // Tasks you finish during this visit stay where they were (crossed out and faded) until you leave the tab
  const shown = todaySort(items.filter((i) => i.status === "today" || (i.status === "done" && i.doneFrom === "today" && ctx.justDone.has(i.id))));
  const openCount = shown.filter((i) => i.status === "today").length;
  const scrollRef = useRef(null);
  const reorder = useReorder(shown.map((i) => i.id), ctx.reorderToday, scrollRef);
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const dump = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    lines.forEach((title) => ctx.addItem({ title, status: "inbox" }));
    setText("");
    ctx.toast(`${lines.length} ${lines.length === 1 ? "thought" : "thoughts"} sent to Inbox`);
  };

  const eveSub = ctx.cleaned
    ? "Tap to review tomorrow’s deck"
    : openCount
      ? `${openCount} still open. Sort them for tomorrow`
      : "Nothing left open. Close out the day";

  return (
    <>
    <div className="cd-scroll" ref={scrollRef}>
      <div className="cd-top">
        <div>
          <div className="cd-date">{dateStr}</div>
          <h1 className="cd-h1">Clear the deck.</h1>
          <p className="cd-sub">Capture. Choose. Do what matters.</p>
        </div>
        <button className="cd-iconbtn" onClick={() => ctx.setSheet({ type: "settings" })} aria-label="Appearance and data"><Sun size={28} strokeWidth={1.6} /></button>
      </div>

      <div className="cd-panel">
        <h3>Thought dump</h3>
        <p>Get it out of your head. One thought per line.</p>
        <div className="cd-dumprow">
          <div className="cd-dump">
            <textarea ref={dumpRef} placeholder="Type anything…" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && dump()} aria-label="Thought dump" />
          </div>
          <button data-keep-kb className={"cd-dumpbtn" + (text.trim() ? " on" : "")} onMouseDown={(e) => e.preventDefault()} onClick={text.trim() ? dump : () => dumpRef.current?.focus()}
            aria-label={text.trim() ? "Send to Inbox" : "Start typing"}>
            {text.trim() ? <ArrowRight size={28} strokeWidth={2.4} /> : <Pencil size={26} />}
            <span>{text.trim() ? "Send" : "Type"}</span>
          </button>
        </div>
      </div>

      <div className="cd-sec">
        <h2 className="cd-h2">Today’s To Do</h2>
        <button className="cd-plus" onClick={() => ctx.setSheet({ type: "edit", id: null, status: "today" })} aria-label="Add task"><Plus size={22} /></button>
      </div>

      {shown.length === 0 && (
        <div className="cd-empty"><b>The deck is clear.</b>Add a task, or pull one in from Future.</div>
      )}
      {shown.length > 1 && <div className="cd-reorder-hint">Hold and drag to reorder</div>}
      <div className="cd-list" ref={reorder.contRef}>
        {shown.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} focusLabel rowProps={reorder.rowProps(i.id)} />)}
      </div>
    </div>
    <div className="cd-evebar">
      <button className={"cd-evebtn" + (ctx.cleaned ? " closed" : "")} onClick={() => ctx.setSheet({ type: "evening" })}>
        <span className="ic">{ctx.cleaned ? <Check size={20} strokeWidth={2.5} /> : <Moon size={20} />}</span>
        <span className="tx"><b>{ctx.cleaned ? "Day closed" : "Evening Clean Up"}</b><small>{eveSub}</small></span>
        <ArrowRight size={18} />
      </button>
    </div>
    </>
  );
}

/* ════════════════════════════════ INBOX ══════════════════════════════════ */

const AUTO_SAVE = false;   // true = a card saves itself once category, effort and impact are set. Off: only the Prioritize card sorts it.

// The task is the star: big type that scales down for long titles
const inboxTitleSize = (t) => { const n = (t || "").length; return n <= 16 ? 42 : n <= 30 ? 36 : n <= 50 ? 30 : n <= 80 ? 25 : 21; };

function InboxView({ ctx, items }) {
  const [skipped, setSkipped] = useState([]);
  const [handled, setHandled] = useState(0);
  const [draft, setDraft] = useState({ category: null, effort: null, impact: null });
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | drag | exit
  const drag = useRef(null);
  const busy = useRef(false);
  const [history, setHistory] = useState([]);     // every sort, newest last, so each one can be undone
  const [front, setFront] = useState(null);       // item brought back to the top by Undo
  const pendingDraft = useRef(null);
  const noAuto = useRef(null);                    // card brought back by Undo must not auto-save straight away
  const flingRef = useRef(null);                  // always points at the latest fling (used by the keyboard handler)
  const [editing, setEditing] = useState(false);  // tapping the card text edits it in place
  const [editText, setEditText] = useState("");
  const editRef = useRef(null);
  const dragged = useRef(false);                  // true once a swipe has started, so its release isn't read as a tap

  const queue = useMemo(() => {
    const un = items.filter(isUnlabeled);
    const fresh = un.filter((i) => !skipped.includes(i.id));
    const sk = skipped.map((id) => un.find((i) => i.id === id)).filter(Boolean);
    const list = [...fresh, ...sk];
    const k = front ? list.findIndex((i) => i.id === front) : -1;
    if (k > 0) list.unshift(list.splice(k, 1)[0]);
    return list;
  }, [items, skipped, front]);
  const cur = queue[0];

  useEffect(() => {
    const pd = pendingDraft.current;
    if (pd && cur && pd.id === cur.id) { setDraft(pd.draft); pendingDraft.current = null; return; }
    setDraft({ category: cur?.category || null, effort: cur?.effort || null, impact: cur?.impact || null });
  }, [cur?.id]);

  const startEdit = () => {
    if (dragged.current || busy.current || !cur) return;
    setEditText(cur.title);
    setEditing(true);
  };
  const commitEdit = () => {
    const t = editText.trim();
    if (cur && t && t !== cur.title) ctx.patchItem(cur.id, { title: t });
    setEditing(false);
  };
  useEffect(() => { setEditing(false); }, [cur?.id]);
  // grow the box to fit the text as you type
  useEffect(() => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [editText, editing]);

  const total = queue.length + handled;
  const behind = Math.min(2, queue.length - 1);
  const complete = draft.category && draft.effort && draft.impact;

  // Each label is written to the card the moment you tap it, so partial progress survives swipes, tab changes and reloads
  const setField = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (cur) ctx.patchItem(cur.id, { [k]: v });
  };
  const snap = () => ({ category: cur.category, effort: cur.effort, impact: cur.impact, status: cur.status, someday: !!cur.someday });
  const skip = (dir = -1) => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-19), { kind: "skip", id: cur.id, dir, draft: { ...draft }, skipped }]);
    setFront(null);
    setSkipped((s) => [...s.filter((x) => x !== cur.id), cur.id]);
  };
  const save = () => {
    if (!cur) return;
    if (!complete) { ctx.toast("Pick a category, effort, and impact first"); return; }
    setHistory((h) => [...h.slice(-19), { kind: "save", id: cur.id, dir: 1, draft: { ...draft }, before: snap() }]);
    setFront(null);
    ctx.patchItem(cur.id, { ...draft, status: "future" });
    setHandled((h) => h + 1);
    ctx.toast("Saved to Future");
  };
  const watch = () => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-19), { kind: "watch", id: cur.id, dir: 0, dirY: -1, draft: { ...draft }, before: snap() }]);
    setFront(null);
    ctx.patchItem(cur.id, { status: "watching", category: draft.category || cur.category });
    setHandled((h) => h + 1);
    ctx.toast("Moved to Watching");
  };
  const park = () => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-19), { kind: "someday", id: cur.id, dir: 0, dirY: 1, draft: { ...draft }, before: snap() }]);
    setFront(null);
    ctx.patchItem(cur.id, {
      status: "future", someday: true,
      category: draft.category || cur.category, effort: draft.effort || cur.effort, impact: draft.impact || cur.impact,
    });
    setHandled((h) => h + 1);
    ctx.toast("Parked in Someday");
  };
  const del = () => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-19), { kind: "delete", id: cur.id, dir: -1, draft: { ...draft }, item: cur }]);
    setFront(null);
    ctx.removeItem(cur.id);
    ctx.toast("Deleted. Tap Undo to bring it back");
  };
  const undo = () => {
    if (busy.current || !history.length) return;
    const e = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (e.kind === "skip") setSkipped(e.skipped);
    else if (e.kind === "delete") ctx.restoreItem(e.item);
    else { ctx.patchItem(e.id, e.before); setHandled((h) => Math.max(0, h - 1)); }
    pendingDraft.current = { id: e.id, draft: e.draft };
    setFront(e.id);
    ctx.toast("Undone");
    // card flies back in from the side it left
    noAuto.current = { id: e.id, sig: JSON.stringify(e.draft) };   // don't auto-save the card we just brought back
    setPhase("drag"); setDx(e.dir * 420); setDy((e.dirY || 0) * 520);
    requestAnimationFrame(() => requestAnimationFrame(() => { setPhase("idle"); setDx(0); setDy(0); }));
  };

  // Tinder-style: a short drag OR a quick flick, in either direction, sends the card to the back of the deck.
  const DIST = 44;      // px of drag that commits on its own
  const FLICK = 0.25;   // px/ms velocity that commits a flick
  const FLICK_MIN = 12; // ...as long as the card has moved at least this far
  // Every way of finishing a card uses the same fly-away motion:
  // swipe either way (or arrow keys) → back of the deck, labels done → right, Someday → down, Watch → up
  const fling = (kind, dir = -1) => {
    if (busy.current || !cur) return;
    if (kind === "save" && !complete) {
      ctx.toast("Pick a category, effort, and impact first");
      setPhase("idle"); setDx(0);
      return;
    }
    busy.current = true;
    setPhase("exit");
    if (kind === "save") setDx(480); else if (kind === "skip") setDx(dir * 480);
    else if (kind === "del") setDx(-480);
    else if (kind === "park") setDy(520); else setDy(-520);
    setTimeout(() => {
      setPhase("drag"); setDx(0); setDy(0);   // new card appears in place, no slide-back
      ({ save, skip, park, watch, del })[kind](dir);
      busy.current = false;
      requestAnimationFrame(() => setPhase("idle"));
    }, 190);
  };
  flingRef.current = fling;

  // Keyboard: ← or → sends the card to the back (when you're not typing in a field).
  // Subscribed once; it always calls the latest fling through the ref.
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") flingRef.current("skip", -1);
      if (e.key === "ArrowRight") flingRef.current("skip", 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Labels done → the card saves itself (Undo is the safety net). Change your mind within the beat and it waits.
  useEffect(() => {
    if (!AUTO_SAVE || !complete || !cur || busy.current) return;
    const na = noAuto.current;
    if (na && na.id === cur.id && na.sig === JSON.stringify(draft)) return;
    noAuto.current = null;
    const t = setTimeout(() => flingRef.current("save"), 450);
    return () => clearTimeout(t);
  }, [draft.category, draft.effort, draft.impact, cur?.id]);

  const onDown = (e) => {
    if (busy.current || editing) return;
    dragged.current = false;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false, samples: [{ t: performance.now(), x: e.clientX }] };
  };
  const onMove = (e) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x, my = e.clientY - g.y;
    if (!g.active) {
      if (Math.abs(mx) < 5 && Math.abs(my) < 5) return;
      if (Math.abs(my) > Math.abs(mx) * 1.3) { drag.current = null; return; }
      g.active = true;
      dragged.current = true;
      setPhase("drag");
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    const now = performance.now();
    g.samples.push({ t: now, x: e.clientX });
    while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift();
    setDx(mx);
  };
  const onUp = (e) => {
    const g = drag.current;
    drag.current = null;
    if (!g || !g.active) return;
    const s0 = g.samples[0], s1 = g.samples[g.samples.length - 1];
    const stale = performance.now() - s1.t > 80;   // finger paused before release: not a flick
    const v = !stale && s1.t > s0.t ? (s1.x - s0.x) / (s1.t - s0.t) : 0;   // px/ms, signed
    const dir = dx > 0 ? 1 : -1;
    const flicked = Math.abs(v) > FLICK && Math.sign(v) === dir && Math.abs(dx) > FLICK_MIN;
    if (Math.abs(dx) > DIST || flicked) fling("skip", dir);
    else { setPhase("idle"); setDx(0); }
  };

  if (!cur) {
    return (
      <div className="cd-scroll">
        <div className="cd-headrow">
          <h1 className="cd-h1">Inbox</h1>
          <button className="cd-undo" onClick={undo} disabled={!history.length} aria-label="Undo last sort"><RotateCcw size={15} /> Undo</button>
        </div>
        <div className="cd-empty" style={{ marginTop: 56 }}>
          <Inbox size={34} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: 10 }} />
          <b>All sorted.</b>Nothing is waiting for a label. Use the thought dump on Today to capture more.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cd-scroll lock">
        <div className="cd-headrow">
          <h1 className="cd-h1">Inbox</h1>
          <button className="cd-undo" onClick={undo} disabled={!history.length} aria-label="Undo last sort"><RotateCcw size={15} /> Undo</button>
        </div>
        <p className="cd-sub">{queue.length} {queue.length === 1 ? "card" : "cards"} left · swipe to send to the back</p>
        <div className="cd-progress"><i style={{ width: `${(handled / total) * 100}%` }} /></div>

        <div className="cd-stack2" style={{ marginBottom: behind * 10 }}>
          {[2, 1].filter((n) => n <= behind).map((n) => {
            const k = phase === "exit" ? n - 1 : n;   // cards behind step forward as the top card leaves
            return (
              <div key={n} className="cd-under" aria-hidden="true" style={{
                transform: `translateY(${k * 10}px) scale(${1 - k * 0.045})`,
                transition: phase === "drag" ? "none" : "transform .19s ease-out",
              }}>
                {n === 1 && queue[1] && (
                  <div className="cd-card-title" style={{ fontSize: inboxTitleSize(queue[1].title) }}>{queue[1].title}</div>
                )}
              </div>
            );
          })}
          <div className="cd-card"
            style={{
              transform: `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`,
              transition: phase === "drag" ? "none" : phase === "exit" ? "transform .19s ease-in" : "transform .25s cubic-bezier(.2,.8,.2,1)",
            }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {editing ? (
              <div className="cd-card-title">
                <textarea ref={editRef} className="cd-card-edit" rows={1} autoFocus value={editText} maxLength={200}
                  style={{ "--edit-size": inboxTitleSize(editText) + "px" }}
                  onChange={(e) => setEditText(e.target.value)} onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
                  enterKeyHint="done" aria-label="Card text" />
              </div>
            ) : (
              <div className="cd-card-title" style={{ fontSize: inboxTitleSize(cur.title), cursor: "text" }} onClick={startEdit}>{cur.title}</div>
            )}
            <button className="cd-cardact" onPointerDown={(e) => e.stopPropagation()} onClick={() => fling("del")} aria-label="Delete card"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>
      <div className="cd-dock">
        <div className="cd-catrow">
          <CategoryPicker pill label={<><FolderIcon /> Category</>} categories={ctx.categories} value={draft.category}
            dot={draft.category ? ctx.catStyle(draft.category)[1] : null}
            onChange={(c) => setField("category", c)} onAdd={ctx.addCategory} />
        </div>
        <div className="cd-tgrid">
          <div className={"cd-tcard prio" + (complete ? " ready" : "")}>
            {/* the whole card is the sort button; the Effort / Impact toggles sit on top of it */}
            <button className="cd-tfull" onClick={() => fling("save")} aria-label="Sort this card into Future" />
            <Bars />
            <span className={"go" + (complete ? " ready" : "")}><ChevRight /></span>
            <b>Prioritize</b><small>Add to actionable tasks</small>
            <div className="cd-trows">
              <div className="cd-trow"><Zap size={18} /><span className="lbl">Effort</span>
                <MiniToggle label="Effort" value={draft.effort} onChange={(v) => setField("effort", v)} options={EFFORT_OPTS} /></div>
              <div className="cd-trow"><Bars size={18} /><span className="lbl">Impact</span>
                <MiniToggle label="Impact" value={draft.impact} onChange={(v) => setField("impact", v)} options={IMPACT_OPTS} /></div>
            </div>
          </div>
          <div className="cd-tleft">
            <button className="cd-tcard someday" onClick={() => fling("park")}>
              <Sparkles size={26} className="ic" />
              <span className="go"><ChevRight /></span>
              <b>Someday</b><small>Save for later</small>
            </button>
            <button className="cd-tcard watch" onClick={() => fling("watch")}>
              <Eye size={26} className="ic" />
              <span className="go"><ChevRight /></span>
              <b>Watch it</b><small>Track this</small>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════ FUTURE ═══════════════════════════════════ */

function FutureView({ ctx, items }) {
  const [mode, setMode] = useState("matrix");
  const [cat, setCat] = useState("All");
  const base = items.filter((i) => (i.status === "future" || (i.status === "done" && i.doneFrom === "future" && ctx.justDone.has(i.id))) && (cat === "All" || i.category === cat));
  const todayStr = iso();
  const attn = base.filter((i) => !i.someday && i.due && i.due < todayStr).sort((a, b) => a.due.localeCompare(b.due));
  const attnIds = new Set(attn.map((i) => i.id));
  const matrixItems = base.filter((i) => !i.someday && i.effort && i.impact && !attnIds.has(i.id));
  const calItems = base.filter((i) => !i.someday && i.due).sort((a, b) => a.due.localeCompare(b.due));
  const somedayItems = base.filter((i) => i.someday);
  const undated = base.filter((i) => i.status === "future" && !i.someday && !i.due).length;

  const toToday = (i) => i.status === "done" ? null : (
    <button className="cd-pill" onClick={() => { ctx.moveToToday(i.id); ctx.toast("Moved to Today"); }}>
      <ArrowRight size={12} /> Today
    </button>
  );

  const calGroups = [];
  calItems.forEach((i) => {
    const last = calGroups[calGroups.length - 1];
    if (last && last.due === i.due) last.list.push(i); else calGroups.push({ due: i.due, list: [i] });
  });
  const dayLabel = (d) => {
    const t = iso();
    if (d < t) return "Overdue · " + fmtShort(d);
    if (d === t) return "Today";
    if (d === offsetDay(1)) return "Tomorrow";
    return fmtShort(d);
  };

  return (
    <div className="cd-scroll">
      <h1 className="cd-h1">Future</h1>
      <p className="cd-sub">Everything not for today.</p>

      <div className="cd-seg">
        {[["matrix", "Matrix"], ["calendar", "Calendar"], ["someday", "Someday"]].map(([k, l]) => (
          <button key={k} className={"cd-segbtn" + (mode === k ? " on" : "")} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <CategoryPicker categories={ctx.categories} value={cat === "All" ? null : cat}
          onChange={(c) => setCat(c || "All")} onAdd={ctx.addCategory} placeholder="All categories" />
      </div>

      {mode === "matrix" && (
        <>
          {attn.length > 0 && (
            <div className="cd-group attn">
              <div className="cd-ghead">
                <AlertCircle size={22} style={{ color: "var(--danger)", flex: "none" }} />
                <div>
                  <div className="t">Needs attention</div>
                  <div className="s">Past due. Sort these out first.</div>
                </div>
                <span className="cd-gcount warn">{attn.length}</span>
              </div>
              <div className="cd-gbody">
                {attn.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} trailing={toToday(i)} />)}
              </div>
            </div>
          )}
          {QUADS.map(({ key, n, title, sub, Icon }) => {
            const list = matrixItems.filter((i) => quadOf(i) === key);
            if (!list.length) return null;
            return (
              <div className="cd-group" key={key}>
                <div className="cd-ghead" style={{ background: `var(--q${n}-bg)` }}>
                  <Icon size={22} style={{ color: `var(--q${n})`, flex: "none" }} />
                  <div><div className="t">{title}</div><div className="s">{sub}</div></div>
                  <span className="cd-gcount">{list.length}</span>
                </div>
                <div className="cd-gbody">
                  {list.map((i) => (
                    <ItemRow key={i.id} item={i} ctx={ctx} trailing={toToday(i)} />
                  ))}
                </div>
              </div>
            );
          })}
          {matrixItems.length === 0 && attn.length === 0 && <div className="cd-empty"><b>Nothing sorted here yet.</b>Sort items in your Inbox and they land here.</div>}
        </>
      )}

      {mode === "calendar" && (
        <>
          {calGroups.map((g) => (
            <div key={g.due}>
              <div className="cd-datehead" style={g.due < iso() ? { color: "var(--danger)" } : undefined}>{dayLabel(g.due)}</div>
              {g.list.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} trailing={toToday(i)} hideDue />)}
            </div>
          ))}
          {calGroups.length === 0 && <div className="cd-empty"><b>No dates set.</b>Add a due date from an item’s menu to see it here.</div>}
          {undated > 0 && calGroups.length > 0 && <div className="cd-hint" style={{ marginTop: 22 }}>{undated} future {undated === 1 ? "item has" : "items have"} no date.</div>}
        </>
      )}

      {mode === "someday" && (
        <div style={{ marginTop: 8 }}>
          {somedayItems.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} trailing={toToday(i)} />)}
          {somedayItems.length === 0 && <div className="cd-empty"><b>Someday is empty.</b>Park ideas here from your Inbox, or from an item’s menu.</div>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ WATCHING ═════════════════════════════════ */

function WatchGroup({ g, ctx, scrollRef, onSent }) {
  const reorder = useReorder(g.items.map((i) => i.id), ctx.reorderWatching, scrollRef);
  const color = g.name ? ctx.catStyle(g.name)[1] : "var(--muted)";
  const open = g.items.filter((i) => i.status === "watching").length;
  const swipe = useRef(null);
  const leaving = useRef(false);
  const justSwiped = useRef(false);     // the click that follows a swipe is not a tap
  const [sw, setSw] = useState(null);       // while a card is moving: { id, x, mode: "drag" | "fly" | "collapse", armed, h }
  const [openId, setOpenId] = useState(null); // the card resting open, showing its Inbox button

  // Same idea as Apple Mail: a short swipe reveals the button and the card rests open;
  // a long swipe (past "full") sends it straight away.
  const ACTION_W = 88;                                           // width of the revealed button
  const fullAt = (w) => Math.max(ACTION_W * 2, w * 0.55);        // how far counts as a full swipe

  // tapping elsewhere, or scrolling, closes the open card
  useEffect(() => {
    if (!openId) return;
    const onDown = (e) => {
      if (e.target.closest && e.target.closest(`[data-rid="${openId}"]`)) return;
      setOpenId(null);
    };
    const sc = scrollRef.current;
    const onScroll = () => setOpenId(null);
    document.addEventListener("pointerdown", onDown, true);
    if (sc) sc.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      if (sc) sc.removeEventListener("scroll", onScroll);
    };
  }, [openId]);

  // card slides off, the gap closes, then it lands in Inbox with an Undo toast
  const sortToInbox = (item, el) => {
    if (leaving.current) return;
    leaving.current = true;
    const w = el ? el.offsetWidth : 400, h = el ? el.offsetHeight : 60;
    setOpenId(null);
    setSw({ id: item.id, x: -w, mode: "fly", armed: true, h });
    setTimeout(() => setSw({ id: item.id, x: -w, mode: "collapse", armed: true, h }), 200);
    setTimeout(() => {
      ctx.patchItem(item.id, { status: "inbox", effort: null, impact: null });   // back to Inbox to get its effort and impact
      onSent(item);   // the Undo button at the top of the page remembers it
      setSw(null);
      leaving.current = false;
    }, 440);
  };

  const endSwipe = (e, cancelled) => {
    const s = swipe.current;
    if (!s || s.pid !== e.pointerId) return;
    swipe.current = null;
    if (!s.on) return;
    justSwiped.current = true;
    setTimeout(() => { justSwiped.current = false; }, 120);
    const a = s.samples[0], b = s.samples[s.samples.length - 1];
    const stale = performance.now() - b.t > 80;
    const v = !stale && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;   // px/ms, negative = leftward
    if (!cancelled && (s.x <= -fullAt(s.w) || (v < -0.9 && s.x < -ACTION_W))) { sortToInbox(s.item, s.el); return; }
    const rest = cancelled ? s.base < 0 : v < -0.3 ? true : v > 0.3 ? false : s.x < -ACTION_W / 2;
    setOpenId(rest ? s.id : null);   // rests open, or eases closed
    setSw(null);
  };

  // Wraps the reorder handlers so one row can be held-and-dragged (reorder) or swiped (Inbox)
  const rowEvents = (i, rp) => ({
    ...rp,
    onClickCapture: (e) => {
      if (justSwiped.current) { e.stopPropagation(); e.preventDefault(); return; }
      if (openId === i.id && !e.target.closest(".cd-swact")) { e.stopPropagation(); e.preventDefault(); setOpenId(null); return; }   // tapping an open card closes it
      rp.onClickCapture(e);
    },
    onPointerDown: (e) => {
      rp.onPointerDown(e);
      if (i.status === "done" || leaving.current || e.target.closest(".cd-check, .cd-more, .cd-swact")) return;
      const el = e.currentTarget;
      swipe.current = {
        item: i, id: i.id, el, w: el.offsetWidth, base: openId === i.id ? -ACTION_W : 0,
        x: 0, armed: false, on: false, pid: e.pointerId, sx: e.clientX, sy: e.clientY,
        samples: [{ t: performance.now(), x: e.clientX }],
      };
    },
    onPointerMove: (e) => {
      rp.onPointerMove(e);
      const s = swipe.current;
      if (!s || s.pid !== e.pointerId) return;
      if (reorder.dragging) { swipe.current = null; return; }
      const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
      if (!s.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { swipe.current = null; return; }   // vertical: scrolling
        const horizontal = Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5;
        if (horizontal && (dx < 0 || s.base < 0)) {
          s.on = true;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        } else return;
      }
      const now = performance.now();
      s.samples.push({ t: now, x: e.clientX });
      while (s.samples.length > 2 && now - s.samples[0].t > 100) s.samples.shift();
      s.x = Math.max(-s.w, Math.min(0, s.base + dx));
      const armed = s.x <= -fullAt(s.w);
      if (armed !== s.armed) { s.armed = armed; if (armed && navigator.vibrate) navigator.vibrate(12); }   // the "click" when it becomes a full swipe
      setSw({ id: s.id, x: s.x, mode: "drag", armed });
    },
    onPointerUp: (e) => { rp.onPointerUp(e); endSwipe(e, false); },
    onPointerCancel: (e) => { rp.onPointerCancel(e); endSwipe(e, true); },
  });

  return (
    <section aria-label={g.name || "No category"}>
      <div className="cd-gh">
        <i style={{ background: color }} />
        <span style={{ color }}>{g.name || "No category"}</span>
        <span className="n">{open}</span>
      </div>
      <div className="cd-list" ref={reorder.contRef}>
        {g.items.map((i) => {
          const done = i.status === "done";
          const { className: extra = "", style: rstyle, ...rp } = reorder.rowProps(i.id);
          const mine = sw && sw.id === i.id ? sw : null;
          const isOpen = openId === i.id;
          const x = mine ? mine.x : isOpen ? -ACTION_W : 0;
          const exposed = -x;
          const reveal = Math.max(0, Math.min(1, exposed / ACTION_W));
          const PILL = 48;
          const dragging = mine && mine.mode === "drag";
          const rowStyle = x ? { transform: `translateX(${x}px)`, transition: dragging ? "none" : mine ? "transform .2s ease-in" : undefined } : undefined;
          const wrapStyle = {
            ...rstyle,
            ...(mine && mine.mode === "fly" ? { height: mine.h } : null),
            ...(mine && mine.mode === "collapse"
              ? { height: 0, marginBottom: 0, opacity: 0, overflow: "hidden", transition: "height .22s ease-out, margin-bottom .22s ease-out, opacity .22s" }
              : null),
          };
          return (
            <div key={i.id} className={"cd-swrap" + extra} style={wrapStyle} {...rowEvents(i, rp)}>
              {!done && (
                <button className={"cd-swact" + (mine || isOpen ? " on" : "") + (mine && mine.armed ? " armed" : "")} tabIndex={-1} aria-label="Send to Inbox"
                  onClick={(e) => sortToInbox(i, e.currentTarget.parentElement)}>
                  {/* grows from a small circle into a pill that follows the card, label underneath */}
                  <span className="cd-swcol" style={{
                    width: exposed > ACTION_W ? PILL + (exposed - ACTION_W) : PILL,
                    opacity: reveal,
                    transform: `scale(${0.55 + 0.45 * reveal})`,
                    transition: dragging ? "none" : "width .2s ease-in, opacity .2s, transform .2s",
                  }}>
                    <span className="cd-swpill"><Inbox size={22} /></span>
                    <span className="cd-swlbl" style={{ opacity: exposed > ACTION_W * 1.5 ? 0 : reveal }}>Inbox</span>
                  </span>
                </button>
              )}
              <div className={"cd-row cd-wrow" + (done ? " done" : "") + (mine || isOpen ? " swiping" : "")} style={rowStyle}>
                <Check_ done={done} onClick={() => ctx.toggleDone(i.id)} label={done ? "Mark not done" : "Mark done"} />
                <button className="cd-row-main" onClick={() => ctx.openMenu(i.id)} aria-label={`Options for ${i.title}`}>
                  <span className="cd-row-title">{i.title}</span>
                </button>
                <button className="cd-more" onClick={() => ctx.openMenu(i.id)} aria-label="More actions"><MoreHorizontal size={20} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WatchingView({ ctx, items }) {
  const scrollRef = useRef(null);
  const [history, setHistory] = useState([]);   // cards sent to Inbox from here, newest last, so each can be undone
  const onSent = (item) => setHistory((h) => [...h.slice(-19), item]);
  const undo = () => {
    if (!history.length) return;
    const it = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    ctx.patchItem(it.id, { status: "watching", effort: it.effort, impact: it.impact, wpos: it.wpos });   // back where it was
  };
  // items you check off stay (faded) until you leave the tab, like on Today
  const list = items
    .filter((i) => i.status === "watching" || (i.status === "done" && i.doneFrom === "watching" && ctx.justDone.has(i.id)))
    .sort((a, b) => (a.wpos ?? 1e9) - (b.wpos ?? 1e9));
  // grouped by category, in your category order; anything uncategorized goes last
  const known = new Set(ctx.categories);
  const groups = [...ctx.categories, null]
    .map((name) => ({ name, items: list.filter((i) => (i.category && known.has(i.category) ? i.category : null) === name) }))
    .filter((g) => g.items.length);
  return (
    <div className="cd-host">
    <div className="cd-scroll" ref={scrollRef} style={{ paddingBottom: 110 }}>
      <div className="cd-top">
        <div>
          <h1 className="cd-h1">Watching</h1>
          <p className="cd-sub">Items to keep an eye on.</p>
        </div>
      </div>
      {groups.some((g) => g.items.length > 1) && <div className="cd-reorder-hint" style={{ marginTop: 8 }}>Swipe left for Inbox · hold and drag to reorder</div>}
      <div style={{ marginTop: 6 }}>
        {groups.map((g) => <WatchGroup key={g.name || "none"} g={g} ctx={ctx} scrollRef={scrollRef} onSent={onSent} />)}
        {list.length === 0 && <div className="cd-empty"><b>Nothing to watch.</b>Mark an item as Watching from your Inbox, or add one here.</div>}
      </div>
    </div>
    {/* floats over the list so they're always in reach while scrolling */}
    <div className="cd-float">
      <button className="cd-undo" onClick={undo} disabled={!history.length} aria-label="Undo last send to Inbox"><RotateCcw size={16} /> Undo</button>
      <button className="cd-plus" onClick={() => ctx.setSheet({ type: "edit", id: null, status: "watching" })} aria-label="Add watched item"><Plus size={26} /></button>
    </div>
    </div>
  );
}

/* ══════════════════════════════ DASHBOARD ═════════════════════════════════ */

function Donut({ segs, total }) {
  const r = 40, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" width="130" height="130" style={{ flex: "none" }} role="img" aria-label={`${total} items in the matrix`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--panel)" strokeWidth="16" />
      {total > 0 && segs.map((s) => {
        const len = (s.count / total) * c;
        const el = (
          <circle key={s.key} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="16"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />
        );
        acc += len;
        return s.count ? el : null;
      })}
      <text x="50" y="49" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--text)" style={{ fontFamily: "var(--font-display)" }}>{total}</text>
      <text x="50" y="62" textAnchor="middle" fontSize="8" fill="var(--muted)">items</text>
    </svg>
  );
}

function DashboardView({ ctx, items }) {
  const t = iso();
  const open = items.filter((i) => i.status !== "done");
  const finished = items.filter((i) => i.status === "done" && isToday(i.doneAt)).length;
  const dueToday = open.filter((i) => i.due === t).length;
  const overdue = open.filter((i) => i.due && i.due < t).length;
  const future = open.filter((i) => i.status === "future").length;
  const watching = open.filter((i) => i.status === "watching").length;

  const focus = items.filter((i) => i.effort === "deep" && i.impact === "high" &&
    (i.status === "today" || (i.status === "done" && i.doneFrom === "today" && isToday(i.doneAt))));
  const focusDone = focus.filter((i) => i.status === "done").length;

  const byCat = ctx.categories.map((c) => ({ name: c, count: open.filter((i) => i.category === c).length })).filter((c) => c.count > 0);
  const uncat = open.filter((i) => !i.category).length;
  if (uncat) byCat.push({ name: "Unsorted", count: uncat });
  byCat.sort((a, b) => b.count - a.count);
  const maxCat = Math.max(1, ...byCat.map((c) => c.count));

  const matrix = items.filter((i) => (i.status === "future" || i.status === "today") && i.effort && i.impact);   // open Today + Future items that have both labels
  const segs = QUADS.map((q) => ({ key: q.key, title: q.title, color: `var(--q${q.n})`, count: matrix.filter((i) => quadOf(i) === q.key).length }));
  const quadLabel = { "quick-high": "Quick + High", "deep-high": "Deep + High", "quick-low": "Quick + Low", "deep-low": "Deep + Low" };

  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const Stat = ({ n, l, cls }) => <div className={"cd-stat " + (cls || "")}><b>{n}</b><span>{l}</span></div>;

  return (
    <div className="cd-scroll">
      <h1 className="cd-h1">Dashboard</h1>
      <p className="cd-sub">Your big picture.</p>

      <div className="cd-card-d">
        <div className="hd"><h2 className="cd-h2" style={{ fontSize: 18 }}>Momentum</h2><span>Today, {dateStr}</span></div>
        <div className="cd-stats">
          <Stat n={finished} l="Finished today" />
          <Stat n={dueToday} l="Due today" cls="hot" />
          <Stat n={overdue} l="Overdue" cls={overdue ? "warn" : ""} />
          <Stat n={future} l="In Future" />
          <Stat n={watching} l="In Watching" />
          <Stat n={open.length} l="Total open" />
        </div>
      </div>

      <div className="cd-card-d">
        <h2 className="cd-h2" style={{ fontSize: 18, marginBottom: 12 }}>Today Focus</h2>
        {focus.length ? (
          <div className="cd-focus">
            <div className="n">{focusDone}/{focus.length}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5 }}>Major focus tasks</div>
              <div className="cd-bar"><i style={{ width: `${(focusDone / focus.length) * 100}%`, background: "var(--accent)" }} /></div>
              {focus.length > 2 && <div className="cd-sub" style={{ fontSize: 12.5 }}>That’s a lot. Try keeping it to 1–2.</div>}
            </div>
          </div>
        ) : (
          <div className="cd-sub">No major focus tasks today. Mark a deep, high-impact task for Today to track it here.</div>
        )}
      </div>

      <div className="cd-card-d">
        <h2 className="cd-h2" style={{ fontSize: 18, marginBottom: 6 }}>Open Items by Category</h2>
        {byCat.map((c) => {
          const fg = c.name === "Unsorted" ? "var(--muted)" : ctx.catStyle(c.name)[1];
          return (
            <div className="cd-cat" key={c.name}>
              <span className="cd-cattext" style={{ color: fg }}><i style={{ background: fg }} />{c.name}</span>
              <div className="tr"><i style={{ width: `${(c.count / maxCat) * 100}%`, background: fg, opacity: 0.7 }} /></div>
              <em>{c.count}</em>
            </div>
          );
        })}
        {byCat.length === 0 && <div className="cd-sub">Nothing open. The deck is clear.</div>}
      </div>

      <div className="cd-card-d">
        <h2 className="cd-h2" style={{ fontSize: 18, marginBottom: 12 }}>Matrix</h2>
        <div className="cd-donut">
          <Donut segs={segs} total={matrix.length} />
          <div className="cd-legend">
            {segs.map((s) => <div key={s.key}><i style={{ background: s.color }} />{quadLabel[s.key]}<em>{s.count}</em></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ SHEETS ═══════════════════════════════════ */

function ItemMenu({ ctx, item, close }) {
  const act = (fn, msg) => () => { fn(); close(); if (msg) ctx.toast(msg); };
  const p = (patch, msg) => act(() => ctx.patchItem(item.id, patch), msg);
  const rows = [];
  const done = item.status === "done";
  if (!done && item.status !== "watching") rows.push({ Icon: Calendar, label: "Edit date", run: () => ctx.setSheet({ type: "date", id: item.id }) });
  if (item.status !== "today" && item.status !== "watching" && !done) rows.push({ Icon: ArrowRight, label: "Move to Today", run: act(() => ctx.moveToToday(item.id), "Moved to Today") });
  if (item.status === "today") rows.push({ Icon: ArrowUp, label: "Move to top", run: act(() => ctx.moveToTop(item.id), "Moved to the top") });
  if (item.status === "today") rows.push({ Icon: CalendarDays, label: "Move to Future", run: p({ status: "future" }, "Moved to Future") });
  if (item.status === "future" && !item.someday) rows.push({ Icon: Sparkles, label: "Move to Someday", run: p({ someday: true }, "Parked in Someday") });
  if (item.status === "future" && item.someday) rows.push({ Icon: Sparkles, label: "Move out of Someday", run: p({ someday: false }, "Back in the matrix") });
  if (item.status === "today" || item.status === "future") rows.push({ Icon: Eye, label: "Mark as Watching", run: p({ status: "watching", someday: false }, "Moved to Watching") });
  if (item.status === "watching") rows.push({ Icon: LayoutGrid, label: "Send to Inbox", run: p({ status: "inbox", effort: null, impact: null }, "Sent to Inbox") });
  if (done) rows.push({ Icon: RotateCcw, label: "Restore", run: act(() => ctx.toggleDone(item.id), "Restored") });
  rows.push({ Icon: Pencil, label: "Edit details", run: () => ctx.setSheet({ type: "edit", id: item.id }) });
  rows.push({ Icon: Trash2, label: "Delete", cls: "del", run: act(() => ctx.removeItem(item.id), "Deleted") });
  return (
    <Sheet title={item.title} onClose={close}>
      <div className="cd-menu">
        {rows.map(({ Icon, label, run, cls }) => (
          <button key={label} className={cls} onClick={run}><Icon size={20} /> {label}</button>
        ))}
      </div>
    </Sheet>
  );
}

function DateEditor({ ctx, item, close }) {
  const [due, setDue] = useState(item.due || "");
  const save = () => { if (!due) return; ctx.patchItem(item.id, { due }); close(); ctx.toast("Date saved"); };
  const quick = [["Today", offsetDay(0)], ["Tomorrow", offsetDay(1)], ["Next week", offsetDay(7)]];
  return (
    <Sheet title="Edit date" onClose={close}>
      <div className="cd-sub" style={{ marginBottom: 12, overflowWrap: "anywhere" }}>{item.title}</div>
      <div className="cd-pills">
        {quick.map(([l, d]) => (
          <button key={l} className={"cd-segbtn sm" + (due === d ? " on" : "")} onClick={() => setDue(d)}>{l}</button>
        ))}
      </div>
      <div className="cd-fl">Due date</div>
      <input className="cd-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
      <button className="cd-primary" disabled={!due} onClick={save}>Save date</button>
      {item.due && <button className="cd-ghost" onClick={() => { ctx.patchItem(item.id, { due: null }); close(); ctx.toast("Date cleared"); }}>Clear date</button>}
    </Sheet>
  );
}

function Editor({ ctx, item, initialStatus, close }) {
  const [d, setD] = useState(() => ({
    title: item?.title || "", category: item?.category || null, effort: item?.effort || null,
    impact: item?.impact || null, due: item?.due || "", status: item?.status || initialStatus || "today",
  }));
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const save = () => {
    const title = d.title.trim();
    if (!title) return;
    const payload = { ...d, title, due: d.status === "watching" ? null : (d.due || null) };
    if (item) ctx.patchItem(item.id, payload); else ctx.addItem(payload);
    close();
    ctx.toast(item ? "Saved" : "Added");
  };
  const needsInbox = d.status === "future" && (!d.category || !d.effort || !d.impact);
  return (
    <Sheet title={item ? "Edit item" : "New item"} onClose={close}>
      <input className="cd-input" placeholder="What needs doing?" value={d.title}
        onChange={(e) => set("title", e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { if (d.title.trim()) save(); else e.currentTarget.blur(); } }}
        enterKeyHint="done" aria-label="Item title" />
      <div className="cd-fl">Goes to</div>
      <div className="cd-pills">
        {[["today", "Today"], ["future", "Future"], ["watching", "Watching"]].map(([v, l]) => (
          <button key={v} className={"cd-segbtn sm" + (d.status === v ? " on" : "")} onClick={() => set("status", v)}>{l}</button>
        ))}
      </div>
      <div className="cd-fl">Category</div>
      <CategoryPicker categories={ctx.categories} value={d.category} onChange={(c) => set("category", c)} onAdd={ctx.addCategory} />
      {d.status !== "watching" && (
        <div className="cd-two2">
          <div><div className="cd-fl">Effort</div><Pills options={EFFORT_OPTS} value={d.effort} onChange={(v) => set("effort", v)} /></div>
          <div><div className="cd-fl">Impact</div><Pills options={IMPACT_OPTS} value={d.impact} onChange={(v) => set("impact", v)} /></div>
        </div>
      )}
      {d.status !== "watching" && (
        <>
          <div className="cd-fl">Due date</div>
          <input className="cd-input" type="date" value={d.due} onChange={(e) => set("due", e.target.value)} aria-label="Due date" />
        </>
      )}
      <button className="cd-primary" disabled={!d.title.trim()} onClick={save}>{item ? "Save changes" : "Add item"}</button>
      {needsInbox && <div className="cd-hint" style={{ marginTop: 10 }}>Unlabeled items wait in Inbox.</div>}
    </Sheet>
  );
}

function Evening({ ctx, items, close }) {
  const [queue] = useState(() => todaySort(items.filter((i) => i.status === "today")).map((i) => i.id));
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState({ tomorrow: 0, future: 0, watching: 0 });
  const [history, setHistory] = useState([]);   // every choice, so each can be undone
  const [leaving, setLeaving] = useState(false);
  const [enterFrom, setEnterFrom] = useState(1); // 1 = new card slides in from the right, -1 = undo brings it back from the left

  const finished = items.filter((i) => i.status === "done" && isToday(i.doneAt)).length;
  const inFlow = idx < queue.length;
  const cur = inFlow ? items.find((i) => i.id === queue[idx]) : null;

  // If an item vanished mid-flow, skip past it
  useEffect(() => { if (inFlow && !cur) setIdx((i) => i + 1); }, [inFlow, cur]);

  const choose = (kind) => {
    if (!cur || leaving) return;
    const before = { status: cur.status, due: cur.due, someday: cur.someday, doneAt: cur.doneAt, doneFrom: cur.doneFrom };
    const id = cur.id, at = idx;
    setLeaving(true);                       // the card slides away first...
    setTimeout(() => {                      // ...then the next one arrives
      if (kind === "done") ctx.toggleDone(id);
      if (kind === "future") ctx.patchItem(id, { status: "future" });
      if (kind === "watching") ctx.patchItem(id, { status: "watching" });
      if (kind !== "done") setLog((l) => ({ ...l, [kind]: l[kind] + 1 }));
      setHistory((h) => [...h, { kind, id, before, idxBefore: at }]);
      setEnterFrom(1);
      setIdx(at + 1);
      setLeaving(false);
    }, 170);
  };
  const keepRest = () => {
    if (leaving) return;
    const n = queue.length - idx;
    setHistory((h) => [...h, { kind: "rest", n, idxBefore: idx }]);
    setLog((l) => ({ ...l, tomorrow: l.tomorrow + n }));
    setIdx(queue.length);
  };
  const undo = () => {
    if (leaving || !history.length) return;
    const e = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (e.id) ctx.patchItem(e.id, e.before);                                    // put the task back as it was
    if (e.kind === "rest") setLog((l) => ({ ...l, tomorrow: l.tomorrow - e.n }));
    else if (e.kind !== "done") setLog((l) => ({ ...l, [e.kind]: l[e.kind] - 1 }));
    setEnterFrom(-1);
    setIdx(e.idxBefore);
    ctx.toast("Undone");
  };

  /* Step: decide on one item at a time */
  if (inFlow && cur) {
    return (
      <Sheet title="Evening Clean Up" onClose={close}>
        <div className="cd-evehead">
          <div className="cd-sub" style={{ fontSize: 13 }}>Item <span key={idx} className="cd-bump">{idx + 1}</span> of {queue.length}</div>
          <button className="cd-undo" onClick={undo} disabled={!history.length || leaving} aria-label="Undo last choice"><RotateCcw size={15} /> Undo</button>
        </div>
        <div className="cd-progress"><i style={{ width: `${(idx / queue.length) * 100}%` }} /></div>
        <div key={cur.id} className={"cd-evecard" + (leaving ? " out" : "")} style={{ "--from": `${enterFrom * 44}px` }}>
          <div className="cd-evetitle">{cur.title}</div>
          <Chip name={cur.category} catStyle={ctx.catStyle} />
        </div>
        <div className="cd-evegrid">
          <button className="cd-evego pri" onClick={() => choose("done")}><Check size={20} />Done<small>I finished it</small></button>
          <button className="cd-evego" onClick={() => choose("tomorrow")}><Sun size={20} />Tomorrow<small>Stays on the deck</small></button>
          <button className="cd-evego" onClick={() => choose("future")}><CalendarDays size={20} />Future<small>Not this week</small></button>
          <button className="cd-evego" onClick={() => choose("watching")}><Eye size={20} />Watch<small>Check back later</small></button>
        </div>
        {queue.length - idx > 1 && <button className="cd-ghost" onClick={keepRest}>Keep the rest for tomorrow</button>}
      </Sheet>
    );
  }
  if (inFlow) return null;

  /* Step: summary of the day */
  const tomorrow = items.filter((i) => i.status === "today");
  const heavy = tomorrow.filter((i) => i.effort === "deep" && i.impact === "high").length;
  const maxShow = typeof window !== "undefined" && window.innerHeight < 720 ? 3 : 5;   // keep the summary on screen on small phones
  const rows = [
    ["Finished today", finished],
    ["Kept for tomorrow", log.tomorrow],
    ["Moved to Future", log.future],
    ["Moved to Watching", log.watching],
  ].filter(([, n]) => n > 0);

  return (
    <Sheet title={queue.length || finished ? "That’s the day." : "Deck is clear."} onClose={close}>
      {history.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button className="cd-undo" onClick={undo} aria-label="Undo last choice"><RotateCcw size={15} /> Undo last choice</button>
        </div>
      )}
      {rows.length > 0 && (
        <div>{rows.map(([l, n]) => <div className="cd-sumrow" key={l}><span>{l}</span><b>{n}</b></div>)}</div>
      )}
      <div className="cd-fl">Tomorrow’s deck</div>
      {tomorrow.length === 0 ? (
        <div className="cd-sub">Nothing yet. Pull something in from Future, or plan it in the morning.</div>
      ) : (
        <div>
          {tomorrow.slice(0, maxShow).map((i) => <div className="cd-sumrow" key={i.id}><span>{i.title}</span><CatText name={i.category} catStyle={ctx.catStyle} /></div>)}
          {tomorrow.length > maxShow && <div className="cd-hint" style={{ textAlign: "left" }}>+ {tomorrow.length - maxShow} more</div>}
        </div>
      )}
      {heavy > 2 && <div className="cd-hint" style={{ textAlign: "left" }}>{heavy} major focus tasks is a lot. Consider keeping it to 1–2.</div>}
      <button className="cd-primary" onClick={() => { ctx.markCleaned(); close(); ctx.toast("Day closed. Rest up."); }}>Finish for the day</button>
    </Sheet>
  );
}

function Settings({ ctx, themeId, close }) {
  return (
    <Sheet title="Settings" onClose={close}>
      <div className="cd-themes">
        {Object.entries(THEMES).map(([id, t]) => (
          <button key={id} className={"cd-theme" + (id === themeId ? " on" : "")} onClick={() => ctx.setTheme(id)}>
            <span className="cd-sw">{t.swatches.map((c) => <i key={c} style={{ background: c }} />)}</span>
            <span><b>{t.name}</b><small>{t.blurb}</small></span>
          </button>
        ))}
      </div>
      <div className="cd-fl" style={{ marginTop: 18 }}>Export</div>
      <button className="cd-ghost" onClick={() => ctx.exportData()}><Download size={18} /> Export to Excel</button>
      <div className="cd-fl" style={{ marginTop: 18 }}>Data</div>
      <button className="cd-ghost" style={{ color: "var(--danger)" }} onClick={() => { ctx.resetData("empty"); close(); }}><Trash2 size={18} /> Clear everything</button>
    </Sheet>
  );
}

/* ═════════════════════════════════ APP ════════════════════════════════════ */

const TABS = [
  { k: "today", label: "Today", Icon: CheckCircle2 },
  { k: "inbox", label: "Inbox", Icon: Inbox },
  { k: "future", label: "Future", Icon: CalendarDays },
  { k: "watching", label: "Watching", Icon: Timer },
  { k: "dashboard", label: "Dashboard", Icon: BarChart3 },
];

export default function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("today");
  const [sheet, setSheet] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const [vvh, setVvh] = useState(null);
  const [dayKey, setDayKey] = useState(iso());
  const [justDone, setJustDone] = useState(() => new Set());   // finished during this visit to a tab; cleared when you switch tabs

  // New day, or coming back to the app: re-check what's due today
  useEffect(() => {
    const check = () => setDayKey(iso());
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, []);

  // Anything in Future that is due today belongs on the Today page.
  // `promotedOn` makes this happen once per day, so moving an item back to Future sticks.
  // Runs on load and when the day changes (not on every edit).
  const loaded = !!state;
  useEffect(() => {
    if (!loaded) return;
    const t = iso();
    setState((s) => {
      const due = s.items.filter((i) => i.status === "future" && !i.someday && i.due === t && i.promotedOn !== t);
      if (!due.length) return s;
      const ids = new Set(due.map((i) => i.id));
      setToastMsg({ m: `${due.length} due today moved to Today` });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
      return { ...s, items: s.items.map((i) => (ids.has(i.id) ? { ...i, status: "today", promotedOn: t } : i)) };
    });
  }, [loaded, dayKey]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setVvh(vv.height);
    f();
    vv.addEventListener("resize", f);
    return () => vv.removeEventListener("resize", f);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadState();
      if (alive) setState(s ? { ...s, items: s.items.map(normalizeItem) } : { items: makeSeed(), categories: DEFAULT_CATS, themeId: DEFAULT_THEME });
    })();
    return () => { alive = false; };
  }, []);

  // Save shortly after the last change, so a burst of edits (drag-reorders, rapid taps) is one write
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => saveState(state), 400);
    return () => clearTimeout(t);
  }, [state]);

  if (!state) {
    return <div className="cd-outer"><style>{CSS}</style><div className="cd" style={THEMES[DEFAULT_THEME].vars} /></div>;
  }

  const theme = THEMES[state.themeId] || THEMES[DEFAULT_THEME];
  const { items, categories } = state;

  // toast("text") or toast("text", { label: "Undo", run: fn }). Toasts with an action stay a little longer.
  const toast = (m, a) => {
    setToastMsg({ m, a });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), a ? 5000 : 2200);
  };
  const update = (fn) => setState((s) => ({ ...s, ...fn(s) }));

  const ctx = {
    categories,
    toast,
    setSheet,
    cleaned: state.cleanedOn === iso(),
    markCleaned: () => update(() => ({ cleanedOn: iso() })),
    openMenu: (id) => setSheet({ type: "menu", id }),
    catStyle: (name) => {
      const idx = Math.max(0, categories.indexOf(name));
      return theme.catPalette[idx % theme.catPalette.length];
    },
    addItem: (p) => update((s) => ({
      items: [...s.items, normalizeItem({ id: uid(), title: "", category: null, effort: null, impact: null, status: "inbox", due: null,
        someday: false, createdAt: Date.now(), doneAt: null, doneFrom: null, ...p })],
    })),
    patchItem: (id, patch) => update((s) => ({ items: s.items.map((i) => (i.id === id ? normalizeItem({ ...i, ...patch }) : i)) })),
    reorderToday: (ids) => update((s) => ({ items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, pos: k } : i; }) })),
    reorderWatching: (ids) => update((s) => ({ items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, wpos: k } : i; }) })),
    moveToTop: (id) => update((s) => {
      const ids = [id, ...todaySort(s.items.filter((i) => i.status === "today")).map((i) => i.id).filter((x) => x !== id)];
      return { items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, pos: k } : i; }) };
    }),
    // Moving something to Today reschedules it: a past due date becomes today, so it no longer reads as overdue
    moveToToday: (id) => update((s) => ({
      items: s.items.map((i) => (i.id === id
        ? normalizeItem({ ...i, status: "today", someday: false, due: i.due && i.due < iso() ? iso() : i.due })
        : i)),
    })),
    removeItem: (id) => update((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    restoreItem: (item) => update((s) => ({ items: s.items.some((i) => i.id === item.id) ? s.items : [...s.items, item] })),
    justDone,
    toggleDone: (id) => {
      const it = items.find((i) => i.id === id);
      if (it) setJustDone((prev) => { const n = new Set(prev); if (it.status === "done") n.delete(id); else n.add(id); return n; });
      update((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i;
        return i.status === "done"
          ? { ...i, status: i.doneFrom || "future", doneAt: null, doneFrom: null }
          : { ...i, doneFrom: i.status, status: "done", doneAt: Date.now() };
      }),
      }));
    },
    addCategory: (name) => update((s) => (s.categories.some((c) => c.toLowerCase() === name.toLowerCase()) ? {} : { categories: [...s.categories, name] })),
    setTheme: (id) => update(() => ({ themeId: id })),
    exportData: async () => {
      if (!items.length) { toast("Nothing to export yet"); return; }
      try { const n = await downloadExport(items); toast(`Exported ${n} ${n === 1 ? "item" : "items"}`); }
      catch (e) { if (!e || e.name !== "AbortError") toast("Couldn't export. Try again"); }
    },
    resetData: (kind) => {
      update(() => ({ items: kind === "sample" ? makeSeed() : [], categories: DEFAULT_CATS }));
      toast(kind === "sample" ? "Sample data loaded" : "Everything cleared");
    },
  };

  const unlabeledCount = items.filter(isUnlabeled).length;
  const attnCount = items.filter((i) => i.status === "future" && !i.someday && i.due && i.due < iso()).length;
  const menuItem = sheet?.type === "menu" ? items.find((i) => i.id === sheet.id) : null;
  const editItem = sheet?.type === "edit" && sheet.id ? items.find((i) => i.id === sheet.id) : null;
  const dateItem = sheet?.type === "date" ? items.find((i) => i.id === sheet.id) : null;
  const close = () => setSheet(null);

  const View = { today: TodayView, inbox: InboxView, future: FutureView, watching: WatchingView, dashboard: DashboardView }[tab];

  return (
    <div className="cd-outer" style={vvh ? { bottom: "auto", height: vvh } : undefined}>
      <style>{CSS}</style>
      <div className="cd" style={theme.vars} data-theme={state.themeId}
        onPointerDown={(e) => {
          // Tapping anywhere that isn't a text field closes the keyboard
          const a = document.activeElement;
          if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && !e.target.closest("input,textarea,[data-keep-kb]")) a.blur();
        }}>
        <View ctx={ctx} items={items} />

        <nav className="cd-nav" aria-label="Sections">
          {TABS.map(({ k, label, Icon }) => (
            <button key={k} className={"cd-tab" + (tab === k ? " on" : "")} onClick={() => { if (k !== tab) { setTab(k); setJustDone(new Set()); } }} aria-current={tab === k ? "page" : undefined}>
              <Icon size={22} strokeWidth={tab === k ? 2.2 : 1.7} />
              {label}
              {k === "inbox" && unlabeledCount > 0 && <span className="cd-badge">{unlabeledCount}</span>}
              {k === "future" && attnCount > 0 && <span className="cd-badge warn" aria-label={`${attnCount} need attention`}>{attnCount}</span>}
            </button>
          ))}
        </nav>

        {sheet?.type === "menu" && menuItem && <ItemMenu ctx={ctx} item={menuItem} close={close} />}
        {sheet?.type === "date" && dateItem && <DateEditor ctx={ctx} item={dateItem} close={close} />}
        {sheet?.type === "edit" && <Editor ctx={ctx} item={editItem} initialStatus={sheet.status} close={close} />}
        {sheet?.type === "evening" && <Evening ctx={ctx} items={items} close={close} />}
        {sheet?.type === "settings" && <Settings ctx={ctx} themeId={state.themeId} close={close} />}
        {toastMsg && (
          <div className={"cd-toast" + (toastMsg.a ? " act" : "")} role="status">
            <span>{toastMsg.m}</span>
            {toastMsg.a && <button onClick={() => { toastMsg.a.run(); setToastMsg(null); }}>{toastMsg.a.label}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
