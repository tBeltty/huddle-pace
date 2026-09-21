import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildHomeTabView } from "../ui/homeTab.js";
import { buildScheduleModal } from "../ui/scheduleModal.js";
import { buildPacingReportBlocks } from "../ui/reportBlock.js";

export function registerHomeHandlers(app: App) {
  // Publish Home tab whenever a user opens the App Home
  app.event("app_home_opened", async ({ event, client }) => {
    try {
      const [active, upcoming, stats] = await Promise.all([
        MeetupService.getActiveMeetups(),
        MeetupService.getUpcomingMeetups(),
        MeetupService.getPacingReportStats(30),
      ]);

      await client.views.publish({
        user_id: event.user,
        view: buildHomeTabView(active, upcoming, stats),
      });
    } catch (error) {
      console.error("Error publishing App Home tab:", error);
    }
  });

  // Action: Open Schedule Modal from Home Tab button
  app.action("open_schedule_modal", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const triggerId = b.trigger_id;
      const currentUserId = b.user?.id;

      await client.views.open({
        trigger_id: triggerId,
        view: buildScheduleModal({
          subtopicCount: 3,
          currentUserId,
        }),
      });
    } catch (error) {
      console.error("Error opening schedule modal from Home:", error);
    }
  });

  // Action: Open Detailed Pacing Report Modal
  app.action("open_report_modal", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const triggerId = b.trigger_id;
      const stats = await MeetupService.getPacingReportStats(30);

      await client.views.open({
        trigger_id: triggerId,
        view: {
          type: "modal",
          title: {
            type: "plain_text",
            text: "Pacing Report",
            emoji: true,
          },
          close: {
            type: "plain_text",
            text: "Close",
          },
          blocks: buildPacingReportBlocks(stats, 30),
        },
      });
    } catch (error) {
      console.error("Error opening pacing report modal:", error);
    }
  });
}
