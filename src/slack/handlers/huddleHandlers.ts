import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { formatMinutes } from "../../utils/progressBar.js";
import { publishHomeTab } from "./homeHandlers.js";

export function registerHuddleHandlers(app: App) {
  // Listen for message changes to detect when a Huddle call ends
  app.event("message", async ({ event, client, context }) => {
    try {
      const e = event as any;

      // Inspect message_changed events on channels
      if (e.subtype !== "message_changed" || !e.message) {
        return;
      }

      const msg = e.message;
      const isHuddle =
        msg.subtype === "huddle_thread" ||
        msg.subtype === "sh_room_created" ||
        msg.room != null ||
        (msg.text &&
          (msg.text.toLowerCase().includes("huddle") || msg.text.toLowerCase().includes("call")));

      const hasEnded =
        msg.room?.has_ended === true ||
        (msg.room?.date_end != null && msg.room.date_end > 0) ||
        (msg.text &&
          (msg.text.toLowerCase().includes("huddle ended") ||
            msg.text.toLowerCase().includes("ended a huddle") ||
            msg.text.toLowerCase().includes("call ended")));

      if (isHuddle && hasEnded) {
        const channelId = e.channel;
        const threadTs = msg.ts;
        const teamId = e.team || context.teamId;

        // Find active or chatting meetup tracking this Huddle
        const meetup = await MeetupService.findActiveMeetupByChannelOrThread(channelId, threadTs, teamId);

        if (meetup) {
          console.info(`Detected Huddle end for channel ${channelId}. Auto-concluding meetup ${meetup.id}.`);

          const updated = await MeetupService.concludeMeetup(meetup.id);

          const started = meetup.startedAt ? new Date(meetup.startedAt).getTime() : Date.now();
          const formalEnded = updated.formalEndsAt ? new Date(updated.formalEndsAt).getTime() : Date.now();
          const ended = updated.endsAt ? new Date(updated.endsAt).getTime() : Date.now();

          const formalMinutes = Math.max(1, Math.round((formalEnded - started) / (60 * 1000)));
          const chatMinutes = Math.max(0, Math.round((ended - formalEnded) / (60 * 1000)));
          const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

          // 1. Update in-channel live tracker message in-place
          if (meetup.trackerMessageTs) {
            await client.chat.update({
              channel: channelId,
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
                    text: `🎉 *This meetup has officially concluded.*\n\n• *Formal Duration:* ${formatMinutes(formalMinutes)} (Scheduled: ${formatMinutes(meetup.totalMinutes)})\n${chatMinutes > 0 ? `• *Casual Chatting:* ${formatMinutes(chatMinutes)}\n` : ""}• *Speakers:* ${speakers}\n\nThank you for respecting everyone's time!`,
                  },
                },
              ],
            }).catch(() => {});
          }

          // 2. Post final summary into the Huddle thread
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: meetup.threadTs || threadTs,
            text: `🏁 *Huddle ended automatically.*\n\n• *Formal Session Duration:* ${formatMinutes(formalMinutes)} (Budget: ${formatMinutes(meetup.totalMinutes)})\n${chatMinutes > 0 ? `• *Casual Chatting:* ${formatMinutes(chatMinutes)}\n` : ""}• *Speakers:* ${speakers}\n\nSession concluded and logged. Great pacing!`,
          }).catch((err: any) => {
            console.warn("Failed to post Huddle end summary:", err);
          });

          // 3. Proactively refresh App Home for all speakers
          const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
          for (const spkId of speakerIds) {
            publishHomeTab(client, spkId, teamId).catch(() => {});
          }
        }
      }
    } catch (error) {
      console.error("Error in huddle event listener:", error);
    }
  });
}
