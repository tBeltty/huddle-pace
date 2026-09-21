import { App } from "@slack/bolt";
import { MeetupService } from "../services/meetupService.js";
import { buildLiveTrackerBlocks } from "../slack/ui/trackerBlock.js";
import { prisma } from "../db/client.js";

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

        // 2. Private Speaker Pacing Checkpoint (when entering a new module)
        if (!status.module.isNotified) {
          try {
            await this.app.client.chat.postMessage({
              channel: meetup.speakerUserId,
              text: `⏱️ *Next Module:* "${status.module.title}" (${status.module.durationMinutes} min allocated).`,
            });

            await prisma.meetupModule.update({
              where: { id: status.module.id },
              data: { isNotified: true },
            });
          } catch (err) {
            console.warn(`Failed to send pacing DM to speaker ${meetup.speakerUserId}:`, err);
          }
        }

        // 3. Social Grace & Exit Ramp (delivered once at 100% completion)
        if (isOvertime && meetup.status === "ACTIVE" && !this.exitRampsSent.has(meetup.id)) {
          this.exitRampsSent.add(meetup.id);
          try {
            await this.app.client.chat.postMessage({
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
