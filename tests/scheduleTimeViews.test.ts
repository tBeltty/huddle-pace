import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildScheduleModal } from "../src/slack/ui/scheduleModal.js";
import { buildScheduleConflictModal } from "../src/slack/ui/conflictModal.js";
import { buildSettingsModal } from "../src/slack/ui/settingsModal.js";
import { buildHomeTabView } from "../src/slack/ui/homeTab.js";

const blocksOf = (view: { blocks?: unknown[] }) => (view.blocks ?? []) as Array<Record<string, any>>;
const findInput = (view: { blocks?: unknown[] }, prefix: string) =>
  blocksOf(view).find((block) => typeof block.block_id === "string" && block.block_id.startsWith(prefix));

describe("schedule modal date and time", () => {
  test("asks for an exact date and time and labels the time with its zone", () => {
    const modal = buildScheduleModal({ zone: "America/Los_Angeles", scheduleDate: "2026-10-07", scheduleTime: "10:00" });
    const date = findInput(modal, "schedule_date_block");
    const time = findInput(modal, "schedule_time_block");
    assert.strictEqual(date?.element.initial_date, "2026-10-07");
    assert.strictEqual(time?.element.initial_time, "10:00");
    assert.strictEqual(time?.label.text, "Time (PT)");
    assert.match(time?.hint.text, /20 minutes before to 20 minutes after/);
  });

  test("leaves the pickers empty instead of reading the clock when no time is given", () => {
    const modal = buildScheduleModal({});
    assert.strictEqual(findInput(modal, "schedule_date_block")?.element.initial_date, undefined);
    assert.strictEqual(findInput(modal, "schedule_time_block")?.element.initial_time, undefined);
  });

  test("keeps the zone and the blocked range in private_metadata", () => {
    const blockedRange = { from: "2026-10-07T16:40:00.000Z", to: "2026-10-07T17:20:00.000Z", title: "Standup", channelId: "C1" };
    const modal = buildScheduleModal({ zone: "Europe/Madrid", blockedRange });
    const metadata = JSON.parse(modal.private_metadata ?? "{}");
    assert.strictEqual(metadata.zone, "Europe/Madrid");
    assert.deepStrictEqual(metadata.blocked, blockedRange);
  });

  test("shows the notice above the time field after Change time", () => {
    const modal = buildScheduleModal({ scheduleNotice: "🔒 *9:40 AM to 10:20 AM PT is taken.*" });
    const ids = blocksOf(modal).map((block) => String(block.block_id ?? ""));
    const noticeIndex = ids.findIndex((id) => id.startsWith("schedule_notice_block"));
    const timeIndex = ids.findIndex((id) => id.startsWith("schedule_time_block"));
    assert.ok(noticeIndex >= 0 && noticeIndex < timeIndex);
  });

  test("template editing has no date or time fields", () => {
    const modal = buildScheduleModal({ editTemplateId: "tpl_1", zone: "America/Los_Angeles" });
    assert.strictEqual(findInput(modal, "schedule_date_block"), undefined);
    assert.strictEqual(findInput(modal, "schedule_time_block"), undefined);
  });
});

describe("time conflict notice", () => {
  const modal = buildScheduleConflictModal({
    token: "abc",
    channelId: "C1",
    zone: "America/Los_Angeles",
    existingTitle: "Standup Ventas",
    existingTime: new Date("2026-10-07T17:00:00.000Z"),
    manualCode: "m1",
  });
  const text = JSON.stringify(modal.blocks);

  test("names the other pace with its time and zone", () => {
    assert.match(text, /10:00 AM PT/);
    assert.match(text, /Standup Ventas/);
  });

  test("says what each button does", () => {
    assert.strictEqual(modal.submit?.text, "Save for manual start");
    assert.strictEqual(modal.close?.text, "Change time");
    assert.match(text, /will not start on its own/);
    assert.match(text, /\/pace start m1/);
    assert.match(text, /within 20 minutes of the other pace stay blocked/);
  });

  test("notifies on close so Change time can return to the form", () => {
    assert.strictEqual(modal.notify_on_close, true);
  });

  test("carries only a token, never the form", () => {
    assert.deepStrictEqual(JSON.parse(modal.private_metadata ?? "{}"), { token: "abc" });
  });
});

describe("settings timezone selector", () => {
  const select = (timezone?: string) => {
    const modal = buildSettingsModal({ reminderTextEnabled: true, reminderImageEnabled: false, timezone, canEdit: true });
    return findInput(modal, "timezone_settings_block")?.element;
  };

  test("defaults to Pacific Time and offers My timezone and custom zones", () => {
    const element = select();
    assert.strictEqual(element?.initial_option.value, "PT");
    const [presets, custom] = element?.option_groups ?? [];
    assert.deepStrictEqual(presets.options.map((option: any) => option.value), ["PT", "USER"]);
    assert.ok(custom.options.some((option: any) => option.value === "America/Bogota"));
  });

  test("preselects a saved custom zone and the My timezone mode", () => {
    assert.strictEqual(select("America/Bogota")?.initial_option.value, "America/Bogota");
    assert.strictEqual(select("USER")?.initial_option.value, "USER");
  });

  test("an invalid stored zone falls back to Pacific Time", () => {
    assert.strictEqual(select("Mars/Olympus")?.initial_option.value, "PT");
  });

  test("read-only members see the active timezone and reminder settings", () => {
    const modal = buildSettingsModal({
      reminderTextEnabled: true,
      reminderImageEnabled: false,
      reminderDmEnabled: false,
      timezone: "USER",
      canEdit: false,
    });
    assert.match(JSON.stringify(modal.blocks), /My timezone/);
    assert.match(JSON.stringify(modal.blocks), /Speaker DM reminders/);
    assert.match(JSON.stringify(modal.blocks), /Disabled/);
  });

  test("offers reminder_dm option in editable settings", () => {
    const modal = buildSettingsModal({
      reminderTextEnabled: true,
      reminderImageEnabled: false,
      reminderDmEnabled: true,
      timezone: "PT",
      canEdit: true,
    });
    const block = findInput(modal, "reminder_settings_block");
    const options = block?.element?.options ?? [];
    assert.ok(options.some((o: any) => o.value === "reminder_dm"));
    const initial = block?.element?.initial_options ?? [];
    assert.ok(initial.some((o: any) => o.value === "reminder_dm"));
  });

  test("offers default_pacing_mode_select in editable settings", () => {
    const modal = buildSettingsModal({
      reminderTextEnabled: true,
      reminderImageEnabled: false,
      defaultPacingMode: "FREEFORM",
      timezone: "PT",
      canEdit: true,
    });
    const block = findInput(modal, "pacing_mode_settings_block");
    assert.ok(block);
    assert.strictEqual(block?.element?.action_id, "default_pacing_mode_select");
    assert.strictEqual(block?.element?.initial_option?.value, "FREEFORM");
    const options = block?.element?.options ?? [];
    assert.ok(options.some((o: any) => o.value === "FREEFORM"));
    assert.ok(options.some((o: any) => o.value === "STRUCTURED"));
  });
});

describe("schedule modal reminder options and pacing modes", () => {
  test("defaults reminder_dm to unchecked and offers it in options", () => {
    const modal = buildScheduleModal({});
    const block = findInput(modal, "reminder_options_block");
    const options = block?.element?.options ?? [];
    assert.ok(options.some((o: any) => o.value === "reminder_dm"));
    const initial = block?.element?.initial_options ?? [];
    assert.strictEqual(initial.some((o: any) => o.value === "reminder_dm"), false);
    assert.strictEqual(initial.some((o: any) => o.value === "reminder_text"), true);
  });

  test("defaults pacing mode to FREEFORM and hides subtopics", () => {
    const modal = buildScheduleModal({});
    const actions = modal.blocks?.find((b: any) => b.block_id === "pacing_mode_actions_block");
    assert.ok(actions);
    const radio = actions.elements?.[0];
    assert.strictEqual(radio?.action_id, "pacing_mode_select");
    assert.strictEqual(radio?.initial_option?.value, "FREEFORM");

    // Has Freeform explanation section
    const hasFreeformSection = modal.blocks?.some(
      (b: any) => b.type === "section" && b.text?.text?.includes("Freeform Session")
    );
    assert.strictEqual(hasFreeformSection, true);

    // Has NO subtopic input blocks
    const hasSubtopics = modal.blocks?.some(
      (b: any) => typeof b.block_id === "string" && b.block_id.startsWith("subtopic_title_")
    );
    assert.strictEqual(hasSubtopics, false);
  });

  test("displays subtopic inputs when pacingMode is STRUCTURED", () => {
    const modal = buildScheduleModal({ pacingMode: "STRUCTURED", subtopicCount: 3 });
    const actions = modal.blocks?.find((b: any) => b.block_id === "pacing_mode_actions_block");
    assert.ok(actions);
    const radio = actions.elements?.[0];
    assert.strictEqual(radio?.initial_option?.value, "STRUCTURED");

    // Has subtopic input blocks
    const hasSubtopics = modal.blocks?.some(
      (b: any) => typeof b.block_id === "string" && b.block_id.startsWith("subtopic_title_")
    );
    assert.strictEqual(hasSubtopics, true);
  });

  test("preselects reminder_dm when reminderDmEnabled is true", () => {
    const modal = buildScheduleModal({ reminderDmEnabled: true });
    const block = findInput(modal, "reminder_options_block");
    const initial = block?.element?.initial_options ?? [];
    assert.strictEqual(initial.some((o: any) => o.value === "reminder_dm"), true);
  });

  test("only lists active huddles and filters out ended huddles", () => {
    const modal = buildScheduleModal({
      availableHuddles: [
        { ts: "1726000100.000100", isActive: true, roomName: "Active Standup", timeFormatted: "10:00" },
        { ts: "1726000200.000200", isActive: false, roomName: "Past Call", timeFormatted: "09:00" },
      ],
    });
    const block = findInput(modal, "huddle_select_block");
    const options = block?.element?.options ?? [];
    assert.strictEqual(options.some((o: any) => o.value === "huddle_1726000100.000100"), true);
    assert.strictEqual(options.some((o: any) => o.value === "huddle_1726000200.000200"), false);
  });
});

describe("App Home Missed and Manual start sections", () => {
  const pace = {
    id: "m_1",
    title: "Standup Ventas",
    totalMinutes: 30,
    channelId: "C1",
    speakerUserId: "U_SPEAKER",
    startedAt: null,
    scheduledFor: new Date("2026-10-07T17:00:00.000Z"),
    manualStartCode: "m1",
    status: "MISSED",
    modules: [],
  };
  const text = (options: Parameters<typeof buildHomeTabView>[4], userId = "U_SPEAKER") =>
    JSON.stringify(buildHomeTabView([], [], undefined, userId, options).blocks);

  test("shows neither section when there is nothing to show", () => {
    const home = text({});
    assert.doesNotMatch(home, /Missed/);
    assert.doesNotMatch(home, /Manual start/);
  });

  test("lists missed paces with their time and zone and a Reschedule button for speakers", () => {
    const home = text({ missedMeetups: [pace], zone: "America/Los_Angeles" });
    assert.match(home, /⏳ Missed/);
    assert.match(home, /10:00 AM PT/);
    assert.match(home, /Reschedule/);
  });

  test("the creator can reschedule a missed pace even when not a speaker", () => {
    assert.match(text({ missedMeetups: [{ ...pace, createdByUserId: "U_CREATOR" }] }, "U_CREATOR"), /Reschedule/);
  });

  test("other members see a missed pace without the Reschedule button", () => {
    assert.doesNotMatch(text({ missedMeetups: [pace] }, "U_OTHER"), /Reschedule/);
  });

  test("a missed pace offers Cancel to those who can manage it and to nobody else", () => {
    assert.match(text({ missedMeetups: [pace] }), /cancel_scheduled_meetup_action/);
    assert.doesNotMatch(text({ missedMeetups: [pace] }, "U_OTHER"), /cancel_scheduled_meetup_action/);
  });

  test("a manual start pace offers Edit and Cancel to its speakers and neither to others", () => {
    const manual = [{ ...pace, status: "MANUAL_START" }];
    const mine = text({ manualStartMeetups: manual });
    assert.match(mine, /edit_scheduled_meetup_action/);
    assert.match(mine, /cancel_scheduled_meetup_action/);
    const others = text({ manualStartMeetups: manual }, "U_OTHER");
    assert.doesNotMatch(others, /edit_scheduled_meetup_action/);
    assert.doesNotMatch(others, /cancel_scheduled_meetup_action/);
  });

  test("lists manual start paces with the command to start them", () => {
    const home = text({ manualStartMeetups: [{ ...pace, status: "MANUAL_START" }] });
    assert.match(home, /\/pace start m1/);
  });
});
