import { describe, test } from "node:test";
import assert from "node:assert";
import { ensureBotInChannel } from "../src/slack/utils/channelUtils.js";

const slackError = (code: string) => Object.assign(new Error(code), { data: { error: code } });

function fakeClient(overrides: Record<string, () => Promise<any>>) {
  const ephemerals: any[] = [];
  const client = {
    conversations: {
      join: overrides.join ?? (async () => ({ ok: true })),
      info: overrides.info ?? (async () => ({ channel: { is_member: false } })),
      history: overrides.history ?? (async () => ({ ok: true, messages: [] })),
    },
    chat: {
      postEphemeral: async (args: any) => {
        ephemerals.push(args);
        return { ok: true };
      },
    },
  };
  return { client, ephemerals };
}

describe("ensureBotInChannel", () => {
  test("accepts a group message the bot is already in when info is not allowed", async () => {
    const { client, ephemerals } = fakeClient({
      join: async () => { throw slackError("method_not_supported_for_channel_type"); },
      info: async () => { throw slackError("missing_scope"); },
    });
    assert.deepStrictEqual(await ensureBotInChannel(client, "G123", "U1"), { ok: true });
    assert.strictEqual(ephemerals.length, 0);
  });

  test("asks for an invite when the bot is not in the conversation", async () => {
    const { client, ephemerals } = fakeClient({
      join: async () => { throw slackError("method_not_supported_for_channel_type"); },
      info: async () => { throw slackError("missing_scope"); },
      history: async () => { throw slackError("not_in_channel"); },
    });
    assert.deepStrictEqual(await ensureBotInChannel(client, "G123", "U1"), { ok: false, error: "not_in_channel" });
    assert.strictEqual(ephemerals.length, 1);
    assert.match(ephemerals[0].text, /group message/);
  });

  test("a public channel is joined without further checks", async () => {
    const { client } = fakeClient({});
    assert.deepStrictEqual(await ensureBotInChannel(client, "C123", "U1"), { ok: true });
  });
});
