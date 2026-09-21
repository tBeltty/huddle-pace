import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderProgressBar, formatMinutes } from "../src/utils/progressBar.js";

describe("progressBar utilities", () => {
  describe("renderProgressBar", () => {
    test("renders 0% progress correctly", () => {
      const bar = renderProgressBar(0, 10);
      assert.strictEqual(bar, "`[░░░░░░░░░░]` *0%*");
    });

    test("renders 50% progress correctly with custom length", () => {
      const bar = renderProgressBar(50, 10);
      assert.strictEqual(bar, "`[█████░░░░░]` *50%*");
    });

    test("renders 100% progress correctly", () => {
      const bar = renderProgressBar(100, 10);
      assert.strictEqual(bar, "`[██████████]` *100%*");
    });

    test("clamps negative percentage to 0%", () => {
      const bar = renderProgressBar(-25, 10);
      assert.strictEqual(bar, "`[░░░░░░░░░░]` *0%*");
    });

    test("clamps percentage over 100 to 100%", () => {
      const bar = renderProgressBar(150, 10);
      assert.strictEqual(bar, "`[██████████]` *100%*");
    });
  });

  describe("formatMinutes", () => {
    test("formats minutes under 60", () => {
      assert.strictEqual(formatMinutes(45), "45m");
      assert.strictEqual(formatMinutes(0), "0m");
    });

    test("formats exact hours", () => {
      assert.strictEqual(formatMinutes(60), "1h");
      assert.strictEqual(formatMinutes(120), "2h");
    });

    test("formats hours and remaining minutes", () => {
      assert.strictEqual(formatMinutes(75), "1h 15m");
      assert.strictEqual(formatMinutes(130), "2h 10m");
    });
  });
});
