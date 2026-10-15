/**
 * Clear the Day: a mobile-first task app (Today, Inbox, Future, Watching, Dashboard, Completed)
 * with six themes. Everything lives in this one file on purpose: themes, styles, views and logic.
 * Data is saved in the browser (see storage.js), and can be exported to Excel from Settings.
 */
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Download, Sun, Pencil, Plus, Moon, Check, X, Eye, LayoutGrid, CalendarDays, BarChart3, CheckCircle2, MoreHorizontal, Zap, Target, ClipboardList, Hourglass, Trash2, ArrowRight, Calendar, Inbox, RotateCcw, Sparkles, AlertCircle, ArrowUp, Leaf, ArrowLeft, Radar,
  ArrowUpDown,
} from "lucide-react";

// Shown at the bottom of Settings. Bump this whenever you ship an update (it lives here so replacing App.jsx is enough).
const APP_VERSION = "6.8";
const CHROME_COLOR = "#F6F3EC";   // fallback tint while loading: a soft neutral cream

/* ════════════════ EXPORT (Excel) ════════════════ */
const HEADERS = ["Title", "List", "Category", "Effort", "Impact", "Matrix", "Due date", "Created", "Completed", "Completed from"];
const WIDTHS = [46, 12, 14, 10, 10, 16, 12, 12, 12, 16];
const LISTS = ["Today", "Inbox", "Future", "Someday", "Watching", "Done"];
const QUAD = { "quick-high": "Quick Wins", "deep-high": "Major Focus", "quick-low": "Admin / Fillers", "deep-low": "Deferral" };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const day = (ms) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "");   // yyyy-mm-dd, local time

function listOf(i) {
  if (i.status === "done") return "Done";
  if (i.status === "today") return "Today";
  if (i.status === "inbox") return "Inbox";
  if (i.status === "watching") return "Watching";
  return i.someday ? "Someday" : "Future";
}
const listName = (s) => ({ today: "Today", inbox: "Inbox", watching: "Watching", future: "Future" }[s] || "");

function toRow(i) {
  const quad = i.effort && i.impact ? QUAD[`${i.effort}-${i.impact}`] || "" : "";
  const from = i.status === "done" ? (i.someday && i.doneFrom === "future" ? "Someday" : listName(i.doneFrom)) : "";
  return [i.title || "", listOf(i), i.category || "", cap(i.effort), cap(i.impact), quad, i.due || "", day(i.createdAt), day(i.doneAt), from];
}

// Today and Watching follow the order you set; the rest keep their saved order
function ordered(items) {
  const pos = (i, k) => (i[k] == null ? 1e9 : i[k]);
  return [...items].sort((a, b) => {
    if (a.status === "today" && b.status === "today") return pos(a, "pos") - pos(b, "pos");
    if (a.status === "watching" && b.status === "watching") return pos(a, "wpos") - pos(b, "wpos");
    return 0;
  });
}

function buildTables(items) {
  const all = ordered(items);
  const byList = {};
  LISTS.forEach((l) => { byList[l] = all.filter((i) => listOf(i) === l).map(toRow); });
  const flat = [];
  LISTS.forEach((l) => flat.push(...byList[l]));
  return { all: flat, byList };
}

/* ───────────── a tiny zip writer (files stored uncompressed), so no extra library is needed ───────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipParts(files) {   // files: [{ name, data: Uint8Array }] -> array of pieces for a Blob
  const enc = new TextEncoder();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(12, 33, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(14, 33, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    locals.push(new Uint8Array(lh.buffer), name, f.data);
    centrals.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centrals.reduce((n, a) => n + a.length, 0), true); end.setUint32(16, offset, true);
  return [...locals, ...centrals, new Uint8Array(end.buffer)];
}

/* ───────────── XLSX (written by hand: a zip of small XML files) ───────────── */
const esc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (n) => { let s = ""; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

function sheetXml(rows) {
  const cols = WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const data = [HEADERS, ...rows].map((r, ri) => {
    const cells = r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1);
      if (v === "" || v == null) return "";
      return `<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`;
}

async function toXlsxBlob(items) {
  const { all, byList } = buildTables(items);
  const sheets = [["All items", all], ...LISTS.map((l) => [l, byList[l]])];
  const parts = [];
  const addFile = (name, text) => parts.push({ name, data: new TextEncoder().encode(text) });
  addFile("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  addFile("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  addFile("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n], i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  addFile("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  addFile("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFE0CD"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  sheets.forEach(([, rows], i) => addFile(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(rows)));
  return new Blob(zipParts(parts), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ───────────── saving the file ───────────── */
async function saveFile(blob, filename) {
  // On phones, hand the file to the share sheet (so you can pick "Save to Files"); elsewhere it's a normal download
  const file = new File([blob], filename, { type: blob.type });
  const phone = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (phone && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e && e.name === "AbortError") throw e; /* anything else: fall back to a download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Exports everything as an Excel workbook. Resolves with the number of items exported.
async function downloadExport(items) {
  const stamp = new Date().toLocaleDateString("en-CA");
  await saveFile(await toXlsxBlob(items), `clear-the-day-${stamp}.xlsx`);
  return items.length;
}

/* ════════════════════════════════════════════════════════════════════════════
   LOOK
   ────────────────────────────────────────────────────────────────────────────
   The app has one look, Café: cream paper, black ink outlines, red and olive green, illustrated headers.
   Every colour, font, radius and shadow comes from the CSS variables in THEMES.cafe below; no component hard-codes a colour.
   ════════════════════════════════════════════════════════════════════════════ */

// Fonts load through ordinary <link> tags, NOT an @import inside the app's own CSS. An @import makes some browsers (Safari) hold back the
// whole stylesheet until the font download finishes, which showed the app as raw unstyled text for a split second at start-up.
const FONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:wght@500;600;700&display=swap";
const fontsLoaded = typeof document === "undefined" ? Promise.resolve() : new Promise((resolve) => {
  const add = (rel, href, cross) => { const l = document.createElement("link"); l.rel = rel; l.href = href; if (cross) l.crossOrigin = ""; document.head.appendChild(l); return l; };
  add("preconnect", "https://fonts.googleapis.com");
  add("preconnect", "https://fonts.gstatic.com", true);
  const sheet = add("stylesheet", FONT_URL);
  sheet.onload = resolve; sheet.onerror = resolve;   // offline or blocked: carry on with the fallback fonts
  setTimeout(resolve, 1500);                          // never wait longer than this
});
const BOOT_T0 = Date.now();   // when the app started: the total wait for fonts is counted from here
const firstFamily = (v) => (v || "").split(",")[0].replace(/['"]/g, "").trim();
// Wait (briefly) for the fonts a theme uses, so a screen never shows in fallback fonts and then jumps
function loadThemeFonts(themeId, maxWait = 1500) {
  const v = (THEMES[themeId] || THEMES[DEFAULT_THEME]).vars;
  const faces = [[v["--display-weight"], v["--font-display"]], [v["--display-weight-sm"] || v["--display-weight"], v["--font-display-sm"] || v["--font-display"]],
    [400, v["--font-body"]], [500, v["--font-body"]], [700, v["--font-body"]]];
  const load = fontsLoaded.then(() => Promise.all(faces.map(([w, f]) =>
    (document.fonts ? document.fonts.load(`${w} 16px "${firstFamily(f)}"`, "Clear the day. 0123") : Promise.resolve()).catch(() => {}))));
  return Promise.race([load, new Promise((r) => setTimeout(r, maxWait))]);
}

const THEMES = {
  // Ink-and-paper café: cream paper, black ink outlines drawn a little wobbly, red and olive green, illustrated headers (public/art)
  cafe: {
    name: "Café",
    blurb: "Ink, paper and a window seat",
    icon: Leaf,   // the settings button
    dark: false,
    outer: "#D8CFBC",
    catPalette: [
      ["#E3E6D0", "#49512E"], ["#E9E4D6", "#7B766B"], ["#F2D9D2", "#A3241C"],
      ["#F1E3BC", "#9A7420"], ["#DDE5E6", "#4B6670"], ["#EBDCE2", "#7A4A5C"],
    ],
    vars: {
      "--bg": "#FBF3E3",
      "--deco": "none", "--deco-size": "auto", "--deco2": "none", "--deco2-size": "auto",
      "--panel": "#EFE6D2",
      "--card": "#FAF3E5",
      "--text": "#1F1B17",
      "--muted": "#6A6256",
      "--line": "rgba(31,27,23,.20)",
      "--accent": "#3F4A2F",
      "--accent-ink": "#FBF3E3",
      "--accent-soft": "#E3E6D0",
      "--someday-bg": "#A3241C",
      "--someday-ink": "#FBF3E3",
      "--watch-bg": "#D4A84F",
      "--watch-ink": "#1F1B17",
      "--watch-icon": "#A9812C",
      "--btn-bg": "#3F4A2F",
      "--btn-ink": "#FBF3E3",
      "--danger": "#A3241C",
      "--hero-bg": "#EFE6D2",
      "--hero-ink": "#1F1B17",
      "--dump-bg": "#FBF5E8",
      "--dump-btn": "#3F4A2F",
      "--dump-ink": "#FBF3E3",
      "--eve-bg": "#3B4532",
      "--eve-ink": "#FBF3E3",
      "--headbtn-bg": "#FBF3E3",
      "--headbtn-ink": "#1F1B17",
      "--c-green": "#5C7A3E", "--c-yellow": "#D9A93A", "--c-blue": "#5E7F92", "--c-orange": "#B8582A",   // colour-coding for the Inbox toggles
      "--font-display": "'Newsreader','Libre Baskerville',Georgia,serif",
      "--font-body": "Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "600",
      "--display-transform": "none",
      "--display-spacing": "-0.01em",
      "--display-scale": "1.3",
      "--radius-lg": "16px",
      "--radius-md": "12px",
      "--radius-pill": "999px",
      "--shadow": "none",
      "--safe-bg": "#FBF3E3",
      "--nav-bg": "#FBF3E3",
      "--nav-active": "#A3241C",
      "--scrim": "rgba(31,27,23,.42)",
      "--q1": "#1F1B17", "--q1-bg": "#E6D9C2",
      "--q2": "#1F1B17", "--q2-bg": "#E9DEC8",
      "--q3": "#1F1B17", "--q3-bg": "#E6D9C2",
      "--q4": "#1F1B17", "--q4-bg": "#E9DEC8",
    },
  },

};
const DEFAULT_THEME = "cafe";

/* ═══════════════════════════ helpers & data ═══════════════════════════════ */

const pad = (n) => String(n).padStart(2, "0");
// The day starts at 5 AM. Between midnight and 5 AM it is still "the day before": at 1 AM on Monday, today is still Sunday,
// and "tomorrow" is Monday. Everything that asks "what is today?" goes through these.
const DAY_START_HOUR = 5;
const dayNow = () => new Date(Date.now() - DAY_START_HOUR * 36e5);
const iso = (d = dayNow()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const offsetDay = (n) => { const d = dayNow(); d.setDate(d.getDate() + n); return iso(d); };
const dayOf = (ms) => iso(new Date(ms - DAY_START_HOUR * 36e5));   // which day a moment belongs to
const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtShort = (s) => parseDay(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
// "3 days overdue" / "Due today" / "Fri, Oct 16"
const shortDay = (d) => parseDay(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });   // Oct 14
const dueInfo = (due) => {
  const t = iso();
  if (due === t) return { text: "Due today", cls: "today" };
  if (due < t) {
    const n = Math.round((parseDay(t) - parseDay(due)) / 864e5);
    return { text: `${n} ${n === 1 ? "day" : "days"} overdue`, cls: "over" };
  }
  return { text: fmtShort(due), cls: "" };
};
// Keeps items consistent: only Today items carry a Today position (pos) and only Watching items a Watching position (wpos)
// Colours you can give a category yourself (background, text). A category with no colour of its own uses the theme's colours.
const CAT_COLORS = [
  { name: "Rose", pair: ["#F7DADF", "#A8324A"] }, { name: "Orange", pair: ["#FBE3CF", "#B5530F"] },
  { name: "Amber", pair: ["#F8EBC2", "#8A6200"] }, { name: "Green", pair: ["#DDEEDA", "#2F7A3A"] },
  { name: "Teal", pair: ["#D2EEEA", "#1B7A70"] }, { name: "Sky", pair: ["#D9E9FA", "#2465B3"] },
  { name: "Indigo", pair: ["#E1E2FA", "#4247B0"] }, { name: "Purple", pair: ["#EADBF6", "#7B3AA8"] },
  { name: "Pink", pair: ["#F9D9EA", "#B02F7C"] }, { name: "Slate", pair: ["#E3E6EB", "#48515F"] },
];
const normalizeItem = (i) => {
  let o = i;
  if (o.status !== "today" && o.pos != null) o = { ...o, pos: null };
  if (o.status !== "watching" && o.wpos != null) o = { ...o, wpos: null };
  return enforceComplete(o);
};
// THE RULE: a task on Today or in Future (Someday is parked, so it's exempt) ALWAYS has a date, an urgency, an effort and an impact.
// Every way an item can be added, changed, loaded or restored goes through normalizeItem, so this can't be broken.
//  - Effort and impact need a person to choose them, so a task missing either waits in the Inbox until they're set.
//  - A date and an urgency can be worked out from each other (or from where the task is), so those are filled in automatically.
const enforceComplete = (o) => {
  if (!((o.status === "today" || o.status === "future") && !o.someday)) return o;
  if (!o.effort || !o.impact) return { ...o, status: "inbox", someday: false, due: null, pos: null };
  let { due, urgency } = o;
  if (due && !urgency) urgency = urgencyForDate(due);
  else if (urgency && !due) due = urgency === "now" ? iso() : offsetDay(urgency === "next" ? 3 : 7);
  else if (!due && !urgency) { if (o.status === "today") { urgency = "now"; due = iso(); } else { urgency = "later"; due = offsetDay(7); } }
  // Today is only for things due today or overdue: a task with a later date lives in Future until its day comes
  if (o.status === "today" && due > iso()) return { ...o, status: "future", due, urgency, pos: null };
  return due === o.due && urgency === o.urgency ? o : { ...o, due, urgency };
};
// ── How dates and urgency fit together (used everywhere) ──────────────────────────────────────────────────────
//   Now   = due today (or overdue)   → lives on Today
//   Next  = due within 3 days        → lives in Future (Inbox sets +3 days)
//   Later = due further out          → lives in Future (Inbox sets +7 days)
// Someday and Watching are parking places (see clearParked): neither holds an urgency, and Someday holds no date. An item gets urgency when it moves to Today or Future.
const daysFromToday = (d) => Math.round((parseDay(d) - parseDay(iso())) / 864e5);
const urgencyForDate = (due) => { const n = daysFromToday(due); return n <= 0 ? "now" : n <= 3 ? "next" : "later"; };
//   Someday  : no date, no urgency (keeps effort and impact)
//   Watching : no urgency, no effort (keeps its due date and impact)
const clearParked = (i) => {
  if (i.status === "watching") return { ...i, urgency: null, effort: null };
  if (i.status === "future" && i.someday) return { ...i, due: null, urgency: null };
  return i;
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
const isToday = (ms) => !!ms && dayOf(ms) === iso();
const uid = () => Math.random().toString(36).slice(2, 10);
// a small buzz on phones that support it, so taps feel physical
const buzz = (p = 10) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) { /* ignore */ } };

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

// !!! NEVER change this key. Changing it makes the app look for data in a new place, so everything saved under the old key
// looks lost. If the shape of the saved data ever changes, migrate it when loading instead.
const STORAGE_KEY = "clear-the-deck:v4";
const SNAP_PREFIX = `${STORAGE_KEY}:bak:`;   // automatic daily snapshots live under this prefix

// Returns { state } on success, { state: null } on a true first run, and { unreadable: true } if saved data exists but
// couldn't be read. In that last case the app must NOT save, or it would overwrite data that may be recoverable.
async function loadState() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return { state: r ? JSON.parse(r.value) : null };
  } catch (e) {
    try {
      const l = await window.storage.list(STORAGE_KEY);
      if (l && Array.isArray(l.keys) && l.keys.includes(STORAGE_KEY)) return { state: null, unreadable: true };
    } catch (_) { /* ignore */ }
    return { state: null };   // nothing saved yet
  }
}
async function saveState(s) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: stay in memory */ }
}
// ONE automatic backup, replaced every day: it is taken the first time the app opens each day, and it replaces the previous day's.
// Today's copy is written first and only then are older ones removed, so there is never a moment with no backup.
async function snapshotOncePerDay(s) {
  try {
    const key = SNAP_PREFIX + iso();
    let have = true;
    try { await window.storage.get(key); } catch { have = false; }
    if (!have) await window.storage.set(key, JSON.stringify(s));
    const l = await window.storage.list(SNAP_PREFIX);
    for (const k of (l && l.keys) || []) if (k !== key) await window.storage.delete(k);
  } catch { /* snapshots are best-effort */ }
}
// Looks through this browser's storage for ANY saved copy of the app's data, whatever key it was saved under.
// Used by Back up & restore, so data that is saved but not currently being shown can be found and brought back.
function findStoredCandidates() {
  const out = [];
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.includes("clear-the-deck") || k.includes(":bak:")) continue;
      try {
        const st = JSON.parse(localStorage.getItem(k));
        if (st && Array.isArray(st.items) && Array.isArray(st.categories)) out.push({ key: k, state: st, count: st.items.length });
      } catch { /* not ours */ }
    }
  } catch { /* storage unavailable */ }
  return out;
}
const candidateLabel = (k) => k === STORAGE_KEY ? "Saved data (original location)"
  : k === "clear-the-deck:" + STORAGE_KEY ? "Saved data (since the GitHub update)" : k;

async function listSnapshots() {
  try {
    const l = await window.storage.list(SNAP_PREFIX);
    const keys = ((l && l.keys) || []).sort().reverse();
    const out = [];
    for (const key of keys) {
      try {
        const r = await window.storage.get(key);
        const st = JSON.parse(r.value);
        out.push({ key, day: key.slice(SNAP_PREFIX.length), state: st, count: (st.items || []).length });
      } catch { /* skip unreadable snapshots */ }
    }
    return out;
  } catch { return []; }
}

/* ═══════════════════════════════ styles ═══════════════════════════════════ */

const CSS = `
.cd-outer{position:fixed;inset:0;display:flex;justify-content:center;align-items:stretch;background:var(--chrome-bg,#F6F3EC);overflow:hidden;overscroll-behavior:none}
.cd, .cd *{box-sizing:border-box}
.cd{position:relative;width:100%;max-width:430px;height:100%;display:flex;flex-direction:column;overflow:hidden;
  background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:15px;line-height:1.4;-webkit-font-smoothing:antialiased}
@media(min-width:520px){.cd-outer{align-items:center;padding:20px 0;background:var(--outer-bg,#CFC8BC)}.cd{height:min(880px,calc(100vh - 40px));border-radius:38px;box-shadow:0 30px 80px rgba(0,0,0,.35)}}
:where(.cd) button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cd button:focus-visible,.cd input:focus-visible,.cd textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
:where(.cd) input,:where(.cd) textarea{font:inherit;color:var(--text)}
/* iOS Safari zooms the page when a field under 16px gets focus, so every field is 16px */
.cd input,.cd textarea,.cd select{font-size:16px !important}
.cd-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px 20px 28px;scrollbar-width:none;
  background:var(--deco,none) no-repeat left top / var(--deco-size,100% auto),var(--deco2,none) repeat-y left top / var(--deco2-size,100% auto);
  background-attachment:local,local}
.cd-scroll::-webkit-scrollbar{display:none}

.cd-date{color:var(--muted);font-size:14px}
.cd-h1{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:calc(34px*var(--display-scale,1));line-height:1.08;margin:4px 0 4px}
.cd-sub{color:var(--muted);font-size:14.5px;margin:0}
.cd-h2{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:21px;margin:0}
.cd-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.cd-iconbtn{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:var(--accent);flex:none}
.cd-plus{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink);flex:none;box-shadow:var(--shadow)}

.cd-panel{background:var(--panel);border-radius:var(--radius-lg);padding:16px;margin-top:18px}
.cd-panel h3{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);font-size:19px;margin:0}
.cd-panel p{margin:2px 0 12px;color:var(--muted);font-size:13.5px}
.cd-dump{position:relative;background:var(--dump-bg,var(--card));border-radius:var(--radius-md)}
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
.cd-empty b{display:block;color:var(--text);font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);font-size:19px;margin-bottom:4px}

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
.cd-ghead .t{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);font-size:18px}
.cd-ghead .s{font-size:12.5px;color:var(--muted);margin-top:1px}
.cd-gcount{margin-left:auto;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;background:var(--card);color:var(--text);flex:none}
.cd-gbody{padding:0 16px 4px;background:var(--card)}
.cd-datehead{font-weight:600;margin:20px 0 2px;font-size:14px;color:var(--muted)}

.cd-row.cd-wrow{gap:14px;padding:14px 4px 14px 14px;margin-bottom:10px;border:0;border-radius:var(--radius-lg);background:var(--card);box-shadow:var(--shadow)}
.cd-wrow .eye{width:44px;height:44px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex:none}
.cd-wrow .cd-row-title{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:17px;line-height:1.25}
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
.cd-card-title{font-family:var(--font-display);font-weight:var(--card-title-weight,var(--display-weight));text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:32px;text-align:center;line-height:1.12;padding:26px 8px 10px;overflow-wrap:anywhere}
.cd-hint{text-align:center;font-size:12.5px;color:var(--muted);margin-top:14px}
.cd-cardact{position:absolute;right:8px;bottom:8px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:transparent;color:var(--muted);opacity:.55;z-index:2}
.cd-cardact:active{opacity:1;color:var(--danger)}
.cd .cd-card-edit{display:block;width:100%;border:0;background:transparent;resize:none;overflow:hidden;text-align:center;
  font-family:var(--font-display);font-weight:var(--card-title-weight,var(--display-weight));text-transform:var(--display-transform);letter-spacing:var(--display-spacing);
  line-height:1.12;padding:0;margin:0;outline:none;user-select:text;-webkit-user-select:text;touch-action:auto;
  font-size:var(--edit-size,32px) !important}

.cd-card-d{background:var(--card);border-radius:var(--radius-lg);box-shadow:var(--shadow);padding:16px;margin-top:14px}
.cd-card-d .hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
.cd-card-d .hd span{font-size:12.5px;color:var(--muted)}
.cd-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 8px;text-align:center}
.cd-stat b{display:block;font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));font-size:30px;line-height:1.1}
.cd-stat span{font-size:12.5px;color:var(--muted)}
.cd-stat.warn b{color:var(--danger)}
.cd-stat.hot b{color:var(--accent)}
.cd-focus{display:flex;align-items:center;gap:16px}
.cd-focus .n{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));font-size:44px;color:var(--accent);line-height:1}
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
.cd-sheet{width:100%;max-height:94%;overflow-y:auto;overscroll-behavior:contain;background:var(--card);border-radius:26px 26px 0 0;padding:6px 20px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:cd-up .22s ease-out;scrollbar-width:none}
.cd-sheet::-webkit-scrollbar{display:none}
@keyframes cd-up{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}
.cd-dragzone{padding:4px 0 12px;touch-action:none;cursor:grab}
.cd-grab{width:40px;height:4px;border-radius:2px;background:var(--line);margin:0 auto}
.cd-shead{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.cd-x{width:36px;height:36px;border-radius:50%;background:var(--panel);display:grid;place-items:center;flex:none;color:var(--muted)}
.cd-pills{display:flex;gap:6px}
.cd-pills .cd-segbtn{flex:1;text-align:center;padding:9px 4px}
.cd-two2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cd-stitle{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);font-size:22px;margin:0;flex:1;min-width:0;overflow-wrap:anywhere}
.cd-menu button{display:flex;align-items:center;gap:12px;width:100%;padding:14px 4px;border-bottom:1px solid var(--line);text-align:left;font-weight:500}
.cd-menu button:last-child{border-bottom:0}
.cd-menu .del{color:var(--danger)}
.cd-input{width:100%;padding:12px 14px;border-radius:var(--radius-md);border:1.5px solid var(--line);background:var(--panel)}
.cd-fl{font-size:11.5px;font-weight:600;letter-spacing:.02em;color:var(--muted);margin:14px 0 5px}
.cd-primary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border-radius:var(--radius-lg);background:var(--btn-bg);color:var(--btn-ink);font-weight:700;margin-top:18px}
.cd-primary:disabled{opacity:.45;cursor:default}
.cd-ghost{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;border-radius:var(--radius-lg);background:var(--panel);font-weight:600;margin-top:10px}
.cd-toast{position:absolute;left:50%;width:max-content;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);background:var(--text);color:var(--card);padding:10px 18px;border-radius:var(--radius-pill);font-size:13.5px;font-weight:500;z-index:40;box-shadow:var(--shadow);max-width:88%;text-align:center;pointer-events:none;animation:cd-drop .22s ease-out}
.cd-toast.act{pointer-events:auto;display:flex;align-items:center;gap:14px;padding:7px 7px 7px 18px}
.cd-toast.act button{padding:7px 15px;border-radius:var(--radius-pill);background:var(--accent);color:var(--accent-ink);font-weight:700;font-size:13.5px;flex:none}
@keyframes cd-drop{from{transform:translate(-50%,-14px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
.cd-addrow{display:flex;gap:8px;margin-top:10px}
.cd-addrow .cd-input{flex:1}
.cd-addrow button{padding:0 16px;border-radius:var(--radius-md);background:var(--accent);color:var(--accent-ink);font-weight:600}
.cd-evebar{padding:8px 20px 12px;border-top:1px solid var(--line);background:var(--bar-bg,transparent)}
.cd-evebtn{display:flex;align-items:center;gap:12px;width:100%;padding:11px 16px 11px 12px;border-radius:var(--radius-lg);background:var(--eve-bg,var(--btn-bg));color:var(--eve-ink,var(--btn-ink));text-align:left;box-shadow:var(--shadow)}
.cd-evebtn .ic{width:38px;height:38px;border-radius:50%;background:color-mix(in srgb,currentColor 16%,transparent);display:grid;place-items:center;flex:none}
.cd-evebtn .tx{flex:1;min-width:0}
.cd-evebtn b{display:block;font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);font-size:17px;line-height:1.2}
.cd-evebtn small{display:block;opacity:.88;font-size:12.5px;margin-top:1px}
.cd-evebtn.closed{background:var(--panel);color:var(--text);box-shadow:none}
.cd-evebtn.closed .ic{background:var(--accent);color:var(--accent-ink)}
.cd-evetitle{font-family:var(--font-display);font-weight:var(--card-title-weight,var(--display-weight));text-transform:var(--display-transform);font-size:25px;text-align:center;line-height:1.2;padding:22px 6px 12px;overflow-wrap:anywhere}
.cd-evegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.cd-evego{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:10px 4px;min-height:72px;border-radius:var(--radius-md);background:var(--panel);text-align:center;font-weight:600;font-size:14px;line-height:1.15}
.cd-evego small{font-weight:400;font-size:11px;color:var(--muted)}
.cd-evego svg{color:var(--accent);margin-bottom:3px}
.cd-evego.pri{background:var(--accent);color:var(--accent-ink)}
.cd-evego.pri small{color:inherit;opacity:.85}
.cd-evego.pri svg{color:inherit}
.cd-evego{background:var(--accent);color:var(--accent-ink)}   /* every Evening Clean Up button is dark */
.cd-evego small{color:inherit;opacity:.85}
.cd-evego svg{color:inherit}
.cd-evego.complete{grid-column:1 / -1;flex-direction:row;gap:10px;min-height:50px;background:transparent;color:var(--text);border:2px solid var(--text)}   /* the Complete button is three buttons wide */
.cd-evego.complete small{color:var(--muted);opacity:1}
.cd-evego.complete svg{color:var(--accent);margin:0}
.cd-evego.all{background:var(--accent-soft);color:var(--accent)}   /* the sixth button, "Everything to tomorrow", is a different color */
.cd-evego.all small,.cd-evego.all svg{color:inherit}
.cd-evego:disabled{opacity:.38}
.cd-sumrow{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.cd-sumrow b{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));font-size:18px}
.cd-scroll.lock{overflow:hidden;touch-action:none;overscroll-behavior:none}
@media(max-height:720px){.cd-h1{font-size:calc(28px*var(--display-scale,1))}.cd-stack2{margin-top:12px}}
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
.cd-tcard b{display:block;font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:20px;line-height:1.1;margin-top:10px}
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
.cd-evecard{margin-top:12px;padding:26px 16px 22px;min-height:min(32vh,250px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:var(--radius-lg);background:var(--panel);text-align:center;animation:cd-evein .42s cubic-bezier(.2,.9,.3,1.15) both}
.cd-evecard .cd-evetitle{padding:6px 6px 10px;font-size:calc(29px * min(var(--display-scale, 1), 1.2))}
.cd-evecard.out{animation:none;transform:translateX(calc(var(--from,44px) * -1)) scale(.94);opacity:0;transition:transform .17s ease-in,opacity .17s ease-in}
@keyframes cd-evein{0%{opacity:0;transform:translateX(var(--from,44px)) scale(.92)}55%{opacity:1}100%{opacity:1;transform:none}}
.cd-bump{display:inline-block;animation:cd-bump .35s ease-out}
@keyframes cd-bump{0%{transform:scale(1.7);color:var(--accent);font-weight:700}100%{transform:none}}
@media(max-height:720px){.cd-sumrow{padding:6px 0}.cd-sheet .cd-hint{margin-top:6px}.cd-sheet .cd-fl{margin-top:8px}.cd-sheet .cd-primary{margin-top:12px}}
.cd-list{position:relative}
.cd-row{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.cd-row.cd-lifting{position:relative;z-index:6;background:var(--card);border-radius:var(--radius-md);box-shadow:0 12px 30px rgba(0,0,0,.2);border-bottom-color:transparent;margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px}
.cd-reorder-hint{font-size:12.5px;color:var(--muted);margin:-2px 0 4px}

/* page header: a fixed bar above the scrolling area (like the nav below it), the same size on every page */
/* With the translucent status bar (index.html), the page draws behind the clock and battery. This strip fills that area. */
.cd::before{content:"";position:absolute;top:0;left:0;right:0;height:env(safe-area-inset-top);background:var(--safe-bg,var(--eve-bg,var(--btn-bg)));z-index:6;pointer-events:none}
.cd-headcard{position:relative;flex:none;z-index:4;display:flex;flex-direction:column;justify-content:center;min-height:104px;padding:var(--head-pad-top,calc(18px + env(safe-area-inset-top))) 20px 12px;margin:var(--head-margin,0);border-radius:var(--head-radius,0);
  background:var(--bar-stripe,none) no-repeat left bottom / 100% 4px,var(--eve-bg,var(--btn-bg));color:var(--eve-ink,var(--btn-ink));box-shadow:var(--shadow)}
.cd-headcard .cd-h1{margin:2px 0 3px}
.cd-headcard .cd-date,.cd-headcard .cd-sub{color:inherit;opacity:.85}
.cd-headact{position:absolute;top:var(--head-act-top,calc(18px + env(safe-area-inset-top)));right:16px;display:flex;align-items:center;gap:8px}
.cd-headact>button:not(.cd-undo){width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--headbtn-bg,color-mix(in srgb,currentColor 16%,transparent));color:var(--headbtn-ink,inherit)}
.cd-headcard .cd-undo{background:var(--headbtn-bg,color-mix(in srgb,currentColor 16%,transparent));color:var(--headbtn-ink,inherit)}
/* thought dump: the dark, vibrant box */
.cd-panel{background:var(--panel-deco,none) no-repeat right 10px top 8px / 160px 48px,var(--panel-stripe,none) no-repeat left top / 100% 6px,var(--hero-bg,var(--accent));box-shadow:var(--shadow)}
.cd-panel h3,.cd-panel p{color:var(--hero-ink,var(--accent-ink))}
.cd-panel p{opacity:.9}
.cd-panel .cd-dumpbtn.on{background:var(--dump-btn,var(--hero-ink,var(--accent-ink)));color:var(--dump-ink,var(--accent))}
/* Today's list sits on a card, like the groups on Future */
.cd-cardlist{background:var(--card);border-radius:var(--radius-lg);box-shadow:var(--shadow);padding:2px 16px}
/* section bars: same height and width everywhere */
.cd-sec,.cd-gh,.cd-datehead{display:flex;align-items:center;min-height:56px;width:100%;background:var(--card);border-radius:var(--radius-lg);box-shadow:var(--shadow)}
.cd-sec{justify-content:space-between;padding:0 8px 0 18px;margin:18px 0 10px}
.cd-gh{padding:0 18px;margin:16px 0 10px}
.cd-gh:first-child{margin-top:8px}
.cd-gh{font-size:15px;font-weight:700}
.cd-gh .n{margin-left:auto;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--card);color:var(--text);font-size:13px;font-weight:700}
.cd-gh i{width:11px;height:11px}
.cd-datehead{padding:0 18px;margin:16px 0 8px}
.cd-sechead{min-width:0}
.cd-cap{font-size:12.5px;color:var(--muted);margin-top:1px}
.cd-scroll>.cd-hint{margin:14px 0 0}
.cd-empty{background:var(--card);border-radius:var(--radius-lg);box-shadow:var(--shadow);margin-top:14px}
.cd-progress{margin-top:10px}
@media(max-height:720px){.cd-headcard{min-height:96px;padding:var(--head-pad-top-sm,calc(14px + env(safe-area-inset-top))) 20px 10px}}
/* Inbox buttons: solid card background, so they read clearly over the artwork */
.cd-tcard,.cd-tcard.someday,.cd-tcard.watch,.cd-tcard.prio{background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow)}
.cd-selwrap.pill .cd-select{background:var(--card);box-shadow:var(--shadow);border:1px solid var(--line)}
.cd-mini{background:var(--panel);border-color:var(--line)}
/* Settings: all five themes in a compact grid, so nothing needs to scroll */
.cd-setrow{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.cd-setrow .cd-ghost{margin-top:0}
.cd-version{text-align:center;color:var(--muted);font-size:12px;margin-top:14px}
.cd-bootmark{width:96px;height:96px;filter:drop-shadow(0 8px 16px rgba(130,55,25,.22));animation:cd-breathe 1.9s ease-in-out .7s infinite}   /* it holds still at first, then breathes if loading takes a while */
.cd-bootmark svg{display:block;width:100%;height:100%}
@keyframes cd-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes cd-pulse{0%,100%{opacity:.25}50%{opacity:1}}
/* ───── v2.1: Inbox controls, effects ───── */
.cd-dock{padding:4px 20px 14px}
.cd-catrow{margin-bottom:0}
.cd-catrow .cd-selwrap{flex:1;min-width:0}
.cd-catrow .lbl{color:var(--muted)}
.cd-urgent{display:inline-flex;align-items:center;gap:6px;flex:none;height:44px;padding:0 14px;border-radius:var(--radius-pill);background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow);font-weight:600;font-size:14px;color:var(--muted);transition:background .15s,color .15s,transform .1s}
.cd-urgent.on{background:var(--danger);color:#fff;border-color:transparent;animation:cd-pop .3s}
.cd-urgent:active{transform:scale(.95)}
.cd-param{display:flex;align-items:center;gap:10px;margin-top:8px}
.cd-param .lbl{display:flex;align-items:center;gap:6px;width:74px;flex:none;color:var(--muted);font-size:13.5px}
.cd-opts{display:flex;gap:8px;flex:1;min-width:0}
.cd-opt{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:5px;height:40px;padding:0 6px;border-radius:var(--radius-md);background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow);font-size:13.5px;color:var(--text);transition:transform .1s,background .15s,color .15s;white-space:nowrap}
.cd-opt b{font-weight:700}
.cd-opt small{color:var(--muted);font-size:11px}
.cd-opt:active{transform:scale(.96)}
.cd-opt.on{background:var(--accent);border-color:transparent;color:var(--accent-ink);animation:cd-pop .25s}
.cd-opt.on small{color:inherit;opacity:.88}
.cd-opt.tone-high b{color:var(--c-green,#3E9B5F)}
.cd-opt.tone-low b{color:var(--danger)}
.cd-opt.tone-high.on{background:var(--c-green,#3E9B5F);color:#fff}
.cd-opt.tone-low.on{background:var(--danger);color:#fff}
.cd-opt.tone-high.on b,.cd-opt.tone-low.on b{color:#fff}
.cd-prio{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:50px;margin-top:12px;border-radius:var(--radius-lg);background:var(--panel);color:var(--muted);border:1.5px dashed color-mix(in srgb,var(--text) 22%,transparent);font-weight:700;font-size:16px;transition:background .2s,color .2s,box-shadow .2s,transform .1s}
.cd-prio.ready{background:var(--btn-bg);color:var(--btn-ink);border:1.5px solid transparent;box-shadow:0 6px 18px color-mix(in srgb,var(--btn-bg) 42%,transparent);animation:cd-ready .45s}
.cd-prio:active{transform:scale(.98)}
.cd-prio.shake,.cd-dumprow.shake{animation:cd-shake .45s}
.cd-secrow{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.cd-alt{display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border-radius:var(--radius-md);background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow);font-weight:600;font-size:14px;transition:transform .1s}
.cd-alt:active{transform:scale(.97)}
.cd-tag{display:inline-block;padding:2px 9px;border-radius:var(--radius-pill);font-size:11.5px;font-weight:600;white-space:nowrap}
.cd-tag.good{background:color-mix(in srgb,var(--c-green,#3E9B5F) 18%,var(--card));color:color-mix(in srgb,var(--c-green,#3E9B5F) 72%,var(--text));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c-green,#3E9B5F) 45%,transparent)}   /* High: the same green as the Inbox */
.cd-tag.bad{background:color-mix(in srgb,var(--danger) 18%,var(--card));color:color-mix(in srgb,var(--danger) 72%,var(--text));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--danger) 45%,transparent)}   /* Low: the same red as the Inbox */
.cd-opthint{display:block;font-size:10.5px;font-weight:400;opacity:.8;margin-top:1px}
.cd-segbtn.sm{line-height:1.15}
.cd-sortpill{display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:7px 13px;border-radius:var(--radius-pill);background:color-mix(in srgb,var(--hero-ink,var(--accent-ink)) 14%,transparent);color:var(--hero-ink,var(--accent-ink));font-weight:600;font-size:13px}
.cd-catlist{max-height:44vh;overflow-y:auto}
.cd-catitem{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.cd-catitem .n{margin-left:auto;color:var(--muted);font-size:12.5px}
.cd-catitem .cd-cattext{font-size:14.5px}
.cd-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:60}
.cd-confetti i{position:absolute;top:-14px;width:8px;height:13px;border-radius:2px;animation:cd-fall 1.6s ease-in forwards}
@keyframes cd-fall{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),105vh) rotate(var(--r));opacity:.9}}
@keyframes cd-pop{0%{transform:scale(.88)}60%{transform:scale(1.07)}100%{transform:scale(1)}}
@keyframes cd-ready{0%{transform:scale(.96)}55%{transform:scale(1.035)}100%{transform:scale(1)}}
@keyframes cd-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-7px)}40%,60%{transform:translateX(7px)}}
.cd-check.on{animation:cd-pop .32s}
.cd-primary,.cd-evebtn,.cd-pill,.cd-undo,.cd-plus,.cd-evego,.cd-ghost,.cd-headbtn,.cd-dumpbtn{transition:transform .1s}
.cd-primary:active,.cd-evebtn:active,.cd-pill:active,.cd-undo:active,.cd-plus:active,.cd-evego:active,.cd-ghost:active{transform:scale(.96)}
@media(max-height:760px){.cd-dock{padding:2px 18px 10px}.cd-param{margin-top:6px}.cd-opt{height:36px}.cd-prio{height:46px;margin-top:10px}.cd-alt{height:38px}}
/* ───── v2.2: Inbox quadrants ───── */
.cd-quad{display:grid;grid-template-columns:1.4fr 1fr;grid-template-areas:"prio some" "tog watch";gap:10px;margin-top:10px}
.cd-quad .cd-tcard.someday{grid-area:some}
.cd-quad .cd-tcard.watch{grid-area:watch}
.cd-quad .cd-prio{grid-area:prio;position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:3px;width:auto;height:auto;min-height:104px;margin:0;padding:12px 14px;border-radius:var(--radius-lg);text-align:left}
.cd-quad .cd-prio .go{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,currentColor 12%,transparent)}
.cd-quad .cd-prio b{font-family:var(--font-display-sm,var(--font-display));font-weight:var(--display-weight-sm,var(--display-weight));text-transform:var(--display-transform);font-size:20px;line-height:1.1}
.cd-quad .cd-prio small{font-size:12px;font-weight:500;opacity:.85}
.cd-toggles{grid-area:tog;display:flex;flex-direction:column;justify-content:center;padding:4px 12px;border-radius:var(--radius-lg);background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow)}
.cd-toggles .cd-trow{padding:5px 0;color:var(--text)}
.cd-toggles .cd-trow+.cd-trow{padding-bottom:5px}
.cd-trow .lbl{font-size:13px;font-weight:600;line-height:1.15}
.cd-trow .lbl small{display:block;color:var(--muted);font-size:10.5px;font-weight:400;margin-top:1px}
.cd-mini{width:82px}
.cd-mini.set{border-color:var(--line)}
@media(max-height:760px){.cd-quad{gap:8px;margin-top:8px}.cd-quad .cd-prio{min-height:88px;padding:10px 12px}.cd-toggles{padding:2px 10px}.cd-toggles .cd-trow{padding:3px 0}}
/* thought dump "send": the thought squeezes and drops toward the Inbox tab (a shake read as "rejected") */
.cd-dumprow{position:relative}
.cd-dumprow.send-out{z-index:3;pointer-events:none;animation:cd-send .46s cubic-bezier(.5,0,.8,.4) forwards}
.cd-dumprow.send-in{animation:cd-arrive .3s ease-out}
@keyframes cd-send{0%{transform:none;opacity:1}22%{transform:scale(.965)}100%{transform:translateY(200px) scale(.5);opacity:0}}
@keyframes cd-arrive{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.cd-badge{animation:cd-pop .35s}
.cd-completed .cd-row.done{opacity:.9}
.cd-completed .cd-row.done .cd-row-title{color:var(--text)}
.cd-leavewrap{overflow:hidden;max-height:140px;transition:max-height .3s ease,opacity .25s ease,transform .3s ease}
.cd-leavewrap.out{max-height:0;opacity:0;transform:translateX(-26px)}
.cd-input[type="date"]{display:block;width:100%;min-width:0;max-width:100%;-webkit-appearance:none;appearance:none;text-align:left}
.cd-input[type="date"]::-webkit-date-and-time-value{text-align:left;min-height:1.4em}
.cd-input[type="date"]::-webkit-calendar-picker-indicator{margin:0}
/* locked Inbox controls (no category yet) and keyboard-open layout */
.cd-quad.locked>*{opacity:.42;filter:grayscale(1);cursor:not-allowed}
.cd-quad.locked .cd-prio.ready{box-shadow:none}
.cd-catrow.shake{animation:cd-shake .45s}
.cd.kb .cd-nav,.cd.kb .cd-evebar{display:none}
.cd.kb{padding-bottom:var(--kb)}
.cd.kb .cd-scrim{bottom:var(--kb)}
.cd-quad .cd-tcard small{display:block;font-size:11.5px;line-height:1.25}   /* one-liners stay visible on short screens too */
/* Radar: a Watching / Someday switch under the header */
.cd-parkbar{flex:none;padding:12px 20px 2px}
.cd-parkbar .cd-seg{margin-top:0;gap:8px}
.cd-parkbar .cd-segbtn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.cd-segbtn .cd-cnt{margin-left:2px;font-weight:700;opacity:.75}
/* Clean has no bold anywhere: every weight is Regular (400), on every screen, sheet, tag and button */
/* The top 8px of every screen is the soft white of the bottom bar. iOS tints the status bar from the top edge of the page,
   so this keeps the bar soft white on every theme instead of picking up a coloured header. */
.cd-topstrip{flex:none;height:8px;background:var(--nav-bg)}
.cd.booting .cd-scroll,.cd.booting .cd-scrim{animation:none}   /* the app appears at once at launch, with no fade */
.cd-catdot{width:26px;height:26px;border-radius:50%;border:2px solid var(--card);box-shadow:0 0 0 1.5px var(--line);flex:none;padding:0;cursor:pointer}
.cd-swatches{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 4px 12px}
.cd-swatch{width:30px;height:30px;border-radius:50%;border:3px solid var(--card);box-shadow:0 0 0 1.5px var(--line);padding:0;cursor:pointer}
.cd-swatch.on{box-shadow:0 0 0 2.5px var(--text)}
.cd-swatch.reset{width:auto;height:30px;padding:0 12px;border-radius:999px;border:0;background:var(--panel);color:var(--muted);font-size:12.5px;box-shadow:none}
.cd-delopt{display:block;width:100%;text-align:left;padding:14px;border-radius:var(--radius-md);background:var(--panel);margin-top:12px;border:2px solid transparent}
.cd-delopt.on{border-color:var(--accent)}
.cd-delopt b{display:block;font-size:15.5px}
.cd-delopt span{display:block;font-size:13px;color:var(--muted);margin-top:3px}
.cd-delpick{margin-top:10px;display:flex;flex-direction:column;gap:10px}
/* ── One colour for each kind of button, the same on every screen ──
   accent  : Prioritize, Today, Tomorrow, This week, Future
   someday : every Someday button        watch : every Watch button */
.cd-quad .cd-prio{background:var(--accent);color:var(--accent-ink);border:0;box-shadow:none;opacity:.55}      /* dimmed until all three are set, then full colour */
.cd-quad .cd-prio.ready{opacity:1;box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 42%,transparent)}
.cd-quad.locked .cd-prio{opacity:.42}
.cd-quad .cd-tcard.someday,.cd-quad .cd-tcard.watch{border-color:transparent;box-shadow:none}
.cd-quad .cd-tcard.someday{background:var(--someday-bg);color:var(--someday-ink)}
.cd-quad .cd-tcard.watch{background:var(--watch-bg);color:var(--watch-ink)}
.cd-quad .cd-tcard.someday .ic,.cd-quad .cd-tcard.watch .ic,.cd-quad .cd-tcard.someday small,.cd-quad .cd-tcard.watch small{color:inherit}
.cd-quad .cd-tcard.someday small,.cd-quad .cd-tcard.watch small{opacity:.9}
.cd-quad .cd-tcard.someday .go,.cd-quad .cd-tcard.watch .go{background:color-mix(in srgb,currentColor 20%,transparent);color:inherit}
.cd-evego.someday{background:var(--someday-bg);color:var(--someday-ink)}
.cd-evego.watch{background:var(--watch-bg);color:var(--watch-ink)}
.cd-pill.sched{background:var(--accent);color:var(--accent-ink)}
.cd-parkbar .cd-segbtn.someday.on{background:var(--someday-bg);color:var(--someday-ink)}
.cd-parkbar .cd-segbtn.watch.on{background:var(--watch-bg);color:var(--watch-ink)}
/* ── Café: ink and paper ─────────────────────────────────────────────────────────────────────── */
.cd[data-theme="cafe"] .cd-headcard{background:var(--bg);box-shadow:none;color:var(--text);min-height:190px;justify-content:flex-start;padding-top:calc(34px + env(safe-area-inset-top));padding-bottom:22px}
.cd[data-theme="cafe"] .cd-headcard::before{content:"";position:absolute;inset:0;z-index:0;background:var(--hdr-art,none) right bottom / 94% auto no-repeat;mix-blend-mode:multiply;pointer-events:none}
.cd[data-theme="cafe"] .cd-headcard .cd-h1,.cd[data-theme="cafe"] .cd-headcard .cd-sub{position:relative;z-index:1}
.cd[data-theme="cafe"] .cd-headcard .cd-sub{max-width:62%;opacity:.8}
.cd[data-theme="cafe"] .cd-headact{z-index:2}
/* a hand-drawn ink line under the header: a thin dark stroke that thins out at both ends, with a faint brush stroke beneath it */
.cd[data-theme="cafe"] .cd-headcard::after{content:"";position:absolute;left:14px;right:14px;bottom:-4px;height:12px;z-index:3;pointer-events:none;filter:url(#cd-rough);
  background:linear-gradient(var(--text),var(--text)) 0 2px / 100% 1.8px no-repeat,linear-gradient(rgba(31,27,23,.16),rgba(31,27,23,.16)) 8% 7px / 62% 2.4px no-repeat;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 7%,#000 93%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 7%,#000 93%,transparent 100%)}
.cd[data-theme="cafe"] .cd-headact>button:not(.cd-undo){border:1.6px solid var(--text)}
.cd[data-theme="cafe"] .cd-headcard .cd-undo{border:1.6px solid var(--text);background:var(--bg)}   /* solid, so the illustration behind it never shows through the word */
@media(max-height:720px){.cd[data-theme="cafe"] .cd-headcard{min-height:150px;padding-top:calc(22px + env(safe-area-inset-top))}}
/* cards, panels and buttons get a black ink outline drawn a little wobbly, plus a flat paper shadow */
.cd[data-theme="cafe"] :is(.cd-cardlist,.cd-panel,.cd-gh,.cd-datehead,.cd-group,.cd-card,.cd-card-d,.cd-tcard,.cd-toggles,.cd-evecard,.cd-empty,.cd-wrow,.cd-evebtn){position:relative;box-shadow:3px 3px 0 rgba(31,27,23,.10)}
.cd[data-theme="cafe"] :is(.cd-cardlist,.cd-panel,.cd-gh,.cd-datehead,.cd-group,.cd-card,.cd-card-d,.cd-tcard,.cd-toggles,.cd-evecard,.cd-empty,.cd-wrow,.cd-evebtn)::after{content:"";position:absolute;inset:0;border:1.8px solid var(--text);border-radius:inherit;filter:url(#cd-rough);pointer-events:none;z-index:2}
.cd[data-theme="cafe"] .cd-quad .cd-tcard.someday,.cd[data-theme="cafe"] .cd-quad .cd-tcard.watch,.cd[data-theme="cafe"] .cd-quad .cd-prio{box-shadow:3px 3px 0 rgba(31,27,23,.10)}
.cd[data-theme="cafe"] .cd-group{overflow:hidden}
.cd[data-theme="cafe"] .cd-plus{background:var(--danger);color:var(--accent-ink);box-shadow:none}
.cd[data-theme="cafe"] .cd-cattext{color:var(--text) !important}
.cd[data-theme="cafe"] .cd-nav{border-top:1.5px solid var(--text);backdrop-filter:none;-webkit-backdrop-filter:none}
/* the little illustrations on empty screens */
.cd[data-theme="cafe"] .cd-empty::before{content:"";display:block;height:130px;margin:0 auto 6px;background:var(--empty-art,none) center / contain no-repeat;mix-blend-mode:multiply}
.cd[data-theme="cafe"] .cd-empty>svg{display:none}
/* Inbox card: more room, and it never collapses when the keyboard opens */
.cd[data-theme="cafe"] .cd-headcard.compact{min-height:136px;padding-top:calc(24px + env(safe-area-inset-top));padding-bottom:16px}
.cd[data-theme="cafe"] .cd-headcard.compact::before{background-size:auto 100%}
.cd-scroll.lock .cd-stack2{min-height:150px;flex-shrink:0}
.cd-dock.away{display:none}   /* editing the card text: the category and sorting controls step aside */
.cd.kb[data-theme="cafe"] .cd-headcard{min-height:84px;padding-top:calc(14px + env(safe-area-inset-top));padding-bottom:12px}   /* with the keyboard up, the illustration gives way */
.cd.kb[data-theme="cafe"] .cd-headcard::before,.cd.kb[data-theme="cafe"] .cd-headcard .cd-sub{display:none}
@media(max-height:720px){.cd[data-theme="cafe"] .cd-headcard.compact{min-height:104px;padding-top:calc(16px + env(safe-area-inset-top));padding-bottom:12px}.cd-quad .cd-prio{min-height:84px}}
.cd[data-theme="cafe"] .cd-sec{box-shadow:none}   /* "Today's To Do" has no outline */
.cd-secact{display:flex;align-items:center;gap:8px}
.cd-sortbtn{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:var(--text);background:transparent;flex:none}
.cd-sortbtn.on{background:var(--accent-soft);color:var(--accent)}
.cd-tag.mig{display:inline-flex;align-items:center;gap:4px;background:var(--accent-soft);color:var(--accent);font-weight:600}
.cd-evecard{touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none}
.cd-evecard.dragging{cursor:grabbing}
.cd-swipehint{position:absolute;left:0;right:0;bottom:9px;text-align:center;font-size:11.5px;color:var(--muted);opacity:.85;pointer-events:none}
.cd-dock.off{opacity:.42;filter:grayscale(1);pointer-events:none;user-select:none;-webkit-user-select:none}   /* empty Inbox: every control still there, none usable */
.cd-scroll.lock .cd-card.cd-card-empty{display:flex;align-items:center;justify-content:center;text-align:center;touch-action:auto;will-change:auto;padding:12px 16px;overflow:hidden}
.cd-emptybody{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;max-width:330px;width:100%;max-height:100%;min-height:0}   /* never taller than the card */
.cd-emptybody::before{content:"";display:block;flex:0 1 96px;width:150px;min-height:28px;background:var(--empty-art,none) center / contain no-repeat;mix-blend-mode:multiply}   /* the picture shrinks first when the card is short */
.cd-emptybody b,.cd-emptybody span{flex:none}
.cd-emptybody b{font-family:var(--font-display);font-weight:var(--display-weight);font-size:22px;letter-spacing:var(--display-spacing)}
.cd-emptybody span{font-size:13.5px;color:var(--muted);line-height:1.4}
.cd-gdot{width:16px;height:16px;border-radius:50%;flex:none}
html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none}
body{position:fixed;inset:0;width:100%}   /* the page itself can't scroll, so iOS can't shove the app around when the keyboard opens */
.cd button,.cd select{touch-action:manipulation}
.cd-nav{-webkit-backdrop-filter:blur(10px)}
.cd-scroll{animation:cd-fade .18s ease-out}
.cd-scrim{animation:cd-fade .18s ease-out}
@keyframes cd-fade{from{opacity:0}to{opacity:1}}
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

// The picture shown while the app opens: the ink illustration (also the app's icon). It is fixed, not a setting.
const BOOT_ART = "data:image/jpeg;base64,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";

function BootMark() {
  return (
    <div className="cd-bootmark" role="status" aria-label="Loading">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs><clipPath id="cd-bm"><rect width="100" height="100" rx="22.5" /></clipPath></defs>
        <image href={BOOT_ART} width="100" height="100" preserveAspectRatio="xMidYMid slice" clipPath="url(#cd-bm)" />
      </svg>
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
// A pill you tap to cycle: unset -> first option -> next ... Optional ones (clearable) cycle back to unset.
function MiniToggle({ value, onChange, options, label, clearable = false, emptyLabel = "Pick" }) {
  const idx = options.findIndex((o) => o.v === value);
  const cur = idx >= 0 ? options[idx] : null;
  const next = !cur ? options[0] : idx === options.length - 1 ? (clearable ? null : options[0]) : options[idx + 1];
  const st = cur && cur.color ? { background: `color-mix(in srgb, ${cur.color} 18%, var(--card))`, color: `color-mix(in srgb, ${cur.color} 72%, var(--text))`, borderColor: cur.color } : undefined;
  return (
    <button type="button" className={"cd-mini" + (cur ? " set" : "")} style={st} onClick={() => { buzz(8); onChange(next ? next.v : null); }}
      aria-label={`${label}: ${cur ? cur.label : "not set"}. Tap to ${next ? "set " + next.label : "clear"}.`}>
      <span className="val">{cur ? cur.label : emptyLabel}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>
    </button>
  );
}

const EFFORT_OPTS = [
  { v: "quick", label: "Quick", hint: "<20 min", tone: "--q1", color: "var(--c-orange, #E07B24)" },
  { v: "deep", label: "Deep", hint: ">20 min", tone: "--q4", color: "var(--c-green, #3E9B5F)" },
];
// Impact is colour-coded: high = green, low = red
const IMPACT_OPTS = [
  { v: "high", label: "High", hint: "meaningful", tone: "--q2", color: "var(--c-green, #3E9B5F)" },
  { v: "low", label: "Low", hint: "nice to have", tone: "--q3", color: "var(--danger)" },
];
// Urgency sets the due date: Now = today (goes straight to Today), Next = in 3 days, Later = in 7 days
const URGENCY_OPTS = [
  { v: "now", label: "Now", hint: "due today", days: 0, color: "var(--c-green, #3E9B5F)" },
  { v: "next", label: "Next", hint: "in 3 days", days: 3, color: "var(--c-yellow, #D9A21B)" },
  { v: "later", label: "Later", hint: "in 7 days", days: 7, color: "var(--c-blue, #3F78D1)" },
];

function Pills({ options, value, onChange }) {
  return (
    <div className="cd-pills">
      {options.map((o) => {
        const on = value === o.v;
        const st = on && o.color ? { background: `color-mix(in srgb, ${o.color} 18%, var(--card))`, color: `color-mix(in srgb, ${o.color} 72%, var(--text))`, boxShadow: `inset 0 0 0 1.5px ${o.color}` } : undefined;
        return (
          <button key={o.v} className={"cd-segbtn sm" + (on ? " on" : "")} style={st} onClick={() => onChange(on ? null : o.v)}>
            {o.label}{o.hint && <small className="cd-opthint">{o.hint}</small>}
          </button>
        );
      })}
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

// One colourful header card, identical in size on every page: date, title, subtitle, and an optional button top-right
const emptyArt = (ctx, k) => (ctx.themeId === "cafe" ? { "--empty-art": `url("${CAFE_ART.empty[k]}")` } : undefined);   // a little ink drawing on empty screens (Café theme)
function PageHead({ ctx, title, sub, action, art, compact }) {
  const SettingsIcon = ctx.themeIcon;
  return (
    <header className={"cd-headcard" + (compact ? " compact" : "")} style={art && ctx.themeId === "cafe" ? { "--hdr-art": `url("${CAFE_ART.hdr[art]}")` } : undefined}>
      <h1 className="cd-h1">{title}</h1>
      <p className="cd-sub">{sub}</p>
      <div className="cd-headact">
        {action}
        <button onClick={() => ctx.setSheet({ type: "settings" })} aria-label="Settings and themes"><SettingsIcon size={20} strokeWidth={1.8} /></button>
      </div>
    </header>
  );
}

function CatText({ name, catStyle }) {
  if (!name) return null;
  const [, fg] = catStyle(name);
  return <span className="cd-cattext" style={{ color: fg }}><i style={{ background: fg }} />{name}</span>;
}

function ItemRow({ item, ctx, trailing, hideDue = false, focusLabel = false, todayView = false, rowProps }) {
  const done = item.status === "done";
  const parked = !!item.someday || item.status === "watching";
  const showDue = item.due && !hideDue && !done && !item.someday && !(todayView && item.due === iso());   // on Today, "Due today" says nothing new   // finished tasks don't show a due date
  const di = item.due ? (done ? { text: fmtShort(item.due), cls: "" } : dueInfo(item.due)) : null;
  const isFocus = focusLabel && item.effort === "deep" && item.impact === "high";
  const showImpact = !!item.impact && !focusLabel && !done && item.status !== "watching";
  const urgent = (item.urgency === "now" || !!item.urgent) && !done && !parked && !todayView && (!item.due || item.due <= iso());
  // a task you sent to tomorrow carries a tag when it comes back
  const migrated = todayView && item.status === "today" && item.migratedOn ? (item.migratedOn === offsetDay(-1) ? "Migrated from yesterday" : `Migrated from ${shortDay(item.migratedOn)}`) : null;
  const hasMeta = item.category || showDue || isFocus || showImpact || urgent || migrated;
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
            {migrated && <span className="cd-tag mig"><ArrowRight size={11} /> {migrated}</span>}
            {isFocus && <span className="cd-focuspill">Major focus</span>}
            {urgent && <span className="cd-tag bad">Urgent</span>}
            {showImpact && <span className={"cd-tag " + (item.impact === "high" ? "good" : "bad")}>{item.impact === "high" ? "High" : "Low"} impact</span>}
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
  const [sendState, setSendState] = useState(null);   // null | "out" (the thought drops toward the Inbox) | "in" (the box comes back empty)
  const dumpRef = useRef(null);
  // Tasks you finish during this visit stay where they were (crossed out and faded) until you leave the tab
  const mode = ctx.todaySortMode || "mine";   // mine | matrix | category
  const mine = todaySort(items.filter((i) => i.status === "today" || (i.status === "done" && i.doneFrom === "today" && ctx.justDone.has(i.id))));
  // matrix and category views show one card per group, like the Future page
  let groups = null;
  if (mode === "matrix") groups = QUADS.map((q) => ({ key: q.key, q, list: mine.filter((i) => quadOf(i) === q.key) })).filter((g) => g.list.length);
  else if (mode === "category") groups = [...ctx.categories, null].map((c) => ({ key: c || "none", cat: c, list: mine.filter((i) => (i.category || null) === c) })).filter((g) => g.list.length);
  const grouped = !!groups;
  const shown = grouped ? groups.flatMap((g) => g.list) : mine;
  const openCount = shown.filter((i) => i.status === "today").length;
  const scrollRef = useRef(null);
  const reorder = useReorder(shown.map((i) => i.id), ctx.reorderToday, scrollRef);
  const dateStr = dayNow().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const dump = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length || sendState) return;
    setSendState("out");              // the thought squeezes, then drops down toward the Inbox tab...
    buzz(10);
    setTimeout(() => {
      lines.forEach((title) => ctx.addItem({ title, status: "inbox" }));
      setText("");
      setSendState("in");             // ...the box fades back in empty, and the Inbox badge pops
      buzz([8, 30, 14]);
      ctx.toast(`${lines.length} ${lines.length === 1 ? "thought" : "thoughts"} sent to Inbox`);
      setTimeout(() => setSendState(null), 320);
    }, 460);
  };

  const eveSub = ctx.cleaned
    ? "Tap to review tomorrow’s deck"
    : openCount
      ? `${openCount} still open. Sort them for tomorrow`
      : "Nothing left open. Close out the day";

  return (
    <>
    <PageHead ctx={ctx} title="Clear the day." sub="Capture. Choose. Do what matters." art="today" />
    <div className="cd-scroll" ref={scrollRef}>

      <div className="cd-panel">
        <h3>Thought dump</h3>
        <p>Get it out of your head. One thought per line.</p>
        <div className={"cd-dumprow" + (sendState ? " send-" + sendState : "")}>
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
        <button className="cd-sortpill" onClick={() => ctx.goTab("inbox")}>
          {ctx.unsorted > 0
            ? <><span key={ctx.unsorted} className="cd-bump">{ctx.unsorted}</span> left to sort in Inbox</>
            : <>Inbox is all sorted</>}
          <ChevRight size={14} />
        </button>
      </div>

      <div className="cd-sec">
        <div className="cd-sechead"><h2 className="cd-h2">Today’s To Do</h2>{shown.length > 1 && <div className="cd-cap">{mode === "matrix" ? "Sorted by the matrix" : mode === "category" ? "Grouped by category" : "Hold and drag to reorder"}</div>}</div>
        <div className="cd-secact">
          <button className={"cd-sortbtn" + (grouped ? " on" : "")} onClick={() => ctx.setSheet({ type: "sort" })} aria-label="Sort the list"><ArrowUpDown size={20} /></button>
          <button className="cd-plus" onClick={() => ctx.setSheet({ type: "edit", id: null, status: "today" })} aria-label="Add task"><Plus size={22} /></button>
        </div>
      </div>

      {shown.length === 0 && (
        <div className="cd-empty" data-art="cat" style={emptyArt(ctx, "cat")}><b>The deck is clear.</b>Add a task, or pull one in from Future.</div>
      )}
      {grouped ? groups.map((g) => (
        <div className="cd-group" key={g.key}>
          <div className="cd-ghead" style={{ background: g.q ? `var(--q${g.q.n}-bg)` : g.cat ? ctx.catStyle(g.cat)[0] : "var(--panel)" }}>
            {g.q ? <g.q.Icon size={22} style={{ color: `var(--q${g.q.n})`, flex: "none" }} /> : <span className="cd-gdot" style={{ background: g.cat ? ctx.catStyle(g.cat)[1] : "var(--muted)" }} />}
            <div><div className="t">{g.q ? g.q.title : g.cat || "No category"}</div><div className="s">{g.q ? g.q.sub : `${g.list.length} ${g.list.length === 1 ? "task" : "tasks"}`}</div></div>
            <span className="cd-gcount">{g.list.length}</span>
          </div>
          <div className="cd-gbody">
            {g.list.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} focusLabel todayView />)}
          </div>
        </div>
      )) : (
        <div className={"cd-list" + (shown.length ? " cd-cardlist" : "")} ref={reorder.contRef}>
          {shown.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} focusLabel todayView rowProps={reorder.rowProps(i.id)} />)}
        </div>
      )}
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
const inboxTitleSize = (t) => { const n = (t || "").length; const px = n <= 16 ? 42 : n <= 30 ? 36 : n <= 50 ? 30 : n <= 80 ? 25 : 21; return `calc(${px}px * min(var(--display-scale, 1), 1.2))`; };

function InboxView({ ctx, items }) {
  const order = ctx.inboxOrder, setOrder = ctx.setInboxOrder;   // the order of the deck, kept by the app so switching tabs doesn't reshuffle it
  const [handled, setHandled] = useState(0);
  const [draft, setDraft] = useState({ category: null, effort: null, impact: null, urgency: null });
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | drag | exit
  const [rise, setRise] = useState(false);     // the next card starts in the card-behind position, then rises to the top
  const [nudge, setNudge] = useState(false);     // shakes the Prioritize button when it is tapped too early
  const [nudgeCat, setNudgeCat] = useState(false);  // shakes the category picker when something is tapped before a category is set
  const drag = useRef(null);
  const busy = useRef(false);
  const [history, setHistory] = useState([]);     // every sort, newest last, so each one can be undone
  const pendingDraft = useRef(null);
  const noAuto = useRef(null);                    // card brought back by Undo must not auto-save straight away
  const flingRef = useRef(null);                  // always points at the latest fling (used by the keyboard handler)
  const backRef = useRef(null);                   // ...and at the latest goBack
  const [editing, setEditing] = useState(false);  // tapping the card text edits it in place
  const [editText, setEditText] = useState("");
  const editRef = useRef(null);
  const dragged = useRef(false);                  // true once a swipe has started, so its release isn't read as a tap

  const queue = useMemo(() => {
    const un = items.filter(isUnlabeled);
    const byId = new Map(un.map((i) => [i.id, i]));
    const kept = order.filter((id) => byId.has(id));                      // cards that are still waiting, in deck order
    const seen = new Set(kept);
    const added = un.filter((i) => !seen.has(i.id)).map((i) => i.id);     // new cards join the back of the deck
    return [...kept, ...added].map((id) => byId.get(id));
  }, [items, order]);
  const cur = queue[0];
  // keep the app's copy of the deck order in step with the cards that are really waiting
  useEffect(() => { const ids = queue.map((i) => i.id); if (ids.length !== order.length || ids.some((x, k) => x !== order[k])) setOrder(ids); }, [queue]);

  useLayoutEffect(() => {
    const pd = pendingDraft.current;
    if (pd && cur && pd.id === cur.id) { setDraft(pd.draft); pendingDraft.current = null; return; }
    setDraft({ category: cur?.category || null, effort: cur?.effort || null, impact: cur?.impact || null, urgency: cur?.urgency || null });
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
  useLayoutEffect(() => { setEditing(false); }, [cur?.id]);
  // grow the box to fit the text as you type
  useLayoutEffect(() => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [editText, editing]);

  const total = queue.length + handled;
  const behind = Math.min(2, queue.length - 1);
  const complete = draft.category && draft.effort && draft.impact && draft.urgency;   // Prioritize needs all of it, urgency included
  const hasCat = !!draft.category;   // until a category is set, every control below the card is locked

  // Each label is written to the card the moment you tap it, so partial progress survives swipes, tab changes and reloads
  const setField = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (cur) ctx.patchItem(cur.id, { [k]: v });
  };
  const snap = () => ({ category: cur.category, effort: cur.effort, impact: cur.impact, status: cur.status, someday: !!cur.someday, due: cur.due, urgency: cur.urgency || null });
  const skip = (dir = -1) => {
    if (!cur) return;
    const ids = queue.map((i) => i.id);
    setHistory((h) => [...h.slice(-19), { kind: "skip", id: cur.id, dir, draft: { ...draft }, order: ids }]);
    setOrder([...ids.slice(1), ids[0]]);   // the card goes to the back of the deck
  };
  const save = () => {
    if (!cur) return;
    if (!complete) { ctx.toast("Set effort, impact and urgency first"); return; }
    setHistory((h) => [...h.slice(-19), { kind: "save", id: cur.id, dir: 1, draft: { ...draft }, before: snap() }]);
    // Urgency sets the date: Now = today (straight to Today), Next = +3 days, Later = +7 days; no urgency = no date change
    const U = URGENCY_OPTS.find((o) => o.v === draft.urgency);
    const due = U ? offsetDay(U.days) : cur.due;
    ctx.patchItem(cur.id, { category: draft.category, effort: draft.effort, impact: draft.impact, urgency: U ? U.v : null,
      status: U && U.v === "now" ? "today" : "future", due });
    setHandled((h) => h + 1);
    ctx.toast(!U ? "Saved to Future" : U.v === "now" ? "Now: due today, moved to Today" : `${U.label}: due ${fmtShort(due)}`);
  };
  const watch = () => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-19), { kind: "watch", id: cur.id, dir: 0, dirY: -1, draft: { ...draft }, before: snap() }]);
    ctx.patchItem(cur.id, { status: "watching", category: draft.category || cur.category });
    setHandled((h) => h + 1);
    ctx.toast("Moved to Watching", { label: "View", run: () => ctx.goRadar("watching") });
  };
  const park = () => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-19), { kind: "someday", id: cur.id, dir: 0, dirY: 1, draft: { ...draft }, before: snap() }]);
    ctx.patchItem(cur.id, {
      status: "future", someday: true,
      category: draft.category || cur.category, effort: draft.effort || cur.effort, impact: draft.impact || cur.impact,
    });
    setHandled((h) => h + 1);
    ctx.toast("Moved to Someday", { label: "View", run: () => ctx.goRadar("someday") });
  };
  const del = () => {
    if (!cur) return;
    setHistory((h) => [...h.slice(-19), { kind: "delete", id: cur.id, dir: -1, draft: { ...draft }, item: cur }]);
    ctx.removeItem(cur.id);
    ctx.toast("Deleted. Tap Undo to bring it back");
  };
  const undo = () => {
    if (busy.current || !history.length) return;
    const e = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (e.kind === "skip") setOrder(e.order);
    else if (e.kind === "delete") ctx.restoreItem(e.item);
    else { ctx.patchItem(e.id, e.before); setHandled((h) => Math.max(0, h - 1)); }
    pendingDraft.current = { id: e.id, draft: e.draft };
    if (e.kind !== "skip") setOrder((o) => [e.id, ...o.filter((x) => x !== e.id)]);   // the card you undo comes back to the top of the deck
    ctx.toast("Undone");
    // card flies back in from the side it left
    noAuto.current = { id: e.id, sig: JSON.stringify(e.draft) };   // don't auto-save the card we just brought back
    setPhase("drag"); setDx(e.dir * 420); setDy((e.dirY || 0) * 520);
    requestAnimationFrame(() => requestAnimationFrame(() => { setPhase("idle"); setDx(0); setDy(0); }));
  };

  // Swipe LEFT (a short drag or a quick flick) to skip: the card goes to the back of the deck. Swipe RIGHT to go back to the previous card.
  const DIST = 44;      // px of drag that commits on its own
  const FLICK = 0.25;   // px/ms velocity that commits a flick
  const FLICK_MIN = 12; // ...as long as the card has moved at least this far
  // Every way of finishing a card uses the same fly-away motion:
  // swipe left → back of the deck, swipe right → previous card (round to the last), labels done → right, Someday → down, Watch → up
  const fling = (kind, dir = -1) => {
    if (busy.current || !cur) return;
    if ((kind === "save" || kind === "park" || kind === "watch") && !draft.category) { ctx.toast("Pick a category first"); return; }
    if (kind === "save" && !complete) {
      ctx.toast("Set effort, impact and urgency first");
      setPhase("idle"); setDx(0);
      return;
    }
    busy.current = true;
    buzz(kind === "save" ? 18 : 10);
    setPhase("exit");
    if (kind === "save") setDx(480); else if (kind === "skip") setDx(dir * 480);
    else if (kind === "del") setDx(-480);
    else if (kind === "park") setDy(520); else setDy(-520);
    setTimeout(() => {
      // The new top card starts exactly where the card behind it was sitting, then rises into place
      setPhase("drag"); setDx(0); setDy(0); setRise(true);
      ({ save, skip, park, watch, del })[kind](dir);
      busy.current = false;
      requestAnimationFrame(() => requestAnimationFrame(() => { setPhase("idle"); setRise(false); }));
    }, 190);
  };
  // Swipe right: back to the previous card in the deck. From the first card it goes round to the LAST card.
  // This only moves through the cards still waiting (a card you have sorted has left the deck); the Undo button is for undoing a sort.
  const goBack = () => {
    if (busy.current || !cur) return;
    if (queue.length < 2) { setPhase("idle"); setDx(0); return; }   // only one card: nothing to move to
    busy.current = true;
    buzz(10);
    setPhase("exit"); setDx(480);
    setTimeout(() => {
      const ids = queue.map((i) => i.id);
      setOrder([ids[ids.length - 1], ...ids.slice(0, -1)]);          // the card at the back comes to the front
      setPhase("drag"); setDx(-420); setDy(0); busy.current = false;  // ...sliding in from the left
      requestAnimationFrame(() => requestAnimationFrame(() => { setPhase("idle"); setDx(0); }));
    }, 190);
  };
  flingRef.current = fling;
  backRef.current = goBack;

  // Keyboard: ← or → sends the card to the back (when you're not typing in a field).
  // Subscribed once; it always calls the latest fling through the ref.
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") flingRef.current("skip", -1);   // skip
      if (e.key === "ArrowRight") backRef.current();              // go back
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
    if (Math.abs(dx) > DIST || flicked) { if (dir < 0) fling("skip", -1); else goBack(); }
    else { setPhase("idle"); setDx(0); }
  };

  const empty = !cur;   // nothing in the Inbox: the same screen, with every control still there but switched off
  const dockRef = useRef(null);
  // "inert" also keeps the switched-off controls out of reach of the keyboard and screen readers
  useEffect(() => { const d = dockRef.current; if (d) { if (empty) d.setAttribute("inert", ""); else d.removeAttribute("inert"); } }, [empty]);

  return (
    <>
      <PageHead ctx={ctx} art="inbox" compact title="Inbox" sub={empty ? "All caught up." : `${queue.length} ${queue.length === 1 ? "card" : "cards"} left${queue.length > 1 ? " · swipe to browse" : ""}`}
          action={<button className="cd-undo" onClick={undo} disabled={!history.length} aria-label="Undo last sort"><RotateCcw size={15} /> Undo</button>} />
      <div className="cd-scroll lock">
        <div className="cd-progress"><i style={{ width: `${empty ? 100 : (handled / total) * 100}%` }} /></div>

        <div className="cd-stack2" style={{ marginBottom: empty ? 0 : behind * 10 }}>
          {empty && (
            <div className="cd-card cd-card-empty">
              <div className="cd-emptybody" data-art="flowers" style={emptyArt(ctx, "flowers")}>
                <b>All sorted.</b>
                <span>Nothing is waiting. Capture more on Today.</span>
              </div>
            </div>
          )}
          {!empty && [2, 1].filter((n) => n <= behind).map((n) => {
            const k = n;   // the cards behind stay put while the top card leaves
            return (
              <div key={n} className="cd-under" aria-hidden="true" style={{
                transform: `translateY(${k * 10}px) scale(${1 - k * 0.045})`,
                transition: "transform .19s ease-out",
              }}>
                {n === 1 && queue[1] && (
                  <div className="cd-card-title" style={{ fontSize: inboxTitleSize(queue[1].title) }}>{queue[1].title}</div>
                )}
              </div>
            );
          })}
          {!empty && <div className="cd-card"
            style={{
              transform: rise ? "translateY(10px) scale(.955)" : `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`,
              transformOrigin: "50% 100%",   // same pivot as the cards behind it, so the hand-off lines up exactly
              transition: phase === "drag" ? "none" : phase === "exit" ? "transform .19s ease-in" : "transform .25s cubic-bezier(.2,.8,.2,1)",
            }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {editing ? (
              <div className="cd-card-title">
                <textarea ref={editRef} className="cd-card-edit" rows={1} autoFocus value={editText} maxLength={200}
                  style={{ "--edit-size": inboxTitleSize(editText) }}
                  onChange={(e) => setEditText(e.target.value)} onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
                  enterKeyHint="done" aria-label="Card text" />
              </div>
            ) : (
              <div className="cd-card-title" style={{ fontSize: inboxTitleSize(cur.title), cursor: "text" }} onClick={startEdit}>{cur.title}</div>
            )}
            {queue.length > 1 && <div className="cd-swipehint">← swipe to skip · swipe back →</div>}
            <button className="cd-cardact" onPointerDown={(e) => e.stopPropagation()} onClick={() => fling("del")} aria-label="Delete card"><Trash2 size={18} /></button>
          </div>}
        </div>
      </div>
      <div ref={dockRef} className={"cd-dock" + (editing ? " away" : "") + (empty ? " off" : "")} aria-disabled={empty ? "true" : undefined}>   {/* editing the card text: the controls step aside. Nothing to sort: they stay, switched off */}
        <div className={"cd-catrow" + (nudgeCat ? " shake" : "")}>
          <CategoryPicker pill label={<FolderIcon />} categories={ctx.categories} value={draft.category}
            dot={draft.category ? ctx.catStyle(draft.category)[1] : null}
            onChange={(c) => setField("category", c)} onAdd={ctx.addCategory} />
        </div>
        <div className={"cd-quad" + (hasCat && !empty ? "" : " locked")}
          onClickCapture={(e) => {
            if (hasCat) return;
            e.preventDefault(); e.stopPropagation();   // locked: swallow the tap, point at the category picker instead
            setNudgeCat(true); setTimeout(() => setNudgeCat(false), 450); buzz(24);
            ctx.toast("Pick a category first");
          }}>
          {/* top left: Prioritize. It only lights up once category, effort and impact are all set. */}
          <button className={"cd-prio" + (complete ? " ready" : "") + (nudge ? " shake" : "")} aria-disabled={!complete}
            onClick={() => { if (!complete) { setNudge(true); setTimeout(() => setNudge(false), 450); buzz(24); } fling("save"); }}>
            <Bars size={24} />
            <span className="go"><ChevRight size={16} /></span>
            <b>Prioritize</b>
            <small>{!complete ? "Set all three first" : draft.urgency === "now" ? "Goes to Today" : "Add to actionable tasks"}</small>
          </button>
          {/* bottom left: tap a pill to cycle through its options */}
          <div className="cd-toggles">
            <div className="cd-trow"><span className="lbl">Effort<small>{(EFFORT_OPTS.find((o) => o.v === draft.effort) || {}).hint || "<20 or >20 min"}</small></span>
              <MiniToggle label="Effort" value={draft.effort} onChange={(v) => setField("effort", v)} options={EFFORT_OPTS} /></div>
            <div className="cd-trow"><span className="lbl">Impact<small>{(IMPACT_OPTS.find((o) => o.v === draft.impact) || {}).hint || "low or high"}</small></span>
              <MiniToggle label="Impact" value={draft.impact} onChange={(v) => setField("impact", v)} options={IMPACT_OPTS} /></div>
            <div className="cd-trow"><span className="lbl">Urgency<small>{(URGENCY_OPTS.find((o) => o.v === draft.urgency) || {}).hint || "when it's due"}</small></span>
              <MiniToggle label="Urgency" value={draft.urgency} onChange={(v) => setField("urgency", v)} options={URGENCY_OPTS} /></div>
          </div>
          {/* right: Someday above, Watch below */}
          <button className="cd-tcard someday" onClick={() => fling("park")}>
            <Sparkles size={26} className="ic" />
            <span className="go"><ChevRight /></span>
            <b>Someday</b><small>Save it. No date</small>
          </button>
          <button className="cd-tcard watch" onClick={() => fling("watch")}>
            <Eye size={26} className="ic" />
            <span className="go"><ChevRight /></span>
            <b>Watch it</b><small>Track it. No date</small>
          </button>
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
  const undated = base.filter((i) => i.status === "future" && !i.someday && !i.due).length;

  const toToday = (i) => i.status === "done" ? null : (
    <button className="cd-pill sched" onClick={() => { const lacks = !i.effort || !i.impact; ctx.moveToToday(i.id); ctx.toast(lacks ? "Needs effort and impact first, so it's waiting in the Inbox" : "Moved to Today"); }}>
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
    <>
      <PageHead ctx={ctx} title="Future" sub="Everything not for today." art="future" />
    <div className="cd-scroll">

      <div className="cd-seg">
        {[["matrix", "Matrix"], ["calendar", "Calendar"]].map(([k, l]) => (
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
          {matrixItems.length === 0 && attn.length === 0 && <div className="cd-empty" data-art="books" style={emptyArt(ctx, "books")}><b>Nothing sorted here yet.</b>Sort items in your Inbox and they land here.</div>}
        </>
      )}

      {mode === "calendar" && (
        <>
          {calGroups.map((g, gi) => {
            const n = Math.round((parseDay(g.due) - parseDay(iso())) / 864e5);
            const over = n < 0, qn = (gi % 4) + 1;
            const title = over ? "Overdue" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : fmtShort(g.due);
            const subt = n <= 1 ? fmtShort(g.due) : `In ${n} days`;
            const tint = n === 0 ? "var(--accent)" : `var(--q${qn})`;
            return (
              <div className={"cd-group" + (over ? " attn" : "")} key={g.due}>
                <div className="cd-ghead" style={over ? undefined : { background: n === 0 ? "var(--accent-soft)" : `var(--q${qn}-bg)` }}>
                  {over ? <AlertCircle size={22} style={{ color: "var(--danger)", flex: "none" }} /> : <Calendar size={22} style={{ color: tint, flex: "none" }} />}
                  <div><div className="t">{title}</div><div className="s">{subt}</div></div>
                  <span className={"cd-gcount" + (over ? " warn" : "")}>{g.list.length}</span>
                </div>
                <div className="cd-gbody">
                  {g.list.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} trailing={toToday(i)} hideDue />)}
                </div>
              </div>
            );
          })}
          {calGroups.length === 0 && <div className="cd-empty" data-art="book" style={emptyArt(ctx, "book")}><b>No dates set.</b>Add a due date from an item’s menu to see it here.</div>}
          {undated > 0 && calGroups.length > 0 && <div className="cd-hint" style={{ marginTop: 22 }}>{undated} future {undated === 1 ? "item has" : "items have"} no date.</div>}
        </>
      )}

    </div>
    </>
  );
}

/* ═══════════════════════════════ WATCHING ═════════════════════════════════ */

function WatchGroup({ g, ctx, scrollRef, onSent }) {
  const reorder = useReorder(g.items.map((i) => i.id), ctx.reorderWatching, scrollRef);
  const color = g.name ? ctx.catStyle(g.name)[1] : "var(--muted)";
  const tint = g.name ? ctx.catStyle(g.name)[0] : "var(--panel)";
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
      ctx.patchItem(item.id, { status: "inbox", urgency: null });   // back to Inbox, labels pre-filled, to get urgency and a date
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
      <div className="cd-gh" style={{ background: tint }}>
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
                  {i.due && !done && <span className="cd-meta"><span className={dueInfo(i.due).cls}>{dueInfo(i.due).text}</span></span>}
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

function WatchingList({ ctx, items }) {
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
      <div style={{ marginTop: 6 }}>
        {groups.map((g) => <WatchGroup key={g.name || "none"} g={g} ctx={ctx} scrollRef={scrollRef} onSent={onSent} />)}
        {list.length === 0 && <div className="cd-empty" data-art="book" style={emptyArt(ctx, "book")}><b>Nothing to watch.</b>Mark an item as Watching from your Inbox, or add one here.</div>}
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

// Someday ideas: one card, newest parking first
function SomedayList({ ctx, items }) {
  const list = items.filter((i) => i.someday && (i.status === "future" || (i.status === "done" && i.doneFrom === "future" && ctx.justDone.has(i.id))));
  const toToday = (i) => i.status === "done" ? null : (
    <button className="cd-pill sched" onClick={() => { const lacks = !i.effort || !i.impact; ctx.moveToToday(i.id); ctx.toast(lacks ? "Needs effort and impact first, so it's waiting in the Inbox" : "Moved to Today"); }}>
      <ArrowRight size={12} /> Today
    </button>
  );
  return (
    <div className="cd-scroll">
      {list.length > 0 && (
        <div className="cd-group" style={{ marginTop: 4 }}>
          <div className="cd-ghead" style={{ background: "var(--q2-bg)" }}>
            <Sparkles size={22} style={{ color: "var(--q2)", flex: "none" }} />
            <div><div className="t">Someday</div><div className="s">Ideas for later. No date.</div></div>
            <span className="cd-gcount">{list.length}</span>
          </div>
          <div className="cd-gbody">
            {list.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} trailing={toToday(i)} />)}
          </div>
        </div>
      )}
      {list.length === 0 && <div className="cd-empty" data-art="books" style={emptyArt(ctx, "books")}><b>Someday is empty.</b>Park ideas here from your Inbox, or from an item’s menu.</div>}
    </div>
  );
}

/* ═══════════════════════════════ RADAR ════════════════════════════════════
   Watching (waiting on something) and Someday (ideas for later) in one place: things on your radar, not on your plate. Neither has an urgency. */

function RadarView({ ctx, items }) {
  const mode = ctx.radarMode;
  const watchingN = items.filter((i) => i.status === "watching").length;
  const somedayN = items.filter((i) => i.status === "future" && i.someday).length;
  const tabs = [["watching", "Watching", Eye, watchingN], ["someday", "Someday", Sparkles, somedayN]];
  return (
    <>
      <PageHead ctx={ctx} art="radar" title="Radar" sub={mode === "watching" ? "Swipe left for Inbox · hold to reorder" : "Ideas for later. No date, no urgency."} />
      <div className="cd-parkbar">
        <div className="cd-seg" role="tablist" aria-label="Radar lists">
          {tabs.map(([k, l, Icon, n]) => (
            <button key={k} role="tab" aria-selected={mode === k} className={"cd-segbtn " + (k === "someday" ? "someday" : "watch") + (mode === k ? " on" : "")} onClick={() => ctx.setRadarMode(k)}>
              <Icon size={15} />{l}<span className="cd-cnt">{n}</span>
            </button>
          ))}
        </div>
      </div>
      {mode === "watching" ? <WatchingList ctx={ctx} items={items} /> : <SomedayList ctx={ctx} items={items} />}
    </>
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
      <text x="50" y="49" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--text)" style={{ fontFamily: "var(--font-display-sm, var(--font-display))" }}>{total}</text>
      <text x="50" y="62" textAnchor="middle" fontSize="8" fill="var(--muted)">items</text>
    </svg>
  );
}

function DashboardView({ ctx, items }) {
  const t = iso();
  const open = items.filter((i) => i.status !== "done");
  const finished = items.filter((i) => i.status === "done" && isToday(i.doneAt)).length;
  const dated = open.filter((i) => !i.someday);   // Someday items are parked: no date, so they never count as due or overdue
  const dueToday = dated.filter((i) => i.due === t).length;
  const overdue = dated.filter((i) => i.due && i.due < t).length;
  const future = dated.filter((i) => i.status === "future").length;
  const watching = open.filter((i) => i.status === "watching").length;

  const focus = items.filter((i) => i.effort === "deep" && i.impact === "high" &&
    (i.status === "today" || (i.status === "done" && i.doneFrom === "today" && isToday(i.doneAt))));
  const focusDone = focus.filter((i) => i.status === "done").length;

  const byCat = ctx.categories.map((c) => ({ name: c, count: open.filter((i) => i.category === c).length })).filter((c) => c.count > 0);
  const uncat = open.filter((i) => !i.category).length;
  if (uncat) byCat.push({ name: "Unsorted", count: uncat });
  byCat.sort((a, b) => b.count - a.count);
  const maxCat = Math.max(1, ...byCat.map((c) => c.count));

  const matrix = items.filter((i) => ((i.status === "future" && !i.someday) || i.status === "today") && i.effort && i.impact);   // open Today + Future items that have both labels
  const segs = QUADS.map((q) => ({ key: q.key, title: q.title, color: `var(--q${q.n})`, count: matrix.filter((i) => quadOf(i) === q.key).length }));
  const quadLabel = { "quick-high": "Quick + High", "deep-high": "Deep + High", "quick-low": "Quick + Low", "deep-low": "Deep + Low" };

  const dateStr = dayNow().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const Stat = ({ n, l, cls }) => <div className={"cd-stat " + (cls || "")}><b>{n}</b><span>{l}</span></div>;
  const doneAll = items.filter((i) => i.status === "done").length;
  const doneWeek = items.filter((i) => i.status === "done" && i.doneAt && i.doneAt >= Date.now() - 7 * 864e5).length;

  return (
    <>
      <PageHead ctx={ctx} title="Dashboard" sub="Your big picture." art="dash" />
    <div className="cd-scroll">

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
        <div className="hd"><h2 className="cd-h2" style={{ fontSize: 18 }}>Completed</h2><span>Your finished tasks</span></div>
        <div className="cd-stats">
          <Stat n={finished} l="Today" />
          <Stat n={doneWeek} l="Last 7 days" />
          <Stat n={doneAll} l="All time" />
        </div>
        <button className="cd-evebtn" style={{ marginTop: 14 }} onClick={() => ctx.goTab("completed")}>
          <span className="ic"><CheckCircle2 size={20} /></span>
          <span className="tx"><b>See what you finished</b><small>{doneAll} {doneAll === 1 ? "task" : "tasks"} completed</small></span>
          <ArrowRight size={18} />
        </button>
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
    </>
  );
}

/* ═════════════════════════════ COMPLETED ═════════════════════════════════ */

function CompletedView({ ctx, items }) {
  const [leaving, setLeaving] = useState(() => new Set());   // rows that are sliding out after being unchecked
  const done = items.filter((i) => i.status === "done").sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const todayKey = iso();
  const yesterdayKey = offsetDay(-1);
  const groups = [];
  done.forEach((i) => {
    const key = i.doneAt ? dayOf(i.doneAt) : "earlier";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.list.push(i); else groups.push({ key, at: i.doneAt, list: [i] });
  });
  const label = (g) => g.key === "earlier" ? "Earlier" : g.key === todayKey ? "Today" : g.key === yesterdayKey ? "Yesterday"
    : parseDay(g.key).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  // Unchecking: the circle empties, the row slides out, then the task goes back to the list it came from (with an Undo)
  const uncheck = (id) => {
    const it = items.find((x) => x.id === id);
    if (!it || leaving.has(id)) return;
    buzz(10);
    setLeaving((prev) => new Set(prev).add(id));
    setTimeout(() => {
      ctx.toggleDone(id);
      setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
      ctx.toast(`Back in ${listName(it.doneFrom) || "Future"}`, { label: "Undo", run: () => ctx.toggleDone(id) });
    }, 320);
  };
  const rowCtx = { ...ctx, toggleDone: uncheck };
  return (
    <>
      <PageHead ctx={ctx} art="dash" title="Completed" sub={`${done.length} ${done.length === 1 ? "task" : "tasks"} finished`}
        action={<button className="cd-undo" onClick={() => ctx.goTab("dashboard")} aria-label="Back to Dashboard"><ArrowLeft size={15} /> Back</button>} />
      <div className="cd-scroll cd-completed">
        {groups.map((g, gi) => {
          const qn = (gi % 4) + 1;
          return (
            <div className="cd-group" key={g.key}>
              <div className="cd-ghead" style={{ background: `var(--q${qn}-bg)` }}>
                <CheckCircle2 size={22} style={{ color: `var(--q${qn})`, flex: "none" }} />
                <div><div className="t">{label(g)}</div><div className="s">{g.list.length} {g.list.length === 1 ? "task" : "tasks"} done</div></div>
                <span className="cd-gcount">{g.list.length}</span>
              </div>
              <div className="cd-gbody">
                {g.list.map((i) => {
                  const out = leaving.has(i.id);
                  return (
                    <div key={i.id} className={"cd-leavewrap" + (out ? " out" : "")}>
                      <ItemRow item={out ? { ...i, status: i.doneFrom || "future" } : i} ctx={rowCtx} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {done.length === 0 && <div className="cd-empty" data-art="books" style={emptyArt(ctx, "books")}><b>Nothing finished yet.</b>Tasks you check off will collect here.</div>}
      </div>
    </>
  );
}

/* ═══════════════════════════════ SHEETS ═══════════════════════════════════ */

// the same three colours as the buttons: scheduling = accent, Someday, Watch
const MENU_TINT = { "Move to tomorrow": "var(--accent)", "Move to this week": "var(--accent)", "Move to future": "var(--accent)", "Move to Future": "var(--accent)", "Move to Today": "var(--accent)",
  "Move to someday": "var(--someday-icon, var(--someday-bg))", "Move to Someday": "var(--someday-icon, var(--someday-bg))", "Move out of Someday": "var(--someday-icon, var(--someday-bg))", "Move to watch": "var(--watch-icon, var(--watch-bg))", "Mark as Watching": "var(--watch-icon, var(--watch-bg))" };
function ItemMenu({ ctx, item, close }) {
  const act = (fn, msg, view) => () => { fn(); close(); if (msg) ctx.toast(msg, view ? { label: "View", run: () => ctx.goRadar(view) } : undefined); };
  const p = (patch, msg, view) => act(() => ctx.patchItem(item.id, patch), msg, view);
  const rows = [];
  const done = item.status === "done";
  // A future date puts the task in Future; one without its labels waits in the Inbox to be finished
  const waits = !item.effort || !item.impact ? " (it needs effort and impact, so it's waiting in the Inbox)" : "";
  if (item.status === "today") {
    rows.push(
      { Icon: Sun, label: "Move to tomorrow", run: p({ status: "future", someday: false, urgency: "now", due: offsetDay(1), migratedOn: iso() }, "Moved to tomorrow" + waits) },
      { Icon: Calendar, label: "Move to this week", run: p({ status: "future", someday: false, urgency: "next", due: offsetDay(3) }, `Moved to this week · due ${fmtShort(offsetDay(3))}` + waits) },
      { Icon: CalendarDays, label: "Move to future", run: p({ status: "future", someday: false, urgency: "later", due: offsetDay(7) }, `Moved to Future · due ${fmtShort(offsetDay(7))}` + waits) },
      { Icon: Sparkles, label: "Move to someday", run: p({ status: "future", someday: true }, "Moved to Someday", "someday") },
      { Icon: Eye, label: "Move to watch", run: p({ status: "watching", someday: false }, "Moved to Watching", "watching") },
      { Icon: Pencil, label: "Edit details", run: () => ctx.setSheet({ type: "edit", id: item.id }) },
      { Icon: Trash2, label: "Delete", cls: "del", run: act(() => ctx.removeItem(item.id), "Deleted") },
    );
  } else {
    if (!done && !item.someday) rows.push({ Icon: Calendar, label: "Edit date", run: () => ctx.setSheet({ type: "date", id: item.id }) });
    if (item.status !== "today" && item.status !== "watching" && !done) rows.push({ Icon: ArrowRight, label: "Move to Today", run: act(() => ctx.moveToToday(item.id), !item.effort || !item.impact ? "Needs effort and impact first, so it's waiting in the Inbox" : "Moved to Today") });
    if (item.status === "today") rows.push({ Icon: ArrowUp, label: "Move to top", run: act(() => ctx.moveToTop(item.id), "Moved to the top") });
    if (item.status === "today") rows.push({ Icon: CalendarDays, label: "Move to Future", run: p({ status: "future", urgency: "later", due: offsetDay(7) }, `Moved to Future · Later, due ${fmtShort(offsetDay(7))}`) });
    if (item.status === "inbox") rows.push({ Icon: Sparkles, label: "Move to Someday", run: p({ status: "future", someday: true }, "Moved to Someday", "someday") });
    if (item.status === "future" && !item.someday) rows.push({ Icon: Sparkles, label: "Move to Someday", run: p({ someday: true }, "Moved to Someday", "someday") });
    if (item.status === "future" && item.someday) rows.push({ Icon: Sparkles, label: "Move out of Someday", run: p({ status: "inbox", someday: false, urgency: null, due: null }, "Sent to Inbox to set urgency") });
    if (item.status === "today" || item.status === "future") rows.push({ Icon: Eye, label: "Mark as Watching", run: p({ status: "watching", someday: false }, "Moved to Watching", "watching") });
    if (item.status === "watching") rows.push({ Icon: LayoutGrid, label: "Send to Inbox", run: p({ status: "inbox", urgency: null }, "Sent to Inbox") });
    if (done) rows.push({ Icon: RotateCcw, label: "Restore", run: act(() => ctx.toggleDone(item.id), "Restored") });
    rows.push({ Icon: Pencil, label: "Edit details", run: () => ctx.setSheet({ type: "edit", id: item.id }) });
    rows.push({ Icon: Trash2, label: "Delete", cls: "del", run: act(() => ctx.removeItem(item.id), "Deleted") });
    const ei = rows.findIndex((r) => r.label === "Edit details");
    if (ei > 0) rows.unshift(...rows.splice(ei, 1));   // Edit details goes to the top
  }
  return (
    <Sheet title={item.title} onClose={close}>
      <div className="cd-menu">
        {rows.map(({ Icon, label, run, cls }) => (
          <button key={label} className={cls} onClick={run}><Icon size={20} style={MENU_TINT[label] ? { color: MENU_TINT[label] } : undefined} /> {label}</button>
        ))}
      </div>
    </Sheet>
  );
}

function DateEditor({ ctx, item, close }) {
  const [due, setDue] = useState(item.due || "");
  const save = () => { if (!due) return; ctx.patchItem(item.id, { due, urgency: urgencyForDate(due) }); close(); ctx.toast("Date saved"); };
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
      {item.due && <button className="cd-ghost" onClick={() => { ctx.patchItem(item.id, { due: null, urgency: null }); close(); ctx.toast("Date cleared"); }}>Clear date</button>}
    </Sheet>
  );
}

// Where a task goes, and the date that goes with it: Today = today, This week = in 3 days, Future = in 7 days
const destDue = (dest) => (dest === "today" ? iso() : dest === "week" ? offsetDay(3) : dest === "future" ? offsetDay(7) : "");
const destStatus = (dest) => (dest === "today" ? "today" : dest === "watching" ? "watching" : "future");
const destOf = (it, initial) => {
  if (it) {
    if (it.status === "watching") return "watching";
    if (it.status === "today") return "today";
    if (it.status === "future" && !it.someday && it.due) return it.due <= iso() ? "today" : it.due <= offsetDay(3) ? "week" : "future";
    return "future";
  }
  return initial === "watching" ? "watching" : initial === "future" ? "future" : "today";
};
function Editor({ ctx, item, initialStatus, close }) {
  const [d, setD] = useState(() => {
    const dest = destOf(item, initialStatus);
    return {
      title: item?.title || "", category: item?.category || null, effort: item?.effort || null,
      impact: item?.impact || null, due: item ? (item.due || "") : destDue(dest), status: item?.status || destStatus(dest), dest, someday: !!item?.someday,
      doneOn: item?.status === "done" && item?.doneAt ? iso(new Date(item.doneAt)) : "",   // date completed (finished tasks only)
    };
  });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  // choosing where it goes fills in the date (you can still change the date afterwards)
  const pick = (dest) => setD((x) => ({ ...x, dest, status: destStatus(dest), someday: dest === "watching" ? false : false, due: dest === "watching" ? x.due : destDue(dest) }));
  // changing the date by hand moves the task to the matching place
  const setDue = (v) => setD((x) => {
    if (!v || x.dest === "watching" || x.someday) return { ...x, due: v };
    const dest = v <= iso() ? "today" : v <= offsetDay(3) ? "week" : "future";
    return { ...x, due: v, dest, status: destStatus(dest) };
  });
  const active = d.status === "today" || (d.status === "future" && !d.someday);   // Today and Future tasks need effort and impact
  const missing = active && (!d.effort || !d.impact);
  const save = () => {
    const title = d.title.trim();
    if (!title || missing) return;
    const parked = d.status === "watching" || (d.status === "future" && d.someday);
    const noDate = d.status === "future" && d.someday;   // Someday has no date; Watching may have one
    const payload = { ...d, title, due: noDate ? null : (d.due || null),
      someday: d.status === "future" || d.status === "done" ? d.someday : false };
    if (!parked) { payload.due = payload.due || destDue(d.dest) || iso(); payload.urgency = urgencyForDate(payload.due); }   // urgency always follows the date
    delete payload.dest;
    delete payload.doneOn;
    if (item?.status === "done" && d.doneOn) {   // a new completion date keeps the original time of day
      const [y, m, dd] = d.doneOn.split("-").map(Number);
      const was = item.doneAt ? new Date(item.doneAt) : new Date();
      payload.doneAt = new Date(y, m - 1, dd, was.getHours(), was.getMinutes()).getTime();
    }
    if (item) ctx.patchItem(item.id, payload); else ctx.addItem(payload);
    close();
    ctx.toast(item ? "Saved" : "Added");
  };
  const needsInbox = d.status === "future" && !d.someday && !d.category;
  return (
    <Sheet title={item ? "Edit item" : "New item"} onClose={close}>
      <input className="cd-input" placeholder="What needs doing?" value={d.title}
        onChange={(e) => set("title", e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { if (d.title.trim()) save(); else e.currentTarget.blur(); } }}
        enterKeyHint="done" aria-label="Item title" />
      {d.status === "done" ? (
        <>
          <div className="cd-fl">Date completed</div>
          <input className="cd-input" type="date" value={d.doneOn} max={iso()} onChange={(e) => set("doneOn", e.target.value)} aria-label="Date completed" />
        </>
      ) : (
        <>
          <div className="cd-fl">Goes to</div>
          <div className="cd-pills">
            {[["today", "Today"], ["week", "This week"], ["future", "Future"], ["watching", "Watching"]].map(([v, l]) => (
              <button key={v} className={"cd-segbtn sm" + (d.dest === v ? " on" : "")} onClick={() => pick(v)}>{l}</button>
            ))}
          </div>
        </>
      )}
      <div className="cd-fl">Category</div>
      <CategoryPicker categories={ctx.categories} value={d.category} onChange={(c) => set("category", c)} onAdd={ctx.addCategory} />
      <div className="cd-two2">
        {d.status !== "watching" && <div><div className="cd-fl">Effort</div><Pills options={EFFORT_OPTS} value={d.effort} onChange={(v) => set("effort", v)} /></div>}
        <div><div className="cd-fl">Impact</div><Pills options={IMPACT_OPTS} value={d.impact} onChange={(v) => set("impact", v)} /></div>
      </div>
      {d.someday && d.status === "future" && <div className="cd-hint" style={{ textAlign: "left" }}>Someday items have no date. Choose Today, This week or Future above to give it one.</div>}
      {!(d.status === "future" && d.someday) && (
        <>
          <div className="cd-fl">Due date</div>
          <input className="cd-input" type="date" value={d.due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        </>
      )}
      <button className="cd-primary" disabled={!d.title.trim() || missing} onClick={save}>{item ? "Save changes" : "Add item"}</button>
      {missing && <div className="cd-hint" style={{ marginTop: 10 }}>Choose effort and impact to put this on {d.dest === "today" ? "Today" : d.dest === "week" ? "This week" : "Future"}. Every task there needs a date, urgency, effort and impact.</div>}
      {!missing && needsInbox && <div className="cd-hint" style={{ marginTop: 10 }}>Items without a category wait in the Inbox.</div>}
    </Sheet>
  );
}

function Evening({ ctx, items, close }) {
  const [queue] = useState(() => todaySort(items.filter((i) => i.status === "today")).map((i) => i.id));
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState({ tomorrow: 0, week: 0, future: 0, someday: 0, watching: 0, skipped: 0 });
  const [history, setHistory] = useState([]);   // every choice, so each can be undone
  const [leaving, setLeaving] = useState(false);
  const [enterFrom, setEnterFrom] = useState(1); // 1 = new card slides in from the right, -1 = undo brings it back from the left
  const [dx, setDx] = useState(0);        // how far the card is being dragged sideways
  const [dragging, setDragging] = useState(false);
  const [exitX, setExitX] = useState(null); // set while the card is flung off the side by a swipe
  const swipeRef = useRef(null);

  const finished = items.filter((i) => i.status === "done" && isToday(i.doneAt)).length;
  const inFlow = idx < queue.length;
  const cur = inFlow ? items.find((i) => i.id === queue[idx]) : null;

  // If an item vanished mid-flow, skip past it
  useEffect(() => { if (inFlow && !cur) setIdx((i) => i + 1); }, [inFlow, cur]);

  // the same dates the Inbox urgency toggle uses: Next = +3 days, Later = +7 days
  const dueFor = (v) => offsetDay(URGENCY_OPTS.find((o) => o.v === v).days);
  const snapOf = (c) => ({ status: c.status, due: c.due, someday: c.someday, doneAt: c.doneAt, doneFrom: c.doneFrom, urgency: c.urgency || null, effort: c.effort || null, impact: c.impact || null });
  // Tomorrow = Now, due tomorrow: the task leaves Today now and comes back on its day. (Between midnight and 5 AM, "tomorrow" is the next calendar day, i.e. today's date.)
  const rollToTomorrow = () => ({ status: "future", someday: false, urgency: "now", due: offsetDay(1), migratedOn: iso() });   // migratedOn: the day it was sent from
  const choose = (kind) => {
    if (!cur || leaving) return;
    setExitX(null);
    const before = snapOf(cur);
    const id = cur.id, at = idx;
    // save the choice at once, so closing or leaving right away can never lose it...
    if (kind === "done") ctx.toggleDone(id);
    if (kind === "tomorrow") ctx.patchItem(id, rollToTomorrow());   // Now
    if (kind === "week") ctx.patchItem(id, { status: "future", someday: false, urgency: "next", due: dueFor("next") });     // Next
    if (kind === "future") ctx.patchItem(id, { status: "future", someday: false, urgency: "later", due: dueFor("later") });   // Later
    if (kind === "someday") ctx.patchItem(id, { status: "future", someday: true });   // parked: no date, no urgency
    if (kind === "watching") ctx.patchItem(id, { status: "watching" });
    setLeaving(true);                       // ...then the card slides away and the next one arrives
    setTimeout(() => {
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
    const befores = queue.slice(idx).map((id) => items.find((x) => x.id === id)).filter(Boolean).map((c) => ({ id: c.id, before: snapOf(c) }));
    befores.forEach((b) => ctx.patchItem(b.id, rollToTomorrow()));   // every remaining task rolls to tomorrow
    setHistory((h) => [...h, { kind: "rest", n, idxBefore: idx, befores }]);
    setLog((l) => ({ ...l, tomorrow: l.tomorrow + n }));
    setIdx(queue.length);
  };
  const complete = () => { ctx.markCleaned(); close(); ctx.toast("Day closed. Rest up."); };
  const undoNow = (silent) => {
    const e = history[history.length - 1];
    if (!e) return;
    setHistory((h) => h.slice(0, -1));
    if (e.kind !== "skip") {
      if (e.id) ctx.patchItem(e.id, e.before);                                    // put the task back as it was
      if (e.befores) e.befores.forEach((b) => ctx.patchItem(b.id, b.before));       // ...or all of them, for "keep the rest"
    }
    if (e.kind === "rest") setLog((l) => ({ ...l, tomorrow: l.tomorrow - e.n }));
    else if (e.kind === "skip") setLog((l) => ({ ...l, skipped: l.skipped - 1 }));
    else if (e.kind !== "done") setLog((l) => ({ ...l, [e.kind]: l[e.kind] - 1 }));
    setEnterFrom(-1);
    setIdx(e.idxBefore);
    if (!silent) ctx.toast("Undone");
  };
  const undo = () => { if (leaving || !history.length) return; setExitX(null); undoNow(false); };

  // Swipe the card: left = skip it (the task stays as it is), right = go back one card (the same as Undo)
  const skipCard = () => {
    if (!cur || leaving) return;
    const at = idx, id = cur.id, before = snapOf(cur);
    setExitX(-460); setLeaving(true);
    setTimeout(() => {
      setLog((l) => ({ ...l, skipped: l.skipped + 1 }));
      setHistory((h) => [...h, { kind: "skip", id, before, idxBefore: at }]);
      setEnterFrom(1); setIdx(at + 1); setDx(0); setExitX(null); setLeaving(false);
    }, 190);
  };
  const goBack = () => {
    if (!history.length || leaving) { setDx(0); return; }   // nothing before this card: it springs back
    setExitX(460); setLeaving(true);
    setTimeout(() => { undoNow(true); setDx(0); setExitX(null); setLeaving(false); }, 190);
  };
  const onDown = (e) => {
    if (leaving || !cur) return;
    swipeRef.current = { x: e.clientX, y: e.clientY, moved: false };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ }
  };
  const onMove = (e) => {
    const d = swipeRef.current;
    if (!d) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.moved && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) d.moved = true;
    if (d.moved) setDx(mx);
  };
  const onUp = () => {
    const d = swipeRef.current; swipeRef.current = null; setDragging(false);
    if (!d || !d.moved) { setDx(0); return; }
    if (dx < -70) skipCard(); else if (dx > 70) goBack(); else setDx(0);
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
        <div key={cur.id} className={"cd-evecard" + (leaving && exitX == null ? " out" : "") + (dragging && dx ? " dragging" : "")}
          style={{
            "--from": `${enterFrom * 44}px`,
            ...(exitX != null ? { animation: "none", transform: `translateX(${exitX}px) rotate(${exitX / 30}deg)`, opacity: 0, transition: "transform .19s ease-in, opacity .19s ease-in" }
              : dx ? { animation: "none", transform: `translateX(${dx}px) rotate(${dx / 24}deg)`, transition: dragging ? "none" : "transform .22s cubic-bezier(.2,.8,.2,1)" } : null),
          }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="cd-evetitle">{cur.title}</div>
          <Chip name={cur.category} catStyle={ctx.catStyle} />
          <div className="cd-swipehint">{history.length ? "← swipe to skip · swipe back →" : "← swipe to skip"}</div>
        </div>
        <div className="cd-evegrid">
          <button className="cd-evego" onClick={() => choose("tomorrow")}><Sun size={18} />Tomorrow<small>Now · {shortDay(offsetDay(1))}</small></button>
          <button className="cd-evego" onClick={() => choose("week")}><Calendar size={18} />This week<small>Next · {shortDay(dueFor("next"))}</small></button>
          <button className="cd-evego" onClick={() => choose("future")}><CalendarDays size={18} />Future<small>Later · {shortDay(dueFor("later"))}</small></button>
          <button className="cd-evego someday" onClick={() => choose("someday")}><Sparkles size={18} />Someday<small>No date</small></button>
          <button className="cd-evego watch" onClick={() => choose("watching")}><Eye size={18} />Watch<small>Check back</small></button>
          <button className="cd-evego all" disabled={queue.length - idx <= 1} onClick={keepRest}><ArrowRight size={18} />Everything<small>to tomorrow</small></button>
          <button className="cd-evego complete" onClick={complete}><Check size={18} />Complete<small>Close out the day</small></button>
        </div>
      </Sheet>
    );
  }
  if (inFlow) return null;

  /* Step: summary of the day */
  const tomorrow = items.filter((i) => !i.someday && (i.status === "today" || (i.status === "future" && i.due && i.due <= offsetDay(1))));   // everything that will be on Today tomorrow
  const heavy = tomorrow.filter((i) => i.effort === "deep" && i.impact === "high").length;
  const maxShow = typeof window !== "undefined" && window.innerHeight < 720 ? 3 : 5;   // keep the summary on screen on small phones
  const rows = [
    ["Finished today", finished],
    ["Moved to tomorrow", log.tomorrow],
    ["Moved to this week", log.week],
    ["Moved to Future", log.future],
    ["Moved to Someday", log.someday],
    ["Moved to Watching", log.watching],
    ["Skipped (still open)", log.skipped],
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

function BackupSheet({ ctx, close }) {
  const [snaps, setSnaps] = useState(null);
  const [found] = useState(() => findStoredCandidates());
  useEffect(() => { let alive = true; listSnapshots().then((l) => { if (alive) setSnaps(l); }); return () => { alive = false; }; }, []);
  const readFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { const j = JSON.parse(String(r.result)); if (ctx.restoreState(j.state || j)) close(); }
      catch { ctx.toast("Couldn’t read that file"); }
    };
    r.readAsText(file);
  };
  return (
    <Sheet title="Back up & restore" onClose={close}>
      <div className="cd-sub" style={{ marginBottom: 4 }}>Your tasks are saved in this browser. A backup file is a safety copy you can keep anywhere.</div>
      <div className="cd-sub" style={{ marginBottom: 10, fontWeight: 600 }}>
        Last backup: {ctx.lastBackupAt ? new Date(ctx.lastBackupAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never"}
      </div>
      <button className="cd-ghost" style={{ marginTop: 0 }} onClick={() => ctx.backupData()}><Download size={18} /> Download a backup</button>
      <div className="cd-sub" style={{ margin: "6px 2px 4px", fontSize: 12.5 }}>It is always saved as <b>clear-the-day-backup.json</b>. If Files asks, choose <b>Replace</b> so you only keep one copy.</div>
      <label className="cd-ghost" style={{ cursor: "pointer" }}>
        <RotateCcw size={18} /> Restore from a backup file
        <input type="file" accept=".json,application/json" hidden onChange={(e) => { readFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      </label>
      <div className="cd-fl" style={{ marginTop: 18 }}>Saved data found on this device</div>
      <div className="cd-catlist">
        {found.length === 0 && <div className="cd-sub">Nothing else found.</div>}
        {found.map((c) => (
          <div className="cd-catitem" key={c.key}>
            <span style={{ minWidth: 0 }}>{candidateLabel(c.key)}</span>
            <span className="n">{c.count} {c.count === 1 ? "task" : "tasks"}</span>
            <button className="cd-pill" onClick={() => { if (ctx.restoreState(c.state)) close(); }}>Restore</button>
          </div>
        ))}
      </div>
      <div className="cd-fl" style={{ marginTop: 18 }}>Automatic backup (one copy, replaced each day)</div>
      <div className="cd-catlist">
        {snaps === null && <div className="cd-sub">Looking…</div>}
        {snaps && snaps.length === 0 && <div className="cd-sub">None yet. It is saved the first time you open the app each day, and replaced the next day.</div>}
        {snaps && snaps.map((sn) => (
          <div className="cd-catitem" key={sn.key}>
            <span>{sn.day}</span>
            <span className="n">{sn.count} {sn.count === 1 ? "task" : "tasks"}</span>
            <button className="cd-pill" onClick={() => { if (ctx.restoreState(sn.state)) close(); }}>Restore</button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// Deleting a category that still has items: move them to another category, or send them back to the Inbox to be sorted again
function DeleteCategory({ ctx, items, name, close }) {
  const n = items.filter((i) => i.category === name).length;
  const others = ctx.categories.filter((c) => c !== name);
  const [mode, setMode] = useState(others.length ? "move" : "resort");
  const [target, setTarget] = useState(others[0] || null);
  const [fresh, setFresh] = useState("");
  const dest = fresh.trim() || target;
  const back = () => ctx.setSheet({ type: "cats" });
  const go = () => { ctx.deleteCategory(name, mode === "move" ? { moveTo: dest } : {}); back(); };
  return (
    <Sheet title={`Delete “${name}”?`} onClose={back}>
      <div className="cd-sub">“{name}” is on {n} {n === 1 ? "item" : "items"}. What should happen to {n === 1 ? "it" : "them"}?</div>
      <button className={"cd-delopt" + (mode === "move" ? " on" : "")} onClick={() => setMode("move")}>
        <b>Move {n === 1 ? "it" : "them"} to another category</b><span>Everything keeps its place and just gets the new category.</span>
      </button>
      {mode === "move" && (
        <div className="cd-delpick">
          {others.length > 0 && <div className="cd-pills" style={{ flexWrap: "wrap" }}>
            {others.map((c) => <button key={c} className={"cd-segbtn sm" + (!fresh.trim() && target === c ? " on" : "")} onClick={() => { setTarget(c); setFresh(""); }}>{c}</button>)}
          </div>}
          <input className="cd-input" placeholder={others.length ? "Or a new category" : "Name a new category"} value={fresh} maxLength={24} onChange={(e) => setFresh(e.target.value)} aria-label="New category name" />
        </div>
      )}
      <button className={"cd-delopt" + (mode === "resort" ? " on" : "")} onClick={() => setMode("resort")}>
        <b>Re-sort {n === 1 ? "it" : "them"} in the Inbox</b><span>Open items go back to the Inbox to be sorted again. Finished tasks just lose the category.</span>
      </button>
      <button className="cd-primary" disabled={mode === "move" && !dest} onClick={go}>Delete “{name}”</button>
      <button className="cd-ghost" onClick={back}>Cancel</button>
    </Sheet>
  );
}

function CatManager({ ctx, items, close }) {
  const [name, setName] = useState("");
  const [picking, setPicking] = useState(null);   // the category whose colours are showing
  const count = (c) => items.filter((i) => i.category === c).length;
  const add = () => { const n = name.trim(); if (n) { ctx.addCategory(n); setName(""); } };
  return (
    <Sheet title="Categories" onClose={close}>
      <div className="cd-sub" style={{ marginBottom: 6 }}>Tap a color dot to change a category’s color. Deleting a category with items asks what to do with them.</div>
      <div className="cd-catlist">
        {ctx.categories.length === 0 && <div className="cd-sub" style={{ padding: "10px 0" }}>No categories yet.</div>}
        {ctx.categories.map((c) => {
          const n = count(c);
          return (
            <React.Fragment key={c}>
              <div className="cd-catitem">
                <button className="cd-catdot" style={{ background: ctx.catStyle(c)[1] }} onClick={() => setPicking(picking === c ? null : c)} aria-label={`Change the color of ${c}`} />
                <CatText name={c} catStyle={ctx.catStyle} />
                <span className="n">{n} {n === 1 ? "item" : "items"}</span>
                <button className="cd-x" onClick={() => (n === 0 ? ctx.removeCategory(c) : ctx.setSheet({ type: "delcat", name: c }))} aria-label={`Delete ${c}`}><Trash2 size={16} /></button>
              </div>
              {picking === c && (
                <div className="cd-swatches">
                  {CAT_COLORS.map((col, k) => (
                    <button key={col.name} className={"cd-swatch" + ((ctx.catStyle(c)[1] === col.pair[1]) ? " on" : "")} style={{ background: col.pair[1] }}
                      onClick={() => ctx.setCategoryColor(c, k)} aria-label={col.name} />
                  ))}
                  <button className="cd-swatch reset" onClick={() => ctx.setCategoryColor(c, null)}>Theme color</button>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="cd-addrow">
        <input className="cd-input" placeholder="New category" value={name} maxLength={24} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }} enterKeyHint="done" aria-label="New category name" />
        <button onClick={add}>Add</button>
      </div>
    </Sheet>
  );
}

function Confetti() {
  const colors = ["var(--q1)", "var(--q2)", "var(--q3)", "var(--q4)", "var(--accent)"];
  return (
    <div className="cd-confetti" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % 5], animationDelay: `${(i % 7) * 0.05}s`,
          animationDuration: `${1.1 + (i % 5) * 0.18}s`, "--dx": `${((i * 53) % 90) - 45}px`, "--r": `${300 + (i * 41) % 360}deg` }} />
      ))}
    </div>
  );
}

function Settings({ ctx, close }) {
  return (
    <Sheet title="Settings" onClose={close}>
      <button className="cd-ghost" onClick={() => ctx.setSheet({ type: "cats" })}><FolderIcon size={18} /> Manage categories</button>
      <button className="cd-ghost" onClick={() => ctx.setSheet({ type: "backup" })}><Download size={18} /> Back up &amp; restore</button>
      <div className="cd-setrow">
        <button className="cd-ghost" onClick={() => ctx.exportData()}><Download size={18} /> Export</button>
        <button className="cd-ghost" style={{ color: "var(--danger)" }} onClick={() => { ctx.resetData("empty"); close(); }}><Trash2 size={18} /> Clear all</button>
      </div>
      <div className="cd-version">Clear the Day · Version {APP_VERSION}</div>
    </Sheet>
  );
}

// Choose how Today's list is sorted
function SortSheet({ ctx, close }) {
  const mode = ctx.todaySortMode;
  const pick = (m) => { ctx.setTodaySortMode(m); close(); };
  return (
    <Sheet title="Sort Today’s list" onClose={close}>
      <button className={"cd-delopt" + (mode === "mine" ? " on" : "")} onClick={() => pick("mine")}>
        <b>My order</b><span>Hold and drag tasks to put them where you want.</span>
      </button>
      <button className={"cd-delopt" + (mode === "matrix" ? " on" : "")} onClick={() => pick("matrix")}>
        <b>By the matrix</b><span>Quick Wins, Major Focus, Admin / Fillers and Deferral, each in its own card.</span>
      </button>
      <button className={"cd-delopt" + (mode === "category" ? " on" : "")} onClick={() => pick("category")}>
        <b>By category</b><span>One card for each category.</span>
      </button>
      <button className="cd-ghost" onClick={close}>Close</button>
    </Sheet>
  );
}

/* ═════════════════════════════════ APP ════════════════════════════════════ */

const TABS = [
  { k: "today", label: "Today", Icon: CheckCircle2 },
  { k: "inbox", label: "Inbox", Icon: Inbox },
  { k: "future", label: "Future", Icon: CalendarDays },
  { k: "radar", label: "Radar", Icon: Radar },
  { k: "dashboard", label: "Dashboard", Icon: BarChart3 },
];

export default function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("today");
  const [sheet, setSheet] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const [vvh, setVvh] = useState(null);
  const stateRef = useRef(null); stateRef.current = state;
  const [settled, setSettled] = useState(false);   // false for the first moments after launch: no fade-in animations
  useEffect(() => { const t = setTimeout(() => setSettled(true), 800); return () => clearTimeout(t); }, []);
  const lockedRef = useRef(false);            // true when saved data exists but couldn't be read: never save over it
  const [burst, setBurst] = useState(0);        // confetti
  const [inboxOrder, setInboxOrder] = useState([]);   // the order of the Inbox deck
  const [fontsReady, setFontsReady] = useState(false);   // the saved theme's fonts are loaded
  const [radarMode, setRadarMode] = useState("watching");   // which Radar list is showing
  const burstTimer = useRef(null);
  const [dayKey, setDayKey] = useState(iso());
  const [justDone, setJustDone] = useState(() => new Set());   // finished during this visit to a tab; cleared when you switch tabs

  // New day, or coming back to the app: re-check what's due today
  useEffect(() => {
    const check = () => setDayKey(iso());
    const timer = setInterval(check, 60000);   // also notice the new day (5 AM) if the app was simply left open
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, []);

  // Anything in Future that is due today belongs on the Today page.
  // `promotedOn` makes this happen once per day, so moving an item back to Future sticks.
  // Runs on load and when the day changes (not on every edit).
  const loaded = !!state;
  useEffect(() => {
    if (!loaded) return;
    const t = iso();
    const due = stateRef.current.items.filter((i) => i.status === "future" && !i.someday && i.due && i.due <= t && i.promotedOn !== t);
    if (!due.length) return;
    const ids = new Set(due.map((i) => i.id));
    setState((s) => ({ ...s, items: s.items.map((i) => (ids.has(i.id) ? { ...i, status: "today", promotedOn: t } : i)) }));
    setToastMsg({ m: `${due.length} due ${due.length === 1 ? "task" : "tasks"} moved to Today` });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, [loaded, dayKey]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let closeTimer = null;
    const f = () => {
      const kbh = Math.round(window.innerHeight - vv.height - vv.offsetTop);   // keyboard height
      const open = vv.scale < 1.05 && kbh > 120;
      if (window.scrollY) window.scrollTo(0, 0);   // the page itself must never scroll
      clearTimeout(closeTimer);
      if (open) setVvh(kbh);
      // when the keyboard closes, wait for it to finish sliding down before the bottom bars come back
      else closeTimer = setTimeout(() => setVvh(null), 240);
    };
    f();
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => { clearTimeout(closeTimer); vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { state: s, unreadable } = await loadState();
      if (!alive) return;
      lockedRef.current = !!unreadable;
      if (unreadable) {
        setToastMsg({ m: "Couldn’t read your saved data, so nothing will be saved this time. Reload to try again." });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastMsg(null), 9000);
      }
      if (s) snapshotOncePerDay(s);
      // an old saved theme name (from before the five new themes) falls back to the default
      setState(s
        ? { ...s, themeId: THEMES[s.themeId] ? s.themeId : DEFAULT_THEME, items: s.items.map(normalizeItem) }
        : { items: makeSeed().map(normalizeItem), categories: DEFAULT_CATS, themeId: DEFAULT_THEME });
      const moved = s ? s.items.filter((it, k) => (it.status === "today" || it.status === "future") && !it.someday && (!it.effort || !it.impact)).length : 0;
      if (moved && !unreadable) {
        setToastMsg({ m: `${moved} ${moved === 1 ? "task has" : "tasks have"} no effort or impact, so ${moved === 1 ? "it's" : "they're"} waiting in the Inbox` });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastMsg(null), 9000);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Save shortly after the last change, so a burst of edits (drag-reorders, rapid taps) is one write
  useEffect(() => {
    if (!state || lockedRef.current) return;
    const t = setTimeout(() => saveState(state), 400);
    return () => clearTimeout(t);
  }, [state]);

  // ...and save immediately if the app is hidden or closed inside that 0.4 s
  useEffect(() => {
    const flush = () => { if (stateRef.current && !lockedRef.current) saveState(stateRef.current); };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", flush); };
  }, []);

  // The phone's status bar / browser tint is the active theme's bottom-bar colour: a soft white that suits that theme. iOS only reads
  // it when the app starts, so after switching themes it can keep the previous theme's soft white until the next launch (barely visible).
  useEffect(() => {
    const t = THEMES[state && state.themeId] || THEMES[DEFAULT_THEME];
    const color = t.vars["--nav-bg"] || CHROME_COLOR;
    const old = document.querySelector('meta[name="theme-color"]');
    if (old) old.remove();
    const m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    m.setAttribute("content", color);
    document.head.appendChild(m);
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
  }, [state && state.themeId]);

  // The loading icon is no longer a setting: clear any choice that an older version remembered
  useEffect(() => { try { localStorage.removeItem("ctd:icon"); } catch (e) { /* storage unavailable */ } }, []);

  // A gentle nudge to back up: at most once a day, only with 10+ tasks and no backup for a week; stays on screen for 5 seconds
  useEffect(() => {
    if (!loaded || lockedRef.current) return;
    const s = stateRef.current;
    const stale = !s.lastBackupAt || Date.now() - s.lastBackupAt > 7 * 864e5;
    if (!stale || s.items.length < 10 || s.backupNudgeOn === iso()) return;
    const t = setTimeout(() => {
      setState((x) => ({ ...x, backupNudgeOn: iso() }));
      setToastMsg({ m: s.lastBackupAt ? "It’s been over a week since your last backup." : "You haven’t backed up your tasks yet.",
        a: { label: "Back up", run: () => setSheet({ type: "backup" }) } });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 5000);
    }, 2500);
    return () => clearTimeout(t);
  }, [loaded]);

  // Once the saved theme is known, wait for its fonts before showing the app
  useEffect(() => {
    if (!loaded || fontsReady) return;
    let alive = true;
    loadThemeFonts(stateRef.current.themeId, Math.max(0, 1500 - (Date.now() - BOOT_T0))).then(() => { if (alive) setFontsReady(true); });   // 1.5 s in total from app start, never longer
    return () => { alive = false; };
  }, [loaded, fontsReady]);

  // While the saved data and fonts load, show a plain neutral screen (not a theme), so no theme flashes before yours appears
  if (!state || !fontsReady) {
    return (
      <div className="cd-outer" style={{ background: CHROME_COLOR }}>
        <style>{CSS}</style>
        <div className="cd" style={{ background: CHROME_COLOR, display: "grid", placeItems: "center" }}>
          <BootMark />
        </div>
      </div>
    );
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
  const celebrate = () => {
    buzz([12, 40, 12, 40, 24]);
    setBurst(Date.now());
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(0), 2400);
  };

  const ctx = {
    categories,
    toast,
    setSheet,
    themeIcon: theme.icon || Sun,
    themeId: state.themeId,
    lastBackupAt: state.lastBackupAt,
    unsorted: items.filter(isUnlabeled).length,
    goTab: (k) => { setTab(k); setJustDone(new Set()); },
    radarMode, setRadarMode,
    inboxOrder, setInboxOrder,
    todaySortMode: state.todaySort || "mine",
    setTodaySortMode: (mode) => update(() => ({ todaySort: mode })),
    goRadar: (mode) => { setRadarMode(mode); setTab("radar"); setJustDone(new Set()); },
    cleaned: state.cleanedOn === iso(),
    markCleaned: () => { celebrate(); update(() => ({ cleanedOn: iso() })); },
    openMenu: (id) => setSheet({ type: "menu", id }),
    catStyle: (name) => {
      const own = (state.categoryColors || {})[name];
      if (own != null && CAT_COLORS[own]) return CAT_COLORS[own].pair;
      const idx = Math.max(0, categories.indexOf(name));
      return theme.catPalette[idx % theme.catPalette.length];
    },
    setCategoryColor: (name, idx) => update((s) => { const m = { ...(s.categoryColors || {}) }; if (idx == null) delete m[name]; else m[name] = idx; return { categoryColors: m }; }),
    addItem: (p) => update((s) => ({
      items: [...s.items, normalizeItem(clearParked({ id: uid(), title: "", category: null, effort: null, impact: null, status: "inbox", due: null,
        someday: false, createdAt: Date.now(), doneAt: null, doneFrom: null, ...p }))],
    })),
    patchItem: (id, patch) => update((s) => ({ items: s.items.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i, ...patch };
      // the "migrated" mark only lasts while the task is still the one you sent to tomorrow: a new date, or a move elsewhere, clears it
      // (unless this very change is the one marking it)
      const marking = patch.migratedOn !== undefined && patch.migratedOn !== i.migratedOn;
      if (!marking && i.migratedOn && (next.due !== i.due || next.someday || (next.status !== i.status && next.status !== "today"))) next.migratedOn = null;
      return normalizeItem(clearParked(next));
    }) })),
    reorderToday: (ids) => update((s) => ({ items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, pos: k } : i; }) })),
    reorderWatching: (ids) => update((s) => ({ items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, wpos: k } : i; }) })),
    moveToTop: (id) => update((s) => {
      const ids = [id, ...todaySort(s.items.filter((i) => i.status === "today")).map((i) => i.id).filter((x) => x !== id)];
      return { items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, pos: k } : i; }) };
    }),
    // Moving something to Today reschedules it: a past due date becomes today, so it no longer reads as overdue
    moveToToday: (id) => update((s) => ({
      items: s.items.map((i) => (i.id === id
        ? normalizeItem({ ...i, status: "today", someday: false, urgency: "now", due: iso(), migratedOn: null })
        : i)),
    })),
    removeItem: (id) => update((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    restoreItem: (item) => update((s) => ({ items: s.items.some((i) => i.id === item.id) ? s.items : [...s.items, item] })),
    justDone,
    toggleDone: (id) => {
      const it = items.find((i) => i.id === id);
      if (it && it.status !== "done") {
        buzz(10);
        if (it.status === "today" && items.filter((i) => i.status === "today" && i.id !== id).length === 0) celebrate();   // last one on the deck
      }
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
    removeCategory: (name) => {
      const prev = { items, categories, categoryColors: state.categoryColors || {} };
      update((s) => { const m = { ...(s.categoryColors || {}) }; delete m[name]; return { categories: s.categories.filter((c) => c !== name), categoryColors: m }; });
      toast(`Deleted “${name}”`, { label: "Undo", run: () => update(() => prev) });
    },
    // Deleting a category that has items: either move them all to another category, or send them back to the Inbox to be sorted again
    deleteCategory: (name, { moveTo = null } = {}) => {
      const prev = { items, categories, categoryColors: state.categoryColors || {} };
      const affected = items.filter((i) => i.category === name);
      const canon = moveTo ? (categories.find((c) => c.toLowerCase() === moveTo.toLowerCase() && c !== name) || moveTo) : null;
      update((s) => {
        let cats = s.categories.filter((c) => c !== name);
        if (canon && !cats.includes(canon)) cats = [...cats, canon];
        const colors = { ...(s.categoryColors || {}) }; delete colors[name];
        return { categories: cats, categoryColors: colors, items: s.items.map((i) => {
          if (i.category !== name) return i;
          if (canon) return normalizeItem({ ...i, category: canon });
          if (i.status === "done") return { ...i, category: null };   // finished tasks just lose the label
          return normalizeItem({ ...i, category: null, status: "inbox", someday: false, due: null });   // everything else goes back to be sorted
        }) };
      });
      const open = affected.filter((i) => i.status !== "done").length;
      toast(canon ? `Deleted “${name}”. ${affected.length} ${affected.length === 1 ? "item" : "items"} moved to ${canon}` : `Deleted “${name}”. ${open} ${open === 1 ? "item" : "items"} sent to the Inbox`,
        { label: "Undo", run: () => update(() => prev) });
    },
    addCategory: (name) => update((s) => (s.categories.some((c) => c.toLowerCase() === name.toLowerCase()) ? {} : { categories: [...s.categories, name] })),
    // A backup is the whole app state as a JSON file. It uses the same save/share path as the Excel export.
    backupData: async () => {
      const payload = { app: "clear-the-deck", version: APP_VERSION, savedAt: new Date().toISOString(),
        state: { items, categories, categoryColors: state.categoryColors || {}, todaySort: state.todaySort || "mine", themeId: state.themeId, cleanedOn: state.cleanedOn } };
      try {
        await saveFile(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "clear-the-day-backup.json"   /* always the same name, so a new backup replaces the old one */);
        update(() => ({ lastBackupAt: Date.now() }));
        toast("Backup saved");
      } catch (e) { if (!e || e.name !== "AbortError") toast("Couldn’t save the backup"); }
    },
    restoreState: (st) => {
      if (!st || !Array.isArray(st.items) || !Array.isArray(st.categories)) { toast("That isn’t a Clear the Day backup"); return false; }
      const prev = { items, categories, categoryColors: state.categoryColors || {}, todaySort: state.todaySort || "mine", themeId: state.themeId, cleanedOn: state.cleanedOn };
      lockedRef.current = false;   // restoring is an explicit choice, so saving is safe again
      update(() => ({ items: st.items.map(normalizeItem), categories: st.categories, categoryColors: st.categoryColors || {},
        ...(["mine", "matrix", "category"].includes(st.todaySort) ? { todaySort: st.todaySort } : {}),
        ...(st.themeId && THEMES[st.themeId] ? { themeId: st.themeId } : {}), ...(st.cleanedOn ? { cleanedOn: st.cleanedOn } : {}) }));
      toast("Backup restored", { label: "Undo", run: () => update(() => prev) });
      return true;
    },
    exportData: async () => {
      if (!items.length) { toast("Nothing to export yet"); return; }
      try { const n = await downloadExport(items); toast(`Exported ${n} ${n === 1 ? "item" : "items"}`); }
      catch (e) { if (!e || e.name !== "AbortError") toast("Couldn't export. Try again"); }
    },
    resetData: (kind) => {
      const prev = { items, categories };
      update(() => ({ items: kind === "sample" ? makeSeed() : [], categories: DEFAULT_CATS }));
      toast(kind === "sample" ? "Sample data loaded" : "Everything cleared", { label: "Undo", run: () => update(() => prev) });
    },
  };

  const unlabeledCount = items.filter(isUnlabeled).length;
  const attnCount = items.filter((i) => i.status === "future" && !i.someday && i.due && i.due < iso()).length;
  const menuItem = sheet?.type === "menu" ? items.find((i) => i.id === sheet.id) : null;
  const editItem = sheet?.type === "edit" && sheet.id ? items.find((i) => i.id === sheet.id) : null;
  const dateItem = sheet?.type === "date" ? items.find((i) => i.id === sheet.id) : null;
  const close = () => setSheet(null);

  const View = { today: TodayView, inbox: InboxView, future: FutureView, dashboard: DashboardView, completed: CompletedView, radar: RadarView }[tab];
  const activeTab = tab === "completed" ? "dashboard" : tab;   // Completed is reached from the Dashboard

  return (
    <div className="cd-outer" style={{ "--chrome-bg": theme.vars["--nav-bg"], "--outer-bg": theme.outer }}>
      <style>{CSS}</style>
      <div className={"cd" + (vvh ? " kb" : "") + (settled ? "" : " booting")} style={{ ...theme.vars, "--kb": (vvh || 0) + "px" }} data-theme="cafe"
        onPointerDown={(e) => {
          // Tapping anywhere that isn't a text field closes the keyboard
          const a = document.activeElement;
          if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && !e.target.closest("input,textarea,[data-keep-kb]")) a.blur();
        }}>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <filter id="cd-rough" x="-3%" y="-3%" width="106%" height="106%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className="cd-topstrip" aria-hidden="true" />
        <View ctx={ctx} items={items} />

        <nav className="cd-nav" aria-label="Sections">
          {TABS.map(({ k, label, Icon }) => (
            <button key={k} className={"cd-tab" + (activeTab === k ? " on" : "")} onClick={() => { if (k !== tab) { setTab(k); setJustDone(new Set()); } }} aria-current={activeTab === k ? "page" : undefined}>
              <Icon size={22} strokeWidth={activeTab === k ? 2.2 : 1.7} />
              {label}
              {k === "inbox" && unlabeledCount > 0 && <span key={unlabeledCount} className="cd-badge">{unlabeledCount}</span>}
              {k === "future" && attnCount > 0 && <span className="cd-badge warn" aria-label={`${attnCount} need attention`}>{attnCount}</span>}
            </button>
          ))}
        </nav>

        {sheet?.type === "menu" && menuItem && <ItemMenu ctx={ctx} item={menuItem} close={close} />}
        {sheet?.type === "date" && dateItem && <DateEditor ctx={ctx} item={dateItem} close={close} />}
        {sheet?.type === "edit" && <Editor ctx={ctx} item={editItem} initialStatus={sheet.status} close={close} />}
        {sheet?.type === "evening" && <Evening ctx={ctx} items={items} close={close} />}
        {sheet?.type === "settings" && <Settings ctx={ctx} close={close} />}
        {sheet?.type === "sort" && <SortSheet ctx={ctx} close={close} />}
        {sheet?.type === "cats" && <CatManager ctx={ctx} items={items} close={close} />}
      {sheet?.type === "delcat" && <DeleteCategory ctx={ctx} items={items} name={sheet.name} close={close} />}
        {sheet?.type === "backup" && <BackupSheet ctx={ctx} close={close} />}
        {burst ? <Confetti key={burst} /> : null}
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


/* ═══════════════════════ Café theme artwork (built in, so no separate image files are needed) ═══════════════════════ */
const CAFE_ART = {
  hdr: {
    today: "data:image/webp;base64,UklGRtBLAABXRUJQVlA4IMRLAACwngGdASroAwECPpVKoEylpCMlorPZgLASiWlu4XNsDJbM3H3jOt4v80nobzh+jz9Rejl05PNT+2XrHemj0C/6H/peuK9Gby6faZ8rDU4PYH+n9MPlx+08SfO97x/hv3S/wfPI6/8zf5p+Ov4/+Q9o39n/0/Fv5cf6H+R9g78l/oH+l/OL+/8ftwX/N9Av25+0/9X++eoj+H/3PUX7b/973Bf2B/7vtf4dNATyYf9D/8f7n1e/n3+59hf+hf4b/wf4kUwAVjkRcKyyLhWWRcKyyLhvaxyIuFZmX4VlkXCssi4VlkXCssi4VlkXCssi4VlkXOI1iKnjADeCKCuv1R9/6Ii4VlkXCssi4VlkXCssi4VlkXCssi4VlkW50DQQIhkqdkXCssi4VlkXCssi4VlkXCssi4VlkXCsgJiM0fY0RcKyyLhWWRcKyyLhWWRcKyyLhWWRcKyyLhWWy5HXgZyIuFZZFwrLIuFZZFwrLIuFZZFwrLIuFZZJ4qNCp8fREXCssi4VlkXCssi4VlkXCssi4VlkXCssykif1vcACnVL/REXCssi4VlkXCssi4VlkXCssi4VloKswn35aqJNYhNDq5OwHsybKDYLu1I5EXCssi4VlkXCssi4VlkXCqGlxuWH4DifFgzidOtV/O7aRDcESkn8X2wiQnv4CFef2cHKmnQU7HPv1SoFuFiXSapp0zasmooKFZZFwrLIuFZZFwrLIuFZZJ/2u0IOs+8BKjXfgxCoR06jOuqFW2oieEx0ZXjlvObKqSA/id0NM2VUnuw/oyV9YCJhVKhW9nxFuJTPFxsivCPbLnvF+iIuFZZFwrLIuFZZFw8KMTMmgVe0kHw9YHOm+xgn/oeQbSRxtNhUmjCCKy9T3jY9DAkAtjIi6CIhejKaKsT6jeGOlEQse7rrZOVZtvCrt+jTkfBmKIFYK8XXe4aW/PYvPElTvPu12/ntLu4OzIAKxyIuFZZFwrLIuFZY7oBB13ctnLrS7b7gvnq9nzcSsHR8fVmodPuBkuJcjTrINZzzRGlGhLuadljJg+rSkZ7pqugkL9KIGZ156n4Cv+dsgvbu8Iav7I1kX+EpVcx2pS3DNVdKwBjbcd0kVM+t+Wp86l9QOevMVkGGxtwoRMHrG+AnZFwrLIuFZZFwrLIuFZZHJ4rSM2SKwSvBOSXs7ZEGlV7/dFEU9chZkHMQIPs5gQzS/k2KewhVpXOBEuOkIv8a5WZ/7c91/urTUHIWOte7VvbX+v+51Pw51vCur2YA+s/CwMvOY//waQ6ch5DE9+Yq5SUrfiXeQZChxZYwFm6QuF1Czuj+x3W+0G8zQO2G6t6QJcKyyLhWWRcKyyLhWV0/qeebgI2B6/4NuZJdk7NBQY0p7p17jHsaVeZHYp7BOE/lRu3YR+xv6lvq4369kjMMxWt/IpFt2+4magSXGWWxBHPmfYx3IdpXr1UjiN8eLmG0KZcfhwofF3XUW4b1adAyt3wF5szHEP/vd5M/XUZgZvhfCdqmZj3gC9NWM3OhPIw2lRDgnES8E6zizQ9lqYJzqzYC8L3XmxkRcKyyLhWWRcKyyLhVQWQy/gIY+LtkaGVr4DQWp3sJrPr8aEPDbi1x4dhzRbvmbPCruMUgWLgnqJhlo0ew0PL89sIvKUx4MCA4U7M+MYFFvWi1F0Oq6/qKtPQrvBUBx64jlkIDcGFi5SGj0Eh8Ewu40FdS6vTelmCyKxuXdY3zSJxL6vxyQZGMMsiEsiL3jD6sTJ/9rO2Swcm9hY8G1EDGbMTica4RLpi1LozIAKxyIuFZZFwrLIuFY012+u5CUGMjmRLngJb849uT0UQ4w9TksEEUz2WDoLkQI6fCOQoCgt5StpFeRNzc/AIevgIUd/HaG0xVtV1kjTOHQAthfAy/6IfO70XhlUsaT/tgzgshe1hNhgCNSELXRZqC+BBU2q8m4ZEtH6JFt7Ta+QsTAXAHbxJ1QFRICwzwSvHQaQJ1Sze3Z3+PoiLhWWRcKyyLhWWQtfcQAmS7eqQ0zCk7bVHUnVr46gKHMNmpw0CXrBGiXEn4DR9mXDWuQZitDD/wLJGULHr8ItrBDnSgC8XxxMrCTxq/6iHUwWcxTdytW4aufWqW9RibBjp30hnhWUNVkJr3QlMUo1xhL4rCX1yBYfc9c0ypxIBKIA2rBn/i5FEt/8S4lFkXCssi4VlkXCssi4VXpnG+utzv3k/DqVwagEeO8ZJ9KlGpzNv1iqmX9om/B/RYIF3Qzf/ARjQ8JcLLF3kTWCEYFV4pM/prxXebOx2umSiH1eLCfpNmtsU9CFwSTeADYPJuqyHcQY47qv+vCovj6Ii4VlkXCssi4VNolFPOdUkbWH/Y3Saz/QgXB2vI1AhHhgmUA5d/JYq48xGURrANVtrk4Uez6JfLrwzhONvKP/r/82zLp4BGUkDpNlA+tkJ5uds0zBQt6E9qEnJNLMqxhLaYejPVWUlH9gWCCyLhWWRcKyyLhWWRcKyvNsg85JerfTlcy15aXb6oAeydUDpX/6W5A4wBNrU4hwwXU8XPw/99tX0QUeMl3L3U2hR7811xVptE6bGArO0XHYSpro9c9SrpCgaLJT+XmLUcwxw5sBxSzbEr6PPlJAgB0XcDW3WCTbLvdnaTHqilkXCssi4VlkXCssi4Vl8u0v4Ud8aUAkIhjmuSL4Rnxtdf2ezoK4z+w6JyyGlhSb58moZWxEjiSQ0vDs2wLxF2FPPE3l47KYOkzPMC3AxJ6tJkPgTJxhUu5ojAjftb8NXcCXy/SYdB9VfZQ3tayoZ9jbNABbcAU6xldQwLi3WPyJswWut9AGhUXx9ERcKyyLhWWRcUQOikG5N84H5T0CGGIrZ4cuaQHytuiJb2BoyfCWWqCplBBEmvnT817b0eOciVjjI1+kQ7FQqVGlgRT6iii9Gux5utwffmDlFg4XhXyA4ICemXqiOuV+GHuxiUTszdKkZRXGejRKSHcKfCovj6Ii4VlkXCssi4VNmM8nYA6i2iIiJczimEZCDCC3asKO301GmmpexVXkadP8t25vAcjYs5ayOANk3/6fVpMyAhO/0Zr8BBV0dBAzTpf0Yr2ShdZut8WoUhhYT3HqP0bdc9fZ2Kiuh+DGU9uRMzYGCEDkRcKyyLhWWRcKyyLhWYrwdM4S1n9M3VfQeOI2VDGXJfcv6gNIBm29o8/WTK+KGB6RV6D5Vbhparv7J2wpPlPMoVoADfssePZb0BrbYQDB/Cv8iZesmBlx+rU0STLRmPuiw3fozCpjSAhFgmsyN+qPE11Yni/REXCssi4VlkXCsrsakhhuWCIceoKaZLSdXWfHSleOVPPk9+ogQ8c56L/hDRCgV1pQYa4aCSOBlemIzAu4W2XOoU60daQVz5OuZoqBkbA/z4U+az1ZrbrnWrztHsqJQXjOK/ddzLQoN+YcEFkXCssi4VlkXCssi4VmvXK03iurYNwWRRNqgVRRfmuf+L+wjXf6hcmzgZVOkM95PQ9Pm5PM+9QoTOX4QZHb57OQSGB6hRfE3/q44XWTgt+YESI9bp/ZVA3SqSSlfPN5gxCVmSz9rTvuAJj2eL9ERcKyyLhWWRcKyyRid5rJobJYAtlszw1ifqaQnBVEGJByMML+QLTIhVMjaKPiz9eFl/mk7U6h8OMd5MPxgBmPldtms4PtxqTqMQrWP0qL12Z9/DLGfBI7WxVA5OrRCF4HCVSGpoFAer8SiisgNED5Cg9ni/REXCssi4VlkXCsrz1HyNXN31HlpuPY52t0vBv4vEqgN3jHNSgW/X32MctmzLH/jEut/c60pte5cDtvJj5l9YVcuWuam5sj1G/qMIPMpRTd6vHIi2gaxorGpVhPl9V163rFJU8jNijfVo1jkRcKyyLhWWRcKyx79hQ2+b/fuqvOtoao63fNhsF/NSf4mmdAaIQ+MuszG4HDT5wEzqTHW08KTZ4fIASFYxsSWLRfd42SCBB0Q0PqaZildsXTLMht6aqb8gDPs5AZTHmGuVQR9P1udMFj6rHIi4VlkXCssi4VlkXC4SPFQkILnWmiRsM2wdpx2AggC9Dhv1meSB5FeYwImISWmqT/4qLvkt3+d5XDLz+JSjRMbPq8of09RjKVrqOTp4/DFG9IxnXTDX60kPAsuI6f0Z6aWF511F4rXarArYYCLtPjDUS/lZabK4pZq3iyO8TBMFZ4v0RFwrLIuFZZFwrLIvxIcVAAvO4TPLXJ2RDGF3Fme5C99b4XjJAg10eEL8+YND+5kteSNb3/c23bkpTBfhgmtiKgvt+zrmS27PAAL7gYTHSNKuD7KDJuBnrxRAHROy5UdWcxjsEvBLFEo1jkRcKyyLhWWRcKyyLhWV/TATQIQxvAvyeYg5FREjxm0n1TGJtTQgqfi7b6fl4QT8GPdcUaxyIuFZZFwrLIuFZZFwrLKmPnQciLhWWRcKyyLZgAD+/zYgAAVzGPRqabMj7mgAAn5yIjGypwAazi0AUAAAAAWOFJ7AAAAAHQgAAAAABH2lWAAAAQsWfcQAAAAAD/DLcOjZJ5Z200ahSrSPyr+7E3gnaIDz+AAAW37jXLpY4O0izGn1Cu5N2Dk7B6qDi0lSCeMJZzg/kGhsYg9v7wlsa7Ks3XGWLAXAxLxD4AD9k5wQ10nuQXqAHQE898B3Du6KaShPzaL/+tmnkg2wAACyEsBhfKHlqkcSnSOTcKbkPh2zl98EtUcW8mvMNDwT+V0v/yKokcqCk0R9N1pO8OujtvkHm/nWk7AlEUzVsf/PIYfbsRR0E1kBZouXZfPZvE7X7OAnRd9Z9qhR/CGLDestrTelv5fEGjnQixMe6AnmoymiYG5mfd3YYgiPxv/tpLwUND5Ho+OE+c+7ptVtveKnmkZbPxjFf9D3fqtWmsq3m/v2nwcrTE2C8oVrwH6xE/W8CRIVoGwdtkvf5ZMpX7STyJABGyU44mf1/tabcNJhpkQJbYeYMdEQrxtPX3De4DhAmyy4eV6A1XHPMRgGtPL448A/fSVMmWvK63+iGT5Y6YngOKmG6OlohiBy5FPy47viQBuh5T2yfvmUi/FVk9nW3vpHZUIBxyDjb9tjI3XtJi4lTLsIZEdZjSawryrdIuF1vXhN5nZk5pOOyCr8fHVcUlZV6bJA7qRMSIXv5oqkvTkUd61ZBO01BnXFIkc2beW4uMM9GQ53DbxdgSat09uXFEWQ0B3JtUChb/sxWEXzsPILeQNe07rIBsSKJaOc1dM+bsO+VhtLgYmmXMAAo3S03JWNpj2TDem56yI2R9kEyia5o/thFIaPJ9xY5xkDoJEGRj20VkM/BhdGtaZeDpdIMaSPklBZzuQTQjJJS2nd3SO/KKIRsS6KBSNA0slUTflufVwNVkIXksDhvXRPniM/tVYZv4w6qsuKFqk26Lq9KqpQ1L4a/+3XvH58qQ+ITvIYAc1sdnUN7OR1u2ssPCucrW/A2Luh9zvOmHICMzsYozN4mlnnAcwVzcTHx+r/drjQxJXln+WBIshv9ykg0N2SbXUfK+4rtXZ5jpUpEV6okjc9M+/FJv40149gY6fIeagykXLieSM93uP2geofTQPLn8OgKmDYl/1aQ9Vl9Io13HE8Pmit1d6+ibIiHfoHXpk1xuEcU0sTbU0HOp7dWBAk8bDwTTOoaZXuQIIzdcf88ITyGDuIJV41PzNOoFXg2fwowSRi1KzYW8HtGM6Gv4+0ZBpm8iWZqofPoFumiLINcJtv2cQc1Y8ZrMKUAs9XDt7SKdBZYOmcpto5y10d54gofjZK0z0Oc/UwE9ZapsrdphdI18LWAEvUA38++3P6VFLtVfUYcOR5oYxehC/HKnfqSvKvo3ST+u28ELlMMUI9jbaJO8MNXDHw61iKl0KWnj7TQYCqV2QAAAGMlqgeAghcJ8aOlv0Wpi4Gk/N5mTySqC4i24jdl3tGBIDgLoWJR58qo1+xcEnRBOU9rMjq0BARqkxv8gm5AR0i3oUI5ToITR6RuDWBDPj8C2w0goJpr/HXn2aclwWdL5Ycs4yEyfAfmJ3O966rUbPX3ZZFXDpYddc+1O+S78Z1vceq5JKfUnxn9/7GQI2Z6TRCjVl5uVYe94K97rwfJ0A8rgdhav+PryeQmLx3nn0Ztyihh+FMjHiIjn+trrLPlLDJsyQNs1ImwE0Um8ZP3BlxMl1nZWjOmOyEpmo9ZIIUAt+m7ro34T+KD+Uogke9/4bshNrG4Kue3No4XpCto+atXzP/LW3YmBK0vFnYknXUm+oOb+ZMzo1shkMNE5PHYxayoGGhsCMIq0GFex4Qkl1aYgk0mGE+wRaoUj2T7l70MvCLj3KJTgMRfzT1xoe9THRQREG7r7occhgmxogxjc94G/tU3hTLqda+zSgXItVR4rFZ5IFPs2mPINqoLEOgfbHdMF+C/jhZLIgJ+tMOKGfftdOwCqQ2NAnowqrlEPB/fVi9fkTF22ArwJHw1Mh0VB9cdmzjCeWpkHErnz0X44JcPX7gvm71Hkc9N8SMq2XEz+SNud5sI7FSuwGJKWbCDAt8ytm8kmtXLbK7jaGtY5xKbu4Uc+3Dn4lNWJ3yvmCB4krLq1grNKG+TfNvzM1CMNLbpZ180Rp17Lj+MQ4Y4b/gW90JKnrgd0JtyrHoScJPOSTpPjTOcZPWRl0KkEb98SGER410AVnGW7m1iWpPyjgc/yZ++QFHOFRIDI8m/pu96/Y4elbgSE2F+9Y4HuZekP6cbVnHkUB989xfiH+y+yLtxnwOXcldrzl57qlr/6hKuKfKZxOdRlKeExEhqg5Xq1NUtg4pkFXvigAgiDFEePXiWGLhN5X8iXzn8Iu7EYaezCGY7bcITOHJPBgC+192m7FwCOKvRfPtuglQkueYPspIwADTaojYlh4mfbX+DzEm/tgKt5Ek27qkzJ1gpQ2mAWWEMvGbqT8d+CBEh8jOnnb9FVSfpFZeIAwUA7Yl6B3Tzo8KOY8Pi4AT4gTgISlNnN4VWcOZ8DkwJZP/K7wuXl0sKlk7y2n+z4BUo1qtkKT2OgY1UdQTnXEioYQUoyVcUHtEZ6AlyQk9Zz39FOuyAxNaYxFxwFYB2NJUtUzhShR38ivtqpih+EDGmAcvtJv/j7cnxQNsA2CL5ikHhBdLd/UMsWy981X7sB12/pq9uhbzASlKgfUI/sFa+mqrZVFcvDmTTdOjM8hP9Af1f1yf511ydM6gqEg27+iNrW70x1O/79bL+GwYBtbk6BY/8R20BiLLlRo9k9eeWo8D/n3KniCVGpXAoMDZ5F+dZT3k5H4orqBGYUzjQZyo5mOS+CRZUr/9HX6L+U+ms8BFki2j0b4TzUiblGVEjiILi4kCrQYiNwFYobPXaHv9wlCFjWgWmgwU04De3CkS+vRbYLE8JQfK/zNCoZiONtyiw9vU0rgJpe1Oj8dmVtRVKDOIB9c8qqfuyWYHjPZUuWGyxUDOGIEx4Xpt2kPotFP8eFn/q+CCk0O66qDyXOEfWVDxXxiI/BENF+r+VyzBISHYaMuqVfoCTx7oju10S0TtkUVj/y4GgcpmVHi4Knr7/cwtnRtuJQ5X8Q+N7RQ+ueQeN8p23YKQvnKoGHMPH5YdszUKy7kssegLys6hQPtdYKvgngk+fWnTmy09qAwDswCD2nLjhsdzhnxyoIe6QbTm3x8qWQ9k/3Cpl8cxli72pviAMH0dLWCeGDTX5gLB5fu3E3x9CMIJHvfuXCEivJBRd/YceMjaETxj+8QeioXS1L+zqzGUSN12bdQN+diuVAJkwH9qfkeXm++i/vx6irehkNMz9QSKAqTViQL1z+Eoph1F4vTe5E9WrMLVGQSv0VDxEniOL3srjQv6erhRbu8C9e6rZ6qpk0gF4YdAqkgYFUDKYNMCmrsMoc1DLuP8T/XHGDN66rptvTaJ48Mme3OXyEYQneM47AzO2p/ZjLUzsWeGCqOSVK9GVPckrilj213UGAIACoKsKA6iLTTVA+of8hxc5/2zQuecSZhodVeCVjUIoC1TvpVPb5CJrZXmiLnuAoawON99qmJKUqKeH9KTNdmboca3DSsS2VfGToEXSxsfJmf/abBtGEo9omX/GTFbmGfG/Iz2GfPmEXtshwCjfv9ySBrVGuuLfHGSlNIEumaZ+9cSR/aSxisB+LbsAhf6THLB+0JCYlP7QZGvbVGUxjSzzOkEdovG7SyH5kC7JcYqkDyvDphfvHthsRD8tkmMfc/xSWwR6OfLyHfRqrpowYPK++b2vrW5eoTnoYo3aGqrRoSXU5wbaQFqlh8KUq1OSnN69S5B3iZqkdW04RbuBB9+30hN0lcHTh64/hhpcaB3VzkIxZHuxdYtKlwS/ZFEriQknHbE3b4KCHT2vQ/ZFVkuSiOPfvXDtE9PAY5fRiRHRoqT9ASBYI/buX8DrmTx3JIZWHzhNIi7D8uhUF7M37HY550+xeviARQaSb5QfesECZ2o2V3jfOvsDqSQw+Rn4MzNJgc3QXlj+AaMuc13kWRjOoz7nFE966QcRMUKkqeKX3onVd9Auf8NmCMr37gBYagV5BJWC9cWQohDa8x5XXFSPtHCBLTIvsw1anYhxvYAAu7xw8yqtjDQOdNVMOTxvHV2k16YEbPd6YTTF5mGXduRb3ey8eg4dM0tJ/9tH8d7uatUBpfCtnMEFELABJgRvlonEHutlFKQ3eKi3Jv5pZmPQdXbAiymYGYvwl7WbYZEaJ/zI7pn3KVZadjk0YILvgVKRrxh/Zer7+8RQ38pfIHd/++axjgXW9IfrRr7v0kZaxazKCnwbREDUdfxWKlgjXQ0l8aVQvgUx5lZN8uqr+BTUOQMsmh4HiyjjTf7Zgq9bMOGj6kSyuJ3bSht0raafUutUZgthXbX3qCxVkanC71gSspj9LxmuG+06jTBO1ARqKlugnQIQYT65YLuDpjByeMYq40VP7LvuaQdrx2tb3KEVPekqzscACOwmAr2b8W8zKkXkzsgp+HIFUF9rT0fCCe9WAoj7h49D7cw4cAVvm45Lvlck2ChHy4foTaTXSiZuW3y6EfytBcBTieMsYDXO7wOCFOMNd8EeCaoqmfbyRfsnU4lPdbTFuU78xf26EQ+AACVd7sjqVF9d2nXHIZcJGL/iFHLIISRGHE+XGJ0Hz6+yateuyxmjSPLHQjJ8h9gNM99bEcgIuvM/SgXOJrCHRJAa7MQiDrlluAn9JgUilriFfU7Owi2J4B9MrFGWWN8CsnVpheMeLNqvCNUm5fKmMhrsn0ALwLTwQLaWq3WBuFgCNVT/wK+XvblOeOb4b9sWEjxH1ilIblci19Rc4+kRnr6J90If8DhXfgHtSPBAiFmtIuEVveZWaqyafzpDAw+VAGKUjApmCDy7sLK8mTxj6Z+m7RimdErhXvB7LeNFAPMvtc9N2NeOs2JlBZEUGonHoqFn59l4UXWbQCZLEzr1Ea3CiZdHZuLl5JKZEGDBC9yzO/s300BrND+xyAPINWaSX3apCr69vXAnWIflLdmWi7dSsWSy57K5NxKq0PLtlQe48pMatkBEhwncefj6omQ2X9PDF/Ux8e7zCC5oYsLk1bv5vgQB6fV9VGiFrnbIsqmCx3C/mrd9Jtj1fq/FG9e5rMfq7KxAa3apGVx1lyP5sK9vlnDPYjdHUp88ZDhE2KeUvWbAx8hXnhgZdz/90Weyq4hemEWsJIidGUKejZKLSXvRbuS/cAW/DvDrBd0eXWKOrHYRmufsiVOd2KAx233bWt+uWngTx3tn5MpW6UiHJxgay6SuKpZD63baJQ0sn0M3azY2orTum1Mjh3226OW0omdzZbHE37juXrEUr07a5PHFrurEHk8u3ELnDu36FgA1zmPUZXgMkmXm4uR2PawFpiKYXq8AUGPGD4n7/dp2hnC0L156gitwr8SxJWqqfrM1Nkyfirem+tOVrmsP57ILPhd7Mul2/PnTwkwOOTe7HiCBpnv0BctnVsuIq2Gk1K8vfubTtTk/uW7WTPo2zMSp00dPPWGqV7g5Gvv+dIJljy0gGOgE9Ri8c8R/YNOgKkKdv1jrGIqIUbgVCnVbXjYXikG/d0F6wP6msf9aNFEMMBgLZtqloIpXb9xih88gvC7Hj9VG+pkj1X1/o6m5G7Tm9+cPbAC/3WFCXmdHBYI64/qAz16VUPSPUrME8cTvhSzgBhXlg0I63xI9rq713YBphT5FDrDSZd2lmP8XC2eAnq2aJSXkDtBkn5OT+2nYi6+ay07lTIxp9CFuS1FAEmhNorWqvRznO7kseh6s2nuO2N4vKMX9xyOzoUQ9BCryz+8bymC32rkZYyLH1rTSMHJG1+6UM1WnHVseNeREP/NBdK6lfIovowt/pFpy3z7TXOtx3sj9J+OHnKdQPLNQGzqHhJIEUNXOCGmAoAFbGVIOmE6scusoxrmvjMu3VVqk6o24t9V4kYx7loamzVCXTbzpQsh0O3eZs6zLu9fbNeu+/gLO9WIdEbS0uwQ5+UhB92ynPtfByuwWzUVLiaH4K7XFJDDFN8PjFQlZa1b/nbrq1nzVEy/qhccG7OwMOZPNSprvlczyJ2tdrZN8/KezZCgC767vUg4w/XFacvlbf14JIMmAfXB2y518JUdnq37YtOy9B+2kU2uTSLqyH7Ej0sUOU6J0xKa7c70IM69QIlQgdlzhz2vmTac3IcDlzBp2wakF73eYTP1yBkQJUEu5Me0ybs31FGjsiWyDQ6J4ENNVSugTXtwZyY9MlSdHCrQb4HwbQTQpjcCxGbyxsadyNwAHacQih76su5bm1SpLjBC7zkUp4Ds7R19ibX7bnL5xXF4zfVopF4qQyjkbvqQo8eE/RmQnLV9QlpYyiZtFFJB3h6RdEZKI48UdA/kRqXVwBe1ECoIjQL4Wjs2YXbmdoiX/w5QF+4i+1gTB20MPdp4PVSWkGOqTreANZT10+XrdsDuFjdA0kNxhmD3KTtMxrSMghyYQ2iBYAzPYJg2yPSzGng3s7WjQyIY7iIa+jzbSp7nkI6Qptq/LMSRp6HBk0YlUwO2vSK2WBpRApZS+fuHEYsk1xFktqn0d9tZvPy29SL2sCXoZ23HtCXOGU6m4cXL76k4nUzCoV/dJPMhmXriTA6Li4kL9jqprlMXBhOfWKPeRYkF5S5I+8Y5DVP/NxGsczVjfYrzDLIPgetGJBpADGyP1quCzDYDjE3vQWDjzGpMC+7V4xYT5KepaDzbtYkavfPF1f4oXlypcPqEDZUY97TV8vFZjpJrCDaWIYlZMTzk1U4P1jXENGpcr/5wSloxW10oIzem46yKii3UVz8mB3eEU/Otez8fQwS5TO+vjnAkj2GntbNPRYXEpEXsyp9a0WG6knOc1Oc4mN7dC7YM6WvWo/T+R6z40IWDzRa0rjPJBbSvvEIdgFE4DhV0noCwe3N9idIU/09sc1WbgjJJozyeBQETHPjXqnGKwXmUi0YpK6ChL4wNYdteA9/PVerJcwovLhQjud9TGMuELTb/Y3/15JkDagSyMZFLv5YeLCh4YjezGjcfxkkhm4wlpOA/y+mXlaC/77Kx8EK0Wdr9fa+mtvTwcDF0oHKblPzF2B832qRaAiClO4UiIqpxZXprv+l4wGNsBR6mYgzPeePtxhjfd84gdJsr4YRVWvSgCMGRl80bKIc0U3xBJ0+h1FQemTHOwkyFznPorAcNacqfSam0cnJRYcJSokJkJvwPYnStpke5ikpp0/uQIrGE1zwQTL+bUX4llUBiPAB65MzZVAe5dnmAEf2OHPPOTdKf2+7n+Ski/aJj6da8xytYX8OctMvHoBUNG9+ZU4VArtm1h41jdVjVIjZIvBWM749FOit8S2keON3RBiz2Pqd1Vn+b2AAm1zFea8xSShuxpfPGVGBOooHG2r3iEn9mp7hMO0NHVQCZhZ5+olDdrluUNNbnsUfS+Is+ONFaL+6n+IyXlmkxXiEWzYKnlkwmhkX5IKspJv0FPEPQEJP1dwhNXIP2Rhliq9aT1J6vmXVhq50H7PXfaaawRA0dlnkIHnl2sZdZhY6EbRuS9cJEPkJGNpH/LJvz3kyLkURmPKWITT2rW1bSpZjMkDGStvy58AauSGV+TuDB0ej6q30jEULX2cZ0e3QrLesPCblNPGT1eJdYWPKljYdOccVI1oqx0WpiNrvMCBuAVA09Y7LjgmHRFVPdZ/jPf62M4IjofBQwOOVOFGn96V1NUwqbHhe9QqB62QuLpQ1dZ0DW2X0fpH8NL0I8vJdQEd5MttmTOEG2tYiziadnxX3Jr//WEoe3Hy8JSUjeYV9lJeyulTyQfn1OTnlqeRxTVDvbZoAvUomFRyE2h8v84ItNMVIBSzyTxCxXg/i3BysltguSic8U4kuPB63mKUO0Wpl5VYrHYkwaWmA25KMX4W06ITWBhzJmnU+ovjY33cfDUVMWnD/1oQF6/QACYUefbrXjTyDMkECi5A5L/nUkADg/thH1FeY4cH6ZWaw4YyMeowyJJgXTAYZSkHgx+cK2t0k8YEvU+CQARD18P2qDaaYX0eKe6bW+vIDGfTmkmZrydaJ3qItzMxVFghAjNf1gDFuaLj1N+/LY9Lj94TR6sAzgXHaTAYTW9+fNKxw6kMfdxGCBebif/Jhr66cEn4TFpDR/oYdx6rvuFbXo1+oDdViqvwnfrgeJ9vJAq9nxpljzsPEj9E01tgIRWlbmqkjwMeH/96Ru0E0xtq01BAwmq6mMuoEeRqpfc0+H/zi/4i81SDOMNtF5tqmLiqCWZZPIYkShgSAiKIBb5g0tTwqpLbHMM8BzZSv6SXfze/eb70VLEUmtvzBs9EhwL05MLCzdoXqMYGQiNplLefiwhJtKrHAaqV/Rkj0oWQGzYgQTeWNB7PQV3QQAaduaL0knvChBsbiXUCyam1DW2YL6gbYYpn5JxdTdx1BEQIAHXHDr76/3JjV1mE3V1DH2NOsPizM/lLnW2Y2CFm2mnxtlKgREcKD0orne7bgOjMUfJyXZYS68aGqqS2ZeEZCy2U5Mh0mNpdejqAYY5ES/VERNvV7GJMdz+VpHEqrc67xIA10vxa+PqjeqHPQR+tIAE0UoCIfQptQEaxexRfPp+2LYiyX/J8jhs3GxiqurTw2b8fQnealFiUnjsD+A5ABjVFkQYjqwx2jUxGSHrvlW9uG/ey54cRJ5o749BPh18QQVu6Rjh6y/eMD4/qyzlZLruLhxbTcu4H4DdIv7TxVVtIV2Gpq35NKJpMm0uKUsAtMUWc34HLtTLzuSHQGq2fSLaxDZyGZWUmR1CFlefxMG2hGiYh69ukOoTIAtguRug3jA+x+baaSY9eNnjmO/Ld0lJQ5WzN0J6APOJQbbZ0ihsh6gi4q4IFsGoipXGCtl5NFjw4e8I3G/pApoEIHKvAtq1WIdb0mk639PbnTLSZ0uLd7kQXvq7euPj7uhTwXl7HNC6DTlugOjCOU9QH1a8CDz/auCTK3zCM8bhrEq/6FX/GCG1OHZWofHhX1OXyEKXt19I6Uq89Xs4e0aKX2esjMFY6q5jMo281o9sxB75TPjr7ZU7UEB4q3Hbhnl25F3CQbcOQ7AvimrN7IQfp8ekqjwesvnkvcO0Wu9fD0DAvbL096FcnbcfB6lTmEBNZyhva25DngVhhkBYbcFIsL3HI1wK/EhaVBpoEMthNXFNg2+1W20wjWRrzmWnhilg+hvgDY19dJqmgw6NpO795SWTqgtxjP+MUADyc3CcIbtdlA2DkZFzbTOSa4GeZlJsjIlXuDOrf1mZTvNJEpUGuXN/9f4vNiTvY2maCAelyOatdKliAk8v8dhtJIQZjbkcXxoVKqQE8UfwJFQQVViOYROmTCYPfw3bD0feoJd5xI5wYZ8vZldE442tUtDlcKtQoka5B1KMv6zRzeqf7+7ttzH8tMc67kGs9koh8RmY1OH72taDqEqnZpqBpNdhpIIc4zRgFp9+VU95a6QMntMwHXvZ/Ex8DqMetn7wd5pewYzj8zbjN51ZouPjSt57HgpomuwHqsBRQ7jla8RBKIPXc0P2FFp9PWkbuEHdBCF8UAV3buNxkas9ak0fCAAQVi1Aslkv2zSC5U0aWfLTMtKbfZclo4/jv4wEAJFmXedHgS3dEWUfv2JhOeri/YYfWe3s1KzkUDEzF/7NwVj1usLLa5JJpQzUhrYAKGHF4xAmnZToBMl9oY/H7cmEUK8gcLQczq3QAhQD79M3BJgLLJXZpiekLoFoi3571u790aqCBv1gE1OUYGeufaYDgbTlykgHajrVJPv6pF7RGBcMhVHf3eTU3mjpKt6pjDeL34RmE9I9KrZX9hK4xflJkUfg6dP6j3wPeHwJREn/eeRfiMMvaas2EXEZDn2MUUAbfEzweAbbZjSa2LgsjoMyE+RA/bGltcE3noJBkTkRTXvYnxPkqTdmHaXmkqnY0xZV+5lVDrRfwYUrfycCwwFhHea/+EsKEU8jEDE2TF8J3qiKU9jlNI1j4rmtNMQwKo/B6kCy1MtqMOQctwHXPalVHEzSZbdsxJlR7gXcjLofthhejphLDm7tArwXvUavWt3zuPjPxLi7pl2GweiBnVnb0jkJKDfxiCX3jA3cY/50gcBO1T4yhnaCE5zNSyBuo+aJq9bmzD0hvFwz3XXOeZW03K/xgrzlQohkrDUiOdtkVJ+oT0uWS/90Qxj41fnlARub1PXATzzoKWwRc8prNL+D6/8mymYqzrgTxq5j06NEXUNX+EHXhpyPHzljtKVBu/c/wSC5MUfhMSIufEC5HehXsSyA1m9c7aHL8YsifGELqncVp9lXNXgZtWH2LXmloQI0Ot8N3qN6ZUf+p94+kVL8GZw/ZDXjAUQhOVcZ+g69xv9Fhw59n5lz77yLvwBHpGgCLPmQFWG438zepAAddM9f82RLWj8/H7J4Jm/oLvGbwIAAFxaIS40FqtTiuVCJBSexKYrUaHfI5EN3s0tKXih4kmror3If0QEGNxMkgEdI8OlUDIyr8Y0XtqDJ8+Qs/GX1kbho2noSVyWOl7lODk/rpwd2ECdVlM6uOf28b69cszZi6dlsdC7go47h30oa/q4dK0KusMXNual3/qKJhjhYw7YVaMc8Jiasq5fc/2qyRrDSpviXyau/H2lH8b4k3R8yFBy9Un9PMdgy4dVVCjb/2NhMitogLYGhMAnyQ8eTfZe2Qtvf1a0sdldnh2G2ty3FUpsHE2nDEJUiuuJZIsp2Xy1WXTz9limiobpJIw0KyYl5r/BRCjviTzBTiKcJxgeAoYg5uMYQ1fbHgndz4R15287xa65pOBi+s1iqOIFwSrRbyj90i5VH0Ev5LK6vLy85l5g7168tc1R1/5Fd5OIBSHrksqYkLRdM19v5GttV1s+la7nvAaUgVdHkIsTReThLpU5tUxOgX63OXlHw+KMJ1bryP29PQWPZ7y7VSWRTUVLQhS4QXPNlK2ge6LObM+fvnZsrMaJfvTN6xfyxDaU/8xFVgcrSDd6QL1HgnfF8XePCuWHKm02mXJUJRuXhqcPYEA1k5liesdP3/MJtsElcu/M7A/DaXVcA1OyTJg/cVElkMqi1Jg7kKjx2LsvAtj8UlH9bH0KTo07KEC2qzgyuPK88ROLV4AFbXvl69Z6sDTriZf5YrqMMIU6ATvDnsGotFYI+o4iW0SBMckSsskjdT/0CFs40OrDmb5+gGR0PPdKBG3H5lsVf0oJvA1GV0BoFZ52sWgxZBv63Xv23GeMM7ZHATgMy7G/fH8J5p3bZ8AgUMAu9846ObbR7iSaEuCkkh/sy3BsZrwGrAjv1/wAglWoSVX7jasUKx1YEI2T86t1AVtpqLNoeJKgL0CDbv6sgLiREvAEvqGfYK05kklIOJAryKcWwd9wd2UQFQ0JYGDsN6YmzGqSfsNRvLyYyhl57PsTTAFlaPplIhkZZ4TG8Y9wfH7dmfks4MUqXUCfZSe9frCGzj68xfln4HRl8z6QQKJ194ESndfDC+WBi/JY8f4HpUDilzKmpHJymx9fI+BzTLGePzbDuuBkzHVLtsGXnDQwhowsYf3Yky3zBu4oS2byWeoSiVWPr3wQnSY3azUnCdNep4orszUzb/R5LBfb0Yt/QnXouIdXDWDdEACodF4g/NHf68aogNdj+wsIgBPNb9mIVOr+XCGR2HmzTf7P4dwnnO9j2cp4mBHqtIztoZ4gBK4MwhrP257L786nJ7ds40NfkZ6xA7y6CsOjvHalMQRqK2glzGaGfM/MRKG7AML6uYPbC5AVn6LVMjeI7niNwc+emrkBtEIPAo9lfkOcbRiLsFoPHMpwB7vtPa3taTfN+JY8bcT5VZnOhfHsvORGJsZuStW89kO4AMtpmW23ZnaCUjrN61lp7EFoFwQHxY39KLyyyjYxsniLtYQVDOPjRLYRPs88V2+Bp4O/Z4DXDQkTP/b2ELRnhisYTwz15NueE0141r6tT+9DNFN49kSR8K1OLUbklXgHtikVIa0m0auZAITj1wTi9opdTJEbTAHWlB4UTH7qelT8AC8dLWeOxKN9tJ3NdpqYopomxwFt4xepeLcR3Ptp7t/lcZAX7gpDGqX/bdmzX9Ok6NkjA/yaYL3+zrd2T/lXALjHuh4ZtTfVUFJZogT0Y9WaF9JUCKTwNyJX1+4r3RHOCbr0+5EsGbxhNLawOqAjVy8+WIo4XnOQ6EHO95xP0E7hKHMCG6saZyvyyNYyVyrBXOXU0SrqXfIscyj9L+2rada4YTyDWv+fnK6GVOPMV9E/TD6pVmhIFebQrOCGbfjy+S+F6cJhHJqLiOS6JON8OVyMteUZe33Wxw63/YpUkw7VO8PZU9NVT2aQZ14zJ2J8c7CRfsZvYZypB+kbleS7BT3FNqt8NJ2iXJu+0quvvSXBST7PWvdTQx9ykEmWhmsvSDOsphFW+K/HETm/Ebn7ceQPlz3iRJwpCkSJgeox9knNs9dpkgmRF7RbXA1AyoVBredRXGgFRkYKG7oZ1qp4oNru7G3EtENYq7KOzcCIbXEqwAHVzD0tA4lzQXoeOQB9hH/xcvPwADvQCGEVv2NX5f5J5bpBOTp035oY6mFOHevQ11wT3ky5E98XWpNEiMN5y/vxU4yxunzHqy7b/wy4T3CmqZ1n2IN4ZIZIqIJMCqE79+jcfeXRmwQNv74NOJdpGgGyaY0RG9h+1MjSx0E0VUMXys7dtWO1cH8ZZvtsRQC18vxBsblpc0ryJM7kDlv+FzGMD+nBVRpyEcDPuS+r0URaqTA+uGIbNL+HVTSzkJleuKa3UzSm+brJ5hbcjnaJwDM+J49eVBawynerbhN5gLuPqLmcbFWCSTLmXFg4Epy7n6CYJi8bNoNvZiS5uN/5wFFiYxzSMhzGNTVMLeGGlTE3tpHE0cRTPAi41Inn7FYovmbUF2huvdKdkM89kU+CB8SHHZZXMK8lPrf/ZeFHSrtL19JkvRb95liWqRagBDQOuK8JOBTn6LAPJGc/3P+Ci4G9X+SlydckxRbXgAhXLvy6IUYrq919cKCxprgJfNWQfRpLqiwEf7zd1jhvHpLeZcaXU9JsDfIL6Xb+9zVsFI1/NM22ImUrcaFARq4HWcUppk55iXanWaZjMqOLY75aLOC6GbQoewNqxEmkNyQLh05NhUb5hlRSCebw1IStXqLq7/3XKU0AJnwHHv9ptf+dIP6zbyzY3dL5CI7CiOpy8tzpZbAI8sIKtm/3rPKoliy4C03MROAXuV6HstQMYD41yLiQ0aprTMqflO+aGoa2/059/XmeqSsCUknfPMsRV6bY29uoxEYz30vqjnAAE06wUiQwQMYEXgExqX7roO5MBiHS1zLUNd6kO7X5lAjGu5+gj/NCedw7iDIxJieBJCtrliZpAbe+qgwgS3Fwad547OkF6a8sGwhbJNhgMBrOub31U7xQaMDlj6pZqUQVu+T4OwxSRfu6MEySm90iECiqMD3wBDndf4U5eFi1aKzzvoFLMzzRKB0EmkvaCwbmzinhDFW+oX33z3JskNF/i57gC41bI0HIx/CSmSh3/qn7skHb4W6qtI6oHFxHq8wJpaFTrgFPaFZWYix9ZNUpPLCrn/IABPg/txN6wJ+voO2A+W/IkACA0vzxAaZZbtsb5DKL4NoSYxf+xv9pSZ9bpO+h27gX6Zz0XlOaUmJ99Y22qeBYNvkgslM/AAEAP26xXfzUdsyNyYXfWxjmubH0OfgBhoM1KEChju96G+EE2+fCKlEMoIyB6+d9XwLEA7w7teuT6ASIiEqEvXWOj5tbfRCvPMWu6il3tAgNlidDeTDGsXkTz7P4QNlV1zEfTOXPEI3wtkeBrEFJOvqDENBjmzIxA+L3F5FXq14mnIunD+kUIYJlg2e38XZ8G4xYomusQevMlP4rSxqlJF3U4/rtm9qx0yq52MtM75e88RBY4MJ2AMI3lSxvRP3uDujnLhUhTJB9D0GLKA3VVn9RdZ2fMAzaUqSlDE4IjW6Xz/DxRx7Rov6v3q0gi/cfchqdwruXbYbK+3izwk6WJnVoZc7BGovC6tYiJay5CgNQz5AK9mb4Khj6w86dfGOD1hP8qCjKeFO0D8u/CYFwV0mpsUwZvJOxnPJRmdvd65pUdBDbjAtz0dGKILIMv10Dg3AiqGkwI7V0Fwr68Rnk+YC7EkXb6i4ue3aCEXHFtJ/aBjKUf1Ms+8VzVn0rUJAD6HglSZDGj14Lx+kkBPQTKbIlJ0RGBBFTMJSotb5g9kehY4jKXjFsAmrBy34jBXVM/AhUnN7HhN7RPgbUnZZFKwXyOHN6Y2j4GzwaeG0n4qSOfGTpxvecVKF12oxw0U1WXRp6iRUUoI1GqMb9dk8weuoYVvK5P+oSe/NeD85eSK6nXdoQlpqmAmqWHQARK9JJKJh9yEA7v1Set60PtFLPpeOBqYNW4KHvQyeMpohudVJLK+bNq8qhJUfZEV47jqxkmzElzgY5ZJqz76JZt9KBFE7b91WZ0MWIomSUcvnUXrADc9BXdkBOILx1b10YyQPTY+J96TFod23V4WT0AdRb92M+0O9Y4kE5ek0v2/mQi3koHqe8nUhpFjiedF0WBqRnTaJSDxrKwPH+DRHtXVp190Ck1OWId1Ci5uQagPSBkViI79go0OQAAkOuEQK2ImXBbRSNzz9rHO89Uzp4fEQU+GkXGSFwSy9FtFU90ovXOeZuXzuWOtWWHe5IxOH+YX3aFxYj3AdIIZGivopTHZu5Ux5r3bPnpIiBq8aTRsrm8Mg/Xr/7Uqz/myodCrAjV70Lc8DeRSjdcM1/9INP+L6C2ncnk6Q4A56XVDMIN7CnXZfbqdxCFZmIhZaNbgmvzqco9K4as7GLecTUfFraqMsslAWdX6SZpA85QxYIMzlHOEibyduX1JvsEDl6+RNKZS68327V/IdOoXxV0xLs65++ESOkkTVChTfvA+4u+SKXF3qTV+gaB+bGc3rlGNgRTVnUS1ttWa1JxCRuJRvhEdwTL+qghDFQ+01MOV7FJwUpIuDke+HJTy1Tuyh9nOCgTyQ426YtJZDNr/IIuk4Hzc7obEMtPch08jrv4XooZDDaEaxKickznHWaxOSjJuqIE+rDc1rW/8pYv6MWj2zble/nTNEaWtG7yePJks/dY7aKUy1k5cbPTIvgp6/d9X3lCKvn/RsI+FHFAJ1m4vLruKVD7elcQi6GoXu1OHJnBy4bZTkM9oA3Y7O+Y2k/E4Yi7f4IM4r4o3nVbULhRqsSJB3j8bKas2BU1eeLXe1Q6zyX1P16Akd5jTD4E5d6XIaOP4VK9mrH6dkR+GJpiPTDSkBEfUf8CATbbTxk1fNkwHkIeb5MCNSKicIFqEyzNlzgI37nc8Bkf4gfSin/Qg8474dP8G/+Jq2zBSBlDvg/t2WPQGDMk70P2QAfFEwyhnDZSUC431ZWh9SOVfrMlOUfIjeo7tNGJb4diKlHG58KSfx7wloNe1y9Upg2psasY1OJ4v1TjVFQQi20/znM5oU2yZ1De5delLAmlwQvNCnOs3Z/cF1QnvCQxEgVWoavLYADCKH4dM+YRf10fVy1/70m/MU+IqmJPFFAOxJ1FdGWFNZK/ZJMqBs+4ICweNKo9PfASbN6L1uNVgnbfhleDS8nXneRyrsCkYAOxuhxzY/3iwWzMBjf+jZ4gCCHk6kmVfV5En5wO4S0HM0/x5/dvVxJlF4qzSPlQ/9CyF7K17SXPmX229qSnU2UyKaXykg5x4ANdYjKh51MXy7cJvQMxg8eAz0l7qt2q4MF+Uqz3fAoQkMduQhvNsdclTdDym4Ng39/NrTUzsdaYCouk4WYN5uFXGi01DQJeDM8+w7eJYVKSboUfStE/oKvguNt/NSfJd0JDMRGOwKDQs2jcMEN6PJtrNXXj8tolrTp2iaAT6QPWYxWRxSnihalEErOsdorboYNM5r5T3NpNS02qJNRIhPbRWQhBsFjORDmHEtsaQbFejMbujfkCdtHtKjhmmsYO6cW7FcGbjKGC2e96i2/RgmkGlrECcJAYuLR2QssR2vgVLNMkXhPV/7DppRMziUAJw9CrC0+ZeWxrThnhaQfuI0ZFN5brB7Od8RoQNJWQyg0I3fTzjrGtnL5LNcuQBNKxaDNu79CyuD+FDLcUqwSDvH2zRKXEc7CMJ2EKkd0TkdAvxisL6Hu3QzxhUdo3RBIqIjctHt/RsPPLYPu47cvaqJfa7/NRHiMiRXiqy7jTqlQhRGa2Dh62+zssoHiH+3J1MdVIT7sThUSm4jDYRH3wA9dHN5t/mmOAYB7V+OwqOywBy/MkRO7gVbQzr02lH6xrIGhuuRZt1xBqhiX7/UuSUzFM1R4XaVdqUSNyR/aAFHU4WI3QXGpVhUETyjGpQruW/4vzpy1zee6OJtC3orR50NPlYhLbZDjvBKd32zWzxlFcyASnepiEMIzI6xHSl6smN9FBNEbHHGlkPqETlvlJo1d2bXS3FEAodkRpFk/000zP7VZrUSuxusa5H/m+d106MmALARGexRIV11CmdfHdpVCYee0FGKi9XK9GPrAAxazPNRZhuIkejW3jMusvzZFKQllVVxlTYnR3KRtiX9xjAUesC3+hYWiESBqI5Gzwfhqt2myxMI24wK7k+HmStkOU4bj8KzHLxmaP6kqEQ7IEWScbC7W/T3Qi+RpQng3jILE7khLjoJ2yFXbxcQkh5KLDL+iZtUngsNviVC3wtz49ytDkdf74P/NzBH7G1zNQaRPsxD83bELdSLjRHC1ObrrM3WRdQ2WeqG+w1suSp+EAJ3AYIFnv1422QsbXahY/4VDfurqlPpVf4WMNR6AqSa0fPSUN2YEmCpf2D4r9x/Lt8FHSstp4QVL8HoRUKvTEVA+HZoj0vNJoXJuL3pzJKp1VFAiM1L46c6v6eerN3a8QVSIVM6o1qyfGfh18Wbny79eZgsdWPOuF5iXdd7VyN8X4c/E9o5HT3nvciKistd31G3Pdq3+xOcPD+95n4FaDO8eXQ3sB+u34XGk9aq7if3Z+OGeZ+CX0Mo9hBVprNc7NE3abeW//Uy3ALyBn+9N2ogq9TjrP2uGxKWQBGCF+nMv3d139RpbwCOGVofw+al9ExpM/TecdOVr4JDMxbc08bTTtMOfxBD2KvO7ipFZgLJGxlXLzt6P3lDE9L15TRHkV1ti1HYFMjtOOwCh3/gNg7duyVearet8lBe3NYqp8EViefWzYLweW8Jcosf9D61OVHPQR/vPclbhPNaddQg9MXJYvm0K/LGW/hzSHSJstrmHY1uUJaiuejRtYcnCZU9m/2pfu8YsczpXBNRwG6FoAOHP/3zrqv4fOuEuszbLnAiQkXVJvaP5ZJbrkrdD0FyG6Uv69dlvLo4gr7cQdo0A1Ieu4YUcHADSUEEB1tTuZPvdCpgtchCr+Uo6eA04khk9GjA4J7HFjDYiHO/Rn/eEAjuMmuIPDpRb8ev2iPXkX7dOhDo4tm+5GwoyNF9IkM+OCPyNQq9wpJfvytRYCrgGC/cxgSbSE9R5Kxh8vIsoHrvU2J1hbU2QI5RebPoZw9rl7h8QzZ89+dBuSwtAnc57z6h/hZmxZ0RtlcEj3uoxdFaOjxne9ZlCLHJqqaKZGpSYE/itvea4r/dfvQt8Q7MEMyabHOoc2mCYPafW99nV0+InhXPwOcNeCu0OimdpqK4UbEVqVa+yUBBap8LDcJOA4NYex5C98kXsqc3wA33KX3lNNJKDgXlSeqy8Df/FYdATtrWG8ezT4aganJS5RO/pULZf1NnBFTZBtLJpcqxQ+b/RgXfTB7oeVKpPpQFwLR5yxXqYoKyLmsLuWnL5qsgELqP5GtmfP/i1I/LVf2JMFPkifK+wBw2aU4KuSdjZGkOZNo5Ppg/3PSoUHn194No/+edzIV3UBgpmpiYj+0OnBV5KehhFg+/IqdEfceIKRzQnNtVqE3NoWeWuwCEhGkhZQM3uTaxNvQEWSwv8s09htTV9oWsI9Ta1LfFv6F3FuEqmlD8BXjPK3R6UcBSxMp3GZJ8w1m0nqVIZYCo7D7lJeaIkv+UhjfUu+37GpQQMbfCO9SyhRRb3TV/BurUR3JB1kLaZa/lM3dwgDwq+taUzAqWKiJjGSxRnq0TX+QjL71CPQsjSwv2QsUTfWxqzcAAIYkmk2GYt2OjOLtwIPyjVDui0JtuvfFH7ZMk12gnxWYgpmzkBEosYUhoLpbhI18ssM5Ic91TXasAH9gyVCPgo3OYkgpymfUddRV9bYhTbphv1BWSF9UMZcS7+j7nmzCYKmw5RZv+SE+2k2E8ZQ+sjuK8w/XOdxTd7+ryQPx6G069jCqW41ZLl1BkGnf2dm/jshzgv6p9fSqgiVsDJBeFv4rlQHUvOXVUwmAWKEb3tFux9lPXlwTgwfU3kbVMLHdhyHdxj6odUdZIvGKcnWsQB6VEzvc/1j43jY2N7ZEn6dxH59Da5n2Dn3U9DkEWGX9rdg3ZpcFlgR+FOoHF8gwr84WclnlDjkpZgcjxpRrgO5be5EqWAxO45/v0aLPAckzPnW35/kYE+E9eX7NivH9H7jguZhUXFz0pHlihCWAanGVifLzHEtnI+WHzo8lwPeNUelkfz6/RgfcuJ2imNUTmeYzj/CjUQSu8CofKRMlIO/Qlp0wfVXv/hbDzyNBs4NdwhjB/K2K91ub8ZWg7c+rX0JpS+3TEKXGRj8erkOd87na1Fmkg+u7BNWMWfE3eKofPtVMlS0h61L5W57xDrxjTzfjabEETUdiYB7l/uWU+6ssx9tThkswTF2rhz/1wTTVfmERfGF3OKNKV6Uhn/Q6ciaF+bu+RVXGRXyiua4oMeUY00JoTHw2FPxNHZareNQWVvAjz474f6OP9sdmjsD1Vc52p7Tc2wCxIaLpHA0VVG3Mu400BQAAS1qKhNHU/79wO7cS/Q3E6yffrr6ktPYD+ezPjK0dBjhRAVzyJuK9Y+KJ4TzP/dL9YNV1XpuiTdktIB+g2mrbWKOGmGTbTOzU0dDdR6PStoHTt/ePv0btEGoVv/5NI3FeCvmiYr97HNKAJsaXix/2L918EjlLFl4LcitxS2w3POsk0wxuY1C2zqF1AjbABX5CA9Eprsr9N9eYtPm/sk27jgB4vebxfvP6Bkg+g6SZ28l7ffywOdWDVUHfLkL4X2fXKcac7ObtWpJzPeVCmNduAmNXCHx/wr25sjfxVuFeR8E8tqzlrbwOoGDFAh4e7bHD7rkkLxinXRg5TpFBD0hEjW77sKB7+9ZMhMx4+aZOJBNIPE25NJaXdZ3dP7K8xvpqxLcilYAdZzfcph5zND8b7NxHuRLQg5puaIo+5vnlut8IwxAD3GwbQYZmsFInDThXVJML0rigjxTsl4yVJLs5UnFMJVo6NtxIpUqffTlPGyU6LPpqj6Kw03uULuW/QwPsWtkWSzAqh+C942x4svZ1Q8/m/oxMJhr0OFt+q5MjsQQ64To5RCGtAkR+lO5tKd7LsYrbcSq3KD6o7ScrwUcUa9JVCAAHwEIqCdGzTwHABSu0z7RNnxhF8QwvczYlG9DqZq45sxE+kv4167l5E/4Q8ljDLwoiAFYvFal+vPC6ow3mq7B4+iwLNQ+1DoLs6DH601bwh2GoaZZiMdLjnBk7pjw7dWzp7YaBZgixNG+uLFjHt0kWgMYd0CiCUggCuL8DaSdbEiL6ikGWCmQ9JbGlFA8EEH2ppiNACVmy+JdosIe+jYL9baQbO4dwD/r0U7nfFUVHzS/M/4Y5vuy3VL5wbCMqR9gwF41lfcWhVJrMF21ixDg2jx807JPhGMEznvV/51qgeysu9u4id9UL4/tQlM+RuVhK8CCDszxhPO5i/QYvHTRFJu2pFo3jdD1TY+/tuK7pEN7Lyf5RrLQyfnmERSYz+plmyX1VRw8GSU7nNKPG/bI/rUr3NFH1uP6S9zdiKGUW5IYanzroR4bmB9a06O222Ij6Bfg+BHcjmuKlmJzhD/2I6H2LYORvVClLU+qPjUoAguOCoCTp7u4tNX8yEp1bqNU4n0cpz7N+sl2BiI74VJt0vtIX+JV/Wg/3YmNJnElg7aNqBnEEsbSti+hKyfFbStQoOZpx0lriK2GPosD9ScO5YXg5Fl1Oy8ZPuABj9Esf/lRuyfb7ENtAXvq+duR/f7yGQN1COwCzpMtZNxBoClMji9nEv4ABsttBCC9U6nZlo6T6Dxg4ByM7urWViunwRp8qtylIOuj2dew2itZaOiz7tPNWuX97Vrp1TARTZB+jQ2z2/KVPn6lOc15FC48iEpexb/wwDnikM7cyNY5+DysbRQ1FcPTJpBGJpgjDFp8Z7ygw94OHCsgCV68JepK7eWbdnCUGXq7k5GHcsduR47qEtTj0RaSW3ajU1z8C676tpFmEdYCiBHocUKI28gTcCMTKMqcb1nh+r4anyQRlaFXHMDJ5gwMdG3vsKLKzPAR4OqboThxmonvZtZ7WP7i8D/FNXsTnHK8FtKy3+fD06GyIee6i1nQQQvJpyEK1IjydeVz8KUQEdL9w0I2XnbABcVfz84yqbaLo/VDRb0984iLKpyz4UDUxLaLGZQlwDxoxVaFzkFyiCuCROfRmbq9knzhA75dvLNeek2MmRptXd9gaC1qzxbfIr3wnb7u3quplfCjSHMP0nj3IPbZMTF/zd5B+Gy3s5ZNxrFpWyMyA+9ttEEvZ+KTF5HVQs8YJS6g8fv5QpxJlZeZWAQnTsooqNIb8igQSwygXuymDR6SuqjeWY4xLyiKXEPv7oiRTUNcdbxhoV+ZHJ5iS1/hEZW9SHaEgJ194Sto2nYnsZ1whP+qN3COvWYB14Rx0B8+19zOLqWQ+fZrLDwGMYhHjimSLAdq4nX2kCaSXvUUlS7vAAABxsICwd9FVNRjU6q8/ewjII3NjS1xCOrPmbX/LQzAZPRHZ6aBLwRr4h+tWcQx8hnhekcLY8auJxJz9OktGwxktvhXkdL0WqoiitIfmQ+889Gv/DENYBJ0lv4pcm/mI9uCsvbyIeHu/rUIUdkYMkO53HsTtiyZaCgbXx8pCae+0okTT9r1gOqBbqW/W4Ces7QD9AqMjElIV02QSKLdNpHKmkDl1ubeSw21tnLeAbL39nFTpDcabRxgHXKnzibHlzDQW3btFrIymOPt8HJFSU/Hd0cOP4jHJHzJTwJdMR64V71RMvwBtv3hd/FlG4awZmR7uFyAQKbtcdNfPfWJaf5gaw7bY5o9qFzLW7jctaq554nGFh61ZprIydewzTJpfkYw1t8g2gXczBq9t7SiVDRPRWg5R7muOkCxWQHiEI0z80MCIXQfaK7ZdmvgtVwvso5qQuoMAABdB3kZCLdiChc+myRmQRc3efvsip4Fqb4I3r2X2dtdaEWAao0VmJmJKKHC3c5xHc0uEIhyLdd9Gsu/sAstm7wx9iIWBMyj6AOgvh1AV4AAAAAAAAAAAAA",
    inbox: "data:image/webp;base64,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",
    future: "data:image/webp;base64,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",
    radar: "data:image/webp;base64,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",
    dash: "data:image/webp;base64,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",
  },
  empty: {
    cat: "data:image/webp;base64,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",
    books: "data:image/webp;base64,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",
    book: "data:image/webp;base64,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",
    flowers: "data:image/webp;base64,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",
  },
};
