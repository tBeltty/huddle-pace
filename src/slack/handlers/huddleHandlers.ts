import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { formatMinutes } from "../../utils/progressBar.js";
import { publishHomeTab } from "./homeHandlers.js";
import { isHuddleMessage, isHuddleEnded, findChannelHuddles } from "../utils/huddleDiscovery.js";
import { launchMeetupInThread } from "./actionHandlers.js";

// Cache of Huddle thread timestamps where standby or auto-start was already posted
const greetedHuddleThreads = new Set<string>();

export function registerHuddleHandlers(app: App) {
  // Listen for message events on channels (new Huddles, Huddle ends, thread messages)
  app.event("message", async ({ event, client, context }) => {
    try {
      const e = event as any;
      const msg = e.message || e;
      const isChanged = e.subtype === "message_changed";

      if (!isHuddleMessage(msg)) {
        return;
      }

      const channelId = e.channel;
      const rootTs = msg.thread_ts || msg.ts || e.ts;
      const teamId = e.team || context.teamId;
      const hasEnded = isHuddleEnded(msg);

      // 1. Case: Huddle Ended
      if (hasEnded) {
        greetedHuddleThreads.delete(rootTs);
        const meetup = await MeetupService.findActiveMeetupByChannelOrThread(channelId, rootTs, teamId);

        if (meetup) {
          console.info(`Detected Huddle end for channel ${channelId}. Auto-concluding meetup ${meetup.id}.`);
          const updated = await MeetupService.concludeMeetup(meetup.id);

          const started = meetup.startedAt ? new Date(meetup.startedAt).getTime() : Date.now();
          const formalEnded = updated.formalEndsAt ? new Date(updated.formalEndsAt).getTime() : Date.now();
          const ended = updated.endsAt ? new Date(updated.endsAt).getTime() : Date.now();

          const formalMinutes = Math.max(1, Math.round((formalEnded - started) / (60 * 1000)));
          const chatMinutes = Math.max(0, Math.round((ended - formalEnded) / (60 * 1000)));
          const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

          // Update in-channel live tracker message in-place
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

          // Post final summary into the Huddle thread
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: meetup.threadTs || rootTs,
            text: `🏁 *Huddle ended automatically.*\n\n• *Formal Session Duration:* ${formatMinutes(formalMinutes)} (Budget: ${formatMinutes(meetup.totalMinutes)})\n${chatMinutes > 0 ? `• *Casual Chatting:* ${formatMinutes(chatMinutes)}\n` : ""}• *Speakers:* ${speakers}\n\nSession concluded and logged. Great pacing!`,
          }).catch((err: any) => {
            console.warn("Failed to post Huddle end summary:", err);
          });

          // Proactively refresh App Home for all speakers
          const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
          for (const spkId of speakerIds) {
            publishHomeTab(client, spkId, teamId).catch(() => {});
          }
        }
        return;
      }

      // 2. Case: Active Huddle Started / Detected
      if (!hasEnded && rootTs) {
        // Check if a meetup is already active or being tracked in this thread/channel
        const existingMeetup = await MeetupService.findActiveMeetupByChannelOrThread(channelId, rootTs, teamId);
        if (existingMeetup) {
          return; // Already tracking an active session
        }

        // Check if there is a pending scheduled meetup for this channel
        const scheduled = await MeetupService.findPendingScheduledMeetup(channelId, teamId);
        if (scheduled) {
          if (!greetedHuddleThreads.has(rootTs)) {
            greetedHuddleThreads.add(rootTs);
            console.info(`Active Huddle detected in channel ${channelId}. Auto-launching scheduled meetup ${scheduled.id}.`);
            await launchMeetupInThread(client, scheduled.id, rootTs);
            await client.chat.postMessage({
              channel: channelId,
              thread_ts: rootTs,
              text: `🛫 *Huddle Detected!* Vector has automatically launched your scheduled session: *"${scheduled.title}"* (${scheduled.totalMinutes}m).\nLive pacing has started in this thread!`,
            }).catch(() => {});
          }
          return;
        }

        // If no scheduled meetup, post unobtrusive standby presence greeting in the Huddle thread
        if (!greetedHuddleThreads.has(rootTs)) {
          greetedHuddleThreads.add(rootTs);
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: rootTs,
            text: `✈️ *Vector Standby:* Huddle detected in this channel. Vector is ready to track pacing.`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `✈️ *Vector Standby: Huddle Active*\nVector is ready to pace this session. Choose a quick flight plan or schedule an agenda:`,
                },
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "⏱️ 15m Quick Flight", emoji: true },
                    style: "primary",
                    value: JSON.stringify({ minutes: 15, threadTs: rootTs }),
                    action_id: "quick_launch_huddle_action",
                  },
                  {
                    type: "button",
                    text: { type: "plain_text", text: "⏱️ 25m Sync", emoji: true },
                    value: JSON.stringify({ minutes: 25, threadTs: rootTs }),
                    action_id: "quick_launch_huddle_action",
                  },
                ],
              },
            ],
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Error in huddle event listener:", error);
    }
  });

  // Listen for @HuddlePace mentions inside Huddle chat threads or channels
  app.event("app_mention", async ({ event, client, context }) => {
    try {
      const channelId = event.channel;
      const threadTs = event.thread_ts || event.ts;
      const teamId = context.teamId || (event as any).team;
      const text = (event.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();

      // Check if user specified a duration, e.g. "@HuddlePace 15m" or "@HuddlePace 20"
      const durationMatch = text.match(/^(\d+)(?:m|min|mins)?(?:\s+(.*))?$/i);
      if (durationMatch) {
        const minutes = parseInt(durationMatch[1], 10);
        if (!isNaN(minutes) && minutes > 0 && minutes <= 480) {
          const title = durationMatch[2]?.trim() || "Huddle Sync";
          const newMeetup = await MeetupService.createMeetup({
            title,
            totalMinutes: minutes,
            channelId,
            speakerUserId: event.user || "guest",
            threadTs,
            teamId,
            modules: [
              { title: "Context & Intro", percentage: 20 },
              { title: "Core Topic", percentage: 60 },
              { title: "Wrap-up & Next Steps", percentage: 20 },
            ],
          });

          await launchMeetupInThread(client, newMeetup.id, threadTs);
          return;
        }
      }

      // Check for status query
      if (text.toLowerCase() === "status") {
        const active = await MeetupService.findActiveMeetupByChannelOrThread(channelId, threadTs, teamId);
        if (active) {
          const elapsed = active.startedAt
            ? Math.floor((Date.now() - new Date(active.startedAt).getTime()) / (60 * 1000))
            : 0;
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: `⏱️ *Active Flight:* "${active.title}" (${elapsed}/${active.totalMinutes}m) by ${MeetupService.formatSpeakerMentions(active.speakerUserId)}.`,
          });
        } else {
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: `ℹ️ No active flight pacing in this thread. Type \`@HuddlePace 15m\` to initiate a 15-minute tracked session.`,
          });
        }
        return;
      }

      // Default: Check if there's a pending scheduled meetup to start, or offer quick launch
      const scheduled = await MeetupService.findPendingScheduledMeetup(channelId, teamId);
      if (scheduled) {
        await launchMeetupInThread(client, scheduled.id, threadTs);
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: `🛫 *Flight Initiated!* Vector has launched your scheduled session: *"${scheduled.title}"* (${scheduled.totalMinutes}m) in this thread.`,
        });
        return;
      }

      // Offer quick takeoff buttons right in the thread
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `✈️ *Vector Flight Deck:* Ready to track this session. Choose a duration to initiate:`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✈️ *Vector Flight Deck*\nReady to pace your talk. Select a flight timebox below or reply with \`@HuddlePace [minutes]\`:`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "⏱️ 15m Quick Flight", emoji: true },
                style: "primary",
                value: JSON.stringify({ minutes: 15, threadTs }),
                action_id: "quick_launch_huddle_action",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "⏱️ 25m Sync", emoji: true },
                value: JSON.stringify({ minutes: 25, threadTs }),
                action_id: "quick_launch_huddle_action",
              },
            ],
          },
        ],
      });
    } catch (err) {
      console.error("Error in app_mention listener:", err);
    }
  });

  // Listen for user_huddle_changed events (when a user starts or joins a Huddle call)
  app.event("user_huddle_changed", async ({ event, client, context }) => {
    try {
      const e = event as any;
      const userId = e.user?.id;
      const huddleState = e.user?.profile?.huddle_state;
      const teamId = context.teamId || e.user?.team_id;

      if (!userId) return;

      console.info(`user_huddle_changed received for ${userId}: huddle_state=${huddleState}`);

      if (huddleState === "in_a_huddle") {
        // Speaker has entered a Huddle! Check for pending scheduled meetups
        const pendingMeetups = await MeetupService.findPendingScheduledMeetupsForSpeaker(userId, teamId);

        for (const meetup of pendingMeetups) {
          console.info(`Auto-launching scheduled meetup ${meetup.id} ('${meetup.title}') in channel ${meetup.channelId} because speaker ${userId} started a Huddle.`);

          const huddles = await findChannelHuddles(client, meetup.channelId);
          const activeHuddle = huddles.find((h) => h.isActive);
          const threadTs = activeHuddle ? activeHuddle.ts : undefined;

          await launchMeetupInThread(client, meetup.id, threadTs);

          await client.chat.postMessage({
            channel: meetup.channelId,
            thread_ts: threadTs || undefined,
            text: `🛫 *Huddle Detected!* Vector has automatically launched your scheduled session: *"${meetup.title}"* (${meetup.totalMinutes}m).\nLive pacing is active!`,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("Error in user_huddle_changed handler:", err);
    }
  });
}

