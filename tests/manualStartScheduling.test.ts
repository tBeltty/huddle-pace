import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MeetupService } from "../src/services/meetupService.js";
import { prisma } from "../src/db/client.js";

const teamId = `T_TEST_${randomUUID()}`;
const channelId = "C_SCHED";
const minutes = (count: number) => count * 60_000;
const at = (offsetMinutes: number) => new Date(Date.UTC(2026, 9, 7, 17, 0) + minutes(offsetMinutes));

async function createPace(overrides: Partial<Parameters<typeof MeetupService.createMeetup>[0]> = {}) {
  return await MeetupService.createMeetup({
    title: "Pace",
    totalMinutes: 30,
    channelId,
    speakerUserId: "U_SPEAKER",
    createdByUserId: "U_CREATOR",
    teamId,
    scheduledFor: at(0),
    modules: [{ title: "Topic", percentage: 100 }],
    ...overrides,
  });
}

describe("scheduling conflicts and Manual start", () => {
  after(async () => {
    await prisma.meetup.deleteMany({ where: { teamId } });
  });

  describe("findScheduleConflict", () => {
    test("blocks times within 20 minutes of another pace in the same channel, edges included", async () => {
      const existing = await createPace({ channelId: "C_CONFLICT", title: "Standup Ventas" });
      for (const offset of [-20, -5, 0, 20]) {
        const conflict = await MeetupService.findScheduleConflict("C_CONFLICT", teamId, at(offset));
        assert.strictEqual(conflict?.id, existing.id, `offset ${offset}`);
      }
    });

    test("allows times just outside the window and back-to-back paces", async () => {
      await createPace({ channelId: "C_OUTSIDE" });
      assert.strictEqual(await MeetupService.findScheduleConflict("C_OUTSIDE", teamId, at(21)), null);
      assert.strictEqual(await MeetupService.findScheduleConflict("C_OUTSIDE", teamId, at(-21)), null);
      assert.strictEqual(await MeetupService.findScheduleConflict("C_OUTSIDE", teamId, at(30)), null);
    });

    test("ignores other channels and the pace being edited", async () => {
      const existing = await createPace({ channelId: "C_ONE" });
      assert.strictEqual(await MeetupService.findScheduleConflict("C_OTHER", teamId, at(0)), null);
      assert.strictEqual(await MeetupService.findScheduleConflict("C_ONE", teamId, at(0), existing.id), null);
    });

    test("paces saved for manual start do not conflict", async () => {
      await createPace({ channelId: "C_MANUAL_ONLY", manualStart: true });
      assert.strictEqual(await MeetupService.findScheduleConflict("C_MANUAL_ONLY", teamId, at(0)), null);
    });
  });

  describe("manual start codes", () => {
    test("assigns m1, m2, m3 per channel and reuses a freed code", async () => {
      const first = await createPace({ channelId: "C_CODES", manualStart: true });
      const second = await createPace({ channelId: "C_CODES", manualStart: true });
      assert.deepStrictEqual([first.manualStartCode, second.manualStartCode], ["m1", "m2"]);
      assert.strictEqual(first.status, "MANUAL_START");

      const otherChannel = await createPace({ channelId: "C_CODES_OTHER", manualStart: true });
      assert.strictEqual(otherChannel.manualStartCode, "m1");

      await MeetupService.claimMeetupForLaunch(first.id);
      assert.strictEqual(await MeetupService.nextManualStartCode("C_CODES", teamId), "m1");
    });

    test("finds a pace by code, case-insensitively, only in its channel", async () => {
      const pace = await createPace({ channelId: "C_FIND", manualStart: true });
      assert.strictEqual((await MeetupService.findManualStartMeetup("C_FIND", "M1", teamId))?.id, pace.id);
      assert.strictEqual(await MeetupService.findManualStartMeetup("C_ELSEWHERE", "m1", teamId), null);
    });

    test("moveToManualStart takes the next code and only works on SCHEDULED paces", async () => {
      const pace = await createPace({ channelId: "C_MOVE" });
      const moved = await MeetupService.moveToManualStart(pace.id);
      assert.strictEqual(moved?.status, "MANUAL_START");
      assert.strictEqual(moved?.manualStartCode, "m1");
      assert.strictEqual(await MeetupService.moveToManualStart(pace.id), null);
    });
  });

  describe("claimMeetupForLaunch", () => {
    test("only one of two simultaneous claims wins", async () => {
      const pace = await createPace({ channelId: "C_CLAIM" });
      const results = await Promise.all([
        MeetupService.claimMeetupForLaunch(pace.id),
        MeetupService.claimMeetupForLaunch(pace.id),
      ]);
      assert.strictEqual(results.filter((result) => result !== null).length, 1);
      assert.strictEqual((await MeetupService.getMeetupById(pace.id))?.status, "ACTIVE");
    });

    test("a released claim returns the pace to its previous status and code", async () => {
      const pace = await createPace({ channelId: "C_RELEASE", manualStart: true });
      const previous = await MeetupService.claimMeetupForLaunch(pace.id);
      assert.strictEqual(previous, "MANUAL_START");
      await MeetupService.releaseLaunchClaim(pace.id, "MANUAL_START", pace.manualStartCode);
      const restored = await MeetupService.getMeetupById(pace.id);
      assert.strictEqual(restored?.status, "MANUAL_START");
      assert.strictEqual(restored?.manualStartCode, "m1");
    });
  });

  describe("missed paces", () => {
    test("marks paces whose window closed as MISSED and leaves the rest", async () => {
      const now = at(60);
      const missed = await createPace({ channelId: "C_MISSED", scheduledFor: at(0) });
      const stillOpen = await createPace({ channelId: "C_MISSED", scheduledFor: at(45) });

      const moved = await MeetupService.markMissedMeetups(now);
      assert.ok(moved.some((meetup) => meetup.id === missed.id));
      assert.ok(!moved.some((meetup) => meetup.id === stillOpen.id));
      assert.strictEqual((await MeetupService.getMeetupById(missed.id))?.status, "MISSED");
      assert.strictEqual((await MeetupService.getMeetupById(stillOpen.id))?.status, "SCHEDULED");
    });

    test("a missed pace gets no manual start code and is not capturable", async () => {
      const pace = await createPace({ channelId: "C_MISSED_OUT", scheduledFor: at(0) });
      await MeetupService.markMissedMeetups(at(60));
      assert.strictEqual((await MeetupService.getMeetupById(pace.id))?.manualStartCode, null);
      assert.strictEqual(await MeetupService.findPendingScheduledMeetup("C_MISSED_OUT", teamId, { anyTime: true }), null);
      assert.strictEqual(await MeetupService.claimMeetupForLaunch(pace.id), null);
    });

    test("a missed pace does not block scheduling in its old slot", async () => {
      await createPace({ channelId: "C_MISSED_FREE", scheduledFor: at(0) });
      await MeetupService.markMissedMeetups(at(60));
      assert.strictEqual(await MeetupService.findScheduleConflict("C_MISSED_FREE", teamId, at(0)), null);
    });

    test("rescheduling a missed pace puts it back to SCHEDULED at the new time", async () => {
      const pace = await createPace({ channelId: "C_RESCHEDULE", scheduledFor: at(0) });
      await MeetupService.markMissedMeetups(at(60));

      const updated = await MeetupService.updateScheduledMeetup(pace.id, {
        title: pace.title,
        totalMinutes: pace.totalMinutes,
        channelId: pace.channelId,
        speakerUserId: pace.speakerUserId,
        scheduledFor: at(180),
        modules: [{ title: "Topic", percentage: 100 }],
      });
      assert.strictEqual(updated?.status, "SCHEDULED");
      assert.strictEqual(updated?.scheduledFor?.getTime(), at(180).getTime());
      assert.strictEqual(
        (await MeetupService.findPendingScheduledMeetup("C_RESCHEDULE", teamId, { anyTime: true }))?.id,
        pace.id
      );
    });

    test("lists missed paces for the workspace, newest first", async () => {
      const older = await createPace({ channelId: "C_LIST", scheduledFor: at(0) });
      const newer = await createPace({ channelId: "C_LIST_B", scheduledFor: at(10) });
      await MeetupService.markMissedMeetups(at(120));
      const ids = (await MeetupService.getMissedMeetups(teamId)).map((meetup) => meetup.id);
      assert.ok(ids.indexOf(newer.id) < ids.indexOf(older.id));
    });
  });

  describe("pickClosestToNow without the window", () => {
    test("an explicit request takes the nearest pace even far outside the window", () => {
      const picked = MeetupService.pickClosestToNow(
        [{ id: "later", scheduledFor: at(300) }, { id: "sooner", scheduledFor: at(120) }],
        at(0),
        Infinity
      );
      assert.strictEqual(picked?.id, "sooner");
    });
  });

  describe("canUserStartMeetup", () => {
    const pace = { speakerUserId: "U_A, U_B", createdByUserId: "U_CREATOR", teamId };
    const regularClient = { users: { info: async () => ({ ok: true, user: { is_admin: false } }) } };
    const adminClient = { users: { info: async () => ({ ok: true, user: { is_admin: true } }) } };

    test("speakers and the creator can start it", async () => {
      assert.strictEqual(await MeetupService.canUserStartMeetup(regularClient, pace, "U_B"), true);
      assert.strictEqual(await MeetupService.canUserStartMeetup(regularClient, pace, "U_CREATOR"), true);
    });

    test("workspace managers can start it, other members cannot", async () => {
      assert.strictEqual(await MeetupService.canUserStartMeetup(adminClient, pace, "U_ADMIN"), true);
      assert.strictEqual(await MeetupService.canUserStartMeetup(regularClient, pace, "U_STRANGER"), false);
    });
  });
});
