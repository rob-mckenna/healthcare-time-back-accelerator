#!/usr/bin/env node
/**
 * Architecture-diagram validation for the Second Shift accelerator baseline.
 *
 * The editable Excalidraw source and the committed SVG must communicate the
 * same architecture, the SVG must be self-contained and accessible, and the
 * Option A scope invariants (exactly one Copilot Studio workflow and exactly
 * one Foundry Shift Closeout Agent) must hold in both artifacts. This gate
 * makes those properties durable instead of relying on manual review.
 *
 * Checks, in order:
 *   1. both diagram artifacts exist and are non-trivial
 *   2. every text label in the Excalidraw source also appears in the SVG
 *      (source and SVG communicate the same architecture)
 *   3. the SVG is self-contained (no external resources, scripts, or fonts)
 *   4. the SVG is accessible (role, aria-labelledby, non-trivial title + desc)
 *   5. Option A scope invariants: one Copilot Studio workflow, one Foundry
 *      Shift Closeout Agent, in both artifacts
 *   6. the README embeds the SVG with non-trivial alt text
 *
 * Zero dependencies. Exits non-zero on any failure.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXCALIDRAW = 'docs/architecture/diagrams/shift-closeout-architecture.excalidraw';
const SVG = 'docs/architecture/diagrams/shift-closeout-architecture.svg';
const README = 'README.md';

const results = [];
let failed = 0;

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    failed += 1;
    results.push({ name, ok: false, detail: error.message });
  }
}

function read(relPath) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) throw new Error(`missing: ${relPath}`);
  return readFileSync(full, 'utf8');
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/* Build a single whitespace-collapsed corpus of every rendered string in the
 * SVG: <title>, <desc>, <text>, and <tspan> content, entities decoded. */
function svgTextCorpus(svg) {
  const stripped = svg.replace(/<[^>]+>/g, ' ');
  return collapse(decodeEntities(stripped));
}

/* 1. artifacts exist -------------------------------------------------------- */

let excalidraw;
let svg;
let readme;

check('diagram artifacts exist and are non-trivial', () => {
  const sizes = {};
  for (const relPath of [EXCALIDRAW, SVG]) {
    const full = join(ROOT, relPath);
    if (!existsSync(full)) throw new Error(`missing: ${relPath}`);
    const size = statSync(full).size;
    if (size < 1000) throw new Error(`${relPath} present but only ${size} bytes`);
    sizes[relPath] = size;
  }
  excalidraw = JSON.parse(read(EXCALIDRAW));
  svg = read(SVG);
  readme = read(README);
  if (excalidraw.type !== 'excalidraw' || !Array.isArray(excalidraw.elements)) {
    throw new Error('Excalidraw source is not a valid excalidraw document');
  }
  return `excalidraw ${sizes[EXCALIDRAW]} bytes, svg ${sizes[SVG]} bytes`;
});

if (failed > 0) {
  report();
}

/* 2. source <-> SVG label parity ------------------------------------------- */

check('every Excalidraw label appears in the SVG', () => {
  const corpus = svgTextCorpus(svg);
  const missing = [];
  let checked = 0;
  for (const element of excalidraw.elements) {
    if (element.type !== 'text' || typeof element.text !== 'string') continue;
    for (const rawLine of element.text.split('\n')) {
      const line = collapse(rawLine);
      if (!line) continue;
      checked += 1;
      if (!corpus.includes(line)) missing.push(line);
    }
  }
  if (missing.length) {
    throw new Error(
      `${missing.length} source label(s) not found in the SVG:\n      ${missing.join('\n      ')}`
    );
  }
  return `${checked} source label line(s) all present in the SVG`;
});

/* 3. self-containment ------------------------------------------------------- */

check('SVG is self-contained (no external resources)', () => {
  // XML namespace declarations (xmlns="http://www.w3.org/2000/svg") are
  // identifiers, not fetched resources; ignore them before scanning for URLs.
  const scannable = svg.replace(/\sxmlns(:[\w-]+)?="[^"]*"/g, '');
  const forbidden = [
    ['<script', 'inline or external script'],
    ['<foreignObject', 'foreignObject can embed arbitrary HTML'],
    ['<image', 'raster/image reference'],
    ['href=', 'hyperlink or external reference'],
    ['xlink:href', 'external reference'],
    ['http://', 'external URL'],
    ['https://', 'external URL'],
    ['@import', 'external stylesheet import'],
    ['url(http', 'external resource URL'],
    ['data:', 'embedded data URI'],
  ];
  const hits = forbidden.filter(([needle]) => scannable.includes(needle)).map(([needle, why]) => `${needle} (${why})`);
  if (hits.length) throw new Error(`external resource indicators found: ${hits.join(', ')}`);
  return 'no scripts, images, external fonts, or remote URLs';
});

/* 4. accessibility ---------------------------------------------------------- */

check('SVG exposes an accessible name and description', () => {
  if (!/<svg[^>]*\brole="img"/.test(svg)) throw new Error('root <svg> is missing role="img"');
  const labelledBy = svg.match(/<svg[^>]*\baria-labelledby="([^"]+)"/);
  if (!labelledBy) throw new Error('root <svg> is missing aria-labelledby');
  const titleMatch = svg.match(/<title id="([^"]+)">([^<]+)<\/title>/);
  const descMatch = svg.match(/<desc id="([^"]+)">([\s\S]*?)<\/desc>/);
  if (!titleMatch) throw new Error('SVG is missing an id-bearing <title>');
  if (!descMatch) throw new Error('SVG is missing an id-bearing <desc>');
  const referenced = labelledBy[1].split(/\s+/);
  for (const id of [titleMatch[1], descMatch[1]]) {
    if (!referenced.includes(id)) throw new Error(`aria-labelledby does not reference ${id}`);
  }
  if (collapse(titleMatch[2]).length < 10) throw new Error('<title> is too short to be meaningful');
  if (collapse(descMatch[2]).length < 200) throw new Error('<desc> is too short to describe the architecture');
  return `title + desc (${collapse(descMatch[2]).length} char description)`;
});

/* 5. Option A scope invariants --------------------------------------------- */

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

check('exactly one Copilot Studio workflow in both artifacts', () => {
  const label = 'Copilot Studio — Care-Team Experience';
  const inSource = excalidraw.elements.filter(
    (e) => e.type === 'text' && typeof e.text === 'string' && e.text.includes(label)
  ).length;
  const inSvg = countOccurrences(svgTextCorpus(svg), label);
  if (inSource !== 1) throw new Error(`Excalidraw source shows the workflow ${inSource} time(s), expected 1`);
  if (inSvg !== 1) throw new Error(`SVG shows the workflow ${inSvg} time(s), expected 1`);
  return 'one Copilot Studio care-team experience';
});

check('exactly one Foundry Shift Closeout Agent in both artifacts', () => {
  const marker = '(exactly one)';
  const inSource = excalidraw.elements.filter(
    (e) => e.type === 'text' && typeof e.text === 'string' && e.text.includes(marker)
  ).length;
  const inSvg = countOccurrences(svgTextCorpus(svg), marker);
  if (inSource !== 1) throw new Error(`Excalidraw source marks the single agent ${inSource} time(s), expected 1`);
  if (inSvg !== 1) throw new Error(`SVG marks the single agent ${inSvg} time(s), expected 1`);
  return 'one Microsoft Foundry Shift Closeout Agent';
});

/* 6. README embed ----------------------------------------------------------- */

check('README embeds the SVG with non-trivial alt text', () => {
  const embed = readme.match(/!\[([^\]]*)\]\(docs\/architecture\/diagrams\/shift-closeout-architecture\.svg\)/);
  if (!embed) throw new Error('README does not embed the diagram SVG');
  if (collapse(embed[1]).length < 80) throw new Error('README image alt text is too short to describe the diagram');
  return `alt text ${collapse(embed[1]).length} chars`;
});

/* report -------------------------------------------------------------------- */

report();

function report() {
  console.log('Diagram validation\n');
  for (const result of results) {
    console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `\n        ${result.detail}` : ''}`);
  }
  console.log(`\n${results.length - failed}/${results.length} diagram checks passed.`);
  if (failed > 0) {
    console.error(`\n${failed} diagram check(s) failed.`);
    process.exit(1);
  }
  process.exit(0);
}
