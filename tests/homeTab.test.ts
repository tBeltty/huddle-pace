import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildHomeTabView } from "../src/slack/ui/homeTab.js";
import { buildAppHomeDeepLink, buildAppHomeMrkdwnLink } from "../src/slack/utils/deepLinks.js";

describe("App Home Tab — Personalization, Reactivity & Boundary Tests", () => {
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

  describe("Onboarding and Empty State", () => {
    test("renders onboarding guide when no active or upcoming meetups exist", () => {
      const view = buildHomeTabView([], [], dummyStats, "U_USER");
      assert.strictEqual(view.type, "home");

      const hasOnboarding = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("Welcome to HuddlePace!")
      );
      assert.strictEqual(hasOnboarding, true);
    });

    test("omits onboarding guide when there are active or upcoming meetups", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPEAKER_1");
      const hasOnboarding = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("Welcome to HuddlePace!")
      );
      assert.strictEqual(hasOnboarding, false);
    });

    test("includes refresh button in the header actions block", () => {
      const view = buildHomeTabView([], [], dummyStats);
      const actionsBlock = view.blocks.find((b: any) => b.type === "actions");
      assert.ok(actionsBlock, "Actions block should exist");
      const hasRefresh = actionsBlock.elements.some(
        (el: any) => el.action_id === "refresh_home_tab"
      );
      assert.strictEqual(hasRefresh, true);
    });
  });

  describe("Personalized Active Sessions", () => {
    test("marks user as designated speaker when currentUserId matches", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPEAKER_1");
      const activeSection = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Daily Standup")
      );
      assert.ok(activeSection);
      assert.match(activeSection.text.text, /🌟 \*You are a speaker\*/);
    });

    test("negative control: marks user as spectator when currentUserId does NOT match", () => {
      const view = buildHomeTabView([dummyActiveMeetup], [], dummyStats, "U_SPECTATOR_999");
      const activeSection = view.blocks.find(
        (b: any) => b.type === "section" && b.text?.text?.includes("Daily Standup")
      );
      assert.ok(activeSection);
      assert.doesNotMatch(activeSection.text.text, /🌟 \*You are a speaker\*/);
      assert.match(activeSection.text.text, /👀 _Spectator_/);
    });
  });

  describe("Personalized Upcoming Sessions (My Meetups vs Team Meetups)", () => {
    test("partitions meetups where user is speaker into 'My Scheduled Meetups'", () => {
      const view = buildHomeTabView(
        [],
        [dummyMeetup1, dummyMeetup2],
        dummyStats,
        "U_SPEAKER_2"
      );

      // Verify "My Scheduled Meetups" header exists
      const myHeaderIndex = view.blocks.findIndex(
        (b: any) => b.type === "header" && b.text?.text?.includes("My Scheduled Meetups")
      );
      assert.ok(myHeaderIndex !== -1, "Should have My Scheduled Meetups header");

      // Verify "Workspace Meetups" header exists
      const teamHeaderIndex = view.blocks.findIndex(
        (b: any) => b.type === "header" && b.text?.text?.includes("Workspace Meetups")
      );
      assert.ok(teamHeaderIndex !== -1, "Should have Workspace Meetups header");

      // My section should contain dummyMeetup1 (user is speaker 2)
      const mySection = view.blocks.slice(myHeaderIndex, teamHeaderIndex);
      const hasSprintPlanning = mySection.some(
        (b: any) => b.type === "section" && b.text?.text?.includes("Sprint Planning")
      );
      assert.strictEqual(hasSprintPlanning, true);

      // Negative control: Engineering All-Hands must NOT be in My section
      const hasAllHandsInMySection = mySection.some(
        (b: any) => b.type === "section" && b.text?.text?.includes("Engineering All-Hands")
      );
      assert.strictEqual(hasAllHandsInMySection, false, "Meetup 2 must not be in My section");

      // Workspace section should contain dummyMeetup2
      const teamSection = view.blocks.slice(teamHeaderIndex);
      const hasAllHandsInTeamSection = teamSection.some(
        (b: any) => b.type === "section" && b.text?.text?.includes("Engineering All-Hands")
      );
      assert.strictEqual(hasAllHandsInTeamSection, true);
    });

    test("renders empty prompt in My Scheduled Meetups when user has no assigned talks", () => {
      const view = buildHomeTabView(
        [],
        [dummyMeetup2],
        dummyStats,
        "U_USER_WITH_NO_TALKS"
      );

      const hasEmptyPrompt = view.blocks.some(
        (b: any) =>
          b.type === "section" &&
          b.text?.text?.includes("You have no upcoming sessions assigned as speaker")
      );
      assert.strictEqual(hasEmptyPrompt, true);
    });
  });

  describe("100-Block Slack Ceiling Safety", () => {
    test("truncates and adds warning when view exceeds 98 blocks", () => {
      // Create 120 upcoming meetups to reliably exceed Slack's 98-block threshold
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
