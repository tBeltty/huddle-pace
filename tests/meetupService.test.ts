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
});
