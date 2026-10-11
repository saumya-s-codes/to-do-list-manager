/**
 * Clear the Day: a mobile-first task app (Today, Inbox, Future, Watching, Dashboard, Completed)
 * with six themes. Everything lives in this one file on purpose: themes, styles, views and logic.
 * Data is saved in the browser (see storage.js), and can be exported to Excel from Settings.
 */
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import papyrusBg from "./assets/papyrus-bg.jpg";
import {
  Download, Sun, Pencil, Plus, Moon, Check, X, Eye, LayoutGrid, CalendarDays, Timer,
  BarChart3, CheckCircle2, MoreHorizontal, Zap, Target, ClipboardList, Hourglass,
  Trash2, ArrowRight, Calendar, Inbox, RotateCcw, Sparkles, AlertCircle, ArrowUp,
  Palette, Leaf, Star, Flower2, Flame, ArrowLeft, Radar,
} from "lucide-react";

// Shown at the bottom of Settings. Bump this whenever you ship an update (it lives here so replacing App.jsx is enough).
const APP_VERSION = "4.8";
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
   THEME SYSTEM
   ────────────────────────────────────────────────────────────────────────────
   Every colour, font, radius and shadow in the app comes from a CSS variable
   set by the active theme. No component hard-codes a colour.

   TO ADD A THEME: add one entry to THEMES below (copy any existing one).
     • vars        → the CSS variables (full list is visible in the entries)
     • catPalette  → [background, text] pairs; categories cycle through these
                     (order: School, Personal, Work, Career, Health, Digital)
     • swatches    → 4 colours shown in the theme picker
     • outer       → backdrop colour behind the phone frame on desktop
   Nothing else needs to change. The picker in Settings lists every entry.

   Five themes, built from the mockups:
     papyrus     Playful Modernism   paper, autumn red, denim · Fraunces + Inter
     vibrant     Google × Meta       blue, coral, yellow · Poppins + Inter
     botanical   Leaves × Barley     olive, sage, clay · Manrope + Lato
     celestial   Blue Moon           twilight blue + gold · Nixie One + Comfortaa
     sanctuary   Lavender × Sage     lavender, blush, sage · Rouge Script + Klee One

   Illustrations are small inline SVGs in each theme's --deco var. Each theme has a HERO (top of every page) and a TILE (repeats down
   long pages), both painted on the scrolling area with background-attachment:local.
   ════════════════════════════════════════════════════════════════════════════ */

// Fonts load through ordinary <link> tags, NOT an @import inside the app's own CSS. An @import makes some browsers (Safari) hold back the
// whole stylesheet until the font download finishes, which showed the app as raw unstyled text for a split second at start-up.
const FONT_URL = "https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;500;600;700&family=Courier+Prime:wght@400&family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Klee+One:wght@400;600&family=Lato:wght@400;700&family=Manrope:wght@500;600;700;800&family=Nixie+One&family=Plus+Jakarta+Sans:wght@400&family=Rouge+Script&family=Roboto:wght@400;500;700&family=Poppins:wght@600;700&display=swap";
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

/* ───────── illustrations ─────────
   Each theme has two layers, both painted on the scrolling area so they move with the page:
     HERO  (430×240)  sits at the very top of every page, corner to corner
     TILE  (430×700)  repeats down the page, so long pages keep getting decorated
   Both scale to the screen width. Pieces hug the left and right edges so they peek out from behind the cards. */
const svgUrl = (w, h, inner) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${inner}</svg>`)}")`;
const G = (x, y, r, s, inner) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">${inner}</g>`;
const LEAF = "M0 0C6 -11 22 -13 34 0C22 13 6 11 0 0Z";
const STAR = "M0-11L2.6-2.6L11 0L2.6 2.6L0 11L-2.6 2.6L-11 0L-2.6-2.6Z";
const sparkle = (x, y, s, c, op = 0.8) => `<path transform="translate(${x} ${y}) scale(${s})" d="${STAR}" fill="${c}" opacity="${op}"/>`;

/* ── Botanical pieces ── */
// leafy branch hanging from (0,0), about 150 tall
const branch = (a, b, stem, op = 0.45) =>
  `<g opacity="${op}"><path d="M0 0C-6 40 -4 90 8 150" fill="none" stroke="${stem}" stroke-width="1.6" stroke-linecap="round"/>` +
  [[-3, 22], [-5, 50], [-3, 80], [2, 110], [8, 140]]
    .map(([x, y], i) => `<path transform="translate(${x} ${y}) rotate(${i % 2 ? 28 : 152}) scale(${1 - i * 0.08})" d="${LEAF}" fill="${i % 2 ? b : a}"/>`).join("") +
  `<path transform="translate(8 150) rotate(95)" d="${LEAF}" fill="${a}"/></g>`;
// barley stalk, about 130 tall
const barley = (c, stem, op = 0.6) =>
  `<g opacity="${op}"><path d="M0 0L0 130" stroke="${stem}" stroke-width="1.5" stroke-linecap="round"/>` +
  Array.from({ length: 7 }, (_, i) => { const y = 6 + i * 12; return `<ellipse cx="-5" cy="${y}" rx="3.4" ry="8" transform="rotate(-24 -5 ${y})" fill="${c}"/><ellipse cx="5" cy="${y + 4}" rx="3.4" ry="8" transform="rotate(24 5 ${y + 4})" fill="${c}"/>`; }).join("") +
  `<path d="M0 0L0 -16M-4 4L-12 -12M4 4L12 -12" stroke="${c}" stroke-width="1" stroke-linecap="round"/></g>`;
const daisy = (p, c, op = 0.75) =>
  `<g opacity="${op}">${Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-9" rx="3.6" ry="8" transform="rotate(${i * 45})" fill="${p}"/>`).join("")}<circle r="4.4" fill="${c}"/></g>`;
const looseLeaf = (x, y, r, s, c, op = 0.4) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="${LEAF}" fill="${c}" opacity="${op}"/>`;

const BOT_A = "#8CA37A", BOT_B = "#7C7A5A", BOT_STEM = "#6F7A4E", BOT_BARLEY = "#C9AE72";
const ART_BOTANICAL = svgUrl(430, 240,
  G(372, -8, 8, 1.3, branch(BOT_A, BOT_B, BOT_STEM, 0.45)));
const TILE_BOTANICAL = svgUrl(430, 700,
  G(6, 80, -8, 1.1, branch(BOT_A, BOT_B, BOT_STEM, 0.4)) +
  G(424, 340, 10, 1.1, branch(BOT_B, BOT_A, BOT_STEM, 0.4)) +
  G(12, 540, -6, 1.05, barley(BOT_BARLEY, BOT_STEM, 0.5)));

/* ── Celestial pieces ── */
const cloud = (x, y, s, op = 0.75) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="#FFFFFF" opacity="${op}"><ellipse cx="0" cy="0" rx="34" ry="11"/><ellipse cx="-18" cy="-7" rx="18" ry="11"/><ellipse cx="12" cy="-10" rx="20" ry="13"/></g>`;
const planet = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><circle r="15" fill="#D8BD88" opacity=".8"/><ellipse rx="27" ry="6.5" transform="rotate(-18)" fill="none" stroke="#9AA6E0" stroke-width="2" opacity=".75"/><path d="M-13 -4A15 15 0 0 1 12 -9" fill="none" stroke="#fff" stroke-width="2" opacity=".5" stroke-linecap="round"/></g>`;
const constel = (pts, c = "#9AA6E0") =>
  `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 3" opacity=".55"/>` +
  pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${c}" opacity=".7"/>`).join("");
const crescent = (x, y, s, op = 0.85) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0A46 46 0 1 0 0 92A35 35 0 1 1 0 0Z" fill="#D8BD88" opacity="${op}"/>`;

const ART_CELESTIAL = svgUrl(430, 240,
  cloud(70, 190, 1.3, 0.8) + cloud(350, 218, 1.1, 0.7) +
  crescent(386, 20, 1.0) +
  sparkle(318, 40, 1.15, "#D8BD88", 0.9) + sparkle(266, 104, 0.6, "#D8BD88", 0.7) + sparkle(420, 150, 0.8, "#D8BD88", 0.8) +
  sparkle(24, 46, 0.9, "#D8BD88", 0.85) + sparkle(96, 92, 0.5, "#9AA6E0", 0.7) +
  constel([[150, 30], [196, 58], [236, 34], [280, 66]]) + constel([[20, 130], [52, 108], [82, 140]], "#C9BFEF"));
const TILE_CELESTIAL = svgUrl(430, 700,
  cloud(30, 120, 1.2, 0.8) + cloud(410, 330, 1.3, 0.8) + cloud(20, 560, 1.1, 0.75) + cloud(420, 650, 0.9, 0.7) +
  sparkle(24, 190, 1.0, "#D8BD88") + sparkle(410, 280, 0.9, "#D8BD88") + sparkle(40, 330, 0.55, "#9AA6E0") +
  sparkle(402, 420, 0.6, "#9AA6E0") + sparkle(22, 470, 1.1, "#D8BD88") + sparkle(414, 580, 0.8, "#D8BD88") + sparkle(40, 640, 0.5, "#9AA6E0") +
  crescent(396, 40 + 440, 0.5, 0.8) + planet(26, 268, 1.1) + planet(412, 372, 0.7) +
  constel([[396, 480], [418, 506], [400, 540]]) + constel([[14, 380], [38, 404], [20, 436]], "#C9BFEF"));

/* ── Sanctuary pieces ── */
const lavender = (stem = "#9DB89E", op = 0.6) =>
  `<g opacity="${op}"><path d="M0 0C-4 76 -20 146 -44 220" fill="none" stroke="${stem}" stroke-width="1.6" stroke-linecap="round"/>` +
  Array.from({ length: 10 }, (_, i) => {
    const y = 20 + i * 18, x = -(y / 220) * 44, s = 1 - i * 0.04, c = i % 2 ? "#B58FD0" : "#C9A7E0";
    return `<ellipse cx="${x - 6}" cy="${y}" rx="${4.8 * s}" ry="${9 * s}" transform="rotate(-28 ${x - 6} ${y})" fill="${c}"/>` +
           `<ellipse cx="${x + 6}" cy="${y + 6}" rx="${4.8 * s}" ry="${9 * s}" transform="rotate(28 ${x + 6} ${y + 6})" fill="${c}"/>`;
  }).join("") +
  `<ellipse cx="-30" cy="196" rx="5" ry="16" transform="rotate(48 -30 196)" fill="${stem}"/><ellipse cx="-10" cy="204" rx="5" ry="15" transform="rotate(-40 -10 204)" fill="${stem}"/></g>`;
const butterfly = (c1, c2, op = 0.7) =>
  `<g opacity="${op}"><path d="M0 0C-8 -22 -30 -26 -30 -10C-30 2 -14 8 0 2Z" fill="${c1}"/><path d="M0 2C-6 14 -20 24 -22 12C-22 4 -10 0 0 2Z" fill="${c2}"/>` +
  `<path d="M0 0C8 -22 30 -26 30 -10C30 2 14 8 0 2Z" fill="${c1}"/><path d="M0 2C6 14 20 24 22 12C22 4 10 0 0 2Z" fill="${c2}"/><path d="M0 -8L0 12M0 -8L-6 -16M0 -8L6 -16" stroke="#7A4FA3" stroke-width="1.2" stroke-linecap="round" fill="none"/></g>`;
const petal = (x, y, r, c, op = 0.6) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="9" transform="rotate(${r} ${x} ${y})" fill="${c}" opacity="${op}"/>`;

const ART_SANCTUARY = svgUrl(430, 240,
  G(396, -6, 4, 1.05, lavender()) + G(344, -10, -6, 0.85, lavender("#9DB89E", 0.45)) +
  G(24, -8, -8, 0.7, lavender("#9DB89E", 0.4)) +
  G(58, 70, -14, 1.0, butterfly("#E4CDF2", "#F7D7E8", 0.85)) +
  sparkle(118, 40, 0.8, "#C9A7E0", 0.8) + sparkle(250, 168, 0.55, "#C9A7E0", 0.7) + sparkle(300, 214, 0.8, "#F7D7E8", 0.9) +
  petal(160, 120, 30, "#F7D7E8") + petal(200, 200, -20, "#E4CDF2"));
const TILE_SANCTUARY = svgUrl(430, 700,
  G(10, 60, 0, 0.95, lavender("#9DB89E", 0.5)) + G(424, 300, 4, 1.0, lavender("#9DB89E", 0.5)) +
  G(16, 420, -4, 0.85, lavender("#9DB89E", 0.45)) + G(420, 520, 6, 0.8, lavender("#9DB89E", 0.45)) +
  G(402, 410, -10, 0.85, butterfly("#E4CDF2", "#F7D7E8")) + G(36, 340, 12, 0.7, butterfly("#F7D7E8", "#E4CDF2", 0.65)) +
  sparkle(26, 280, 0.8, "#C9A7E0") + sparkle(408, 220, 0.6, "#C9A7E0") + sparkle(34, 560, 0.7, "#F7D7E8", 0.95) + sparkle(404, 640, 0.9, "#C9A7E0") +
  petal(46, 200, 30, "#F7D7E8") + petal(386, 360, -25, "#E4CDF2") + petal(30, 640, 40, "#E4CDF2") + petal(408, 560, 20, "#F7D7E8") + petal(52, 500, -30, "#F7D7E8", 0.5));

/* ── Papyrus (Playful Modernism): the painted paper background is a normal image file (src/assets/papyrus-bg.jpg) ── */
const PAPYRUS_PAGE = `url("${papyrusBg}")`;

/* ── Thought-dump box: a small corner motif from each theme's own set of design elements (Vibrant stays plain) ── */
const PANEL_PAPYRUS = svgUrl(160, 48,
  Array.from({ length: 12 }, (_, i) => `<circle cx="${60 + (i % 4) * 9}" cy="${10 + Math.floor(i / 4) * 9}" r="1.9" fill="#FFF8F0" opacity=".7"/>`).join("") +
  `<path d="M96 42C106 12 126 8 130 24C134 40 112 38 116 22C120 8 146 12 154 6" fill="none" stroke="#FFF8F0" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>`);
const PANEL_BOTANICAL = svgUrl(160, 48,
  G(140, 0, 16, 0.3, branch("#F2F5E6", "#E3EACB", "#FBF8EE", 0.85)));
const PANEL_CELESTIAL = svgUrl(160, 48,
  crescent(130, 3, 0.32, 0.95) + sparkle(92, 14, 0.7, "#FFE6B0", 0.95) + sparkle(62, 36, 0.45, "#FFFFFF", 0.85) + sparkle(150, 40, 0.5, "#FFFFFF", 0.85) +
  constel([[8, 38], [28, 22], [48, 36]], "#FFFFFF"));
const PANEL_SANCTUARY = svgUrl(160, 48,
  G(122, 26, 10, 0.8, butterfly("#FFFFFF", "#F7D7E8", 0.8)) + sparkle(72, 14, 0.6, "#FFFFFF", 0.85) + sparkle(152, 8, 0.45, "#F7D7E8", 0.95) +
  petal(38, 32, 30, "#F7D7E8", 0.7));

/* ── Vibrant: flat, Google-style shapes in the four primary colours. Few of them, kept to the edges. ── */
const V_B = "#4285F4", V_R = "#EA4335", V_Y = "#FBBC05", V_G = "#34A853";
const vDisc = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const vRing = (x, y, r, c, w = 7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const vPlus = (x, y, sc, c, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${sc})" fill="${c}"><rect x="-4" y="-14" width="8" height="28" rx="4"/><rect x="-14" y="-4" width="28" height="8" rx="4"/></g>`;
const vTri = (x, y, sc, r, c) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${sc})" d="M0 -18L16 12L-16 12Z" fill="${c}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`;
const vSq = (x, y, sc, r, c) => `<rect transform="translate(${x} ${y}) rotate(${r}) scale(${sc})" x="-18" y="-18" width="36" height="36" rx="9" fill="${c}"/>`;
const vHalf = (x, y, r, rot, c) => `<path transform="translate(${x} ${y}) rotate(${rot})" d="M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z" fill="${c}"/>`;
const vQuarter = (x, y, r, rot, c) => `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0L${r} 0A${r} ${r} 0 0 1 0 ${r}Z" fill="${c}"/>`;
const vSquig = (x, y, sc, c, w = 5) => `<path transform="translate(${x} ${y}) scale(${sc})" d="M0 0q9 -12 18 0t18 0t18 0" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const vDots = (x, y, c, n = 3, gap = 12) => Array.from({ length: n }, (_, i) => `<circle cx="${x}" cy="${y + i * gap}" r="3.2" fill="${c}"/>`).join("");

const ART_VIBRANT = svgUrl(430, 240,
  vQuarter(430, 0, 58, 90, V_Y) + vRing(346, 26, 12, V_B, 6) +
  vTri(420, 132, 0.8, -90, V_R) + vHalf(0, 96, 24, 90, V_G) + vDisc(10, 176, 8, V_R));
const TILE_VIBRANT = svgUrl(430, 700,
  vHalf(0, 70, 32, 90, V_B) + vQuarter(430, 170, 44, 90, V_R) + vSq(6, 270, 0.9, -14, V_Y) +
  vRing(430, 372, 26, V_G, 8) + vPlus(12, 452, 0.9, V_R, 15) + vTri(422, 532, 0.9, 90, V_B) +
  vDots(10, 596, V_G) + vHalf(430, 664, 30, -90, V_Y));
const PANEL_VIBRANT = svgUrl(160, 48,
  vDisc(142, 14, 7, V_Y) + vPlus(114, 15, 0.55, V_R) + vRing(88, 15, 6, V_B, 3.5) + vSquig(26, 24, 0.8, V_G, 3.5));

const THEMES = {
  /* ───────── 01. PAPYRUS — playful modernism: paper, ink and paint ───────── */
  papyrus: {
    name: "Papyrus",
    blurb: "Warm paper, painted shapes",
    icon: Palette,   // the settings button
    dark: false,
    outer: "#D9CDB8",
    swatches: ["#BB464B", "#789BB8", "#788F5B", "#DBB247"],
    catPalette: [   // School, Personal, Work, Career, Health, Digital
      ["#DCE6EF", "#4F7394"], ["#F3D9D4", "#A33A3F"], ["#E1E6D3", "#5C7044"],
      ["#F0DAD2", "#A86A5A"], ["#F5E6BE", "#8F6E12"], ["#E6DCCB", "#7A6A52"],
    ],
    vars: {
      "--bg": `${PAPYRUS_PAGE} center top / cover no-repeat, #EDE4D6`,   // one painting behind everything, so the top, the bottom bars and the buttons all match
      "--panel": "#F3EADB",
      "--card": "#FBF7EF",
      "--text": "#3B2A1B",
      "--muted": "#5E4C38",
      "--line": "rgba(107,93,69,.16)",
      "--accent": "#A93C41",
      "--accent-ink": "#FFF8F0",
      "--accent-soft": "#F3D9D4",
      "--someday-bg": "#3E7F86",
      "--someday-ink": "#FFF8F0",
      "--watch-bg": "#946A1B",
      "--watch-ink": "#FFF8F0",
      "--btn-bg": "#A93C41",
      "--btn-ink": "#FFF8F0",
      "--danger": "#A8322F",
      "--hero-bg": "linear-gradient(120deg,#A93C41 0%,#B5503F 50%,#C98A3A 105%)",
      "--panel-deco": PANEL_PAPYRUS,
      "--hero-ink": "#FFF8F0",
      "--c-green": "#788F5B", "--c-yellow": "#DBB247", "--c-blue": "#789BB8", "--c-orange": "#D0793F",   // colour-coding for the Inbox toggles
      "--bar-bg": "#EDE4D6",   // solid paper colour behind the Evening Clean Up button, instead of the painting
      "--font-display": "Fraunces,'Iowan Old Style','Palatino Linotype',Georgia,serif",
      "--font-body": "Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "600",
      "--display-transform": "none",
      "--display-spacing": "-0.02em",
      "--radius-lg": "22px",
      "--radius-md": "14px",
      "--radius-pill": "999px",
      "--shadow": "0 4px 14px rgba(107,93,69,.12)",
      "--nav-bg": "#FBF7EF",
      "--nav-active": "#A93C41",
      "--scrim": "rgba(60,45,30,.4)",
      "--q1": "#788F5B", "--q1-bg": "#E1E6D3",
      "--q2": "#BB464B", "--q2-bg": "#F3D9D4",
      "--q3": "#C99A2A", "--q3-bg": "#F5E6BE",
      "--q4": "#789BB8", "--q4-bg": "#DCE6EF",
    },
  },

  /* ───────── 02. VIBRANT — bright base, confident pops ───────── */
  vibrant: {
    name: "Vibrant",
    blurb: "Primary colors, clean and playful",
    icon: Sparkles,   // the settings button
    dark: false,
    outer: "#E8EAED",
    swatches: ["#4285F4", "#EA4335", "#FBBC05", "#34A853"],
    catPalette: [   // School, Personal, Work, Career, Health, Digital
      ["#E8F0FE", "#1967D2"], ["#FCE8E6", "#C5221F"], ["#FEF7E0", "#B06000"],
      ["#E6F4EA", "#137333"], ["#F3E8FD", "#8430CE"], ["#E4F7FB", "#007B83"],
    ],
    vars: {
      "--bg": "linear-gradient(180deg,#FFFFFF 0%,#F8F9FA 100%)",
      "--deco": ART_VIBRANT,
      "--deco-size": "100% auto",
      "--deco2": TILE_VIBRANT,
      "--deco2-size": "100% auto",
      "--panel-deco": PANEL_VIBRANT,
      "--panel": "#F1F3F4",
      "--card": "#FFFFFF",
      "--text": "#202124",
      "--muted": "#5F6368",
      "--line": "rgba(60,64,67,.14)",
      "--accent": "#1A73E8",
      "--accent-ink": "#FFFFFF",
      "--accent-soft": "#E8F0FE",
      "--someday-bg": "#188038",
      "--someday-ink": "#FFFFFF",
      "--watch-bg": "#B45F06",
      "--watch-ink": "#FFFFFF",
      "--btn-bg": "#4285F4",
      "--btn-ink": "#FFFFFF",
      "--danger": "#D93025",
      "--hero-bg": "#E8F0FE",
      "--hero-ink": "#202124",
      "--dump-btn": "#4285F4",
      "--dump-ink": "#FFFFFF",
      "--c-green": "#34A853", "--c-yellow": "#FBBC05", "--c-blue": "#4285F4", "--c-orange": "#FA7B17",   // colour-coding for the Inbox toggles
      "--font-display": "Poppins,'Google Sans','Avenir Next','Segoe UI',system-ui,sans-serif",
      "--font-body": "Roboto,Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "600",
      "--display-transform": "none",
      "--display-spacing": "-0.015em",
      "--radius-lg": "20px",
      "--radius-md": "14px",
      "--radius-pill": "999px",
      "--shadow": "0 1px 2px rgba(60,64,67,.28), 0 1px 4px 1px rgba(60,64,67,.12)",
      "--nav-bg": "#FFFFFF",
      "--nav-active": "#1A73E8",
      "--scrim": "rgba(32,33,36,.42)",
      "--q1": "#34A853", "--q1-bg": "#E6F4EA",
      "--q2": "#4285F4", "--q2-bg": "#E8F0FE",
      "--q3": "#F9AB00", "--q3-bg": "#FEF7E0",
      "--q4": "#EA4335", "--q4-bg": "#FCE8E6",
    },
  },

  /* ───────── 03. BOTANICAL — earthy, olive, paper ───────── */
  botanical: {
    name: "Botanical",
    blurb: "Earthy, organic, grounded",
    icon: Leaf,   // the settings button
    dark: false,
    outer: "#D9D1BE",
    swatches: ["#6B7B47", "#8CA37A", "#D6C295", "#A67C52"],
    catPalette: [
      ["#E2EAD3", "#55703F"], ["#E8E6D2", "#6B6A45"], ["#F0E0CC", "#8A5E35"],
      ["#F3E7C8", "#8A6D1F"], ["#DDE8D8", "#3F6B4A"], ["#E9E2D6", "#6B5E48"],
    ],
    vars: {
      "--bg": "linear-gradient(180deg,#FCF9F3 0%,#F4ECDC 100%)",
      "--deco": ART_BOTANICAL,
      "--deco-size": "100% auto",
      "--deco2": TILE_BOTANICAL,
      "--deco2-size": "100% auto",
      "--panel": "#F2EADB",
      "--card": "#FFFBF2",
      "--text": "#2E2E28",
      "--muted": "#6A6550",
      "--line": "rgba(120,100,60,.18)",
      "--accent": "#5A6A3A",
      "--accent-ink": "#FBF8EE",
      "--accent-soft": "#E2E7D0",
      "--someday-bg": "#A4573B",
      "--someday-ink": "#FBF8EE",
      "--watch-bg": "#4B6C7A",
      "--watch-ink": "#FBF8EE",
      "--btn-bg": "#5A6A3A",
      "--btn-ink": "#FBF8EE",
      "--danger": "#B5483A",
      "--hero-bg": "linear-gradient(120deg,#56663A 0%,#6F8450 55%,#B79A55 118%)",
      "--panel-deco": PANEL_BOTANICAL,
      "--hero-ink": "#FBF8EE",
      "--c-green": "#6F8A5C", "--c-yellow": "#C2A25E", "--c-blue": "#7C9AAE", "--c-orange": "#C47A3F",   // colour-coding for the Inbox toggles
      "--font-display": "Manrope,'Avenir Next','Segoe UI',system-ui,sans-serif",
      "--font-body": "Lato,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "700",
      "--display-transform": "none",
      "--display-spacing": "-0.01em",
      "--radius-lg": "20px",
      "--radius-md": "14px",
      "--radius-pill": "999px",
      "--shadow": "0 4px 14px rgba(90,80,40,.10)",
      "--nav-bg": "#FCF9F3",
      "--nav-active": "#5A6A3A",
      "--scrim": "rgba(46,46,40,.4)",
      "--q1": "#6F8A5C", "--q1-bg": "#E2EAD3",
      "--q2": "#7C7A5A", "--q2-bg": "#E8E6D2",
      "--q3": "#C2A25E", "--q3-bg": "#F3E7C8",
      "--q4": "#A67C52", "--q4-bg": "#EEDFCF",
    },
  },

  /* ───────── 04. CELESTIAL — twilight blue, gold ───────── */
  celestial: {
    name: "Celestial",
    blurb: "Airy, starlit, mystical",
    icon: Star,   // the settings button
    dark: false,
    outer: "#CDD3EC",
    swatches: ["#5F72BE", "#C9BFEF", "#D8BD88", "#E9B8C9"],
    catPalette: [
      ["#E2E7F8", "#4F5FA8"], ["#EADFF5", "#7550A6"], ["#F6E9CF", "#8C6F2E"],
      ["#DDEFF0", "#2F7C86"], ["#F5DDE6", "#A24A6E"], ["#E6E9F4", "#55608A"],
    ],
    vars: {
      "--bg": "linear-gradient(180deg,#EAEEFB 0%,#FAF9FE 45%,#EFEFFB 100%)",
      "--deco": ART_CELESTIAL,
      "--deco-size": "100% auto",
      "--deco2": TILE_CELESTIAL,
      "--deco2-size": "100% auto",
      "--panel": "#E4E8F7",
      "--card": "#FCFCFF",
      "--text": "#2B3158",
      "--muted": "#5A6296",
      "--line": "rgba(95,114,190,.15)",
      "--accent": "#5F72BE",
      "--accent-ink": "#FFFFFF",
      "--accent-soft": "#E2E7F8",
      "--someday-bg": "#34816C",
      "--someday-ink": "#FFFFFF",
      "--watch-bg": "#966F1E",
      "--watch-ink": "#FFFFFF",
      "--btn-bg": "#5F72BE",
      "--btn-ink": "#FFFFFF",
      "--danger": "#C4455A",
      "--good": "#4E9A7A",   // a calm green for "high impact" (this theme's own blues aren't green)
      "--hero-bg": "linear-gradient(120deg,#4F5FA8 0%,#7B88D4 55%,#E9B8C9 118%)",
      "--panel-deco": PANEL_CELESTIAL,
      "--hero-ink": "#FFFFFF",
      "--c-green": "#4E9A7A", "--c-yellow": "#D8BD88", "--c-blue": "#5F72BE", "--c-orange": "#E0A070",   // colour-coding for the Inbox toggles
      "--font-display": "'Nixie One','Iowan Old Style',Georgia,serif",   // page title and big card titles
      "--font-display-sm": "Comfortaa,'Avenir Next','Segoe UI',system-ui,sans-serif",   // smaller headings
      "--display-weight-sm": "700",
      "--display-scale": "1.1",   // Nixie One runs small,
      "--font-body": "Comfortaa,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "400",
      "--card-title-weight": "700",   // the text on the big cards is bold (Nixie One has one weight, so the phone makes it bold)
      "--display-transform": "none",
      "--display-spacing": "0.01em",
      "--radius-lg": "22px",
      "--radius-md": "15px",
      "--radius-pill": "999px",
      "--shadow": "0 4px 18px rgba(95,114,190,.15)",
      "--nav-bg": "#FAF9FE",
      "--nav-active": "#5F72BE",
      "--scrim": "rgba(43,49,88,.4)",
      "--q1": "#7F8FD4", "--q1-bg": "#E3E7F9",
      "--q2": "#5F72BE", "--q2-bg": "#DADFF4",
      "--q3": "#C4A15A", "--q3-bg": "#F4EAD2",
      "--q4": "#A99BD8", "--q4-bg": "#EAE5F7",
    },
  },

  /* ───────── 05. SOFT SANCTUARY — lavender, blush, sage ───────── */
  sanctuary: {
    name: "Sanctuary",
    blurb: "Gentle, dreamy, peaceful",
    icon: Flower2,   // the settings button
    dark: false,
    outer: "#DACDE6",
    swatches: ["#9A6FBE", "#C9A7E0", "#9DB89E", "#F7D7E8"],
    catPalette: [
      ["#E1EDE2", "#4F7A55"], ["#EADCF4", "#7A4FA3"], ["#FBE3EE", "#B8467A"],
      ["#E8E6F6", "#5E5C9E"], ["#DDEFEA", "#2F7A6B"], ["#EFE6F4", "#7C6C8F"],
    ],
    vars: {
      "--bg": "linear-gradient(180deg,#FCF8FD 0%,#F4ECF8 100%)",
      "--deco": ART_SANCTUARY,
      "--deco-size": "100% auto",
      "--deco2": TILE_SANCTUARY,
      "--deco2-size": "100% auto",
      "--panel": "#F2EAF7",
      "--card": "#FEFBFF",
      "--text": "#3A2E46",
      "--muted": "#6F6185",
      "--line": "rgba(110,70,150,.13)",
      "--accent": "#835AA6",
      "--accent-ink": "#FFFFFF",
      "--accent-soft": "#EADCF4",
      "--someday-bg": "#B24F78",
      "--someday-ink": "#FFFFFF",
      "--watch-bg": "#4F8260",
      "--watch-ink": "#FFFFFF",
      "--btn-bg": "#835AA6",
      "--btn-ink": "#FFFFFF",
      "--danger": "#C2455F",
      "--hero-bg": "linear-gradient(120deg,#6F4A93 0%,#8E64B0 55%,#D68FB5 115%)",
      "--panel-deco": PANEL_SANCTUARY,
      "--hero-ink": "#FFFFFF",
      "--c-green": "#7FA283", "--c-yellow": "#E0B867", "--c-blue": "#8BA6D6", "--c-orange": "#E39A6B",   // colour-coding for the Inbox toggles
      "--font-display": "'Rouge Script',cursive,Georgia,serif",   // page title and big card titles
      "--font-display-sm": "'Klee One','Avenir Next','Segoe UI',system-ui,sans-serif",   // smaller headings
      "--display-weight-sm": "600",
      "--display-scale": "1.35",   // Rouge Script runs very small,
      "--font-body": "'Klee One',-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "400",
      "--display-transform": "none",
      "--display-spacing": "0",
      "--radius-lg": "26px",
      "--radius-md": "18px",
      "--radius-pill": "999px",
      "--shadow": "0 6px 20px rgba(140,100,180,.13)",
      "--nav-bg": "#FCF8FD",
      "--nav-active": "#835AA6",
      "--scrim": "rgba(58,46,70,.4)",
      "--q1": "#7FA283", "--q1-bg": "#E1EDE2",
      "--q2": "#9A6FBE", "--q2-bg": "#EADCF4",
      "--q3": "#D9779E", "--q3-bg": "#FBE3EE",
      "--q4": "#A895B8", "--q4-bg": "#EFE6F4",
    },
  },
  /* ───────── 06. CLEAN — white and grey surfaces, one calm green accent, bold geometric type (from your screenshot) ───────── */
  clean: {
    name: "Clean",
    blurb: "Fresh whites and greys",
    icon: Zap,   // the settings button
    dark: false,
    outer: "#E7E7E4",
    swatches: ["#FFFFFF", "#ECECE9", "#B4B8B6", "#5B615F"],
    catPalette: [   // School, Personal, Work, Career, Health, Digital
      ["#E6F2E8", "#2F7A45"], ["#FFF0E0", "#B85F12"], ["#E6F0FF", "#1F5FD0"],
      ["#EFE8FB", "#6B46C1"], ["#FDE8E8", "#C53030"], ["#EBEDF0", "#4B5563"],
    ],
    vars: {
      "--bg": "linear-gradient(180deg,#FFFFFF 0%,#F6F6F4 100%)",
      "--panel": "#F1F1EE",
      "--card": "#FFFFFF",
      "--text": "#12181B",
      "--muted": "#667069",
      "--line": "rgba(20,30,25,.09)",
      "--accent": "#3F6B52",
      "--accent-ink": "#FFFFFF",
      "--accent-soft": "#E4EEE8",
      "--someday-bg": "#4458A8",
      "--someday-ink": "#FFFFFF",
      "--watch-bg": "#B0661A",
      "--watch-ink": "#FFFFFF",
      "--btn-bg": "#3F6B52",
      "--btn-ink": "#FFFFFF",
      "--eve-bg": "#FFFFFF",        // the top card and the Evening Clean Up card are white, like your screenshot
      "--eve-ink": "#12181B",
      "--head-margin": "calc(env(safe-area-inset-top) + 2px) 14px 6px",
      "--head-radius": "22px",
      "--head-pad-top": "18px",
      "--head-pad-top-sm": "14px",
      "--head-act-top": "18px",
      "--safe-bg": "#3F6B52",   // status-bar strip: dark, because the top card itself is white
      "--headbtn-bg": "#E4EEE8",
      "--headbtn-ink": "#3F6B52",
      "--hero-bg": "#FFFFFF",
      "--hero-ink": "#12181B",
      "--dump-bg": "#F2F2EF",
      "--dump-btn": "#3F6B52",
      "--dump-ink": "#FFFFFF",
      "--danger": "#D13B3B",
      "--c-green": "#4C9A6A", "--c-yellow": "#D9A21B", "--c-blue": "#3F73C8", "--c-orange": "#D98A2B",   // colour-coding for the Inbox toggles
      "--font-display": "'Courier Prime','Courier New',Courier,monospace",   // page title and big card titles
      "--font-display-sm": "'Plus Jakarta Sans','Avenir Next','Segoe UI',system-ui,sans-serif",   // smaller headings
      "--display-weight-sm": "400",
      "--display-scale": "0.88",   // Courier is wide, so the title is a little smaller,
      "--font-body": "'Plus Jakarta Sans',Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "400",
      "--display-transform": "none",
      "--display-spacing": "-0.02em",
      "--radius-lg": "22px",
      "--radius-md": "14px",
      "--radius-pill": "999px",
      "--shadow": "0 1px 2px rgba(20,30,25,.05), 0 6px 18px rgba(20,30,25,.06)",
      "--nav-bg": "#FFFFFF",
      "--nav-active": "#3F6B52",
      "--scrim": "rgba(18,24,27,.38)",
      "--q1": "#4C9A6A", "--q1-bg": "#E6F2EA",
      "--q2": "#3F73C8", "--q2-bg": "#E6EFFC",
      "--q3": "#D98A2B", "--q3-bg": "#FDF0DD",
      "--q4": "#7A8280", "--q4-bg": "#EDEFEE",
    },
  },
};
const DEFAULT_THEME = "papyrus";

/* ═══════════════════════════ helpers & data ═══════════════════════════════ */

const pad = (n) => String(n).padStart(2, "0");
const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const offsetDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
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
const isToday = (ms) => !!ms && new Date(ms).toDateString() === new Date().toDateString();
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
    const key = SNAP_PREFIX + new Date().toLocaleDateString("en-CA");
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
.cd-themegrid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.cd-tile{display:flex;flex-direction:column;align-items:flex-start;gap:7px;padding:10px 12px;border-radius:var(--radius-md);background:var(--panel);border:2px solid transparent;text-align:left;min-width:0}
.cd-tile.on{border-color:var(--accent)}
.cd-tile b{font-size:12.5px;font-weight:600;line-height:1.2}
.cd-tile .cd-sw{border-radius:11px;box-shadow:0 0 0 1px var(--line)}
.cd-tile .cd-sw i{width:16px;height:22px}
.cd-tile .cd-sw i:first-child{border-radius:11px 0 0 11px}
.cd-tile .cd-sw i:last-child{border-radius:0 11px 11px 0}
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
.cd-tag.good{background:color-mix(in srgb,var(--c-green,#3E9B5F) 16%,var(--card));color:var(--c-green,#3E9B5F)}
.cd-tag.bad{background:color-mix(in srgb,var(--danger) 14%,var(--card));color:var(--danger)}
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
.cd[data-theme="clean"],.cd[data-theme="clean"] *{font-weight:400 !important}
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
.cd-icomini{display:inline-block;width:24px;height:24px;flex:none}
.cd-icomini svg,.cd-icobig svg,.cd-icotile svg{display:block;width:100%;height:100%}
.cd-icoprev{display:flex;gap:14px;align-items:center;margin:6px 0 4px}
.cd-icobig{display:block;width:76px;height:76px;flex:none;filter:drop-shadow(0 6px 12px rgba(0,0,0,.18))}
.cd-icogrid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px}
.cd-icotile{aspect-ratio:1;display:block;padding:0;border-radius:14px;border:3px solid transparent;background:transparent;cursor:pointer}
.cd-icotile.on{border-color:var(--text)}
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

// ── Loading icon: the picture shown while the app starts. Chosen in Settings, and also remembered under "ctd:icon" so the page
//    can draw it before any script has loaded. (The same code is in index.html.) ──
const BOOT_COLORS = { rust: ["#C25A35", "#A8441F"], teal: ["#3F9A93", "#2B7570"], plum: ["#9A62B8", "#774391"], olive: ["#7A8F4A", "#5A6A3A"], blue: ["#5F82D6", "#3F5FB0"], rose: ["#D4708F", "#B0506F"] };
const BOOT_ART = "data:image/jpeg;base64,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";   // the illustration (a 288 px picture)
const BOOT_GLYPHS = {
  art: () => "",   // drawn as a picture by bootIconSvg below
  check: (ink, dark) => `<rect x="24" y="24" width="52" height="52" rx="10" fill="${ink}"/><path d="M38 51 L47 60 L63 41" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  flower: (ink, dark) => `<g fill="${ink}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="50" cy="35" rx="10" ry="15.5" transform="rotate(${a} 50 50)"/>`).join("")}</g><circle cx="50" cy="50" r="8.5" fill="${dark}"/>`,
  leaf: (ink, dark) => `<path d="M28 72 C24 44 44 24 74 26 C76 56 58 76 28 72 Z" fill="${ink}"/><path d="M30 70 L62 38" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  moon: (ink, dark, uid) => `<defs><mask id="mn${uid}"><rect width="100" height="100" fill="#fff"/><circle cx="60" cy="42" r="23" fill="#000"/></mask></defs><circle cx="47" cy="52" r="25" fill="${ink}" mask="url(#mn${uid})"/><path d="M70 62 l2.2 5.6 5.8 2.2 -5.8 2.2 -2.2 5.8 -2.2 -5.8 -5.8 -2.2 5.8 -2.2z" fill="${ink}"/>`,
  sun: (ink) => `<circle cx="50" cy="50" r="13.5" fill="${ink}"/><g stroke="${ink}" stroke-width="5.5" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="50" y1="22" x2="50" y2="29" transform="rotate(${a} 50 50)"/>`).join("")}</g>`,
  butterfly: (ink, dark) => `<g fill="${ink}"><ellipse cx="36" cy="40" rx="14" ry="16" transform="rotate(-28 36 40)"/><ellipse cx="64" cy="40" rx="14" ry="16" transform="rotate(28 64 40)"/><ellipse cx="38" cy="63" rx="10" ry="12" transform="rotate(20 38 63)"/><ellipse cx="62" cy="63" rx="10" ry="12" transform="rotate(-20 62 63)"/></g><rect x="47.5" y="32" width="5" height="40" rx="2.5" fill="${dark}"/>`,
  mountain: (ink) => `<path d="M18 74 L42 36 L55 56 L64 44 L82 74 Z" fill="${ink}"/><circle cx="72" cy="32" r="6" fill="${ink}"/>`,
  heart: (ink) => `<path d="M50 74 C28 58 22 46 28 37 C34 28 45 30 50 39 C55 30 66 28 72 37 C78 46 72 58 50 74 Z" fill="${ink}"/>`,
  star: (ink) => `<path d="M50 22 L58.5 41 L79 43.5 L63.5 57.5 L68 78 L50 67.5 L32 78 L36.5 57.5 L21 43.5 L41.5 41 Z" fill="${ink}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`,
  bolt: (ink) => `<path d="M57 20 L33 55 H48 L43 80 L67 44 H52 Z" fill="${ink}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`,
};
const DEFAULT_BOOT_ICON = { g: "art", c: "rust" };
const bootIconSvg = (pick, uid = "boot") => {
  const g = pick && BOOT_GLYPHS[pick.g] ? pick.g : DEFAULT_BOOT_ICON.g;
  const c = pick && BOOT_COLORS[pick.c] ? pick.c : DEFAULT_BOOT_ICON.c;
  if (g === "art") return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="cp${uid}"><rect width="100" height="100" rx="22.5"/></clipPath></defs><image href="${BOOT_ART}" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#cp${uid})"/></svg>`;
  const [top, bottom] = BOOT_COLORS[c];
  const id = "bg" + uid;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="100" height="100" rx="22.5" fill="url(#${id})"/>${BOOT_GLYPHS[g]("#F5E6DA", bottom, uid)}</svg>`;
};
const readBootPick = () => { try { const v = JSON.parse(localStorage.getItem("ctd:icon")); return v && BOOT_GLYPHS[v.g] && BOOT_COLORS[v.c] ? v : null; } catch (e) { return null; } };
const BOOT_AT_LOAD = readBootPick() || DEFAULT_BOOT_ICON;   // read at once, before the saved data has loaded, so the right icon is on screen from the first frame

function BootMark() {
  return <div className="cd-bootmark" role="status" aria-label="Loading" dangerouslySetInnerHTML={{ __html: bootIconSvg(BOOT_AT_LOAD, "boot") }} />;
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
function PageHead({ ctx, title, sub, action }) {
  const SettingsIcon = ctx.themeIcon;
  return (
    <header className="cd-headcard">
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
  const hasMeta = item.category || showDue || isFocus || showImpact || urgent;
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
  const shown = todaySort(items.filter((i) => i.status === "today" || (i.status === "done" && i.doneFrom === "today" && ctx.justDone.has(i.id))));
  const openCount = shown.filter((i) => i.status === "today").length;
  const scrollRef = useRef(null);
  const reorder = useReorder(shown.map((i) => i.id), ctx.reorderToday, scrollRef);
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

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
    <PageHead ctx={ctx} title="Clear the day." sub="Capture. Choose. Do what matters." />
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
        <div className="cd-sechead"><h2 className="cd-h2">Today’s To Do</h2>{shown.length > 1 && <div className="cd-cap">Hold and drag to reorder</div>}</div>
        <button className="cd-plus" onClick={() => ctx.setSheet({ type: "edit", id: null, status: "today" })} aria-label="Add task"><Plus size={22} /></button>
      </div>

      {shown.length === 0 && (
        <div className="cd-empty"><b>The deck is clear.</b>Add a task, or pull one in from Future.</div>
      )}
      <div className={"cd-list" + (shown.length ? " cd-cardlist" : "")} ref={reorder.contRef}>
        {shown.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} focusLabel todayView rowProps={reorder.rowProps(i.id)} />)}
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
const inboxTitleSize = (t) => { const n = (t || "").length; const px = n <= 16 ? 42 : n <= 30 ? 36 : n <= 50 ? 30 : n <= 80 ? 25 : 21; return `calc(${px}px * min(var(--display-scale, 1), 1.2))`; };

function InboxView({ ctx, items }) {
  const [skipped, setSkipped] = useState([]);
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
    setHistory((h) => [...h.slice(-19), { kind: "skip", id: cur.id, dir, draft: { ...draft }, skipped }]);
    setFront(null);
    setSkipped((s) => [...s.filter((x) => x !== cur.id), cur.id]);
  };
  const save = () => {
    if (!cur) return;
    if (!complete) { ctx.toast("Set effort, impact and urgency first"); return; }
    setHistory((h) => [...h.slice(-19), { kind: "save", id: cur.id, dir: 1, draft: { ...draft }, before: snap() }]);
    setFront(null);
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
    setFront(null);
    ctx.patchItem(cur.id, { status: "watching", category: draft.category || cur.category });
    setHandled((h) => h + 1);
    ctx.toast("Moved to Watching", { label: "View", run: () => ctx.goRadar("watching") });
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
    ctx.toast("Moved to Someday", { label: "View", run: () => ctx.goRadar("someday") });
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
      <>
        <PageHead ctx={ctx} title="Inbox" sub="All caught up."
          action={<button className="cd-undo" onClick={undo} disabled={!history.length} aria-label="Undo last sort"><RotateCcw size={15} /> Undo</button>} />
      <div className="cd-scroll">
        <div className="cd-empty" style={{ marginTop: 56 }}>
          <Inbox size={34} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: 10 }} />
          <b>All sorted.</b>Nothing is waiting for a label. Use the thought dump on Today to capture more.
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <PageHead ctx={ctx} title="Inbox" sub={`${queue.length} ${queue.length === 1 ? "card" : "cards"} left · swipe to send to the back`}
          action={<button className="cd-undo" onClick={undo} disabled={!history.length} aria-label="Undo last sort"><RotateCcw size={15} /> Undo</button>} />
      <div className="cd-scroll lock">
        <div className="cd-progress"><i style={{ width: `${(handled / total) * 100}%` }} /></div>

        <div className="cd-stack2" style={{ marginBottom: behind * 10 }}>
          {[2, 1].filter((n) => n <= behind).map((n) => {
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
          <div className="cd-card"
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
            <button className="cd-cardact" onPointerDown={(e) => e.stopPropagation()} onClick={() => fling("del")} aria-label="Delete card"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>
      <div className="cd-dock">
        <div className={"cd-catrow" + (nudgeCat ? " shake" : "")}>
          <CategoryPicker pill label={<FolderIcon />} categories={ctx.categories} value={draft.category}
            dot={draft.category ? ctx.catStyle(draft.category)[1] : null}
            onChange={(c) => setField("category", c)} onAdd={ctx.addCategory} />
        </div>
        <div className={"cd-quad" + (hasCat ? "" : " locked")}
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
      <PageHead ctx={ctx} title="Future" sub="Everything not for today." />
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
          {matrixItems.length === 0 && attn.length === 0 && <div className="cd-empty"><b>Nothing sorted here yet.</b>Sort items in your Inbox and they land here.</div>}
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
          {calGroups.length === 0 && <div className="cd-empty"><b>No dates set.</b>Add a due date from an item’s menu to see it here.</div>}
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
      {list.length === 0 && <div className="cd-empty"><b>Someday is empty.</b>Park ideas here from your Inbox, or from an item’s menu.</div>}
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
      <PageHead ctx={ctx} title="Radar" sub={mode === "watching" ? "Swipe left for Inbox · hold to reorder" : "Ideas for later. No date, no urgency."} />
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

  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const Stat = ({ n, l, cls }) => <div className={"cd-stat " + (cls || "")}><b>{n}</b><span>{l}</span></div>;
  const doneAll = items.filter((i) => i.status === "done").length;
  const doneWeek = items.filter((i) => i.status === "done" && i.doneAt && i.doneAt >= Date.now() - 7 * 864e5).length;

  return (
    <>
      <PageHead ctx={ctx} title="Dashboard" sub="Your big picture." />
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
  const todayKey = new Date().toDateString();
  const yesterdayKey = new Date(Date.now() - 864e5).toDateString();
  const groups = [];
  done.forEach((i) => {
    const key = i.doneAt ? new Date(i.doneAt).toDateString() : "earlier";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.list.push(i); else groups.push({ key, at: i.doneAt, list: [i] });
  });
  const label = (g) => g.key === "earlier" ? "Earlier" : g.key === todayKey ? "Today" : g.key === yesterdayKey ? "Yesterday"
    : new Date(g.at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
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
      <PageHead ctx={ctx} title="Completed" sub={`${done.length} ${done.length === 1 ? "task" : "tasks"} finished`}
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
        {done.length === 0 && <div className="cd-empty"><b>Nothing finished yet.</b>Tasks you check off will collect here.</div>}
      </div>
    </>
  );
}

/* ═══════════════════════════════ SHEETS ═══════════════════════════════════ */

// the same three colours as the buttons: scheduling = accent, Someday, Watch
const MENU_TINT = { "Move to tomorrow": "var(--accent)", "Move to this week": "var(--accent)", "Move to future": "var(--accent)", "Move to Future": "var(--accent)", "Move to Today": "var(--accent)",
  "Move to someday": "var(--someday-bg)", "Move to Someday": "var(--someday-bg)", "Move out of Someday": "var(--someday-bg)", "Move to watch": "var(--watch-bg)", "Mark as Watching": "var(--watch-bg)" };
function ItemMenu({ ctx, item, close }) {
  const act = (fn, msg, view) => () => { fn(); close(); if (msg) ctx.toast(msg, view ? { label: "View", run: () => ctx.goRadar(view) } : undefined); };
  const p = (patch, msg, view) => act(() => ctx.patchItem(item.id, patch), msg, view);
  const rows = [];
  const done = item.status === "done";
  // A future date puts the task in Future; one without its labels waits in the Inbox to be finished
  const waits = !item.effort || !item.impact ? " (it needs effort and impact, so it's waiting in the Inbox)" : "";
  if (item.status === "today") {
    rows.push(
      { Icon: Sun, label: "Move to tomorrow", run: p({ status: "future", someday: false, urgency: "now", due: offsetDay(1) }, "Moved to tomorrow" + waits) },
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

function Editor({ ctx, item, initialStatus, close }) {
  const [d, setD] = useState(() => ({
    title: item?.title || "", category: item?.category || null, effort: item?.effort || null,
    impact: item?.impact || null, due: item?.due || "", status: item?.status || initialStatus || "today",
    doneOn: item?.status === "done" && item?.doneAt ? iso(new Date(item.doneAt)) : "",   // date completed (finished tasks only)
  }));
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const active = d.status === "today" || (d.status === "future" && !item?.someday);   // Today and Future tasks need effort and impact
  const missing = active && (!d.effort || !d.impact);
  const save = () => {
    const title = d.title.trim();
    if (!title || missing) return;
    const parked = d.status === "watching" || (d.status === "future" && !!item?.someday);
    const noDate = d.status === "future" && !!item?.someday;   // Someday has no date; Watching may have one
    const payload = { ...d, title, due: noDate ? null : (d.due || null),
      someday: d.status === "future" || d.status === "done" ? !!item?.someday : false };
    if (!parked && d.due !== (item?.due || "")) payload.urgency = d.due ? urgencyForDate(d.due) : null;   // the date changed, so urgency follows it
    else if (!parked && item && d.status !== item.status) {                                              // moved between Today and Future: the date follows
      if (d.status === "today") { payload.urgency = "now"; payload.due = iso(); }
      else if (d.status === "future") { payload.urgency = "later"; payload.due = offsetDay(7); }
    } else if (!parked && !item && d.status === "today" && !d.due) { payload.urgency = "now"; payload.due = iso(); }   // new task added straight to Today
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
  const needsInbox = d.status === "future" && !item?.someday && !d.category;
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
            {[["today", "Today"], ["future", "Future"], ["watching", "Watching"]].map(([v, l]) => (
              <button key={v} className={"cd-segbtn sm" + (d.status === v ? " on" : "")} onClick={() => set("status", v)}>{l}</button>
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
      {item?.someday && d.status === "future" && <div className="cd-hint" style={{ textAlign: "left" }}>Someday items have no date. Move it to Today, or out of Someday, to date it.</div>}
      {!(d.status === "future" && item?.someday) && (
        <>
          <div className="cd-fl">Due date</div>
          <input className="cd-input" type="date" value={d.due} onChange={(e) => set("due", e.target.value)} aria-label="Due date" />
        </>
      )}
      <button className="cd-primary" disabled={!d.title.trim() || missing} onClick={save}>{item ? "Save changes" : "Add item"}</button>
      {missing && <div className="cd-hint" style={{ marginTop: 10 }}>Choose effort and impact to put this on {d.status === "today" ? "Today" : "Future"}. Every task there needs a date, urgency, effort and impact.</div>}
      {!missing && needsInbox && <div className="cd-hint" style={{ marginTop: 10 }}>Items without a category wait in the Inbox.</div>}
    </Sheet>
  );
}

function Evening({ ctx, items, close }) {
  const [queue] = useState(() => todaySort(items.filter((i) => i.status === "today")).map((i) => i.id));
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState({ tomorrow: 0, week: 0, future: 0, someday: 0, watching: 0 });
  const [history, setHistory] = useState([]);   // every choice, so each can be undone
  const [leaving, setLeaving] = useState(false);
  const [enterFrom, setEnterFrom] = useState(1); // 1 = new card slides in from the right, -1 = undo brings it back from the left

  const finished = items.filter((i) => i.status === "done" && isToday(i.doneAt)).length;
  const inFlow = idx < queue.length;
  const cur = inFlow ? items.find((i) => i.id === queue[idx]) : null;

  // If an item vanished mid-flow, skip past it
  useEffect(() => { if (inFlow && !cur) setIdx((i) => i + 1); }, [inFlow, cur]);

  // the same dates the Inbox urgency toggle uses: Next = +3 days, Later = +7 days
  const dueFor = (v) => offsetDay(URGENCY_OPTS.find((o) => o.v === v).days);
  const snapOf = (c) => ({ status: c.status, due: c.due, someday: c.someday, doneAt: c.doneAt, doneFrom: c.doneFrom, urgency: c.urgency || null, effort: c.effort || null, impact: c.impact || null });
  // Tomorrow = Now: the task stays on the deck and its date becomes tomorrow, so it reads "due today" when tomorrow comes
  const rollToTomorrow = { urgency: "now", due: offsetDay(1) };
  const choose = (kind) => {
    if (!cur || leaving) return;
    const before = snapOf(cur);
    const id = cur.id, at = idx;
    setLeaving(true);                       // the card slides away first...
    setTimeout(() => {                      // ...then the next one arrives
      if (kind === "done") ctx.toggleDone(id);
      if (kind === "tomorrow") ctx.patchItem(id, rollToTomorrow);   // Now
      if (kind === "week") ctx.patchItem(id, { status: "future", someday: false, urgency: "next", due: dueFor("next") });     // Next
      if (kind === "future") ctx.patchItem(id, { status: "future", someday: false, urgency: "later", due: dueFor("later") });   // Later
      if (kind === "someday") ctx.patchItem(id, { status: "future", someday: true });   // parked: no date, no urgency
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
    const befores = queue.slice(idx).map((id) => items.find((x) => x.id === id)).filter(Boolean).map((c) => ({ id: c.id, before: snapOf(c) }));
    befores.forEach((b) => ctx.patchItem(b.id, rollToTomorrow));   // every remaining task rolls to tomorrow
    setHistory((h) => [...h, { kind: "rest", n, idxBefore: idx, befores }]);
    setLog((l) => ({ ...l, tomorrow: l.tomorrow + n }));
    setIdx(queue.length);
  };
  const undo = () => {
    if (leaving || !history.length) return;
    const e = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (e.id) ctx.patchItem(e.id, e.before);                                    // put the task back as it was
    if (e.befores) e.befores.forEach((b) => ctx.patchItem(b.id, b.before));       // ...or all of them, for "keep the rest"
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
          <button className="cd-evego" onClick={() => choose("tomorrow")}><Sun size={18} />Tomorrow<small>Now</small></button>
          <button className="cd-evego" onClick={() => choose("week")}><Calendar size={18} />This week<small>Next · {shortDay(dueFor("next"))}</small></button>
          <button className="cd-evego" onClick={() => choose("future")}><CalendarDays size={18} />Future<small>Later · {shortDay(dueFor("later"))}</small></button>
          <button className="cd-evego someday" onClick={() => choose("someday")}><Sparkles size={18} />Someday<small>No date</small></button>
          <button className="cd-evego watch" onClick={() => choose("watching")}><Eye size={18} />Watch<small>Check back</small></button>
          <button className="cd-evego all" disabled={queue.length - idx <= 1} onClick={keepRest}><ArrowRight size={18} />Everything<small>to tomorrow</small></button>
        </div>
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
    ["Moved to this week", log.week],
    ["Moved to Future", log.future],
    ["Moved to Someday", log.someday],
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

function Settings({ ctx, themeId, close }) {
  const ids = Object.keys(THEMES);
  return (
    <Sheet title="Settings" onClose={close}>
      <div className="cd-fl" style={{ marginTop: 0 }}>Theme</div>
      <div className="cd-themegrid">
        {ids.map((id, k) => {
          const t = THEMES[id];
          return (
            <button key={id} className={"cd-tile" + (id === themeId ? " on" : "")} style={{ gridColumn: ids.length === 6 ? "span 2" : k < 3 ? "span 2" : "span 3" }}
              onClick={() => ctx.setTheme(id)} aria-label={`${t.name} theme`} aria-pressed={id === themeId}>
              <span className="cd-sw">{t.swatches.map((c) => <i key={c} style={{ background: c }} />)}</span>
              <b>{t.name}</b>
            </button>
          );
        })}
      </div>
      <button className="cd-ghost" onClick={() => ctx.setSheet({ type: "icon" })}><span className="cd-icomini" dangerouslySetInnerHTML={{ __html: bootIconSvg(ctx.bootIcon, "mini") }} /> Loading icon</button>
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

// Choose the icon shown while the app opens
function IconPicker({ ctx }) {
  const cur = ctx.bootIcon;
  const back = () => ctx.setSheet({ type: "settings" });
  const set = (patch) => ctx.setBootIcon({ ...cur, ...patch });
  return (
    <Sheet title="Loading icon" onClose={back}>
      <div className="cd-icoprev">
        <span className="cd-icobig" dangerouslySetInnerHTML={{ __html: bootIconSvg(cur, "big") }} />
        <div className="cd-sub">Shown while the app opens. The icon on your Home Screen can’t be changed from inside the app.</div>
      </div>
      <div className="cd-fl">Icon</div>
      <div className="cd-icogrid">
        {Object.keys(BOOT_GLYPHS).map((g) => (
          <button key={g} className={"cd-icotile" + (cur.g === g ? " on" : "")} onClick={() => set({ g })} aria-label={g} aria-pressed={cur.g === g}
            dangerouslySetInnerHTML={{ __html: bootIconSvg({ g, c: cur.c }, "t" + g) }} />
        ))}
      </div>
      {cur.g !== "art" && <>
        <div className="cd-fl">Color</div>
        <div className="cd-swatches" style={{ gap: 12 }}>
          {Object.keys(BOOT_COLORS).map((c) => (
            <button key={c} className={"cd-swatch" + (cur.c === c ? " on" : "")} style={{ background: BOOT_COLORS[c][1] }} onClick={() => set({ c })} aria-label={c} aria-pressed={cur.c === c} />
          ))}
        </div>
      </>}
      <button className="cd-ghost" onClick={back}>Done</button>
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
  const [fontsReady, setFontsReady] = useState(false);   // the saved theme's fonts are loaded
  const [radarMode, setRadarMode] = useState("watching");   // which Radar list is showing
  const burstTimer = useRef(null);
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
    const due = stateRef.current.items.filter((i) => i.status === "future" && !i.someday && i.due === t && i.promotedOn !== t);
    if (!due.length) return;
    const ids = new Set(due.map((i) => i.id));
    setState((s) => ({ ...s, items: s.items.map((i) => (ids.has(i.id) ? { ...i, status: "today", promotedOn: t } : i)) }));
    setToastMsg({ m: `${due.length} due today moved to Today` });
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

  // Remember the loading icon where the page can read it instantly next time (before the saved data has loaded)
  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem("ctd:icon", JSON.stringify(state.bootIcon || DEFAULT_BOOT_ICON)); } catch (e) { /* storage unavailable */ }
  }, [state && state.bootIcon]);

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
    lastBackupAt: state.lastBackupAt,
    bootIcon: state.bootIcon || DEFAULT_BOOT_ICON,
    setBootIcon: (pick) => update(() => ({ bootIcon: pick })),
    unsorted: items.filter(isUnlabeled).length,
    goTab: (k) => { setTab(k); setJustDone(new Set()); },
    radarMode, setRadarMode,
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
    patchItem: (id, patch) => update((s) => ({ items: s.items.map((i) => (i.id === id ? normalizeItem(clearParked({ ...i, ...patch })) : i)) })),
    reorderToday: (ids) => update((s) => ({ items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, pos: k } : i; }) })),
    reorderWatching: (ids) => update((s) => ({ items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, wpos: k } : i; }) })),
    moveToTop: (id) => update((s) => {
      const ids = [id, ...todaySort(s.items.filter((i) => i.status === "today")).map((i) => i.id).filter((x) => x !== id)];
      return { items: s.items.map((i) => { const k = ids.indexOf(i.id); return k >= 0 ? { ...i, pos: k } : i; }) };
    }),
    // Moving something to Today reschedules it: a past due date becomes today, so it no longer reads as overdue
    moveToToday: (id) => update((s) => ({
      items: s.items.map((i) => (i.id === id
        ? normalizeItem({ ...i, status: "today", someday: false, urgency: "now", due: iso() })
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
    setTheme: (id) => { loadThemeFonts(id).then(() => update(() => ({ themeId: id }))); },
    // A backup is the whole app state as a JSON file. It uses the same save/share path as the Excel export.
    backupData: async () => {
      const payload = { app: "clear-the-deck", version: APP_VERSION, savedAt: new Date().toISOString(),
        state: { items, categories, categoryColors: state.categoryColors || {}, bootIcon: state.bootIcon || DEFAULT_BOOT_ICON, themeId: state.themeId, cleanedOn: state.cleanedOn } };
      try {
        await saveFile(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "clear-the-day-backup.json"   /* always the same name, so a new backup replaces the old one */);
        update(() => ({ lastBackupAt: Date.now() }));
        toast("Backup saved");
      } catch (e) { if (!e || e.name !== "AbortError") toast("Couldn’t save the backup"); }
    },
    restoreState: (st) => {
      if (!st || !Array.isArray(st.items) || !Array.isArray(st.categories)) { toast("That isn’t a Clear the Day backup"); return false; }
      const prev = { items, categories, categoryColors: state.categoryColors || {}, bootIcon: state.bootIcon || DEFAULT_BOOT_ICON, themeId: state.themeId, cleanedOn: state.cleanedOn };
      lockedRef.current = false;   // restoring is an explicit choice, so saving is safe again
      update(() => ({ items: st.items.map(normalizeItem), categories: st.categories, categoryColors: st.categoryColors || {},
        ...(st.bootIcon && BOOT_GLYPHS[st.bootIcon.g] && BOOT_COLORS[st.bootIcon.c] ? { bootIcon: st.bootIcon } : {}),
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
      <div className={"cd" + (vvh ? " kb" : "") + (settled ? "" : " booting")} style={{ ...theme.vars, "--kb": (vvh || 0) + "px" }} data-theme={state.themeId}
        onPointerDown={(e) => {
          // Tapping anywhere that isn't a text field closes the keyboard
          const a = document.activeElement;
          if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && !e.target.closest("input,textarea,[data-keep-kb]")) a.blur();
        }}>
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
        {sheet?.type === "settings" && <Settings ctx={ctx} themeId={state.themeId} close={close} />}
        {sheet?.type === "icon" && <IconPicker ctx={ctx} />}
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
