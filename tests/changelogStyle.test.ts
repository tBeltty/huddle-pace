import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// CHANGELOG.md sections are published verbatim as GitHub release notes, so they are about the
// HuddlePace Slack app only and have to pass docs/guidelines/EDITORIAL_STANDARDS.md before the
// commit and the tag. Website, SEO, docs, tests and tooling changes are not release material;
// they go in docs/PRODUCT_CAPABILITIES_LOG.md. Entries up to 1.4.0 predate this gate.

const BANNED = [
  "delve", "foster", "leverage", "utilize", "facilitate", "empower", "streamline", "robust",
  "cutting-edge", "paradigm shift", "game changer", "tapestry", "realm", "beacon", "multifaceted",
  "meticulous", "paramount", "transformative", "elevate", "embark", "supercharge", "harness",
  "ever-evolving", "world-class", "revolutionary", "best-in-class", "synergize", "holistic",
  "seamless", "trailblazing",
];
const MAX_BULLET_CHARS = 320;

// Website and repo terms that mark an entry as "not the product".
const NOT_PRODUCT =
  /\b(sitemap|robots\.txt|SEO|landing|Lighthouse|hreflang|canonical|structured data|favicon|WebP|fonts?|CSS|stylesheet|Cloudflare|huddlepace\.com|privacy policy|footer|home ?page|404|changelog|release notes?|tests?|pnpm)\b|\/es\/|\b(AGENTS|BRAND)\b|\.md\b/i;

export function violations(body: string): string[] {
  const found: string[] = [];
  for (const word of BANNED) {
    if (new RegExp(`\\b${word}\\b`, "i").test(body)) found.push(`banned word "${word}"`);
  }
  if (/[—–]/.test(body)) found.push("em or en dash");
  if (/\*\*[^*\n]+\*\*\s*:/.test(body)) found.push("bold-label colon opener");
  if (/\bnot (just|only)\b/i.test(body) || /\bnot\b[^.\n]{0,40}\bbut\b/i.test(body)) found.push("binary contrast");
  for (const line of body.split("\n").filter((l) => l.startsWith("- "))) {
    const prose = line.replace(/`[^`]*`/g, "").replace(/\d+:\d+/g, "");
    if (/:\s|:$/.test(prose)) found.push(`colon reveal: ${line.slice(0, 50)}`);
    if (NOT_PRODUCT.test(line)) found.push(`not the Slack product: ${line.slice(0, 50)}`);
    if (line.length > MAX_BULLET_CHARS) found.push(`bullet over ${MAX_BULLET_CHARS} chars: ${line.slice(0, 40)}`);
  }
  return found;
}

describe("the release-note rules themselves", () => {
  test("accept a short product entry", () => {
    const entry = [
      "### Added",
      "- Speakers can edit a scheduled meetup from App Home until it starts.",
      "",
      "### Fixed",
      "- A 25-minute meetup created with `/pace` keeps its duration when reopened.",
    ].join("\n");
    assert.deepEqual(violations(entry), []);
  });

  test("reject website, SEO and housekeeping entries, including the ones that slipped through before", () => {
    const bad = [
      "- Unknown URLs return a 404 page in English or Spanish, marked `noindex` so search engines drop them.",
      "- Every sitemap URL has a `lastmod` date that changes only when that page's content changes.",
      "- Fonts load from huddlepace.com instead of Google Fonts.",
      "- A test fails when a changelog entry uses banned words.",
      "- Rewrote the release notes for 1.5.0 to 1.10.0 in plain language.",
    ];
    for (const line of bad) {
      assert.ok(violations(line).some((v) => v.startsWith("not the Slack product")), line);
    }
  });

  test("reject colon reveals, bold labels, dashes, banned words and binary contrasts", () => {
    assert.ok(violations("- **404 Page**: Unknown paths answer with a page.").length > 0);
    assert.ok(violations("- Social tags are cleaner: unused tags removed.").length > 0);
    assert.ok(violations("- A fast — and robust — timer.").length > 0);
    assert.ok(violations("- It is not a timer but a copilot.").length > 0);
    assert.ok(violations("- Ratios such as 4.5:1 are fine and so is `code: here`.").length === 0);
  });
});

function sections(): Array<{ version: string; body: string }> {
  const changelog = fs.readFileSync(path.resolve(process.cwd(), "CHANGELOG.md"), "utf-8");
  const out: Array<{ version: string; body: string }> = [];
  const re = /^## \[(Unreleased|\d+\.\d+\.\d+)\][^\n]*\n([\s\S]*?)(?=^## \[|^\[Unreleased\]:)/gm;
  for (const m of changelog.matchAll(re)) out.push({ version: m[1], body: m[2] });
  return out;
}

function newerThan(version: string, last: [number, number, number]): boolean {
  if (version === "Unreleased") return true;
  const v = version.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (v[i] !== last[i]) return v[i] > last[i];
  }
  return false;
}

describe("CHANGELOG.md", () => {
  const all = sections();

  test("is found and has an Unreleased block", () => {
    assert.ok(all.some((s) => s.version === "Unreleased"));
    assert.ok(all.some((s) => s.version === "1.4.0"));
  });

  for (const { version, body } of all.filter((s) => newerThan(s.version, [1, 4, 0]))) {
    test(`${version} passes the release-note rules`, () => {
      assert.deepEqual(violations(body), []);
    });
  }
});
