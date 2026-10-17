import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildLiveTrackerBlocks } from "../src/slack/ui/trackerBlock.js";

describe("Live Tracker Block Kit Generation", () => {
  test("renders header, monospace progress bar, and midpoint flight check alert", () => {
    const blocks = buildLiveTrackerBlocks({
      meetupId: "meetup-123",
      title: "Sprint Planning",
      totalMinutes: 15,
      speakerUserId: "U_GUEST",
      elapsedMinutes: 9,
      currentModuleName: "Core Topic",
      moduleRemainingMinutes: 4,
      nextModuleName: "Wrap-up",
      isOvertime: false,
    });

    assert.ok(Array.isArray(blocks));
    // Header
    assert.strictEqual(blocks[0].type, "header");
    assert.strictEqual(blocks[0].text.text, "Sprint Planning");

    // Telemetry section
    assert.strictEqual(blocks[1].type, "section");
    assert.ok(blocks[1].text.text.includes("Pacing On Track"));
    assert.ok(blocks[1].text.text.includes("9 / 15 min"));
    assert.ok(blocks[1].text.text.includes("[██████████░░░░░░]"));
    assert.ok(blocks[1].text.text.includes("6m remaining"));

    // Flight check blockquote alert (over 50% elapsed)
    assert.strictEqual(blocks[2].type, "section");
    assert.ok(blocks[2].text.text.startsWith("> 🧭 *Midpoint Flight Check:*"));

    // Fields
    assert.strictEqual(blocks[3].type, "section");
    assert.ok(blocks[3].fields[0].text.includes("<@U_GUEST>"));
    assert.ok(blocks[3].fields[1].text.includes("Core Topic"));

    // Actions block with Next Module, Just Chatting and Conclude
    const actionsBlock = blocks.find((b: any) => b.type === "actions");
    assert.ok(actionsBlock);
    assert.strictEqual(actionsBlock.elements.length, 3);
    assert.strictEqual(actionsBlock.elements[0].action_id, "next_module_action");
    assert.strictEqual(actionsBlock.elements[1].action_id, "switch_to_chatting_action");
    assert.strictEqual(actionsBlock.elements[2].action_id, "conclude_meetup_action");
  });

  test("renders 1-minute warning alert when current module has <= 1 min left", () => {
    const blocks = buildLiveTrackerBlocks({
      meetupId: "meetup-123",
      title: "Sprint Planning",
      totalMinutes: 15,
      speakerUserId: "U_GUEST",
      elapsedMinutes: 4,
      currentModuleName: "Welcome",
      moduleRemainingMinutes: 1,
      nextModuleName: "Core Topic",
      isOvertime: false,
    });

    const alertBlock = blocks[2];
    assert.ok(alertBlock.text.text.includes("1-Minute Warning"));
    assert.ok(alertBlock.text.text.includes("Welcome"));
    assert.ok(alertBlock.text.text.includes("Core Topic"));
  });

  test("renders overtime holding pattern alert when session is overtime", () => {
    const blocks = buildLiveTrackerBlocks({
      meetupId: "meetup-123",
      title: "Sprint Planning",
      totalMinutes: 15,
      speakerUserId: "U_GUEST",
      elapsedMinutes: 16,
      currentModuleName: "Wrap-up",
      moduleRemainingMinutes: 0,
      nextModuleName: null,
      isOvertime: true,
    });

    assert.ok(blocks[1].text.text.includes("Session Overtime"));
    assert.ok(blocks[2].text.text.includes("Holding Pattern (Overtime)"));
  });

  test("renders Just Chatting layout when session is in casual chat mode", () => {
    const blocks = buildLiveTrackerBlocks({
      meetupId: "meetup-123",
      title: "Sprint Planning",
      totalMinutes: 15,
      speakerUserId: "U_GUEST",
      elapsedMinutes: 15,
      currentModuleName: "Casual Chat",
      moduleRemainingMinutes: 0,
      nextModuleName: null,
      isChatting: true,
      chattingElapsedMinutes: 5,
    });

    assert.strictEqual(blocks[0].text.text, "☕ Sprint Planning (Just Chatting)");
    assert.ok(blocks[1].text.text.includes("Casual Chat Mode Active"));
    assert.ok(blocks[2].fields[1].text.includes("5m"));
  });

  test("renders Freeform Session layout with Pacing Mode field and omits Next Up and Next Module button", () => {
    const blocks = buildLiveTrackerBlocks({
      meetupId: "meetup-freeform",
      title: "Design Review",
      totalMinutes: 30,
      speakerUserId: "U_ALICE",
      elapsedMinutes: 10,
      currentModuleName: "Design Review",
      moduleRemainingMinutes: 20,
      nextModuleName: null,
      pacingMode: "FREEFORM",
    });

    // Header
    assert.strictEqual(blocks[0].text.text, "Design Review");

    // Fields: Speaker and Pacing Mode (no Active Module)
    const fieldsSection = blocks.find((b: any) => b.fields && b.fields.length === 2);
    assert.ok(fieldsSection);
    assert.ok(fieldsSection.fields[0].text.includes("<@U_ALICE>"));
    assert.ok(fieldsSection.fields[1].text.includes("*Pacing Mode*"));
    assert.ok(fieldsSection.fields[1].text.includes("Freeform Session"));
    assert.ok(fieldsSection.fields[1].text.includes("20m remaining"));

    // Ensure Next Up context line is omitted
    const hasNextUp = blocks.some(
      (b: any) => b.type === "context" && b.elements?.some((el: any) => el.text?.includes("Next Up"))
    );
    assert.strictEqual(hasNextUp, false);

    // Actions block: Just Chatting and Conclude only (no Next Module)
    const actions = blocks.find((b: any) => b.type === "actions");
    assert.ok(actions);
    assert.strictEqual(actions.elements.length, 2);
    assert.strictEqual(actions.elements[0].action_id, "switch_to_chatting_action");
    assert.strictEqual(actions.elements[1].action_id, "conclude_meetup_action");
  });
});
