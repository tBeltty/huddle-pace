import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { formatMinutes } from "../../utils/progressBar.js";

export function registerHuddleHandlers(app: App) {
  // Listen for message changes to detect when a Huddle call ends
  app.event("message", async ({ event, client, context }) => {
    try {
      const e = event as any;

      // Only inspect message_changed events on channels
      if (e.subtype !== "message_changed" || !e.message) {
        return;
      }

      const msg = e.message;
      const isHuddle = msg.subtype === "huddle_thread" || msg.room != null;
      const hasEnded = msg.room?.has_ended === true || (msg.text && msg.text.toLowerCase().includes("huddle ended"));

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

          // Post final summary into the Huddle thread
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: meetup.threadTs || threadTs,
            text: `🏁 *Huddle ended automatically.*\n\n• *Formal Session Duration:* ${formatMinutes(formalMinutes)} (Budget: ${formatMinutes(meetup.totalMinutes)})\n${chatMinutes > 0 ? `• *Casual Chatting:* ${formatMinutes(chatMinutes)}\n` : ""}• *Speakers:* ${speakers}\n\nSession concluded and logged. Great pacing!`,
          }).catch((err: any) => {
            console.warn("Failed to post Huddle end summary:", err);
          });
        }
      }
    } catch (error) {
      console.error("Error in huddle event listener:", error);
    }
  });
}
