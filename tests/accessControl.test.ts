import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isUserAuthorizedForMeetup } from "../src/slack/handlers/actionHandlers.js";
import { MAX_SUBTOPICS, buildScheduleModal } from "../src/slack/ui/scheduleModal.js";

describe("Access Control & UI Resilience", () => {
  describe("isUserAuthorizedForMeetup", () => {
    test("authorizes single designated speaker", () => {
      const authorized = isUserAuthorizedForMeetup("U123", "U123");
      assert.strictEqual(authorized, true);
    });

    test("authorizes user when in a multi-speaker comma-separated list", () => {
      const authorized = isUserAuthorizedForMeetup("U111, U222, U333", "U222");
      assert.strictEqual(authorized, true);
    });

    test("rejects unauthorized user (negative control)", () => {
      const authorized = isUserAuthorizedForMeetup("U111, U222", "U999_ATTENDEE");
      assert.strictEqual(authorized, false);
    });

    test("rejects when userId is undefined or empty (negative control)", () => {
      const authorized = isUserAuthorizedForMeetup("U111", undefined);
      assert.strictEqual(authorized, false);
    });
  });

  describe("Subtopics Boundary and Modal Cap", () => {
    test("MAX_SUBTOPICS is defined as 10 to protect Slack 100-block limit", () => {
      assert.strictEqual(MAX_SUBTOPICS, 10);
    });

    test("includes add_row_actions button when count < MAX_SUBTOPICS", () => {
      const modal = buildScheduleModal({ subtopicCount: 3 });
      const hasAddButton = modal.blocks?.some(
        (b: any) => b.block_id === "add_row_actions"
      );
      assert.strictEqual(hasAddButton, true);
    });

    test("hides add_row_actions button when count >= MAX_SUBTOPICS", () => {
      const modal = buildScheduleModal({ subtopicCount: 10 });
      const hasAddButton = modal.blocks?.some(
        (b: any) => b.block_id === "add_row_actions"
      );
      assert.strictEqual(hasAddButton, false);

      const hasCapNotice = modal.blocks?.some(
        (b: any) =>
          b.type === "context" &&
          b.elements?.some((el: any) =>
            el.text?.includes("Maximum of 10 agenda modules reached")
          )
      );
      assert.strictEqual(hasCapNotice, true);
    });

    test("includes comprehensive duration options and omits separate custom block for cleaner UI", () => {
      const modal = buildScheduleModal({ subtopicCount: 3 });
      const durationBlock = modal.blocks?.find(
        (b: any) => b.block_id === "duration_block"
      ) as any;
      assert.strictEqual(!!durationBlock, true);
      const options = durationBlock.element.options.map((o: any) => o.value);
      assert.strictEqual(options.includes("15"), true);
      assert.strictEqual(options.includes("20"), true);
      assert.strictEqual(options.includes("30"), true);
      assert.strictEqual(options.includes("45"), true);
      assert.strictEqual(options.includes("60"), true);
      assert.strictEqual(options.includes("90"), true);
      assert.strictEqual(options.includes("120"), true);

      // Custom duration input block was removed per design feedback
      const customDurationBlock = modal.blocks?.find(
        (b: any) => b.block_id === "custom_duration_block"
      );
      assert.strictEqual(customDurationBlock, undefined);

      // Verify updated title placeholder
      const titleBlock = modal.blocks?.find((b: any) => b.block_id === "title_block") as any;
      assert.match(titleBlock.element.placeholder.text, /Onboarding/);
    });
  });
});
