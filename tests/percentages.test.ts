import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rebalanceAfterEdit, addRowKeepingTotal } from "../src/utils/percentages.js";
import { buildScheduleModal } from "../src/slack/ui/scheduleModal.js";

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

describe("rebalanceAfterEdit", () => {
  test("30/40/30 with first set to 40 gives 40/30/30", () => {
    assert.deepEqual(rebalanceAfterEdit([30, 40, 30], 0, 40), [40, 30, 30]);
  });
  test("splits the remainder evenly, extra unit to earliest rows", () => {
    assert.deepEqual(rebalanceAfterEdit([15, 60, 25], 1, 50), [25, 50, 25]);
    assert.deepEqual(rebalanceAfterEdit([34, 33, 33], 2, 30), [35, 35, 30]);
  });
  test("clamps so other rows keep at least 1%", () => {
    assert.deepEqual(rebalanceAfterEdit([15, 60, 25], 0, 100), [98, 1, 1]);
  });
  test("single row is always 100", () => {
    assert.deepEqual(rebalanceAfterEdit([40], 0, 10), [100]);
  });
  test("rejects unusable input", () => {
    assert.equal(rebalanceAfterEdit([15, 60, 25], 0, NaN), null);
    assert.equal(rebalanceAfterEdit([15, 60, 25], 0, 0), null);
    assert.equal(rebalanceAfterEdit([15, 60, 25], 0, 12.5), null);
    assert.equal(rebalanceAfterEdit([15, 60, 25], 7, 20), null);
  });
  test("always totals 100", () => {
    for (let n = 1; n <= 10; n++) {
      const vals = Array.from({ length: n }, () => Math.floor(100 / n));
      for (const edit of [1, 7, 33, 50, 99, 100]) {
        assert.equal(sum(rebalanceAfterEdit(vals, 0, edit)!), 100);
      }
    }
  });
});

describe("addRowKeepingTotal", () => {
  test("totals 100 with every row >= 1 from 1 to 9 existing rows", () => {
    for (let n = 1; n <= 9; n++) {
      const base = rebalanceAfterEdit(Array.from({ length: n }, () => 1), 0, 100 - (n - 1))!;
      const next = addRowKeepingTotal(base);
      assert.equal(next.length, n + 1);
      assert.equal(sum(next), 100);
      assert.ok(next.every((v) => v >= 1), JSON.stringify(next));
    }
  });
  test("shrinks existing rows proportionally", () => {
    assert.deepEqual(addRowKeepingTotal([15, 60, 25]), [11, 45, 19, 25]);
  });
});

describe("schedule modal % fields", () => {
  const pctBlocks = (view: any) => view.blocks.filter((b: any) => b.element?.action_id?.startsWith("subtopic_pct_input_"));
  test("default 3 rows are real values summing to 100 and dispatch on Enter", () => {
    const blocks = pctBlocks(buildScheduleModal({ subtopicCount: 3 }));
    assert.deepEqual(blocks.map((b: any) => b.element.initial_value), ["15", "60", "25"]);
    assert.ok(blocks.every((b: any) => b.dispatch_action === true));
    assert.ok(blocks.every((b: any) => b.element.dispatch_action_config.trigger_actions_on[0] === "on_enter_pressed"));
  });
});
