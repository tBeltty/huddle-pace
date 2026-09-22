import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildHomeTabView, buildGuideModal } from "../src/slack/ui/homeTab.js";
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

    test("renders action bar with Schedule Meetup, Analytics, and Guide buttons", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER");
      const actionBar = view.blocks.find((b: any) => b.block_id === "home_action_bar");
      assert.ok(actionBar, "Action bar block should exist");
      assert.strictEqual(actionBar.elements.length, 3);

      const [btnSchedule, btnAnalytics, btnGuide] = actionBar.elements;
      assert.strictEqual(btnSchedule.action_id, "open_schedule_modal");
      assert.strictEqual(btnSchedule.style, "primary");
      assert.match(btnSchedule.text.text, /Schedule Meetup/);

      assert.strictEqual(btnAnalytics.action_id, "open_report_modal");
      assert.strictEqual(btnAnalytics.text.text, "Analytics");

      assert.strictEqual(btnGuide.action_id, "open_guide_modal");
      assert.strictEqual(btnGuide.text.text, "Guide");
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

    test("negative control: marks user as spectator when currentUserId is not active speaker", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPECTATOR");
      const activeSection = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Daily Standup")
      );
      assert.ok(activeSection);
      assert.match(activeSection.text.text, /👀 _Spectator_/);
      assert.doesNotMatch(activeSection.text.text, /🌟 \*You are a speaker\*/);
    });

    test("partitions upcoming meetups into My Scheduled Meetups vs Workspace Meetups", () => {
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
      assert.strictEqual(
        mySection.some((b: any) => b.text?.text?.includes("Sprint Planning")),
        true
      );
      assert.strictEqual(
        mySection.some((b: any) => b.text?.text?.includes("Engineering All-Hands")),
        false
      );

      const teamSection = view.blocks.slice(teamHeaderIndex);
      assert.strictEqual(
        teamSection.some((b: any) => b.text?.text?.includes("Engineering All-Hands")),
        true
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
});
