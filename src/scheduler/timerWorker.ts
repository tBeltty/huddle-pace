import { App } from "@slack/bolt";
import { MeetupService } from "../services/meetupService.js";
import { buildLiveTrackerBlocks } from "../slack/ui/trackerBlock.js";
import { prisma } from "../db/client.js";
import { getBotTokenForTeam } from "../slack/oauth/installationStore.js";
import { publishHomeTab } from "../slack/handlers/homeHandlers.js";
import { formatMinutes } from "../utils/progressBar.js";
import { findChannelHuddles, isHuddleEnded } from "../slack/utils/huddleDiscovery.js";
import { launchMeetupInThread } from "../slack/handlers/actionHandlers.js";

export class TimerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private exitRampsSent = new Set<string>();
  private moduleWarningsSent = new Set<string>();

  constructor(private app: App) {}

  public start(intervalMs = 30000) {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error("Error during timer worker tick:", err);
      });
    }, intervalMs);

    console.info(`⏱️ Timer worker started (interval: ${intervalMs / 1000}s).`);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.isRunning) return; // Prevent concurrent overlapping ticks
    this.isRunning = true;

    try {
      // 0. Safety Net: Check for pending scheduled meetups in channels with active Huddles
      try {
        const pendingScheduled = await prisma.meetup.findMany({
          where: { status: "SCHEDULED" },
          include: { modules: { orderBy: { orderIndex: "asc" } } },
        });

        for (const scheduled of pendingScheduled) {
          const botToken = await getBotTokenForTeam(scheduled.teamId);
          const huddles = await findChannelHuddles(this.app.client, scheduled.channelId);
          const activeHuddle = huddles.find((h) => h.isActive);

          if (activeHuddle) {
            console.info(`⏱️ Timer worker detected active Huddle in channel ${scheduled.channelId}. Auto-launching scheduled meetup ${scheduled.id}.`);
            await launchMeetupInThread(this.app.client, scheduled.id, activeHuddle.ts);
            await this.app.client.chat.postMessage({
              token: botToken,
              channel: scheduled.channelId,
              thread_ts: activeHuddle.ts,
              text: `🛫 *Huddle Detected!* Vector has automatically launched your scheduled session: *"${scheduled.title}"* (${scheduled.totalMinutes}m).\nLive pacing has started in this thread!`,
            }).catch(() => {});
          }
        }
      } catch (scheduledErr) {
        console.warn("Error checking pending scheduled meetups in timer worker:", scheduledErr);
      }

      const activeMeetups = await MeetupService.getActiveMeetups();
      const activeIds = new Set(activeMeetups.map((m) => m.id));

      // Clean up exit ramp and warning caches for finished meetups
      for (const id of this.exitRampsSent) {
        if (!activeIds.has(id)) {
          this.exitRampsSent.delete(id);
        }
      }

      for (const meetup of activeMeetups) {
        if (!meetup.startedAt || !meetup.trackerMessageTs) continue;

        const botToken = await getBotTokenForTeam(meetup.teamId);

        // 0. Safety Net: Verify if Slack Huddle thread has ended
        if (meetup.threadTs && meetup.threadTs !== "main") {
          try {
            const historyRes = await this.app.client.conversations.history({
              token: botToken,
              channel: meetup.channelId,
              latest: meetup.threadTs,
              oldest: meetup.threadTs,
              inclusive: true,
              limit: 1,
            });

            const parentMsg = historyRes.messages?.[0] as any;
            if (parentMsg && isHuddleEnded(parentMsg)) {
              console.info(`⏱️ Timer worker detected Huddle ${meetup.threadTs} has ended. Auto-concluding meetup ${meetup.id}.`);

                const updated = await MeetupService.concludeMeetup(meetup.id);
                const started = new Date(meetup.startedAt).getTime();
                const ended = updated.endsAt ? new Date(updated.endsAt).getTime() : Date.now();
                const formalMin = Math.max(1, Math.round((ended - started) / (60 * 1000)));
                const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

                if (meetup.trackerMessageTs) {
                  await this.app.client.chat.update({
                    token: botToken,
                    channel: meetup.channelId,
                    ts: meetup.trackerMessageTs,
                    text: `🏁 *Meetup Concluded: ${meetup.title}*`,
                    blocks: [
                      {
                        type: "header",
                        text: { type: "plain_text", text: `🏁 Concluded: ${meetup.title}`, emoji: true },
                      },
                      {
                        type: "section",
                        text: {
                          type: "mrkdwn",
                          text: `🎉 *This meetup has officially concluded.*\n\n• *Formal Duration:* ${formatMinutes(formalMin)} (Scheduled: ${formatMinutes(meetup.totalMinutes)})\n• *Speakers:* ${speakers}\n\nThank you for respecting everyone's time!`,
                        },
                      },
                    ],
                  }).catch(() => {});
                }

                // Brief notice into Huddle thread
                await this.app.client.chat.postMessage({
                  token: botToken,
                  channel: meetup.channelId,
                  thread_ts: meetup.threadTs,
                  text: `🏁 *Huddle call ended.* Live pacing session concluded and logged (${formatMinutes(formalMin)}). Great work!`,
                }).catch(() => {});

                // Refresh Home tabs
                const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
                for (const spkId of speakerIds) {
                  publishHomeTab(this.app.client, spkId, meetup.teamId).catch(() => {});
                }
                continue;
              }
          } catch (err: any) {
            // Ignore transient Slack history lookup errors
          }
        }

        const now = Date.now();
        const isChatting = meetup.status === "JUST_CHATTING";

        let elapsedMinutes: number;
        let chattingElapsedMinutes = 0;

        if (isChatting && meetup.formalEndsAt) {
          elapsedMinutes = Math.floor(
            (new Date(meetup.formalEndsAt).getTime() - new Date(meetup.startedAt).getTime()) / (60 * 1000)
          );
          chattingElapsedMinutes = Math.floor(
            (now - new Date(meetup.formalEndsAt).getTime()) / (60 * 1000)
          );
        } else {
          elapsedMinutes = Math.floor((now - new Date(meetup.startedAt).getTime()) / (60 * 1000));
        }

        const status = MeetupService.getCurrentModule(meetup);
        if (!status && !isChatting) continue;

        const isOvertime = elapsedMinutes >= meetup.totalMinutes;

        // 1. Update the live in-channel tracker message
        try {
          await this.app.client.chat.update({
            token: botToken,
            channel: meetup.channelId,
            ts: meetup.trackerMessageTs,
            text: isChatting
              ? `☕ Just Chatting: ${meetup.title} (+${chattingElapsedMinutes}m)`
              : `⏱️ Meetup Progress: ${meetup.title} (${elapsedMinutes}/${meetup.totalMinutes}m)`,
            blocks: buildLiveTrackerBlocks({
              meetupId: meetup.id,
              title: meetup.title,
              totalMinutes: meetup.totalMinutes,
              speakerUserId: meetup.speakerUserId,
              elapsedMinutes,
              currentModuleName: status?.module?.title || "Casual Chat",
              moduleRemainingMinutes: status?.remainingMinutes || 0,
              nextModuleName: status?.nextModule ? status.nextModule.title : null,
              isOvertime,
              isChatting,
              chattingElapsedMinutes,
            }),
          });
        } catch (err: any) {
          const slackError = err?.data?.error;
          console.warn(`Failed to update tracker message for meetup ${meetup.id}:`, slackError || err.message);

          if (slackError === "message_not_found" || slackError === "channel_not_found") {
            console.warn(`Tracker message missing for meetup ${meetup.id}. Concluding session.`);
            await MeetupService.concludeMeetup(meetup.id);
            this.exitRampsSent.delete(meetup.id);
            continue;
          }
        }

        // 2. Proactively refresh App Home for speakers so progress updates in real time
        const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
        for (const spkId of speakerIds) {
          publishHomeTab(this.app.client, spkId, meetup.teamId).catch(() => {});
        }

        // If in Just Chatting mode, skip pacing DMs and formal exit ramp
        if (isChatting) continue;

        // 3. 1-Minute Early Warning DM to speakers
        if (status && status.module && status.remainingMinutes <= 1 && !this.moduleWarningsSent.has(status.module.id)) {
          this.moduleWarningsSent.add(status.module.id);
          const nextMod = status.nextModule;
          const warningText = nextMod
            ? `⏱️ *1 Minute Remaining:* Wrapping up "*${status.module.title}*". Start rounding out your points; next up is "*${nextMod.title}*" (${nextMod.durationMinutes}m).`
            : `⏱️ *1 Minute Remaining:* Wrapping up final module "*${status.module.title}*". Prepare for open Q&A or conclusion.`;

          for (const speakerId of speakerIds) {
            try {
              await this.app.client.chat.postMessage({
                token: botToken,
                channel: speakerId,
                text: warningText,
              });
            } catch (err) {
              console.warn(`Failed to send 1-minute warning DM to speaker ${speakerId}:`, err);
            }
          }
        }

        // 4. Natural Vector Speaker Transition / Takeoff DM
        if (status && status.module && !status.module.isNotified) {
          const isTakeoff = status.module.startOffsetMin === 0;
          let messageText: string;

          if (isTakeoff) {
            messageText = `🛫 *Cleared for Takeoff!* Starting with module "*${status.module.title}*" (${status.module.durationMinutes}m allocated). I'll keep an eye on pacing so you can focus on the talk.`;
          } else {
            // Find preceding module
            const prevModule = meetup.modules.find((m) => m.endOffsetMin === status.module.startOffsetMin);
            const prevTitle = prevModule ? prevModule.title : "Previous Module";
            messageText = `🧭 *Module Transition:* Time is up for "*${prevTitle}*". Move to "*${status.module.title}*" (${status.module.durationMinutes}m allocated) to keep our flight path on schedule.`;
          }

          for (const speakerId of speakerIds) {
            try {
              await this.app.client.chat.postMessage({
                token: botToken,
                channel: speakerId,
                text: messageText,
              });
            } catch (err) {
              console.warn(`Failed to send pacing DM to speaker ${speakerId}:`, err);
            }
          }

          try {
            await prisma.meetupModule.update({
              where: { id: status.module.id },
              data: { isNotified: true },
            });
          } catch (err) {
            console.warn(`Failed to mark module ${status.module.id} as notified:`, err);
          }
        }

        // 5. Timebox Reached Notification with Snooze & Just Chatting Options
        if (isOvertime && meetup.status === "ACTIVE" && !this.exitRampsSent.has(meetup.id)) {
          this.exitRampsSent.add(meetup.id);
          try {
            await this.app.client.chat.postMessage({
              token: botToken,
              channel: meetup.channelId,
              thread_ts: meetup.threadTs || meetup.trackerMessageTs,
              text: `⏱️ *Timebox Reached (${meetup.totalMinutes}m).* The scheduled agenda time has elapsed.`,
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `⏱️ *Timebox Reached:* The scheduled *${meetup.totalMinutes}m* budget for *"${meetup.title}"* has elapsed. Select an option below to extend time, transition to casual chat, or conclude:`,
                  },
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: { type: "plain_text", text: "+5m Snooze", emoji: true },
                      value: JSON.stringify({ meetupId: meetup.id, minutes: 5 }),
                      action_id: "snooze_meetup_action",
                    },
                    {
                      type: "button",
                      text: { type: "plain_text", text: "+10m Snooze", emoji: true },
                      value: JSON.stringify({ meetupId: meetup.id, minutes: 10 }),
                      action_id: "snooze_meetup_action",
                    },
                    {
                      type: "button",
                      text: { type: "plain_text", text: "+20m Snooze", emoji: true },
                      value: JSON.stringify({ meetupId: meetup.id, minutes: 20 }),
                      action_id: "snooze_meetup_action",
                    },
                    {
                      type: "button",
                      text: { type: "plain_text", text: "☕ Just Chatting", emoji: true },
                      value: meetup.id,
                      action_id: "switch_to_chatting_action",
                    },
                    {
                      type: "button",
                      text: { type: "plain_text", text: "⏹️ Conclude", emoji: true },
                      style: "danger",
                      value: meetup.id,
                      action_id: "conclude_meetup_action",
                    },
                  ],
                },
              ],
            });
          } catch (err) {
            console.warn(`Failed to post timebox alert for meetup ${meetup.id}:`, err);
          }
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
