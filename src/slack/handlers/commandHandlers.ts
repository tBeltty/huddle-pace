import { App } from "@slack/bolt";
import { buildScheduleModal } from "../ui/scheduleModal.js";
import { buildPacingReportBlocks } from "../ui/reportBlock.js";
import { MeetupService } from "../../services/meetupService.js";
import { findChannelHuddles } from "../utils/huddleDiscovery.js";
import { buildAppHomeMrkdwnLink } from "../utils/deepLinks.js";

export function registerCommandHandlers(app: App) {
  // Slash command: /pace
  app.command("/pace", async ({ command, ack, client, logger }) => {
    await ack();
    try {
      const rawText = command.text.trim();
      const parts = rawText.split(/\s+/);
      const subCommand = parts[0]?.toLowerCase() || "";

      const homeLink = buildAppHomeMrkdwnLink("App Home Dashboard", { teamId: command.team_id });

      if (subCommand === "help") {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `ℹ️ *HuddlePace Commands:*\n• \`/pace\` — Open the meetup scheduler modal\n• \`/pace status\` — Check active meetups in this channel\n• \`/pace report [days]\` — View pacing & timebox compliance report (default: 30 days)\n• \`/pace help\` — Show this help message\n\n🏠 Open your ${homeLink} to see your personalized sessions.`,
        });
        return;
      }

      if (subCommand === "report" || subCommand === "stats") {
        const daysArg = parseInt(parts[1], 10);
        const days = !isNaN(daysArg) && daysArg > 0 ? Math.min(daysArg, 365) : 30;
        const stats = await MeetupService.getPacingReportStats(days, command.team_id);
        const blocks = buildPacingReportBlocks(stats, days);

        // Add App Home link context
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `🏠 View full metrics and active sessions anytime in your ${homeLink}.`,
            },
          ],
        });

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `📊 HuddlePace Report (Last ${days} days)`,
          blocks,
        });
        return;
      }

      if (subCommand === "status") {
        const active = await MeetupService.getActiveMeetups(command.team_id);
        const channelMeetups = active.filter((m) => m.channelId === command.channel_id);

        if (channelMeetups.length === 0) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: "ℹ️ No active HuddlePace sessions running in this channel.",
          });
          return;
        }

        const list = channelMeetups
          .map((m) => {
            const speakers = MeetupService.formatSpeakerMentions(m.speakerUserId);
            const statusLabel = m.status === "JUST_CHATTING" ? "☕ Just Chatting" : "⏱️ In Progress";
            return `• *${m.title}* (${statusLabel}) by ${speakers} (${m.totalMinutes} min budget)`;
          })
          .join("\n");

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `🔴 *Active Sessions in this channel:*\n${list}`,
        });
        return;
      }

      // Default: open schedule modal with detected Huddles in current channel
      const huddles = await findChannelHuddles(client, command.channel_id);
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildScheduleModal({
          channelId: command.channel_id,
          currentUserId: command.user_id,
          subtopicCount: 3,
          availableHuddles: huddles,
        }),
      });
    } catch (error) {
      logger.error("Error executing /pace command:", error);
    }
  });

  // Global Shortcut: schedule_meetup_shortcut
  app.shortcut("schedule_meetup_shortcut", async ({ shortcut, ack, client, logger }) => {
    await ack();
    try {
      await client.views.open({
        trigger_id: shortcut.trigger_id,
        view: buildScheduleModal({ subtopicCount: 3 }),
      });
    } catch (error) {
      logger.error("Error opening schedule modal from shortcut:", error);
    }
  });
}
