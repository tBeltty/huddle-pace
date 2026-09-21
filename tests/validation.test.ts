import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  scheduleModalInputSchema,
  subtopicInputSchema,
} from "../src/slack/schemas/scheduleSchema.js";
import { envSchema } from "../src/config/env.js";

describe("Zod Runtime Validation Schemas", () => {
  describe("envSchema", () => {
    test("succeeds with valid environment variables", () => {
      const validEnv = {
        SLACK_BOT_TOKEN: "xoxb-valid-bot-token",
        SLACK_APP_TOKEN: "xapp-valid-app-token",
        DATABASE_URL: "file:./dev.db",
        NODE_ENV: "development",
      };
      const result = envSchema.safeParse(validEnv);
      assert.strictEqual(result.success, true);
    });

    test("fails when SLACK_BOT_TOKEN is missing (negative control)", () => {
      const invalidEnv = {
        SLACK_APP_TOKEN: "xapp-valid-app-token",
      };
      const result = envSchema.safeParse(invalidEnv);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const issues = result.error.issues.filter(
          (i) => i.path[0] === "SLACK_BOT_TOKEN"
        );
        assert.strictEqual(issues.length > 0, true);
      }
    });

    test("fails when SLACK_APP_TOKEN is missing (negative control)", () => {
      const invalidEnv = {
        SLACK_BOT_TOKEN: "xoxb-valid-bot-token",
      };
      const result = envSchema.safeParse(invalidEnv);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const issues = result.error.issues.filter(
          (i) => i.path[0] === "SLACK_APP_TOKEN"
        );
        assert.strictEqual(issues.length > 0, true);
      }
    });
  });

  describe("scheduleModalInputSchema", () => {
    const validPayload = {
      title: "Architecture Sync",
      channelId: "C123456",
      totalMinutes: 60,
      speakerUserId: "U999",
      threadTs: null,
      modules: [
        { title: "Topic 1", percentage: 40 },
        { title: "Topic 2", percentage: 60 },
      ],
    };

    test("passes with 100% timebox and valid parameters", () => {
      const result = scheduleModalInputSchema.safeParse(validPayload);
      assert.strictEqual(result.success, true);
    });

    test("fails when percentages sum to less than 100% (negative control)", () => {
      const invalid = {
        ...validPayload,
        modules: [
          { title: "Topic 1", percentage: 30 },
          { title: "Topic 2", percentage: 40 },
        ],
      };
      const result = scheduleModalInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const has100Err = result.error.issues.some((i) =>
          i.message.includes("Total must equal 100%")
        );
        assert.strictEqual(has100Err, true);
      }
    });

    test("fails when percentages sum to greater than 100% (negative control)", () => {
      const invalid = {
        ...validPayload,
        modules: [
          { title: "Topic 1", percentage: 60 },
          { title: "Topic 2", percentage: 50 },
        ],
      };
      const result = scheduleModalInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const has100Err = result.error.issues.some((i) =>
          i.message.includes("Total must equal 100%")
        );
        assert.strictEqual(has100Err, true);
      }
    });

    test("fails with negative or non-positive percentage (negative control)", () => {
      const invalid = {
        ...validPayload,
        modules: [
          { title: "Topic 1", percentage: -20 },
          { title: "Topic 2", percentage: 120 },
        ],
      };
      const result = scheduleModalInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    test("fails with empty title (negative control)", () => {
      const invalid = {
        ...validPayload,
        title: "   ",
      };
      const result = scheduleModalInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    test("fails with empty channel (negative control)", () => {
      const invalid = {
        ...validPayload,
        channelId: "",
      };
      const result = scheduleModalInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  describe("subtopicInputSchema", () => {
    test("rejects empty subtopic title", () => {
      const result = subtopicInputSchema.safeParse({
        title: "",
        percentage: 50,
      });
      assert.strictEqual(result.success, false);
    });

    test("rejects non-positive percentage", () => {
      const result = subtopicInputSchema.safeParse({
        title: "Intro",
        percentage: 0,
      });
      assert.strictEqual(result.success, false);
    });
  });
});
