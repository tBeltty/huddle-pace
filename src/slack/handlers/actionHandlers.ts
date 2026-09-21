import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildLiveTrackerBlocks } from "../ui/trackerBlock.js";
import { formatMinutes } from "../../utils/progressBar.js";

/**
 * Searches the target channel's recent message history for an active Huddle call.
 */
async function findActiveHuddleThread(client: any, channelId: string): Promise<string | null> {
  try {
    const res = await client.conversations.history({
      channel: channelId,
      limit: 15,
    });

    if (!res.messages) return null;

    for (const msg of res.messages) {
      const isHuddle = msg.subtype === "huddle_thread" || msg.room != null;
      const hasEnded = msg.room?.has_ended === true || (msg.text && msg.text.toLowerCase().includes("huddle ended"));
      if (isHuddle && !hasEnded) {
        return msg.ts;
      }
    }
  } catch (err) {
    console.warn(`Could not inspect conversations.history for channel ${channelId}:`, err);
  }
  return null;
}

export function registerActionHandlers(app: App) {
  // Action: Start a scheduled meetup (posts inside the Huddle chat thread)
  app.action("start_scheduled_meetup_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const meetupId = b.actions[0].value;
      const meetup = await MeetupService.getMeetupById(meetupId);

      if (!meetup) {
        console.error(`Meetup ${meetupId} not found.`);
        return;
      }

      if (meetup.status === "ACTIVE" || meetup.status === "JUST_CHATTING") {
        return; // Already in progress
      }

      // 1. Locate active Huddle in target channel to inject tracker directly into Huddle chat
      const huddleThreadTs = await findActiveHuddleThread(client, meetup.channelId);

      const initialModule = meetup.modules[0];
      const nextModule = meetup.modules[1] || null;

      // 2. Post live tracker message
      // If an active Huddle is present, inject into its chat thread
      const trackerMsg = await client.chat.postMessage({
        channel: meetup.channelId,
        thread_ts: huddleThreadTs || undefined,
        text: `⏱️ *Live Tracker Started: ${meetup.title}*`,
        blocks: buildLiveTrackerBlocks({
          meetupId: meetup.id,
          title: meetup.title,
          totalMinutes: meetup.totalMinutes,
          speakerUserId: meetup.speakerUserId,
          elapsedMinutes: 0,
          currentModuleName: initialModule?.title || "Introduction",
          moduleRemainingMinutes: initialModule?.durationMinutes || meetup.totalMinutes,
          nextModuleName: nextModule?.title || null,
        }),
      });

      // 3. Update DB record with startedAt, tracker message TS, and Huddle thread TS
      await MeetupService.startMeetup(
        meetup.id,
        trackerMsg.ts as string,
        huddleThreadTs || (trackerMsg.ts as string)
      );

      // 4. Send private introductory pacing DM to all assigned speakers
      const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
      for (const spkId of speakerIds) {
        await client.chat.postMessage({
          channel: spkId,
          text: `🚀 *Meetup Started: ${meetup.title}*\nYour live tracker is running in <#${meetup.channelId}>${huddleThreadTs ? " inside the active Huddle chat" : ""}.\nYou will receive private pacing alerts here as you transition between modules.`,
        }).catch((err: any) => {
          console.warn(`Failed to send start DM to speaker ${spkId}:`, err);
        });
      }
    } catch (error) {
      console.error("Error starting meetup from action button:", error);
    }
  });

  // Action: Switch to Just Chatting mode
  app.action("switch_to_chatting_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const meetupId = b.actions[0].value;
      const meetup = await MeetupService.getMeetupById(meetupId);

      if (!meetup || !meetup.startedAt) return;

      const updated = await MeetupService.switchToJustChatting(meetupId);

      const elapsedMinutes = Math.floor((Date.now() - new Date(meetup.startedAt).getTime()) / (60 * 1000));

      // Update tracker message in-place with the warm Just Chatting banner
      if (meetup.trackerMessageTs) {
        await client.chat.update({
          channel: meetup.channelId,
          ts: meetup.trackerMessageTs,
          text: `☕ *Formal Agenda Complete — Casual Chatting: ${meetup.title}*`,
          blocks: buildLiveTrackerBlocks({
            meetupId: meetup.id,
            title: meetup.title,
            totalMinutes: meetup.totalMinutes,
            speakerUserId: meetup.speakerUserId,
            elapsedMinutes,
            currentModuleName: "Just Chatting",
            moduleRemainingMinutes: 0,
            nextModuleName: null,
            isChatting: true,
            chattingElapsedMinutes: 0,
          }),
        });
      }

      // Notify speakers that formal pacing is now complete
      const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
      for (const spkId of speakerIds) {
        await client.chat.postMessage({
          channel: spkId,
          text: `☕ *Formal Agenda Finished:* '${meetup.title}' wrapped up at *${elapsedMinutes}m* (budget: ${meetup.totalMinutes}m). The session is now in casual chat mode. Pacing alerts are complete!`,
        }).catch(() => {});
      }
    } catch (error) {
      console.error("Error switching to Just Chatting:", error);
    }
  });

  // Action: Conclude an active meetup
  app.action("conclude_meetup_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const meetupId = b.actions[0].value;
      const meetup = await MeetupService.getMeetupById(meetupId);

      if (!meetup) return;

      await MeetupService.concludeMeetup(meetupId);

      const started = meetup.startedAt ? new Date(meetup.startedAt).getTime() : Date.now();
      const formalEnded = meetup.formalEndsAt ? new Date(meetup.formalEndsAt).getTime() : Date.now();
      const ended = Date.now();

      const formalMinutes = Math.max(1, Math.round((formalEnded - started) / (60 * 1000)));
      const chatMinutes = Math.max(0, Math.round((ended - formalEnded) / (60 * 1000)));

      const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

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
                text: `🎉 *This meetup has officially concluded.*\n\n• *Formal Duration:* ${formatMinutes(formalMinutes)} (Scheduled: ${formatMinutes(meetup.totalMinutes)})\n${chatMinutes > 0 ? `• *Casual Chatting:* ${formatMinutes(chatMinutes)}\n` : ""}• *Speakers:* ${speakers}\n\nThank you for respecting everyone's time!`,
              },
            },
          ],
        });
      }

      // Notify the speakers
      const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
      for (const spkId of speakerIds) {
        await client.chat.postMessage({
          channel: spkId,
          text: `🏁 *Session Concluded:* '${meetup.title}' wrapped up at *${formatMinutes(formalMinutes)}*. Great session!`,
        }).catch(() => {});
      }
    } catch (error) {
      console.error("Error concluding meetup:", error);
    }
  });
}
