import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createSlackApp } from "../src/slack/app.js";
import { _resetCachedEnvForTesting } from "../src/config/env.js";

describe("Slack App Factory & Initialization Gate", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetCachedEnvForTesting();
  });

  test("initializes successfully in Socket Mode with customRoutes and port", () => {
    process.env.SOCKET_MODE = "true";
    process.env.SLACK_BOT_TOKEN = "xoxb-mock-bot-token";
    process.env.SLACK_APP_TOKEN = "xapp-mock-app-token";
    process.env.PORT = "3000";
    _resetCachedEnvForTesting();

    const app = createSlackApp();
    assert.strictEqual(!!app, true);
  });

  test("initializes successfully in HTTP OAuth Mode with valid redirectUriPath", () => {
    process.env.SOCKET_MODE = "false";
    process.env.SLACK_SIGNING_SECRET = "mock-signing-secret";
    process.env.SLACK_CLIENT_ID = "mock-client-id";
    process.env.SLACK_CLIENT_SECRET = "mock-client-secret";
    process.env.SLACK_STATE_SECRET = "mock-state-secret";
    process.env.SLACK_REDIRECT_URI = "https://huddlepace.com/slack/oauth_redirect";
    process.env.PORT = "3000";
    _resetCachedEnvForTesting();

    const app = createSlackApp();
    assert.strictEqual(!!app, true);
  });
});
