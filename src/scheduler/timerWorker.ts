import { App } from "@slack/bolt";
import { MeetupService } from "../services/meetupService.js";
import { buildLiveTrackerBlocks } from "../slack/ui/trackerBlock.js";
import { prisma } from "../db/client.js";

export class TimerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

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

      for (const meetup of activeMeetups) {
        if (!meetup.startedAt || !meetup.trackerMessageTs) continue;

        const now = Date.now();
        const elapsedMinutes = Math.floor((now - new Date(meetup.startedAt).getTime()) / (60 * 1000));
        const status = MeetupService.getCurrentModule(meetup);

        if (!status) continue;

        const isOvertime = elapsedMinutes >= meetup.totalMinutes;

        // 1. Update the live in-channel tracker message
        try {
          await this.app.client.chat.update({
            channel: meetup.channelId,
            ts: meetup.trackerMessageTs,
            text: `⏱️ Meetup Progress: ${meetup.title} (${elapsedMinutes}/${meetup.totalMinutes}m)`,
            blocks: buildLiveTrackerBlocks({
              meetupId: meetup.id,
              title: meetup.title,
              totalMinutes: meetup.totalMinutes,
              speakerUserId: meetup.speakerUserId,
              elapsedMinutes,
              currentModuleName: status.module.title,
              moduleRemainingMinutes: status.remainingMinutes,
              nextModuleName: status.nextModule ? status.nextModule.title : null,
              isOvertime,
            }),
          });
        } catch (err) {
          console.warn(`Failed to update tracker message for meetup ${meetup.id}:`, err);
        }

        // 2. Private Speaker Pacing Checkpoint (when entering a new module)
        if (!status.module.isNotified) {
          try {
            await this.app.client.chat.postMessage({
              channel: meetup.speakerUserId,
              text: `🔔 *Pacing Alert:* Moving to module *'${status.module.title}'* (${status.module.durationMinutes} min allocated).`,
            });

            await prisma.meetupModule.update({
              where: { id: status.module.id },
              data: { isNotified: true },
            });
          } catch (err) {
            console.warn(`Failed to send pacing DM to speaker ${meetup.speakerUserId}:`, err);
          }
        }

        // 3. Social Grace & Exit Ramp (at 100% completion)
        if (isOvertime && meetup.status === "ACTIVE") {
          // Send polite release message once
          try {
            await this.app.client.chat.postMessage({
              channel: meetup.channelId,
              thread_ts: meetup.threadTs || meetup.trackerMessageTs,
              text: `🏁 *Scheduled Timebox Reached (${meetup.totalMinutes} min)*: Official session time is up! Anyone with subsequent commitments is free to step away. Feel free to stay on for open chatter.`,
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
