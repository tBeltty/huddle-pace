import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// CHANGELOG.md sections are published verbatim as GitHub release notes, so they have to pass
// docs/guidelines/EDITORIAL_STANDARDS.md before the commit and the tag, not after.
// Entries before 1.5.0 predate this gate and keep their original style.
const BANNED = [
  "delve", "foster", "leverage", "utilize", "facilitate", "empower", "streamline", "robust",
  "cutting-edge", "paradigm shift", "game changer", "tapestry", "realm", "beacon", "multifaceted",
  "meticulous", "paramount", "transformative", "elevate", "embark", "supercharge", "harness",
  "ever-evolving", "world-class", "revolutionary", "best-in-class", "synergize", "holistic",
  "seamless", "trailblazing",
];
const MAX_BULLET_CHARS = 320;

const changelog = fs.readFileSync(path.resolve(process.cwd(), "CHANGELOG.md"), "utf-8");

function sections(): Array<{ version: string; body: string }> {
  const out: Array<{ version: string; body: string }> = [];
  const re = /^## \[(Unreleased|\d+\.\d+\.\d+)\][^\n]*\n([\s\S]*?)(?=^## \[|^\[Unreleased\]:)/gm;
  for (const m of changelog.matchAll(re)) out.push({ version: m[1], body: m[2] });
  return out;
}

function atLeast(version: string, min: [number, number, number]): boolean {
  if (version === "Unreleased") return true;
  const v = version.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (v[i] !== min[i]) return v[i] > min[i];
  }
  return true;
}

const gated = sections().filter((s) => atLeast(s.version, [1, 5, 0]));

describe("CHANGELOG release notes follow the editorial standards", () => {
  test("the gate covers the entries it is meant to cover", () => {
    assert.ok(gated.length >= 10, `only ${gated.length} sections found`);
    assert.ok(gated.some((s) => s.version === "1.5.0"));
  });

  for (const { version, body } of gated) {
    test(`${version}: banned lexicon, colon reveals, dashes and binary contrasts`, () => {
      for (const word of BANNED) {
        assert.doesNotMatch(body, new RegExp(`\\b${word}\\b`, "i"), `"${word}" is on the banned list`);
      }
      assert.doesNotMatch(body, /[—–]/, "em and en dashes are not allowed");
      assert.doesNotMatch(body, /\*\*[^*\n]+\*\*\s*:/, "bold-label colon openers are colon reveals");
      assert.doesNotMatch(body, /\bnot (just|only)\b/i, "binary contrast");
      assert.doesNotMatch(body, /\bnot\b[^.\n]{0,40}\bbut\b/i, "binary contrast");
    });

    test(`${version}: each bullet stays short enough to read as a release note`, () => {
      for (const line of body.split("\n").filter((l) => l.startsWith("- "))) {
        assert.ok(line.length <= MAX_BULLET_CHARS, `${line.length} chars: ${line.slice(0, 70)}...`);
      }
    });
  }
});
