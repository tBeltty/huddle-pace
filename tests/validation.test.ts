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

    test("succeeds with valid HTTP OAuth mode environment variables and optional SLACK_REDIRECT_URI", () => {
      const validOAuthEnv = {
        SOCKET_MODE: "false",
        SLACK_SIGNING_SECRET: "mock-signing-secret",
        SLACK_CLIENT_ID: "mock-client-id",
        SLACK_CLIENT_SECRET: "mock-client-secret",
        SLACK_STATE_SECRET: "mock-state-secret",
        SLACK_REDIRECT_URI: "https://huddlepace.com/slack/oauth_redirect",
        PORT: 4000,
      };
      const result = envSchema.safeParse(validOAuthEnv);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.SOCKET_MODE, false);
        assert.strictEqual(result.data.PORT, 4000);
        assert.strictEqual(
          result.data.SLACK_REDIRECT_URI,
          "https://huddlepace.com/slack/oauth_redirect"
        );
      }
    });

    test("fails when SLACK_REDIRECT_URI is not a valid URL (negative control)", () => {
      const invalidOAuthEnv = {
        SOCKET_MODE: "false",
        SLACK_SIGNING_SECRET: "mock-signing-secret",
        SLACK_CLIENT_ID: "mock-client-id",
        SLACK_CLIENT_SECRET: "mock-client-secret",
        SLACK_STATE_SECRET: "mock-state-secret",
        SLACK_REDIRECT_URI: "not-a-valid-url",
      };
      const result = envSchema.safeParse(invalidOAuthEnv);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(
          result.error.issues.some((i) => i.path[0] === "SLACK_REDIRECT_URI"),
          true
        );
      }
    });

    test("fails when OAuth secrets are missing in HTTP mode (negative control)", () => {
      const invalidOAuthEnv = {
        SOCKET_MODE: "false",
        SLACK_SIGNING_SECRET: "mock-signing-secret",
      };
      const result = envSchema.safeParse(invalidOAuthEnv);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        assert.strictEqual(paths.includes("SLACK_CLIENT_ID"), true);
        assert.strictEqual(paths.includes("SLACK_CLIENT_SECRET"), true);
        assert.strictEqual(paths.includes("SLACK_STATE_SECRET"), true);
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

    test("passes with custom duration positive integers (15m, 25m, 75m)", () => {
      for (const mins of [15, 25, 75]) {
        const result = scheduleModalInputSchema.safeParse({
          ...validPayload,
          totalMinutes: mins,
        });
        assert.strictEqual(result.success, true);
        if (result.success) {
          assert.strictEqual(result.data.totalMinutes, mins);
        }
      }
    });

    test("fails when totalMinutes is non-positive (negative control)", () => {
      const invalid = {
        ...validPayload,
        totalMinutes: 0,
      };
      const result = scheduleModalInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(
          result.error.issues.some((i) => i.path[0] === "totalMinutes"),
          true
        );
      }
    });

    test("fails when totalMinutes is a decimal (negative control)", () => {
      const invalid = {
        ...validPayload,
        totalMinutes: 45.5,
      };
      const result = scheduleModalInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(
          result.error.issues.some((i) => i.path[0] === "totalMinutes"),
          true
        );
      }
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
