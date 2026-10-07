import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MeetupService } from "../src/services/meetupService.js";

describe("MeetupService calculations and parsing", () => {
  describe("parseSpeakerIds", () => {
    test("splits comma separated IDs and trims whitespace", () => {
      const ids = MeetupService.parseSpeakerIds("U123, U456 , U789");
      assert.deepStrictEqual(ids, ["U123", "U456", "U789"]);
    });

    test("handles empty string gracefully", () => {
      const ids = MeetupService.parseSpeakerIds("");
      assert.deepStrictEqual(ids, []);
    });
  });

  describe("formatSpeakerMentions", () => {
    test("formats single speaker mention", () => {
      const formatted = MeetupService.formatSpeakerMentions("U123");
      assert.strictEqual(formatted, "<@U123>");
    });

    test("formats multiple speaker mentions", () => {
      const formatted = MeetupService.formatSpeakerMentions("U123, U456");
      assert.strictEqual(formatted, "<@U123>, <@U456>");
    });

    test("returns 'Not specified' when empty", () => {
      const formatted = MeetupService.formatSpeakerMentions("");
      assert.strictEqual(formatted, "Not specified");
    });
  });

  describe("calculateModuleAllocations", () => {
    test("computes exact minute allocations for 60m meetup with 50/30/20 split", () => {
      const modules = [
        { title: "Intro", percentage: 50 },
        { title: "Demo", percentage: 30 },
        { title: "Q&A", percentage: 20 },
      ];
      const allocations = MeetupService.calculateModuleAllocations(60, modules);

      assert.strictEqual(allocations.length, 3);
      assert.strictEqual(allocations[0].durationMinutes, 30);
      assert.strictEqual(allocations[0].startOffsetMin, 0);
      assert.strictEqual(allocations[0].endOffsetMin, 30);

      assert.strictEqual(allocations[1].durationMinutes, 18);
      assert.strictEqual(allocations[1].startOffsetMin, 30);
      assert.strictEqual(allocations[1].endOffsetMin, 48);

      assert.strictEqual(allocations[2].durationMinutes, 12);
      assert.strictEqual(allocations[2].startOffsetMin, 48);
      assert.strictEqual(allocations[2].endOffsetMin, 60);

      const totalAllocated = allocations.reduce((sum, m) => sum + m.durationMinutes, 0);
      assert.strictEqual(totalAllocated, 60);
    });

    test("reconciles rounding discrepancies to sum exactly to totalMinutes", () => {
      const modules = [
        { title: "Part 1", percentage: 33 },
        { title: "Part 2", percentage: 33 },
        { title: "Part 3", percentage: 34 },
      ];
      const allocations = MeetupService.calculateModuleAllocations(45, modules);

      const totalAllocated = allocations.reduce((sum, m) => sum + m.durationMinutes, 0);
      assert.strictEqual(totalAllocated, 45);
      assert.strictEqual(allocations[2].endOffsetMin, 45);
    });

    test("throws error if percentage does not equal 100", () => {
      const modules = [
        { title: "Intro", percentage: 40 },
        { title: "Demo", percentage: 50 },
      ];
      assert.throws(
        () => MeetupService.calculateModuleAllocations(60, modules),
        /Total percentage must equal 100%/
      );
    });

    test("throws error if modules array is empty", () => {
      assert.throws(
        () => MeetupService.calculateModuleAllocations(60, []),
        /At least one topic module is required/
      );
    });
  });

  describe("extendMeetup", () => {
    test("extends meetup totalMinutes and the final module duration", async () => {
      const created = await MeetupService.createMeetup({
        title: "Architecture Review",
        totalMinutes: 30,
        channelId: "C123_TEST",
        speakerUserId: "U_USER",
        teamId: "T_TEST_EXT",
        modules: [
          { title: "Intro", percentage: 50 },
          { title: "Discussion", percentage: 50 },
        ],
      });

      const extended = await MeetupService.extendMeetup(created.id, 10);
      assert.strictEqual(extended.totalMinutes, 40);
      assert.strictEqual(extended.status, "ACTIVE");

      const lastModule = extended.modules[extended.modules.length - 1];
      assert.strictEqual(lastModule.durationMinutes, 25); // 15 + 10
      assert.strictEqual(lastModule.endOffsetMin, 40);
    });

    test("fails when extending non-existent meetup (negative control)", async () => {
      await assert.rejects(
        () => MeetupService.extendMeetup("non-existent-id", 5),
        /not found/
      );
    });
  });

  describe("skipToNextModule", () => {
    test("advances active meetup to next module and transfers saved minutes", async () => {
      const created = await MeetupService.createMeetup({
        title: "Sprint Retro",
        totalMinutes: 30,
        channelId: "C123_SKIP",
        speakerUserId: "U_SPEAKER",
        teamId: "T_TEST_SKIP",
        modules: [
          { title: "Review", percentage: 50 }, // 15m (0-15)
          { title: "Action Items", percentage: 50 }, // 15m (15-30)
        ],
      });

      // Start meetup with startedAt 5 minutes ago
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      await MeetupService.startMeetup(created.id, "123.456", "123.456");
      const { prisma } = await import("../src/db/client.js");
      await prisma.meetup.update({
        where: { id: created.id },
        data: { startedAt: fiveMinAgo },
      });

      const updated = await MeetupService.skipToNextModule(created.id);
      assert.ok(updated);
      assert.strictEqual(updated.modules.length, 2);

      const mod1 = updated.modules[0];
      const mod2 = updated.modules[1];

      // Mod 1 should end at ~5m
      assert.strictEqual(mod1.endOffsetMin, 5);
      assert.strictEqual(mod1.durationMinutes, 5);

      // Mod 2 should start at 5m and absorb the 10m saved: 5 to 30 = 25m duration!
      assert.strictEqual(mod2.startOffsetMin, 5);
      assert.strictEqual(mod2.endOffsetMin, 30);
      assert.strictEqual(mod2.durationMinutes, 25);
    });

    test("returns null when called on final module", async () => {
      const created = await MeetupService.createMeetup({
        title: "Single Topic",
        totalMinutes: 10,
        channelId: "C123_SINGLE",
        speakerUserId: "U_SPEAKER",
        teamId: "T_TEST_SINGLE",
        modules: [{ title: "Solo Topic", percentage: 100 }],
      });

      await MeetupService.startMeetup(created.id, "123.456", "123.456");
      const result = await MeetupService.skipToNextModule(created.id);
      assert.strictEqual(result, null);
    });

    test("fails when called on non-existent meetup (negative control)", async () => {
      await assert.rejects(
        () => MeetupService.skipToNextModule("non-existent-id"),
        /not found/
      );
    });
  });

  describe("calculateGraceMinutes & Flexibility Analytics", () => {
    test("calculates proportional grace minutes with minimum of 3m", () => {
      assert.strictEqual(MeetupService.calculateGraceMinutes(15), 3);
      assert.strictEqual(MeetupService.calculateGraceMinutes(20), 3);
      assert.strictEqual(MeetupService.calculateGraceMinutes(30), 5);
      assert.strictEqual(MeetupService.calculateGraceMinutes(45), 8);
      assert.strictEqual(MeetupService.calculateGraceMinutes(60), 10);
      assert.strictEqual(MeetupService.calculateGraceMinutes(90), 15);
      assert.strictEqual(MeetupService.calculateGraceMinutes(120), 20);
    });

    test("supports STRICT, STANDARD, and RELAXED flexibility modes in calculateGraceMinutes", () => {
      // STRICT mode: 0 minutes grace buffer
      assert.strictEqual(MeetupService.calculateGraceMinutes(15, "STRICT"), 0);
      assert.strictEqual(MeetupService.calculateGraceMinutes(60, "STRICT"), 0);

      // STANDARD mode: ~16.7% buffer (min 3m)
      assert.strictEqual(MeetupService.calculateGraceMinutes(15, "STANDARD"), 3);
      assert.strictEqual(MeetupService.calculateGraceMinutes(60, "STANDARD"), 10);

      // RELAXED mode: 25% buffer (min 5m)
      assert.strictEqual(MeetupService.calculateGraceMinutes(15, "RELAXED"), 5);
      assert.strictEqual(MeetupService.calculateGraceMinutes(60, "RELAXED"), 15);
    });

    test("manages workspace settings lifecycle (get, update, and delegated managers)", async () => {
      const teamId = "T_SETTINGS_TEST_" + Date.now();

      // Default settings
      const defaultSettings = await MeetupService.getWorkspaceSettings(teamId);
      assert.strictEqual(defaultSettings.reminderTextEnabled, true);
      assert.strictEqual(defaultSettings.reminderImageEnabled, false);
      assert.strictEqual(defaultSettings.flexibilityMode, "STANDARD");
      assert.deepStrictEqual(defaultSettings.managerUserIds, []);

      // Update settings with delegated managers
      await MeetupService.updateWorkspaceSettings(teamId, {
        reminderTextEnabled: false,
        reminderImageEnabled: true,
        flexibilityMode: "STRICT",
        managerUserIds: ["U_MGR1", "U_MGR2"],
      });

      const updatedSettings = await MeetupService.getWorkspaceSettings(teamId);
      assert.strictEqual(updatedSettings.reminderTextEnabled, false);
      assert.strictEqual(updatedSettings.reminderImageEnabled, true);
      assert.strictEqual(updatedSettings.flexibilityMode, "STRICT");
      assert.deepStrictEqual(updatedSettings.managerUserIds, ["U_MGR1", "U_MGR2"]);
    });

    test("isUserWorkspaceManager correctly evaluates admin, installer, manager, and member roles", async () => {
      const { prisma } = await import("../src/db/client.js");
      const teamId = "T_ROLE_TEST_" + Date.now();

      // Setup workspace settings with delegated manager
      await MeetupService.updateWorkspaceSettings(teamId, {
        managerUserIds: ["U_DELEGATED_MANAGER"],
      });

      // Setup installation with installer
      await prisma.slackInstallation.create({
        data: {
          teamId,
          installedByUserId: "U_INSTALLER",
          installationData: JSON.stringify({ ok: true }),
        },
      });

      const mockAdminClient = {
        users: {
          info: async ({ user }: { user: string }) => {
            if (user === "U_SLACK_ADMIN") {
              return { ok: true, user: { is_admin: true, is_owner: false } };
            }
            if (user === "U_SLACK_OWNER") {
              return { ok: true, user: { is_admin: false, is_owner: true } };
            }
            return { ok: true, user: { is_admin: false, is_owner: false, is_primary_owner: false } };
          },
        },
      };

      // 1. Delegated Bot Manager
      const isManager = await MeetupService.isUserWorkspaceManager(mockAdminClient, "U_DELEGATED_MANAGER", teamId);
      assert.strictEqual(isManager, true, "Delegated manager should have access");

      // 2. Installer
      const isInstaller = await MeetupService.isUserWorkspaceManager(mockAdminClient, "U_INSTALLER", teamId);
      assert.strictEqual(isInstaller, true, "App installer should have access");

      // 3. Slack Workspace Admin
      const isAdmin = await MeetupService.isUserWorkspaceManager(mockAdminClient, "U_SLACK_ADMIN", teamId);
      assert.strictEqual(isAdmin, true, "Slack admin should have access");

      // 4. Slack Workspace Owner
      const isOwner = await MeetupService.isUserWorkspaceManager(mockAdminClient, "U_SLACK_OWNER", teamId);
      assert.strictEqual(isOwner, true, "Slack owner should have access");

      // 5. Negative Control: Regular workspace member without special roles
      const isMember = await MeetupService.isUserWorkspaceManager(mockAdminClient, "U_REGULAR_MEMBER", teamId);
      assert.strictEqual(isMember, false, "Regular member should NOT have manager access");

      // Negative Control: Nonexistent or empty user ID
      const isEmpty = await MeetupService.isUserWorkspaceManager(mockAdminClient, "", teamId);
      assert.strictEqual(isEmpty, false, "Empty user ID should not have access");
    });

    test("counts sessions within grace buffer as compliant (flexible) without penalizing team", async () => {
      const { prisma } = await import("../src/db/client.js");
      const teamId = "T_GRACE_TEST_" + Date.now();
      
      // Meeting 1: 60m budget, took 64m (4m over, within 10m grace) -> isOnTime = true, isWithinGrace = true
      const m1 = await MeetupService.createMeetup({
        title: "Architecture Sync",
        totalMinutes: 60,
        channelId: "C_GRACE",
        speakerUserId: "U_GRACE_1",
        teamId,
        modules: [{ title: "Deep Dive", percentage: 100 }],
      });
      const started1 = new Date(Date.now() - 64 * 60 * 1000);
      const ended1 = new Date();
      await prisma.meetup.update({
        where: { id: m1.id },
        data: {
          status: "COMPLETED",
          startedAt: started1,
          formalEndsAt: ended1,
          endsAt: ended1,
        },
      });

      // Meeting 2: 60m budget, took 75m (15m over, exceeds 10m grace) -> isOnTime = false, isWithinGrace = false
      const m2 = await MeetupService.createMeetup({
        title: "Extended Workshop",
        totalMinutes: 60,
        channelId: "C_GRACE",
        speakerUserId: "U_GRACE_2",
        teamId,
        modules: [{ title: "Workshop", percentage: 100 }],
      });
      const started2 = new Date(Date.now() - 75 * 60 * 1000);
      const ended2 = new Date();
      await prisma.meetup.update({
        where: { id: m2.id },
        data: {
          status: "COMPLETED",
          startedAt: started2,
          formalEndsAt: ended2,
          endsAt: ended2,
        },
      });

      const stats = await MeetupService.getPacingReportStats(30, teamId);
      assert.strictEqual(stats.totalSessions, 2);
      assert.strictEqual(stats.completedOnTime, 1);
      assert.strictEqual(stats.complianceRate, 50);

      const session1 = stats.recentSessions.find((s) => s.id === m1.id);
      assert.ok(session1);
      assert.strictEqual(session1.isOnTime, true);
      assert.strictEqual(session1.isWithinGrace, true);
      assert.strictEqual(session1.graceMinutes, 10);

      const session2 = stats.recentSessions.find((s) => s.id === m2.id);
      assert.ok(session2);
      assert.strictEqual(session2.isOnTime, false);
      assert.strictEqual(session2.isWithinGrace, false);
    });

    test("strict mode in workspace settings denies grace period", async () => {
      const { prisma } = await import("../src/db/client.js");
      const teamId = "T_STRICT_TEST_" + Date.now();

      await MeetupService.updateWorkspaceSettings(teamId, {
        flexibilityMode: "STRICT",
      });

      const m = await MeetupService.createMeetup({
        title: "Strict Standup",
        totalMinutes: 15,
        channelId: "C_STRICT",
        speakerUserId: "U_STRICT",
        teamId,
        modules: [{ title: "Status", percentage: 100 }],
      });

      // Took 17 minutes (2m over on a 15m budget)
      const started = new Date(Date.now() - 17 * 60 * 1000);
      const ended = new Date();
      await prisma.meetup.update({
        where: { id: m.id },
        data: {
          status: "COMPLETED",
          startedAt: started,
          formalEndsAt: ended,
          endsAt: ended,
        },
      });

      const stats = await MeetupService.getPacingReportStats(30, teamId);
      assert.strictEqual(stats.completedOnTime, 0);
      assert.strictEqual(stats.complianceRate, 0);

      const session = stats.recentSessions.find((s) => s.id === m.id);
      assert.ok(session);
      assert.strictEqual(session.isOnTime, false);
      assert.strictEqual(session.isWithinGrace, false);
      assert.strictEqual(session.graceMinutes, 0);
    });
  });
  describe("analytics privacy", () => {
    async function completed(teamId: string, speaker: string, creator: string | null, isPrivate: boolean) {
      const { prisma } = await import("../src/db/client.js");
      const m = await MeetupService.createMeetup({
        title: `Sync ${speaker} ${isPrivate ? "private" : "public"}`,
        totalMinutes: 30,
        channelId: "C_PRIV",
        speakerUserId: speaker,
        createdByUserId: creator,
        isPrivate,
        teamId,
        modules: [{ title: "Talk", percentage: 100 }],
      });
      const started = new Date(Date.now() - 20 * 60 * 1000);
      const ended = new Date();
      await prisma.meetup.update({
        where: { id: m.id },
        data: { status: "COMPLETED", startedAt: started, formalEndsAt: ended, endsAt: ended },
      });
      return m.id;
    }

    test("managers see workspace meetups without private ones", async () => {
      const teamId = "T_PRIV_MGR_" + Date.now();
      const pub = await completed(teamId, "U_A", "U_A", false);
      await completed(teamId, "U_A", "U_A", true);
      const stats = await MeetupService.getPacingReportStats(30, teamId, { userId: "U_ADMIN", isManager: true });
      assert.strictEqual(stats.scope, "workspace");
      assert.deepStrictEqual(stats.recentSessions.map((s) => s.id), [pub]);
    });

    test("members see only meetups they spoke in or created, private included", async () => {
      const teamId = "T_PRIV_MEM_" + Date.now();
      const own = await completed(teamId, "U_ME", "U_ME", false);
      const ownPrivate = await completed(teamId, "U_ME", "U_ME", true);
      const created = await completed(teamId, "U_OTHER", "U_ME", false);
      const spokeOnly = await completed(teamId, "U_X, U_ME", null, false);
      await completed(teamId, "U_OTHER", "U_OTHER", false);
      const stats = await MeetupService.getPacingReportStats(30, teamId, { userId: "U_ME", isManager: false });
      assert.strictEqual(stats.scope, "personal");
      assert.deepStrictEqual(
        stats.recentSessions.map((s) => s.id).sort(),
        [own, ownPrivate, created, spokeOnly].sort()
      );
    });
  });
});

