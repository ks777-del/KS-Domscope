import { parse, type HTMLElement } from "node-html-parser";

export interface ParsedHtml {
  root: HTMLElement;
  html: string;
  lineStarts: number[];
}

/** Parse raw HTML into a node-html-parser tree. Nothing is executed. */
export function parseHtml(html: string): ParsedHtml {
  const root = parse(html, {
    comment: true,
    lowerCaseTagName: true,
    blockTextElements: { script: true, style: true, noscript: true, pre: true, textarea: true },
  });
  return { root, html, lineStarts: computeLineStarts(html) };
}

export function computeLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** Convert a character offset into a 1-based line/column. */
export function offsetToPosition(lineStarts: number[], offset: number): { line: number; column: number } {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - lineStarts[lo] + 1 };
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
