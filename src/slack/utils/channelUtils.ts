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
        // Fallthrough to prompt invite
      }

      if (userId) {
        try {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: `💡 *HuddlePace needs an invite:* To track meetups in this private channel, please invite the bot first by typing \`/invite @HuddlePace\` in this channel.`,
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
