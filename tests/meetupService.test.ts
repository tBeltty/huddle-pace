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
});
