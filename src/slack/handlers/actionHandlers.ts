import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildLiveTrackerBlocks } from "../ui/trackerBlock.js";
import { formatMinutes } from "../../utils/progressBar.js";

export function registerActionHandlers(app: App) {
  // Action: Start a scheduled meetup
  app.action("start_scheduled_meetup_action", async ({ ack, body, client, logger }) => {
    await ack();
    try {
      const b = body as any;
      const meetupId = b.actions[0].value;
      const meetup = await MeetupService.getMeetupById(meetupId);

      if (!meetup) {
        logger.error(`Meetup ${meetupId} not found.`);
        return;
      }

      if (meetup.status === "ACTIVE") {
        return; // Already started
      }

      const initialModule = meetup.modules[0];
      const nextModule = meetup.modules[1] || null;

      // Post initial live tracker block to the target channel
      const trackerMsg = await client.chat.postMessage({
        channel: meetup.channelId,
        text: `🎙️ *Live Meetup Started: ${meetup.title}*`,
        blocks: buildLiveTrackerBlocks({
          meetupId: meetup.id,
          title: meetup.title,
          totalMinutes: meetup.totalMinutes,
          speakerUserId: meetup.speakerUserId,
          elapsedMinutes: 0,
          currentModuleName: initialModule?.title || "Kickoff",
          moduleRemainingMinutes: initialModule?.durationMinutes || meetup.totalMinutes,
          nextModuleName: nextModule?.title || null,
        }),
      });

      // Update DB record with startedAt and trackerMessageTs
      await MeetupService.startMeetup(meetup.id, trackerMsg.ts as string);

      // Send private introductory pacing DM to the speaker
      await client.chat.postMessage({
        channel: meetup.speakerUserId,
        text: `🚀 *Meetup Started: ${meetup.title}*\nYour live tracker is active in <#${meetup.channelId}>.\nI will send you private pacing alerts here as you transition between modules!`,
      });
    } catch (error) {
      logger.error("Error starting meetup from action button:", error);
    }
  });

  // Action: Conclude an active meetup
  app.action("conclude_meetup_action", async ({ ack, body, client, logger }) => {
    await ack();
    try {
      const b = body as any;
      const meetupId = b.actions[0].value;
      const meetup = await MeetupService.getMeetupById(meetupId);

      if (!meetup) return;

      await MeetupService.concludeMeetup(meetupId);

      const elapsedMinutes = meetup.startedAt
        ? Math.floor((Date.now() - new Date(meetup.startedAt).getTime()) / (60 * 1000))
        : meetup.totalMinutes;

      // Update the channel message in-place to the completed state
      if (meetup.trackerMessageTs) {
        await client.chat.update({
          channel: meetup.channelId,
          ts: meetup.trackerMessageTs,
          text: `🏁 *Meetup Concluded: ${meetup.title}*`,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `🏁 Concluded: ${meetup.title}`,
                emoji: true,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🎉 *This meetup has officially concluded!*\n\n⏱️ *Final Duration:* ${formatMinutes(elapsedMinutes)} (Scheduled: ${formatMinutes(meetup.totalMinutes)})\n👤 *Speaker:* <@${meetup.speakerUserId}>\n\nThank you for respecting everyone's time! Attendees are free to stay for unstructured conversation.`,
              },
            },
          ],
        });
      }

      // Notify the speaker
      await client.chat.postMessage({
        channel: meetup.speakerUserId,
        text: `🏁 *Meetup Concluded:* '${meetup.title}' wrapped up at *${formatMinutes(elapsedMinutes)}*. Great session!`,
      });
    } catch (error) {
      logger.error("Error concluding meetup:", error);
    }
  });
}
