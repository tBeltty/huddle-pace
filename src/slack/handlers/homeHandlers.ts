import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildHomeTabView } from "../ui/homeTab.js";

export function registerHomeHandlers(app: App) {
  // Publish Home tab whenever a user opens the App Home
  app.event("app_home_opened", async ({ event, client, logger }) => {
    try {
      const [active, upcoming] = await Promise.all([
        MeetupService.getActiveMeetups(),
        MeetupService.getUpcomingMeetups(),
      ]);

      await client.views.publish({
        user_id: event.user,
        view: buildHomeTabView(active, upcoming),
      });
    } catch (error) {
      logger.error("Error publishing App Home tab:", error);
    }
  });

  // Action: Open Schedule Modal from Home Tab button
  app.action("open_schedule_modal", async ({ ack, body, client, logger }) => {
    await ack();
    try {
      const triggerId = (body as any).trigger_id;
      const { buildScheduleModal } = await import("../ui/scheduleModal.js");

      await client.views.open({
        trigger_id: triggerId,
        view: buildScheduleModal({ subtopicCount: 3 }),
      });
    } catch (error) {
      logger.error("Error opening schedule modal from Home:", error);
    }
  });
}
