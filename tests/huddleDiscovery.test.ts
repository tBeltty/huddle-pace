import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isHuddleMessage,
  isHuddleEnded,
  findChannelHuddles,
  findActiveHuddleThread,
} from "../src/slack/utils/huddleDiscovery.js";

describe("Huddle Discovery & Multi-Lingual Thread Binding", () => {
  describe("isHuddleMessage", () => {
    test("detects standard English huddle start messages", () => {
      assert.strictEqual(isHuddleMessage({ text: "started a huddle" }), true);
      assert.strictEqual(isHuddleMessage({ text: "joined the huddle" }), true);
      assert.strictEqual(isHuddleMessage({ text: "huddle started in #general" }), true);
    });

    test("detects Spanish huddle messages", () => {
      assert.strictEqual(isHuddleMessage({ text: "Jhonatan inició un huddle" }), true);
      assert.strictEqual(isHuddleMessage({ text: "se unió al huddle" }), true);
      assert.strictEqual(isHuddleMessage({ text: "huddle iniciado" }), true);
    });

    test("detects room object and huddle subtypes", () => {
      assert.strictEqual(isHuddleMessage({ room: { id: "R123", name: "Standup" } }), true);
      assert.strictEqual(isHuddleMessage({ subtype: "huddle_thread" }), true);
      assert.strictEqual(isHuddleMessage({ subtype: "sh_room_created" }), true);
      assert.strictEqual(isHuddleMessage({ subtype: "channel_huddle" }), true);
    });

    test("detects huddle keyword inside JSON block structure", () => {
      const complexMsg = {
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "A new Huddle is live in this room." },
          },
        ],
      };
      assert.strictEqual(isHuddleMessage(complexMsg), true);
    });

    test("negative control: rejects normal messages without huddle context", () => {
      assert.strictEqual(isHuddleMessage({ text: "Hey team, how is the project going?" }), false);
      assert.strictEqual(isHuddleMessage({ text: "Good morning everyone!" }), false);
      assert.strictEqual(isHuddleMessage(null), false);
      assert.strictEqual(isHuddleMessage(undefined), false);
    });
  });

  describe("isHuddleEnded", () => {
    test("detects English completion indicators", () => {
      assert.strictEqual(isHuddleEnded({ text: "huddle ended" }), true);
      assert.strictEqual(isHuddleEnded({ text: "ended a huddle" }), true);
      assert.strictEqual(isHuddleEnded({ text: "call ended" }), true);
    });

    test("detects Spanish completion indicators", () => {
      assert.strictEqual(isHuddleEnded({ text: "huddle finalizado" }), true);
      assert.strictEqual(isHuddleEnded({ text: "finalizó el huddle" }), true);
      assert.strictEqual(isHuddleEnded({ text: "terminó el huddle" }), true);
    });

    test("detects room.has_ended and room.date_end", () => {
      assert.strictEqual(isHuddleEnded({ room: { has_ended: true } }), true);
      assert.strictEqual(isHuddleEnded({ room: { date_end: 1726000000 } }), true);
    });

    test("negative control: returns false for active huddles", () => {
      assert.strictEqual(isHuddleEnded({ text: "started a huddle", room: { has_ended: false } }), false);
      assert.strictEqual(isHuddleEnded({ text: "inició un huddle" }), false);
    });
  });

  describe("findChannelHuddles & findActiveHuddleThread", () => {
    test("resolves active Spanish Huddle and extracts room name", async () => {
      const mockClient = {
        conversations: {
          join: async () => ({ ok: true }),
          history: async () => ({
            messages: [
              {
                ts: "1726000100.000100",
                text: "Jhonatan inició un huddle: Daily Sync",
                user: "U_SPEAKER_1",
              },
            ],
          }),
        },
      };

      const huddles = await findChannelHuddles(mockClient, "C_TEST_CHANNEL");
      assert.strictEqual(huddles.length, 1);
      assert.strictEqual(huddles[0].isActive, true);
      assert.strictEqual(huddles[0].ts, "1726000100.000100");
      assert.strictEqual(huddles[0].roomName, "Daily Sync");
      assert.strictEqual(huddles[0].createdBy, "U_SPEAKER_1");

      const activeThread = await findActiveHuddleThread(mockClient, "C_TEST_CHANNEL");
      assert.strictEqual(activeThread, "1726000100.000100");
    });

    test("deduplicates in-huddle thread replies to root thread_ts", async () => {
      const rootTs = "1726000100.000100";
      const mockClient = {
        conversations: {
          join: async () => ({ ok: true }),
          history: async () => ({
            messages: [
              {
                ts: "1726000150.000200",
                thread_ts: rootTs,
                text: "Here is the meeting notes link for this huddle",
              },
              {
                ts: rootTs,
                text: "started a huddle: Architecture Review",
                room: { name: "Architecture Review", has_ended: false },
              },
            ],
          }),
        },
      };

      const huddles = await findChannelHuddles(mockClient, "C_TEST_CHANNEL");
      assert.strictEqual(huddles.length, 1);
      assert.strictEqual(huddles[0].ts, rootTs);
      assert.strictEqual(huddles[0].isActive, true);
    });

    test("returns empty array when no huddles exist (negative control)", async () => {
      const mockClient = {
        conversations: {
          join: async () => ({ ok: true }),
          history: async () => ({
            messages: [
              { ts: "1726000000.000001", text: "Hello channel!" },
              { ts: "1726000000.000002", text: "Reviewing pull request now." },
            ],
          }),
        },
      };

      const huddles = await findChannelHuddles(mockClient, "C_TEST_CHANNEL");
      assert.strictEqual(huddles.length, 0);

      const activeThread = await findActiveHuddleThread(mockClient, "C_TEST_CHANNEL");
      assert.strictEqual(activeThread, null);
    });
  });
});
