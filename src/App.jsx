/**
 * Clear the Deck: a mobile-first task app (Today, Inbox, Future, Watching, Dashboard, Completed)
 * with six themes. Everything lives in this one file on purpose: themes, styles, views and logic.
 * Data is saved in the browser (see storage.js), and can be exported to Excel from Settings.
 */
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import papyrusBg from "./assets/papyrus-bg.jpg";
import pkg from "../package.json";
import {
  Download, Sun, Pencil, Plus, Moon, Check, X, Eye, LayoutGrid, CalendarDays, Timer,
  BarChart3, CheckCircle2, MoreHorizontal, Zap, Target, ClipboardList, Hourglass,
  Trash2, ArrowRight, Calendar, Inbox, RotateCcw, Sparkles, AlertCircle, ArrowUp,
  Palette, Leaf, Star, Flower2, Flame, ArrowLeft,
} from "lucide-react";

// Shown at the bottom of Settings. It comes from "version" in package.json, so bump it there.
const APP_VERSION = pkg.version;

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
  await saveFile(await toXlsxBlob(items), `clear-the-deck-${stamp}.xlsx`);
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
     botanical   Leaves × Barley     olive, sage, clay · Lora + Inter
     celestial   Blue Moon           twilight blue + gold · Cormorant Garamond + Inter
     sanctuary   Lavender × Sage     lavender, blush, sage · Playfair Display + Inter

   Illustrations are small inline SVGs in each theme's --deco var. Each theme has a HERO (top of every page) and a TILE (repeats down
   long pages), both painted on the scrolling area with background-attachment:local.
   ════════════════════════════════════════════════════════════════════════════ */

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Lora:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600&family=Roboto:wght@400;500;700&family=Poppins:wght@600;700&display=swap');\n";

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

/* ── Soft Sanctuary pieces ── */
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
      "--nav-bg": "rgba(251,247,239,.94)",
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
      "--nav-bg": "rgba(255,255,255,.96)",
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
      "--btn-bg": "#5A6A3A",
      "--btn-ink": "#FBF8EE",
      "--danger": "#B5483A",
      "--hero-bg": "linear-gradient(120deg,#56663A 0%,#6F8450 55%,#B79A55 118%)",
      "--panel-deco": PANEL_BOTANICAL,
      "--hero-ink": "#FBF8EE",
      "--c-green": "#6F8A5C", "--c-yellow": "#C2A25E", "--c-blue": "#7C9AAE", "--c-orange": "#C47A3F",   // colour-coding for the Inbox toggles
      "--font-display": "Lora,'Iowan Old Style',Georgia,serif",
      "--font-body": "Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "500",
      "--display-transform": "none",
      "--display-spacing": "-0.01em",
      "--radius-lg": "20px",
      "--radius-md": "14px",
      "--radius-pill": "999px",
      "--shadow": "0 4px 14px rgba(90,80,40,.10)",
      "--nav-bg": "rgba(252,249,243,.92)",
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
      "--btn-bg": "#5F72BE",
      "--btn-ink": "#FFFFFF",
      "--danger": "#C4455A",
      "--good": "#4E9A7A",   // a calm green for "high impact" (this theme's own blues aren't green)
      "--hero-bg": "linear-gradient(120deg,#4F5FA8 0%,#7B88D4 55%,#E9B8C9 118%)",
      "--panel-deco": PANEL_CELESTIAL,
      "--hero-ink": "#FFFFFF",
      "--c-green": "#4E9A7A", "--c-yellow": "#D8BD88", "--c-blue": "#5F72BE", "--c-orange": "#E0A070",   // colour-coding for the Inbox toggles
      "--font-display": "'Cormorant Garamond','Iowan Old Style',Garamond,Georgia,serif",
      "--font-body": "Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "600",
      "--display-transform": "none",
      "--display-spacing": "-0.005em",
      "--radius-lg": "22px",
      "--radius-md": "15px",
      "--radius-pill": "999px",
      "--shadow": "0 4px 18px rgba(95,114,190,.15)",
      "--nav-bg": "rgba(250,249,254,.92)",
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
    name: "Soft Sanctuary",
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
      "--btn-bg": "#835AA6",
      "--btn-ink": "#FFFFFF",
      "--danger": "#C2455F",
      "--hero-bg": "linear-gradient(120deg,#6F4A93 0%,#8E64B0 55%,#D68FB5 115%)",
      "--panel-deco": PANEL_SANCTUARY,
      "--hero-ink": "#FFFFFF",
      "--c-green": "#7FA283", "--c-yellow": "#E0B867", "--c-blue": "#8BA6D6", "--c-orange": "#E39A6B",   // colour-coding for the Inbox toggles
      "--font-display": "'Playfair Display','Iowan Old Style',Georgia,serif",
      "--font-body": "Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "500",
      "--display-transform": "none",
      "--display-spacing": "-0.01em",
      "--radius-lg": "26px",
      "--radius-md": "18px",
      "--radius-pill": "999px",
      "--shadow": "0 6px 20px rgba(140,100,180,.13)",
      "--nav-bg": "rgba(252,248,253,.92)",
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
      "--btn-bg": "#3F6B52",
      "--btn-ink": "#FFFFFF",
      "--eve-bg": "#FFFFFF",        // the top card and the Evening Clean Up card are white, like your screenshot
      "--eve-ink": "#12181B",
      "--head-margin": "10px 14px 6px",
      "--head-radius": "22px",
      "--headbtn-bg": "#E4EEE8",
      "--headbtn-ink": "#3F6B52",
      "--hero-bg": "#FFFFFF",
      "--hero-ink": "#12181B",
      "--dump-bg": "#F2F2EF",
      "--dump-btn": "#3F6B52",
      "--dump-ink": "#FFFFFF",
      "--danger": "#D13B3B",
      "--c-green": "#4C9A6A", "--c-yellow": "#D9A21B", "--c-blue": "#3F73C8", "--c-orange": "#D98A2B",   // colour-coding for the Inbox toggles
      "--font-display": "'Plus Jakarta Sans','Avenir Next','Segoe UI',system-ui,sans-serif",
      "--font-body": "'Plus Jakarta Sans',Inter,-apple-system,'Segoe UI',system-ui,sans-serif",
      "--display-weight": "800",
      "--display-transform": "none",
      "--display-spacing": "-0.025em",
      "--radius-lg": "22px",
      "--radius-md": "14px",
      "--radius-pill": "999px",
      "--shadow": "0 1px 2px rgba(20,30,25,.05), 0 6px 18px rgba(20,30,25,.06)",
      "--nav-bg": "rgba(255,255,255,.96)",
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
// One automatic snapshot per day (taken the first time the app opens that day), keeping the last 7
async function snapshotOncePerDay(s) {
  try {
    const key = SNAP_PREFIX + new Date().toLocaleDateString("en-CA");
    try { await window.storage.get(key); return; } catch { /* none yet today */ }
    await window.storage.set(key, JSON.stringify(s));
    const l = await window.storage.list(SNAP_PREFIX);
    const keys = ((l && l.keys) || []).sort();
    while (keys.length > 7) await window.storage.delete(keys.shift());
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

const CSS = FONT_IMPORT + `
.cd-outer{position:fixed;inset:0;display:flex;justify-content:center;align-items:stretch;background:#CFC8BC;overflow:hidden;overscroll-behavior:none}
.cd, .cd *{box-sizing:border-box}
.cd{position:relative;width:100%;max-width:430px;height:100%;display:flex;flex-direction:column;overflow:hidden;
  background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:15px;line-height:1.4;-webkit-font-smoothing:antialiased}
@media(min-width:520px){.cd-outer{align-items:center;padding:20px 0}.cd{height:min(880px,calc(100vh - 40px));border-radius:38px;box-shadow:0 30px 80px rgba(0,0,0,.35)}}
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
.cd-h1{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:34px;line-height:1.08;margin:4px 0 4px}
.cd-sub{color:var(--muted);font-size:14.5px;margin:0}
.cd-h2{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);letter-spacing:var(--display-spacing);font-size:21px;margin:0}
.cd-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.cd-iconbtn{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:var(--accent);flex:none}
.cd-plus{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink);flex:none;box-shadow:var(--shadow)}

.cd-panel{background:var(--panel);border-radius:var(--radius-lg);padding:16px;margin-top:18px}
.cd-panel h3{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:19px;margin:0}
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
.cd-evebar{padding:8px 20px 12px;border-top:1px solid var(--line);background:var(--bar-bg,transparent)}
.cd-evebtn{display:flex;align-items:center;gap:12px;width:100%;padding:11px 16px 11px 12px;border-radius:var(--radius-lg);background:var(--eve-bg,var(--btn-bg));color:var(--eve-ink,var(--btn-ink));text-align:left;box-shadow:var(--shadow)}
.cd-evebtn .ic{width:38px;height:38px;border-radius:50%;background:color-mix(in srgb,currentColor 16%,transparent);display:grid;place-items:center;flex:none}
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
@media(max-height:720px){.cd-h1{font-size:28px}.cd-stack2{margin-top:12px}}
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

/* page header: a fixed bar above the scrolling area (like the nav below it), the same size on every page */
.cd-headcard{position:relative;flex:none;z-index:4;display:flex;flex-direction:column;justify-content:center;min-height:104px;padding:calc(18px + env(safe-area-inset-top)) 20px 12px;margin:var(--head-margin,0);border-radius:var(--head-radius,0);
  background:var(--bar-stripe,none) no-repeat left bottom / 100% 4px,var(--eve-bg,var(--btn-bg));color:var(--eve-ink,var(--btn-ink));box-shadow:var(--shadow)}
.cd-headcard .cd-h1{margin:2px 0 3px}
.cd-headcard .cd-date,.cd-headcard .cd-sub{color:inherit;opacity:.85}
.cd-headact{position:absolute;top:calc(18px + env(safe-area-inset-top));right:16px;display:flex;align-items:center;gap:8px}
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
@media(max-height:720px){.cd-headcard{min-height:96px;padding:calc(14px + env(safe-area-inset-top)) 20px 10px}}
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
.cd-boot{width:10px;height:10px;border-radius:50%;background:#B9B5AC;animation:cd-pulse 1s ease-in-out infinite}
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
.cd-quad .cd-prio b{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-transform);font-size:20px;line-height:1.1}
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
html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none}
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
  { v: "quick", label: "Quick", hint: "<15 min", tone: "--q1", color: "var(--c-orange, #E07B24)" },
  { v: "deep", label: "Deep", hint: ">15 min", tone: "--q4", color: "var(--c-green, #3E9B5F)" },
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

function ItemRow({ item, ctx, trailing, hideDue = false, focusLabel = false, rowProps }) {
  const done = item.status === "done";
  const showDue = item.due && !hideDue && !done;   // finished tasks don't show a due date
  const di = item.due ? (done ? { text: fmtShort(item.due), cls: "" } : dueInfo(item.due)) : null;
  const isFocus = focusLabel && item.effort === "deep" && item.impact === "high";
  const showImpact = !!item.impact && !focusLabel && !done;
  const urgent = (item.urgency === "now" || !!item.urgent) && !done;
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
    <PageHead ctx={ctx} title="Clear the deck." sub="Capture. Choose. Do what matters." />
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
  const [draft, setDraft] = useState({ category: null, effort: null, impact: null, urgency: null });
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | drag | exit
  const [rise, setRise] = useState(false);     // the next card starts in the card-behind position, then rises to the top
  const [nudge, setNudge] = useState(false);     // shakes the Prioritize button when it is tapped too early
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
  const complete = draft.category && draft.effort && draft.impact;

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
    if (!complete) { ctx.toast("Pick a category, effort, and impact first"); return; }
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
          <CategoryPicker pill label={<FolderIcon />} categories={ctx.categories} value={draft.category}
            dot={draft.category ? ctx.catStyle(draft.category)[1] : null}
            onChange={(c) => setField("category", c)} onAdd={ctx.addCategory} />
        </div>
        <div className="cd-quad">
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
            <div className="cd-trow"><span className="lbl">Effort<small>{(EFFORT_OPTS.find((o) => o.v === draft.effort) || {}).hint || "<15 or >15 min"}</small></span>
              <MiniToggle label="Effort" value={draft.effort} onChange={(v) => setField("effort", v)} options={EFFORT_OPTS} /></div>
            <div className="cd-trow"><span className="lbl">Impact<small>{(IMPACT_OPTS.find((o) => o.v === draft.impact) || {}).hint || "low or high"}</small></span>
              <MiniToggle label="Impact" value={draft.impact} onChange={(v) => setField("impact", v)} options={IMPACT_OPTS} /></div>
            <div className="cd-trow"><span className="lbl">Urgency<small>{(URGENCY_OPTS.find((o) => o.v === draft.urgency) || {}).hint || "optional"}</small></span>
              <MiniToggle label="Urgency" value={draft.urgency} onChange={(v) => setField("urgency", v)} options={URGENCY_OPTS} clearable emptyLabel="None" /></div>
          </div>
          {/* right: Someday above, Watch below */}
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
    <>
      <PageHead ctx={ctx} title="Future" sub="Everything not for today." />
    <div className="cd-scroll">

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

      {mode === "someday" && (
        <>
          {somedayItems.length > 0 && (
            <div className="cd-group">
              <div className="cd-ghead" style={{ background: "var(--q2-bg)" }}>
                <Sparkles size={22} style={{ color: "var(--q2)", flex: "none" }} />
                <div><div className="t">Someday</div><div className="s">Ideas parked for later.</div></div>
                <span className="cd-gcount">{somedayItems.length}</span>
              </div>
              <div className="cd-gbody">
                {somedayItems.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} trailing={toToday(i)} />)}
              </div>
            </div>
          )}
          {somedayItems.length === 0 && <div className="cd-empty"><b>Someday is empty.</b>Park ideas here from your Inbox, or from an item’s menu.</div>}
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
    <>
      <PageHead ctx={ctx} title="Watching" sub="Swipe left for Inbox · hold to reorder" />
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
  const ei = rows.findIndex((r) => r.label === "Edit details");
  if (ei > 0) rows.unshift(...rows.splice(ei, 1));   // Edit details goes to the top
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
    doneOn: item?.status === "done" && item?.doneAt ? iso(new Date(item.doneAt)) : "",   // date completed (finished tasks only)
  }));
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const save = () => {
    const title = d.title.trim();
    if (!title) return;
    const payload = { ...d, title, due: d.status === "watching" ? null : (d.due || null),
      someday: d.status === "future" || d.status === "done" ? !!item?.someday : false };
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
  const needsInbox = d.status === "future" && (!d.category || !d.effort || !d.impact);
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
      <div className="cd-fl" style={{ marginTop: 18 }}>Automatic backups (one a day, last 7 days)</div>
      <div className="cd-catlist">
        {snaps === null && <div className="cd-sub">Looking…</div>}
        {snaps && snaps.length === 0 && <div className="cd-sub">None yet. One is saved the first time you open the app each day.</div>}
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

function CatManager({ ctx, items, close }) {
  const [name, setName] = useState("");
  const count = (c) => items.filter((i) => i.category === c).length;
  const add = () => { const n = name.trim(); if (n) { ctx.addCategory(n); setName(""); } };
  return (
    <Sheet title="Categories" onClose={close}>
      <div className="cd-sub" style={{ marginBottom: 6 }}>Deleting a category keeps its items. They just lose the label.</div>
      <div className="cd-catlist">
        {ctx.categories.length === 0 && <div className="cd-sub" style={{ padding: "10px 0" }}>No categories yet.</div>}
        {ctx.categories.map((c) => {
          const n = count(c);
          return (
            <div className="cd-catitem" key={c}>
              <CatText name={c} catStyle={ctx.catStyle} />
              <span className="n">{n} {n === 1 ? "item" : "items"}</span>
              <button className="cd-x" onClick={() => ctx.removeCategory(c)} aria-label={`Delete ${c}`}><Trash2 size={16} /></button>
            </div>
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
      <button className="cd-ghost" onClick={() => ctx.setSheet({ type: "cats" })}><FolderIcon size={18} /> Manage categories</button>
      <button className="cd-ghost" onClick={() => ctx.setSheet({ type: "backup" })}><Download size={18} /> Back up &amp; restore</button>
      <div className="cd-setrow">
        <button className="cd-ghost" onClick={() => ctx.exportData()}><Download size={18} /> Export</button>
        <button className="cd-ghost" style={{ color: "var(--danger)" }} onClick={() => { ctx.resetData("empty"); close(); }}><Trash2 size={18} /> Clear all</button>
      </div>
      <div className="cd-version">Clear the deck · Version {APP_VERSION}</div>
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
  const stateRef = useRef(null); stateRef.current = state;
  const lockedRef = useRef(false);            // true when saved data exists but couldn't be read: never save over it
  const [burst, setBurst] = useState(0);        // confetti
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
    const f = () => {
      const kb = vv.scale < 1.05 && window.innerHeight - vv.height > 120;
      setVvh(kb ? { h: vv.height, top: vv.offsetTop } : null);
      if (kb && window.scrollY) window.scrollTo(0, 0);
    };
    f();
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); };
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
        : { items: makeSeed(), categories: DEFAULT_CATS, themeId: DEFAULT_THEME });
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

  // Keep the phone's status-bar / browser tint in step with the theme. Without this, iOS can hold on to the previous
  // theme's colour after you switch (for example Vibrant's blue showing above Botanical's green).
  useEffect(() => {
    if (!state) return;
    const t = THEMES[state.themeId] || THEMES[DEFAULT_THEME];
    const color = t.vars["--eve-bg"] || t.vars["--btn-bg"];   // the colour of the top bar
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "theme-color"); document.head.appendChild(m); }
    m.setAttribute("content", color);
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
  }, [state && state.themeId]);

  // A gentle nudge to back up: at most once a day, only if there's something worth saving and no backup for a week
  useEffect(() => {
    if (!loaded || lockedRef.current) return;
    const s = stateRef.current;
    const stale = !s.lastBackupAt || Date.now() - s.lastBackupAt > 7 * 864e5;
    if (!stale || s.items.length < 5 || s.backupNudgeOn === iso()) return;
    const t = setTimeout(() => {
      setState((x) => ({ ...x, backupNudgeOn: iso() }));
      setToastMsg({ m: s.lastBackupAt ? "It’s been over a week since your last backup." : "You haven’t backed up your tasks yet.",
        a: { label: "Back up", run: () => setSheet({ type: "backup" }) } });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 9000);
    }, 2500);
    return () => clearTimeout(t);
  }, [loaded]);

  // While the saved data loads, show a plain neutral screen (not a theme), so no theme flashes before yours appears
  if (!state) {
    return (
      <div className="cd-outer" style={{ background: "#ECEAE6" }}>
        <style>{CSS}</style>
        <div className="cd" style={{ background: "#F6F5F2", display: "grid", placeItems: "center" }}>
          <div className="cd-boot" role="status" aria-label="Loading" />
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
    unsorted: items.filter(isUnlabeled).length,
    goTab: (k) => { setTab(k); setJustDone(new Set()); },
    cleaned: state.cleanedOn === iso(),
    markCleaned: () => { celebrate(); update(() => ({ cleanedOn: iso() })); },
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
      const prev = { items, categories };
      update((s) => ({ categories: s.categories.filter((c) => c !== name), items: s.items.map((i) => (i.category === name ? normalizeItem({ ...i, category: null }) : i)) }));
      toast(`Deleted “${name}”`, { label: "Undo", run: () => update(() => prev) });
    },
    addCategory: (name) => update((s) => (s.categories.some((c) => c.toLowerCase() === name.toLowerCase()) ? {} : { categories: [...s.categories, name] })),
    setTheme: (id) => update(() => ({ themeId: id })),
    // A backup is the whole app state as a JSON file. It uses the same save/share path as the Excel export.
    backupData: async () => {
      const payload = { app: "clear-the-deck", version: APP_VERSION, savedAt: new Date().toISOString(),
        state: { items, categories, themeId: state.themeId, cleanedOn: state.cleanedOn } };
      try {
        await saveFile(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `clear-the-deck-backup-${new Date().toLocaleDateString("en-CA")}.json`);
        update(() => ({ lastBackupAt: Date.now() }));
        toast("Backup saved");
      } catch (e) { if (!e || e.name !== "AbortError") toast("Couldn’t save the backup"); }
    },
    restoreState: (st) => {
      if (!st || !Array.isArray(st.items) || !Array.isArray(st.categories)) { toast("That isn’t a Clear the Deck backup"); return false; }
      const prev = { items, categories, themeId: state.themeId, cleanedOn: state.cleanedOn };
      lockedRef.current = false;   // restoring is an explicit choice, so saving is safe again
      update(() => ({ items: st.items.map(normalizeItem), categories: st.categories,
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

  const View = { today: TodayView, inbox: InboxView, future: FutureView, watching: WatchingView, dashboard: DashboardView, completed: CompletedView }[tab];
  const activeTab = tab === "completed" ? "dashboard" : tab;   // Completed is reached from the Dashboard

  return (
    <div className="cd-outer" style={{ background: theme.outer, ...(vvh ? { bottom: "auto", top: vvh.top, height: vvh.h } : null) }}>
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
        {sheet?.type === "cats" && <CatManager ctx={ctx} items={items} close={close} />}
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
