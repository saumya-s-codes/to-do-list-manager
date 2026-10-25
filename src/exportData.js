// Export everything (to-dos, inbox, future, someday, watching, finished) as an Excel workbook.

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

export function buildTables(items) {
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

export async function toXlsxBlob(items) {
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
export async function downloadExport(items) {
  const stamp = new Date().toLocaleDateString("en-CA");
  await saveFile(await toXlsxBlob(items), `clear-the-deck-${stamp}.xlsx`);
  return items.length;
}
