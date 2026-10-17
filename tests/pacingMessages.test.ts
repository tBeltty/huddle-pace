import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatOneMinuteWarningText, formatModuleStartingText } from "../src/utils/pacingMessages.js";

describe("Pacing Messages Formatting", () => {
  test("formats 1-minute warning with next module", () => {
    const text = formatOneMinuteWarningText("Introduction to SkyCastle ecosystem", {
      title: "Introduction to Slack Community",
      durationMinutes: 18,
    });

    const expected =
      ':stopwatch: 1 Minute Remaining: Wrapping up "Introduction to SkyCastle ecosystem".\n\nnext up is "Introduction to Slack Community" (18m).';
    assert.strictEqual(text, expected);
  });

  test("formats 1-minute warning without next module (final module)", () => {
    const text = formatOneMinuteWarningText("Open Q&A / Wrap-up", null);

    const expected = ':stopwatch: 1 Minute Remaining: Wrapping up "Open Q&A / Wrap-up".';
    assert.strictEqual(text, expected);
  });

  test("formats module starting / transition message", () => {
    const text = formatModuleStartingText("Introduction to Slack Community", 18);

    const expected = ':compass: Starting "Introduction to Slack Community" (18m)';
    assert.strictEqual(text, expected);
  });
});
