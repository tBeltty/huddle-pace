/**
 * Ensures the bot is a member of the target channel before sending messages.
 * Automatically joins public channels using the channels:join scope.
 * If the channel is private and the bot is missing, sends a helpful ephemeral guide.
 */
export async function ensureBotInChannel(
  client: any,
  channelId: string,
  userId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await client.conversations.join({ channel: channelId });
    return { ok: true };
  } catch (error: any) {
    const errorCode = error?.data?.error;

    // Already in channel or joined successfully
    if (errorCode === "already_in_channel" || !errorCode) {
      return { ok: true };
    }

    // Private channel: auto-join not permitted by Slack API
    if (
      errorCode === "method_not_supported_for_channel_type" ||
      errorCode === "channel_not_found"
    ) {
      // Check if bot is already a member
      try {
        const info = await client.conversations.info({ channel: channelId });
        if (info?.channel?.is_member) {
          return { ok: true };
        }
      } catch {
        // Group messages need mpim:read for conversations.info, which HuddlePace does not request
      }

      // Reading one message works for a member of any channel type with the history scopes the app has
      try {
        await client.conversations.history({ channel: channelId, limit: 1 });
        return { ok: true };
      } catch {
        // Not a member: fall through to the invite prompt
      }

      if (userId) {
        try {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: "💡 *HuddlePace needs to be in this conversation:* In a private channel, invite the bot by typing `/invite @HuddlePace`. In a group message, add @HuddlePace to the conversation.",
          });
        } catch {
          // Channel might not permit ephemeral either if not in channel
        }
      }

      return { ok: false, error: "not_in_channel" };
    }

    return { ok: true };
  }
}
