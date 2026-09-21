import { App } from "@slack/bolt";
import { buildScheduleModal } from "../ui/scheduleModal.js";
import { MeetupService } from "../../services/meetupService.js";

export function registerCommandHandlers(app: App) {
  // Slash command: /pace
  app.command("/pace", async ({ command, ack, client, logger }) => {
    await ack();
    try {
      const subCommand = command.text.trim().toLowerCase();

      if (subCommand === "status") {
        const active = await MeetupService.getActiveMeetups();
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
          .map((m) => `• *${m.title}* by <@${m.speakerUserId}> (${m.totalMinutes} min budget)`)
          .join("\n");

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `🔴 *Active Meetups in this channel:*\n${list}`,
        });
        return;
      }

      // Default: open schedule modal
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildScheduleModal({ channelId: command.channel_id, subtopicCount: 3 }),
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
