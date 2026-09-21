import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db/client.js";
import {
  prismaInstallationStore,
  getBotTokenForTeam,
} from "../src/slack/oauth/installationStore.js";
import { MeetupService } from "../src/services/meetupService.js";
import type { Installation } from "@slack/bolt";

describe("OAuth Multi-Tenant & InstallationStore", () => {
  const mockTeamId = "T_TEST_TEAM_999";
  const mockInstallation: Installation<"v2", false> = {
    team: {
      id: mockTeamId,
      name: "Engineering Test Org",
    },
    enterprise: undefined,
    user: {
      id: "U_INSTALLER_123",
      scopes: ["identity:basic"],
      token: "xoxp-mock-user-token",
    },
    bot: {
      id: "B_BOT_123",
      userId: "U_BOT_123",
      token: "xoxb-mock-workspace-bot-token",
      scopes: ["commands", "chat:write"],
    },
    tokenType: "bot",
    isEnterpriseInstall: false,
    appId: "A_MOCK_APP_ID",
  };

  after(async () => {
    // Cleanup test artifacts
    await prisma.slackInstallation.deleteMany({
      where: { teamId: { in: [mockTeamId, "T_ALPHA", "T_BETA"] } },
    });
    await prisma.meetup.deleteMany({
      where: { teamId: { in: ["T_ALPHA", "T_BETA"] } },
    });
  });

  describe("prismaInstallationStore lifecycle", () => {
    test("stores a new workspace installation", async () => {
      await prismaInstallationStore.storeInstallation(mockInstallation);

      const saved = await prisma.slackInstallation.findUnique({
        where: { teamId: mockTeamId },
      });

      assert.notStrictEqual(saved, null);
      assert.strictEqual(saved?.teamId, mockTeamId);
      assert.strictEqual(saved?.botToken, "xoxb-mock-workspace-bot-token");
      assert.strictEqual(saved?.botUserId, "U_BOT_123");
    });

    test("fetches an existing workspace installation", async () => {
      const fetched = await prismaInstallationStore.fetchInstallation({
        teamId: mockTeamId,
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      });

      assert.strictEqual(fetched.team?.id, mockTeamId);
      assert.strictEqual(fetched.bot?.token, "xoxb-mock-workspace-bot-token");
      assert.strictEqual(fetched.user?.id, "U_INSTALLER_123");
    });

    test("fails when fetching nonexistent team (negative control)", async () => {
      await assert.rejects(
        async () => {
          await prismaInstallationStore.fetchInstallation({
            teamId: "T_NON_EXISTENT_XYZ",
            enterpriseId: undefined,
            isEnterpriseInstall: false,
          });
        },
        /Installation not found/
      );
    });

    test("resolves team-specific bot token via getBotTokenForTeam", async () => {
      const token = await getBotTokenForTeam(mockTeamId);
      assert.strictEqual(token, "xoxb-mock-workspace-bot-token");
    });

    test("falls back to process.env.SLACK_BOT_TOKEN for default/unknown team", async () => {
      const defaultToken = await getBotTokenForTeam("default");
      assert.strictEqual(defaultToken, process.env.SLACK_BOT_TOKEN);

      const nullToken = await getBotTokenForTeam(null);
      assert.strictEqual(nullToken, process.env.SLACK_BOT_TOKEN);
    });

    test("deletes an installation cleanly", async () => {
      await prismaInstallationStore.deleteInstallation({
        teamId: mockTeamId,
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      });

      const deleted = await prisma.slackInstallation.findUnique({
        where: { teamId: mockTeamId },
      });
      assert.strictEqual(deleted, null);
    });
  });

  describe("Multi-Tenant Isolation in MeetupService", () => {
    before(async () => {
      // Create meetups belonging to two distinct tenants
      await MeetupService.createMeetup({
        title: "Alpha Sprint Planning",
        channelId: "C_ALPHA",
        totalMinutes: 30,
        speakerUserId: "U_ALPHA_LEAD",
        teamId: "T_ALPHA",
        modules: [{ title: "Backlog", percentage: 100 }],
      });

      await MeetupService.createMeetup({
        title: "Beta Design Review",
        channelId: "C_BETA",
        totalMinutes: 45,
        speakerUserId: "U_BETA_LEAD",
        teamId: "T_BETA",
        modules: [{ title: "Mockups", percentage: 100 }],
      });
    });

    test("partitions upcoming meetups strictly by teamId", async () => {
      const alphaUpcoming = await MeetupService.getUpcomingMeetups("T_ALPHA");
      const betaUpcoming = await MeetupService.getUpcomingMeetups("T_BETA");

      assert.strictEqual(alphaUpcoming.every((m) => m.teamId === "T_ALPHA"), true);
      assert.strictEqual(betaUpcoming.every((m) => m.teamId === "T_BETA"), true);

      assert.strictEqual(alphaUpcoming.some((m) => m.title === "Alpha Sprint Planning"), true);
      assert.strictEqual(alphaUpcoming.some((m) => m.title === "Beta Design Review"), false);

      assert.strictEqual(betaUpcoming.some((m) => m.title === "Beta Design Review"), true);
      assert.strictEqual(betaUpcoming.some((m) => m.title === "Alpha Sprint Planning"), false);
    });
  });
});
