import { App } from "@slack/bolt";
import { MeetupService } from "../services/meetupService.js";
import { buildLiveTrackerBlocks } from "../slack/ui/trackerBlock.js";
import { prisma } from "../db/client.js";
import { getBotTokenForTeam } from "../slack/oauth/installationStore.js";

export class TimerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private exitRampsSent = new Set<string>();

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
      const activeMeetups = await MeetupService.getActiveMeetups();
      const activeIds = new Set(activeMeetups.map((m) => m.id));
      for (const id of this.exitRampsSent) {
        if (!activeIds.has(id)) {
          this.exitRampsSent.delete(id);
        }
      }

      for (const meetup of activeMeetups) {
        if (!meetup.startedAt || !meetup.trackerMessageTs) continue;

        const botToken = await getBotTokenForTeam(meetup.teamId);

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
              currentModuleName: status?.module.title || "Casual Chat",
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

          // If the message or channel was deleted in Slack, conclude meetup to release timer resources
          if (slackError === "message_not_found" || slackError === "channel_not_found") {
            console.warn(`Tracker message missing for meetup ${meetup.id}. Concluding session.`);
            await MeetupService.concludeMeetup(meetup.id);
            this.exitRampsSent.delete(meetup.id);
            continue;
          }
        }

        // If in Just Chatting mode, skip pacing DMs and formal exit ramp
        if (isChatting) continue;

        // 2. Private Speaker Pacing Checkpoint (when entering a new module)
        if (status && !status.module.isNotified) {
          const speakerIds = MeetupService.parseSpeakerIds(meetup.speakerUserId);
          for (const speakerId of speakerIds) {
            try {
              await this.app.client.chat.postMessage({
                token: botToken,
                channel: speakerId,
                text: `⏱️ *Next Module:* "${status.module.title}" (${status.module.durationMinutes} min allocated).`,
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

        // 3. Social Grace & Exit Ramp (delivered once at 100% completion)
        if (isOvertime && meetup.status === "ACTIVE" && !this.exitRampsSent.has(meetup.id)) {
          this.exitRampsSent.add(meetup.id);
          try {
            await this.app.client.chat.postMessage({
              token: botToken,
              channel: meetup.channelId,
              thread_ts: meetup.threadTs || meetup.trackerMessageTs,
              text: `🏁 *Timebox reached (${meetup.totalMinutes} min).* Official agenda is complete. Attendees with next commitments can drop off; feel free to stay for open chat.`,
            });
          } catch (err) {
            console.warn(`Failed to post exit ramp for meetup ${meetup.id}:`, err);
          }
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
