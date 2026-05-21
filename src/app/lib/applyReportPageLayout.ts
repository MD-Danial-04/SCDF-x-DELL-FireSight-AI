/**
 * Applies page breaks to the fire investigation report body.
 *
 * Layout:
 *   Page 1 — cover/title + sections 1, 2, 3
 *   Page 2 — sections 4, 5 (through b Area/Point of Fire Origin)
 *   Page 3 — section 5 continuation (c, d, e)
 *   Page 4 — sections 6, 7, 8
 *   Page 5 — intentionally blank
 *   Page 6 — report sign-offs
 *   Annexes  — appended on separate page(s) by appendAnnexImagesToDocx
 */

const PAGE_BREAK_PARA = "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>";

const TABLE_BREAKS = ["c Burn Pattern/s", "6 INFORMATION ON INJURY"];
const TABLE_SPLIT_ANCHOR = "4 INSURANCE COVERAGE:";
const SIGN_OFF_ANCHOR = "{preparedBy}";

function isLayoutApplied(xml: string): boolean {
  const anchorIdx = xml.indexOf(TABLE_SPLIT_ANCHOR);
  if (anchorIdx === -1) return false;
  const before = xml.slice(0, anchorIdx);
  const lastBreak = before.lastIndexOf(PAGE_BREAK_PARA);
  if (lastBreak === -1) return false;
  const between = xml.slice(lastBreak + PAGE_BREAK_PARA.length, anchorIdx);
  return between.includes("<w:tbl");
}

function removeAllPageBreaks(xml: string): string {
  let out = xml.replace(
    /<w:p[^>]*>\s*<w:r(?:\s[^>]*)?>\s*<w:br w:type="page"\/>\s*<\/w:r>\s*<\/w:p>/g,
    ""
  );
  out = out.replace(/<w:r(?:\s[^>]*)?>\s*<w:br w:type="page"\/>\s*<\/w:r>/g, "");
  out = out.replace(/<w:br w:type="page"\/>/g, "");
  out = out.replace(/<w:pageBreakBefore(?:\s[^>]*)?\/>/g, "");
  return out;
}

function isTableOpenTag(xml: string, idx: number): boolean {
  const rest = xml.slice(idx, idx + 10);
  return rest.startsWith("<w:tbl>") || rest.startsWith("<w:tbl ");
}

function findLastTableStartBefore(xml: string, idx: number): number {
  const re = /<w:tbl(?:>| )/g;
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    if (match.index >= idx) break;
    last = match.index;
  }
  return last;
}

function findTableEnd(xml: string, tblStart: number): number {
  let pos = tblStart + 6;
  let depth = 1;
  while (depth > 0 && pos < xml.length) {
    const nextOpen = xml.indexOf("<w:tbl", pos);
    const nextClose = xml.indexOf("</w:tbl>", pos);
    if (nextClose === -1) return -1;

    if (nextOpen !== -1 && nextOpen < nextClose && isTableOpenTag(xml, nextOpen)) {
      depth += 1;
      pos = nextOpen + 6;
      continue;
    }

    depth -= 1;
    if (depth === 0) return nextClose;
    pos = nextClose + 8;
  }
  return -1;
}

function extractTableProperties(xml: string, tblStart: number): string {
  const slice = xml.slice(tblStart, tblStart + 4000);
  const match = slice.match(/<w:tblPr[\s\S]*?<\/w:tblPr>/);
  return match ? match[0] : "<w:tblPr/>";
}

function findRowStartBefore(xml: string, idx: number): number {
  const re = /<w:tr(?:>| )/g;
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    if (match.index >= idx) break;
    last = match.index;
  }
  return last;
}

function splitTableBeforeAnchor(xml: string, anchorText: string): string {
  const anchorIdx = xml.indexOf(anchorText);
  if (anchorIdx === -1) return xml;

  const trStart = findRowStartBefore(xml, anchorIdx);
  const tblStart = findLastTableStartBefore(xml, anchorIdx);
  if (trStart === -1 || tblStart === -1 || trStart < tblStart) return xml;

  const tblEnd = findTableEnd(xml, tblStart);
  if (tblEnd === -1) return xml;

  const tblPr = extractTableProperties(xml, tblStart);
  const beforeTable = xml.slice(0, tblStart);
  const firstTableBody = xml.slice(tblStart, trStart);
  const secondTableRows = xml.slice(trStart, tblEnd);
  const afterTable = xml.slice(tblEnd + 8);

  return (
    beforeTable +
    firstTableBody +
    "</w:tbl>" +
    PAGE_BREAK_PARA +
    "<w:tbl>" +
    tblPr +
    secondTableRows +
    "</w:tbl>" +
    afterTable
  );
}

function insertPageBreakBeforeTableContaining(xml: string, anchorText: string): string {
  const idx = xml.indexOf(anchorText);
  if (idx === -1) return xml;

  const tblStart = findLastTableStartBefore(xml, idx);
  if (tblStart === -1) return xml;

  const before = xml.slice(Math.max(0, tblStart - 120), tblStart);
  if (before.includes('w:type="page"')) return xml;

  return xml.slice(0, tblStart) + PAGE_BREAK_PARA + xml.slice(tblStart);
}

function isEmptyParagraph(segment: string): boolean {
  return (
    /^<w:p[\s\S]*<\/w:p>\s*$/.test(segment) &&
    !segment.includes("<w:t>") &&
    !segment.includes("<w:drawing")
  );
}

function trimEmptyParagraphsBeforeIndex(xml: string, idx: number): string {
  const pStart = xml.lastIndexOf("<w:p", idx);
  if (pStart === -1) return xml;

  let trimEnd = pStart;
  while (trimEnd > 0) {
    const prevStart = xml.lastIndexOf("<w:p", trimEnd - 1);
    if (prevStart === -1) break;
    const segment = xml.slice(prevStart, trimEnd);
    if (!isEmptyParagraph(segment)) break;
    trimEnd = prevStart;
  }

  if (trimEnd === pStart) return xml;
  return xml.slice(0, trimEnd) + xml.slice(pStart);
}

function insertSignOffPageBreaks(xml: string): string {
  const idx = xml.indexOf(SIGN_OFF_ANCHOR);
  if (idx === -1) return xml;

  let out = trimEmptyParagraphsBeforeIndex(xml, idx);
  const anchorIdx = out.indexOf(SIGN_OFF_ANCHOR);
  const pStart = out.lastIndexOf("<w:p", anchorIdx);
  if (pStart === -1) return out;

  return out.slice(0, pStart) + PAGE_BREAK_PARA + PAGE_BREAK_PARA + out.slice(pStart);
}

export function applyReportPageLayout(xml: string): string {
  if (isLayoutApplied(xml)) return xml;

  let out = removeAllPageBreaks(xml);
  out = splitTableBeforeAnchor(out, TABLE_SPLIT_ANCHOR);

  for (const anchor of TABLE_BREAKS) {
    out = insertPageBreakBeforeTableContaining(out, anchor);
  }

  out = insertSignOffPageBreaks(out);
  return out;
}
