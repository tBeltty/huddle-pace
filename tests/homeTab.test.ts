import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildHomeTabView, buildGuideModal } from "../src/slack/ui/homeTab.js";
import { buildSettingsModal } from "../src/slack/ui/settingsModal.js";
import { buildAppHomeDeepLink, buildAppHomeMrkdwnLink } from "../src/slack/utils/deepLinks.js";

describe("App Home Tab — Minimalist Layout, Personalization & Modal Helpers", () => {
  const dummyStats = {
    totalSessions: 10,
    completedOnTime: 8,
    complianceRate: 80,
    totalFormalMinutes: 240,
    totalChattingMinutes: 45,
    totalMinutesSpent: 285,
    recentSessions: [],
  };

  const dummyMeetup1 = {
    id: "m-1",
    title: "Sprint Planning",
    totalMinutes: 30,
    channelId: "C111",
    speakerUserId: "U_SPEAKER_1, U_SPEAKER_2",
    startedAt: null,
    status: "SCHEDULED",
    modules: [
      { title: "Intro", percentage: 50, durationMinutes: 15 },
      { title: "Estimation", percentage: 50, durationMinutes: 15 },
    ],
  };

  const dummyMeetup2 = {
    id: "m-2",
    title: "Engineering All-Hands",
    totalMinutes: 45,
    channelId: "C222",
    speakerUserId: "U_OTHER_SPEAKER",
    startedAt: null,
    status: "SCHEDULED",
    modules: [
      { title: "Updates", percentage: 100, durationMinutes: 45 },
    ],
  };

  const dummyActiveMeetup = {
    id: "m-active",
    title: "Daily Standup",
    totalMinutes: 15,
    channelId: "C333",
    speakerUserId: "U_SPEAKER_1",
    startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    status: "ACTIVE",
    modules: [
      { title: "Status", percentage: 100, durationMinutes: 15 },
    ],
  };

  describe("Minimalist Header & Action Bar", () => {
    test("renders personalized greeting with user mention and wave emoji", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_JHONATAN");
      assert.strictEqual(view.type, "home");

      const greetingBlock = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Hi, <@U_JHONATAN> :wave:")
      );
      assert.ok(greetingBlock, "Should render personalized greeting with :wave:");
    });

    test("falls back cleanly to generic greeting when currentUserId is missing", () => {
      const view = buildHomeTabView([], [], dummyStats);
      const greetingBlock = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Hi there :wave:")
      );
      assert.ok(greetingBlock, "Should render generic greeting");
    });

    test("renders action bar with Schedule Meetup, Templates, Analytics, Guide, and Settings buttons", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER");
      const actionBar = view.blocks.find((b: any) => b.block_id === "home_action_bar");
      assert.ok(actionBar, "Action bar block should exist");
      assert.strictEqual(actionBar.elements.length, 5);

      const [btnSchedule, btnTemplates, btnAnalytics, btnGuide, btnSettings] = actionBar.elements;
      assert.strictEqual(btnSchedule.action_id, "open_schedule_modal");
      assert.strictEqual(btnSchedule.style, "primary");
      assert.match(btnSchedule.text.text, /Schedule Meetup/);

      assert.strictEqual(btnTemplates.action_id, "open_templates_modal");
      assert.strictEqual(btnTemplates.text.text, "Templates");

      assert.strictEqual(btnAnalytics.action_id, "open_report_modal");
      assert.strictEqual(btnAnalytics.text.text, "Analytics");

      assert.strictEqual(btnGuide.action_id, "open_guide_modal");
      assert.strictEqual(btnGuide.text.text, "Guide");

      assert.strictEqual(btnSettings.action_id, "open_settings_modal");
      assert.strictEqual(btnSettings.text.text, "Settings");
    });

    test("omits redundant 'Dashboard' header block for a cleaner, modern look", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER");
      const hasDashboardHeader = view.blocks.some(
        (b: any) => b.type === "header" && b.text?.text?.includes("Dashboard")
      );
      assert.strictEqual(hasDashboardHeader, false, "Dashboard header should be omitted");
    });
  });

  describe("Agenda & Sessions Display", () => {
    test("renders clean, unified empty slate when no meetups are active or upcoming", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER");
      const hasCleanSlate = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("Your agenda is clear")
      );
      assert.strictEqual(hasCleanSlate, true);
    });

    test("renders active sessions with role badges and conclude buttons", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPEAKER_1");
      const hasActiveHeader = view.blocks.some(
        (b: any) => b.type === "header" && b.text?.text?.includes("Active Sessions")
      );
      assert.strictEqual(hasActiveHeader, true);

      const activeSection = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Daily Standup")
      );
      assert.ok(activeSection);
      assert.match(activeSection.text.text, /🌟 \*You are a speaker\*/);
      assert.strictEqual(activeSection.accessory?.action_id, "conclude_meetup_action");
    });

    test("negative control: marks user as spectator when currentUserId is not active speaker and omits conclude button", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPECTATOR");
      const activeSection = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Daily Standup")
      );
      assert.ok(activeSection);
      assert.match(activeSection.text.text, /👀 _Spectator_/);
      assert.doesNotMatch(activeSection.text.text, /🌟 \*You are a speaker\*/);
      assert.strictEqual(activeSection.accessory, undefined, "Spectators should not have Conclude button");
    });

    test("partitions upcoming meetups into My Scheduled Meetups vs Workspace Meetups with role-gated launch buttons", () => {
      const view = buildHomeTabView(
        [],
        [dummyMeetup1, dummyMeetup2],
        dummyStats,
        "U_SPEAKER_2"
      );

      const myHeaderIndex = view.blocks.findIndex(
        (b: any) => b.type === "header" && b.text?.text?.includes("My Scheduled Meetups")
      );
      const teamHeaderIndex = view.blocks.findIndex(
        (b: any) => b.type === "header" && b.text?.text?.includes("Workspace Meetups")
      );

      assert.ok(myHeaderIndex !== -1, "My Scheduled Meetups header must exist");
      assert.ok(teamHeaderIndex !== -1, "Workspace Meetups header must exist");

      const mySection = view.blocks.slice(myHeaderIndex, teamHeaderIndex);
      const myBlock = mySection.find((b: any) => b.text?.text?.includes("Sprint Planning"));
      assert.ok(myBlock);
      assert.strictEqual(myBlock.accessory?.action_id, "start_scheduled_meetup_action");
      const editRow = mySection.find((b: any) => b.type === "actions" && b.elements?.[0]?.action_id === "edit_scheduled_meetup_action");
      assert.ok(editRow, "Speaker's own upcoming meetups must offer an Edit button");
      assert.strictEqual(editRow.elements[0].value, dummyMeetup1.id);
      const cancelButton = editRow.elements.find((e: any) => e.action_id === "cancel_scheduled_meetup_action");
      assert.ok(cancelButton, "Speaker's own upcoming meetups must offer a Cancel button");
      assert.strictEqual(cancelButton.value, dummyMeetup1.id);
      assert.ok(cancelButton.confirm, "Cancel must ask for confirmation");
      assert.strictEqual(
        mySection.some((b: any) => b.text?.text?.includes("Engineering All-Hands")),
        false
      );

      const teamSection = view.blocks.slice(teamHeaderIndex);
      const teamBlock = teamSection.find((b: any) => b.text?.text?.includes("Engineering All-Hands"));
      assert.ok(teamBlock);
      assert.strictEqual(teamBlock.accessory, undefined, "Workspace meetups for spectators must not have Start in Huddle button");
      assert.strictEqual(
        teamSection.some((b: any) => b.type === "actions"),
        false,
        "Workspace meetups for spectators must not have Edit button"
      );
    });
  });

  describe("Guide Modal Builder", () => {
    test("builds guide modal with 3 steps and slash commands", () => {
      const modal = buildGuideModal();
      assert.strictEqual(modal.type, "modal");
      assert.strictEqual(modal.title.text, "HuddlePace Guide");

      const has3Steps = modal.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("Schedule with Modules") &&
          b.text?.text?.includes("Launch in a Slack Huddle")
      );
      assert.strictEqual(has3Steps, true);

      const hasSlashCommands = modal.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("/pace") &&
          b.text?.text?.includes("/pace report")
      );
      assert.strictEqual(hasSlashCommands, true);
    });
  });

  describe("100-Block Slack Ceiling Safety", () => {
    test("truncates and adds warning when view exceeds 98 blocks", () => {
      const manyMeetups = Array.from({ length: 120 }, (_, i) => ({
        id: `meetup-bulk-${i}`,
        title: `Bulk Meetup #${i}`,
        totalMinutes: 15,
        channelId: "C123",
        speakerUserId: `U_SPEAKER_${i}`,
        startedAt: null,
        status: "SCHEDULED",
        modules: [{ title: "Topic", percentage: 100, durationMinutes: 15 }],
      }));

      const view = buildHomeTabView([], manyMeetups, dummyStats, "U_SPEAKER_0");
      assert.ok(view.blocks.length <= 99, `Block count ${view.blocks.length} exceeds 99`);

      const lastBlock = view.blocks[view.blocks.length - 1];
      assert.strictEqual(lastBlock.type, "context");
      assert.match(lastBlock.elements[0].text, /100-block limit/);
    });
  });

  describe("Deep Linking Utilities", () => {
    test("buildAppHomeDeepLink constructs native Slack app URI with parameters", () => {
      const uri = buildAppHomeDeepLink({
        teamId: "T_TEST_TEAM",
        appId: "A_TEST_APP",
        tab: "home",
      });
      assert.strictEqual(uri, "slack://app?team=T_TEST_TEAM&id=A_TEST_APP&tab=home");
    });

    test("buildAppHomeDeepLink defaults to home tab", () => {
      const uri = buildAppHomeDeepLink({ teamId: "T_TEAM" });
      assert.strictEqual(uri, "slack://app?team=T_TEAM&tab=home");
    });

    test("buildAppHomeMrkdwnLink produces valid Slack mrkdwn link", () => {
      const link = buildAppHomeMrkdwnLink("Open Dashboard", {
        teamId: "T123",
        appId: "A123",
      });
      assert.strictEqual(link, "<slack://app?team=T123&id=A123&tab=home|Open Dashboard>");
    });
  });

  describe("Settings Modal Layout & Defaults", () => {
    test("renders settings modal with text reminder enabled, image disabled, and Bot Manager picker by default", () => {
      const modal = buildSettingsModal({
        reminderTextEnabled: true,
        reminderImageEnabled: false,
        flexibilityMode: "STANDARD",
        teamId: "T_TEST_TEAM",
      });

      assert.strictEqual(modal.type, "modal");
      assert.strictEqual(modal.callback_id, "submit_settings_modal");
      assert.strictEqual(modal.title.text, "HuddlePace Settings");
      assert.strictEqual(modal.submit?.text, "Save Settings");

      const reminderBlock = modal.blocks.find((b: any) => b.block_id === "reminder_settings_block") as any;
      assert.ok(reminderBlock);
      assert.strictEqual(reminderBlock.element.type, "checkboxes");
      assert.strictEqual(reminderBlock.element.initial_options?.length, 1);
      assert.strictEqual(reminderBlock.element.initial_options[0].value, "reminder_text");

      const flexBlock = modal.blocks.find((b: any) => b.block_id === "flexibility_settings_block") as any;
      assert.ok(flexBlock);
      assert.strictEqual(flexBlock.element.type, "static_select");
      assert.strictEqual(flexBlock.element.initial_option.value, "STANDARD");

      const managerBlock = modal.blocks.find((b: any) => b.block_id === "manager_settings_block") as any;
      assert.ok(managerBlock);
      assert.strictEqual(managerBlock.element.type, "multi_users_select");
      assert.strictEqual(managerBlock.element.initial_users, undefined);
    });

    test("reflects custom reminder toggles, STRICT flexibility mode, and pre-selected Bot Managers", () => {
      const modal = buildSettingsModal({
        reminderTextEnabled: false,
        reminderImageEnabled: true,
        flexibilityMode: "STRICT",
        managerUserIds: ["U_MGR1", "U_MGR2"],
        teamId: "T_STRICT",
        canEdit: true,
      });

      const reminderBlock = modal.blocks.find((b: any) => b.block_id === "reminder_settings_block") as any;
      assert.ok(reminderBlock);
      assert.strictEqual(reminderBlock.element.initial_options?.length, 1);
      assert.strictEqual(reminderBlock.element.initial_options[0].value, "reminder_image");

      const flexBlock = modal.blocks.find((b: any) => b.block_id === "flexibility_settings_block") as any;
      assert.strictEqual(flexBlock.element.initial_option.value, "STRICT");

      const managerBlock = modal.blocks.find((b: any) => b.block_id === "manager_settings_block") as any;
      assert.ok(managerBlock);
      assert.deepStrictEqual(managerBlock.element.initial_users, ["U_MGR1", "U_MGR2"]);
    });

    test("reflects RELAXED flexibility mode and both reminders active", () => {
      const modal = buildSettingsModal({
        reminderTextEnabled: true,
        reminderImageEnabled: true,
        flexibilityMode: "RELAXED",
      });

      const reminderBlock = modal.blocks.find((b: any) => b.block_id === "reminder_settings_block") as any;
      assert.strictEqual(reminderBlock.element.initial_options?.length, 2);

      const flexBlock = modal.blocks.find((b: any) => b.block_id === "flexibility_settings_block") as any;
      assert.strictEqual(flexBlock.element.initial_option.value, "RELAXED");
    });

    test("negative control: renders read-only settings modal when canEdit is false", () => {
      const modal = buildSettingsModal({
        reminderTextEnabled: true,
        reminderImageEnabled: false,
        flexibilityMode: "STANDARD",
        managerUserIds: ["U_MGR_ALPHA"],
        teamId: "T_READONLY",
        canEdit: false,
      });

      assert.strictEqual(modal.type, "modal");
      assert.strictEqual(modal.callback_id, "view_settings_modal_readonly");
      assert.strictEqual(modal.submit, undefined, "Read-only modal must omit Save Settings button");
      assert.strictEqual(modal.close.text, "Close");

      // Verify Read-Only banner
      const hasReadOnlyNotice = modal.blocks.some(
        (b: any) => b.type === "section" && b.text?.text?.includes("Read-Only View")
      );
      assert.strictEqual(hasReadOnlyNotice, true);

      // Verify formatted manager mentions
      const managerSection = modal.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Delegated Bot Managers")
      ) as any;
      assert.ok(managerSection);
      assert.match(managerSection.text.text, /<@U_MGR_ALPHA>/);

      // Verify reminder summary values
      const reminderSection = modal.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Thread Reminders")
      ) as any;
      assert.ok(reminderSection);
      assert.match(reminderSection.text.text, /Finish-line text checkpoint:\* \*Active\*/);
      assert.match(reminderSection.text.text, /Visual illustration banner:\* \*Disabled\*/);
    });
  });
});
