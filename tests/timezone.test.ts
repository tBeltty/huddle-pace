import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PT_ZONE,
  formatEventTime,
  nextQuarterHour,
  normalizeTimezoneSetting,
  resolveSchedulingZone,
  zonedParts,
  zonedWallTimeToUtc,
} from "../src/utils/timezone.js";

describe("timezone helpers", () => {
  test("PT wall time converts to UTC across the daylight saving change", () => {
    // PDT (UTC-7) before Nov 1, 2026; PST (UTC-8) after.
    assert.strictEqual(zonedWallTimeToUtc("2026-10-07", "10:00", PT_ZONE).toISOString(), "2026-10-07T17:00:00.000Z");
    assert.strictEqual(zonedWallTimeToUtc("2026-11-02", "10:00", PT_ZONE).toISOString(), "2026-11-02T18:00:00.000Z");
  });

  test("spring-forward gap resolves to the instant just after the gap", () => {
    // 02:30 on Mar 8, 2026 does not exist in Los Angeles.
    const gap = zonedWallTimeToUtc("2026-03-08", "02:30", PT_ZONE);
    assert.strictEqual(zonedParts(gap, PT_ZONE).time, "03:30");
  });

  test("zones without daylight saving keep a fixed offset", () => {
    assert.strictEqual(zonedWallTimeToUtc("2026-10-07", "10:00", "America/Bogota").toISOString(), "2026-10-07T15:00:00.000Z");
  });

  test("formatEventTime shows the time with its zone", () => {
    const at = zonedWallTimeToUtc("2026-10-07", "10:00", PT_ZONE);
    assert.strictEqual(formatEventTime(at, PT_ZONE), "10:00 AM PT");
    assert.match(formatEventTime(at, "America/Bogota"), /^12:00 PM /);
  });

  test("setting resolution: PT default, user zone, custom zone", () => {
    assert.strictEqual(resolveSchedulingZone(undefined), PT_ZONE);
    assert.strictEqual(resolveSchedulingZone("PT", "Asia/Tokyo"), PT_ZONE);
    assert.strictEqual(resolveSchedulingZone("USER", "Asia/Tokyo"), "Asia/Tokyo");
    assert.strictEqual(resolveSchedulingZone("USER", null), PT_ZONE);
    assert.strictEqual(resolveSchedulingZone("Europe/Madrid", "Asia/Tokyo"), "Europe/Madrid");
  });

  test("invalid stored zone falls back to PT", () => {
    assert.strictEqual(normalizeTimezoneSetting("Mars/Olympus"), "PT");
  });

  test("nextQuarterHour rounds up in the target zone", () => {
    const now = new Date("2026-10-07T17:07:00.000Z"); // 10:07 PDT
    assert.deepStrictEqual(nextQuarterHour(now, PT_ZONE), { date: "2026-10-07", time: "10:15" });
  });
});
