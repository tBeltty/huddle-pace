import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildLiveTrackerBlocks } from "../ui/trackerBlock.js";
import { formatMinutes } from "../../utils/progressBar.js";
import { findChannelHuddles } from "../utils/huddleDiscovery.js";
import { buildHuddleSelectionModal } from "../ui/huddleSelectModal.js";
import { ensureBotInChannel } from "../utils/channelUtils.js";
import { publishHomeTab } from "./homeHandlers.js";
import { buildAppHomeDeepLink } from "../utils/deepLinks.js";

/**
 * Validates whether the user triggering an action is an authorized speaker/organizer.
 */
export function isUserAuthorizedForMeetup(speakerUserId: string, userId?: string): boolean {
  if (!userId) return false;
  const speakerIds = MeetupService.parseSpeakerIds(speakerUserId);
  return speakerIds.includes(userId);
}

/**
 * Starts a meetup and attaches its live tracker to the designated Huddle thread (or channel feed).
 */
export async function launchMeetupInThread(client: any, meetupId: string, threadTs?: string) {
  const meetup = await MeetupService.getMeetupById(meetupId);
  if (!meetup) {
    console.error(`Meetup ${meetupId} not found.`);
    return;
  }

  if (meetup.status === "ACTIVE" || meetup.status === "JUST_CHATTING") {
    return; // Already in progress
  }

  const initialModule = meetup.modules[0];
  const nextModule = meetup.modules[1] || null;

  // 1. Ensure bot is present in channel (auto-joins public channels)
  await ensureBotInChannel(client, meetup.channelId);

  // 2. Post live tracker message (in Huddle thread or main feed)
  const trackerMsg = await client.chat.postMessage({
    channel: meetup.channelId,
    thread_ts: threadTs || undefined,
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

  // 2. Update DB record with startedAt, tracker message TS, and Huddle thread TS
  await MeetupService.startMeetup(
    meetup.id,
    trackerMsg.ts as string,
    threadTs || (trackerMsg.ts as string)
  );

  // 3. Send private introductory pacing DM to all assigned speakers and refresh their App Home
  const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
  for (const spkId of speakerIds) {
    await client.chat.postMessage({
      channel: spkId,
      text: `🚀 *Meetup Started: ${meetup.title}*\nYour live tracker is running in <#${meetup.channelId}>${threadTs ? " inside the selected Huddle chat" : ""}.\nYou will receive private pacing alerts here as you transition between modules.`,
    }).catch((err: any) => {
      console.warn(`Failed to send start DM to speaker ${spkId}:`, err);
    });

    publishHomeTab(client, spkId, meetup.teamId).catch(() => {});
  }
}

export function registerActionHandlers(app: App) {
  // Action: Start a scheduled meetup
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

      if (!isUserAuthorizedForMeetup(meetup.speakerUserId, b.user?.id)) {
        try {
          await client.chat.postEphemeral({
            channel: b.channel?.id || meetup.channelId,
            user: b.user?.id,
            text: "⚠️ *Access Denied:* Only the designated speaker(s) or organizer can start this meetup.",
          });
        } catch {}
        return;
      }

      if (meetup.status === "ACTIVE" || meetup.status === "JUST_CHATTING") {
        return; // Already in progress
      }

      // Check if threadTs was explicitly pre-selected during schedule creation
      if (meetup.threadTs && meetup.threadTs !== "auto" && meetup.threadTs !== "main") {
        await launchMeetupInThread(client, meetupId, meetup.threadTs);
        return;
      }

      if (meetup.threadTs === "main") {
        await launchMeetupInThread(client, meetupId, undefined);
        return;
      }

      // Mode is "auto" or unset: scan channel for active Huddles
      const huddles = await findChannelHuddles(client, meetup.channelId);
      const active = huddles.filter((h) => h.isActive);

      // Disambiguate if multiple active Huddles exist
      if (active.length > 1 && b.trigger_id) {
        await client.views.open({
          trigger_id: b.trigger_id,
          view: buildHuddleSelectionModal(meetup.id, meetup.title, meetup.channelId, active),
        });
        return;
      }

      const targetThreadTs = active.length === 1 ? active[0].ts : undefined;
      await launchMeetupInThread(client, meetupId, targetThreadTs);

      // Auto-refresh App Home for the user who initiated the action
      if (b.user?.id) {
        publishHomeTab(client, b.user.id, b.team?.id).catch(() => {});
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

      if (!isUserAuthorizedForMeetup(meetup.speakerUserId, b.user?.id)) {
        try {
          await client.chat.postEphemeral({
            channel: b.channel?.id || meetup.channelId,
            user: b.user?.id,
            text: "⚠️ *Access Denied:* Only the designated speaker(s) can switch this session to casual chatting.",
          });
        } catch {}
        return;
      }

      await MeetupService.switchToJustChatting(meetupId);

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

      // Auto-refresh App Home for triggering user and all speakers
      const usersToRefresh = Array.from(new Set([b.user?.id, ...speakerIds].filter(Boolean)));
      for (const uid of usersToRefresh) {
        publishHomeTab(client, uid, b.team?.id).catch(() => {});
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

      if (!isUserAuthorizedForMeetup(meetup.speakerUserId, b.user?.id)) {
        try {
          await client.chat.postEphemeral({
            channel: b.channel?.id || meetup.channelId,
            user: b.user?.id,
            text: "⚠️ *Access Denied:* Only the designated speaker(s) can conclude this session.",
          });
        } catch {}
        return;
      }

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
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `📊 View workspace pacing reports and schedules in <${buildAppHomeDeepLink({ teamId: meetup.teamId })}|App Home>`,
                },
              ],
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

      // Auto-refresh App Home for triggering user and all speakers
      const usersToRefresh = Array.from(new Set([b.user?.id, ...speakerIds].filter(Boolean)));
      for (const uid of usersToRefresh) {
        publishHomeTab(client, uid, b.team?.id).catch(() => {});
      }
    } catch (error) {
      console.error("Error concluding meetup:", error);
    }
  });
}
