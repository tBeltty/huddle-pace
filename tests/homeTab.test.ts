import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildHomeTabView } from "../src/slack/ui/homeTab.js";
import { buildAppHomeDeepLink, buildAppHomeMrkdwnLink } from "../src/slack/utils/deepLinks.js";

describe("App Home Tab — Sub-tabs Navigation, Personalization & Boundary Tests", () => {
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

  describe("Sub-tabs Navigation Architecture", () => {
    test("renders sub-tabs navigation bar with Meetups, Analytics and Guide buttons", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER", "meetups");
      assert.strictEqual(view.type, "home");

      const navBlock = view.blocks.find((b: any) => b.block_id === "home_subtabs_nav");
      assert.ok(navBlock, "Navigation block home_subtabs_nav should exist");
      assert.strictEqual(navBlock.elements.length, 3);

      const actionIds = navBlock.elements.map((el: any) => el.action_id);
      assert.deepStrictEqual(actionIds, ["nav_tab_meetups", "nav_tab_analytics", "nav_tab_guide"]);
    });

    test("highlights active tab with primary style and dot indicator", () => {
      // Meetups tab active
      const viewMeetups = buildHomeTabView([], [], dummyStats, "U_USER", "meetups");
      const navMeetups = viewMeetups.blocks.find((b: any) => b.block_id === "home_subtabs_nav");
      assert.strictEqual(navMeetups.elements[0].style, "primary");
      assert.strictEqual(navMeetups.elements[1].style, undefined);
      assert.strictEqual(navMeetups.elements[2].style, undefined);

      // Analytics tab active
      const viewAnalytics = buildHomeTabView([], [], dummyStats, "U_USER", "analytics");
      const navAnalytics = viewAnalytics.blocks.find((b: any) => b.block_id === "home_subtabs_nav");
      assert.strictEqual(navAnalytics.elements[0].style, undefined);
      assert.strictEqual(navAnalytics.elements[1].style, "primary");
      assert.strictEqual(navAnalytics.elements[2].style, undefined);

      // Guide tab active
      const viewGuide = buildHomeTabView([], [], dummyStats, "U_USER", "guide");
      const navGuide = viewGuide.blocks.find((b: any) => b.block_id === "home_subtabs_nav");
      assert.strictEqual(navGuide.elements[0].style, undefined);
      assert.strictEqual(navGuide.elements[1].style, undefined);
      assert.strictEqual(navGuide.elements[2].style, "primary");
    });
  });

  describe("Tab 1: Meetups & Agenda (Clean Slate & Session List)", () => {
    test("renders unified clean empty state when no active or upcoming meetups exist", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER", "meetups");
      const hasCleanSlate = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("Your agenda is clear")
      );
      assert.strictEqual(hasCleanSlate, true);

      // Negative control: should NOT show redundant wall-of-text empty messages
      const hasWallOfText = view.blocks.some(
        (b: any) =>
          b.text?.text?.includes("You have no upcoming sessions assigned as speaker")
      );
      assert.strictEqual(hasWallOfText, false);
    });

    test("renders active sessions and concludes buttons when active sessions exist", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPEAKER_1", "meetups");
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

    test("negative control: marks user as spectator when currentUserId does not match active speaker", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPECTATOR", "meetups");
      const activeSection = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Daily Standup")
      );
      assert.ok(activeSection);
      assert.match(activeSection.text.text, /👀 _Spectator_/);
      assert.doesNotMatch(activeSection.text.text, /🌟 \*You are a speaker\*/);
    });

    test("partitions upcoming meetups into My Scheduled vs Workspace Meetups", () => {
      const view = buildHomeTabView(
        [],
        [dummyMeetup1, dummyMeetup2],
        dummyStats,
        "U_SPEAKER_2",
        "meetups"
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
      // Negative control: Meetup 2 (Engineering All-Hands) must not be in My section
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

  describe("Tab 2: Analytics & Reports", () => {
    test("renders compliance metrics, time breakdown, and report button", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER", "analytics");
      const hasAnalyticsHeader = view.blocks.some(
        (b: any) => b.type === "header" && b.text?.text?.includes("Pacing & Timebox Analytics")
      );
      assert.strictEqual(hasAnalyticsHeader, true);

      // Verify compliance rate block
      const hasComplianceRate = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.fields?.some((f: any) => f.text?.includes("80%"))
      );
      assert.strictEqual(hasComplianceRate, true);

      // Verify report button
      const hasReportBtn = view.blocks.some(
        (b: any) =>
          b.type === "actions" &&
          b.elements?.some((el: any) => el.action_id === "open_report_modal")
      );
      assert.strictEqual(hasReportBtn, true);

      // Negative control: should NOT render agenda session headers in analytics tab
      const hasActiveHeader = view.blocks.some(
        (b: any) => b.type === "header" && b.text?.text?.includes("Active Sessions")
      );
      assert.strictEqual(hasActiveHeader, false);
    });
  });

  describe("Tab 3: Guide & Tips", () => {
    test("renders 3-step guide and quick slash commands", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER", "guide");
      const hasWelcome = view.blocks.some(
        (b: any) => b.type === "header" && b.text?.text?.includes("Welcome to HuddlePace")
      );
      assert.strictEqual(hasWelcome, true);

      const has3Steps = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("Schedule with Modules") &&
          b.text?.text?.includes("Launch in a Slack Huddle")
      );
      assert.strictEqual(has3Steps, true);

      const hasSlashCommands = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("/pace") &&
          b.text?.text?.includes("/pace report")
      );
      assert.strictEqual(hasSlashCommands, true);

      // Negative control: should NOT render active meetups in guide tab
      const hasActiveHeader = view.blocks.some(
        (b: any) => b.type === "header" && b.text?.text?.includes("Active Sessions")
      );
      assert.strictEqual(hasActiveHeader, false);
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

      const view = buildHomeTabView([], manyMeetups, dummyStats, "U_SPEAKER_0", "meetups");
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
