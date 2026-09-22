import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildHomeTabView, HomeTabType } from "../ui/homeTab.js";
import { buildScheduleModal } from "../ui/scheduleModal.js";
import { buildPacingReportBlocks } from "../ui/reportBlock.js";

// Tracks active sub-tab per user in-memory for instant navigation
const userHomeTabMap = new Map<string, HomeTabType>();

/**
 * Centralized publisher for a user's App Home view.
 */
export async function publishHomeTab(
  client: any,
  userId: string,
  teamId?: string,
  tabOverride?: HomeTabType
): Promise<void> {
  try {
    if (tabOverride) {
      userHomeTabMap.set(userId, tabOverride);
    }
    const activeTab = tabOverride || userHomeTabMap.get(userId) || "meetups";

    const [active, upcoming, stats] = await Promise.all([
      MeetupService.getActiveMeetups(teamId),
      MeetupService.getUpcomingMeetups(teamId),
      MeetupService.getPacingReportStats(30, teamId),
    ]);

    const view = buildHomeTabView(active, upcoming, stats, userId, activeTab);
    await client.views.publish({
      user_id: userId,
      view,
    });
    console.info(`⚡ App Home tab published for user ${userId} (tab: ${activeTab}, blocks: ${view.blocks.length})`);
  } catch (error: any) {
    console.error(`Error publishing App Home tab for user ${userId}:`, error?.data || error.message || error);
  }
}

export function registerHomeHandlers(app: App) {
  // Publish Home tab whenever a user opens the App Home
  app.event("app_home_opened", async ({ event, client, context }) => {
    console.info(`📥 app_home_opened received for user ${event.user}, tab: ${(event as any).tab}`);
    const teamId = (event as any).view?.team_id || context.teamId;
    await publishHomeTab(client, event.user, teamId);
  });

  // Action: Refresh Home Tab manually
  app.action("refresh_home_tab", async ({ ack, body, client, context }) => {
    await ack();
    const b = body as any;
    const teamId = b.team?.id || context.teamId;
    const userId = b.user?.id;
    if (userId) {
      await publishHomeTab(client, userId, teamId);
    }
  });

  // Action: Switch to Meetups & Agenda sub-tab
  app.action("nav_tab_meetups", async ({ ack, body, client, context }) => {
    await ack();
    const b = body as any;
    const teamId = b.team?.id || context.teamId;
    const userId = b.user?.id;
    if (userId) {
      await publishHomeTab(client, userId, teamId, "meetups");
    }
  });

  // Action: Switch to Analytics & Reports sub-tab
  app.action("nav_tab_analytics", async ({ ack, body, client, context }) => {
    await ack();
    const b = body as any;
    const teamId = b.team?.id || context.teamId;
    const userId = b.user?.id;
    if (userId) {
      await publishHomeTab(client, userId, teamId, "analytics");
    }
  });

  // Action: Switch to Guide & Tips sub-tab
  app.action("nav_tab_guide", async ({ ack, body, client, context }) => {
    await ack();
    const b = body as any;
    const teamId = b.team?.id || context.teamId;
    const userId = b.user?.id;
    if (userId) {
      await publishHomeTab(client, userId, teamId, "guide");
    }
  });

  // Action: Open Schedule Modal from Home Tab button
  app.action("open_schedule_modal", async ({ ack, body, client }) => {
    const b = body as any;
    const triggerId = b.trigger_id;
    const currentUserId = b.user?.id;
    const teamId = b.team?.id;

    console.info(`🎯 open_schedule_modal clicked by user ${currentUserId} in team ${teamId}, trigger: ${triggerId?.slice(0, 15)}...`);

    try {
      const modalView = buildScheduleModal({
        subtopicCount: 3,
        currentUserId,
      });

      await Promise.all([
        ack(),
        client.views.open({
          trigger_id: triggerId,
          view: modalView,
        }),
      ]);
      console.info(`✅ Schedule modal opened successfully for user ${currentUserId}`);
    } catch (error: any) {
      console.error("Error opening schedule modal from Home:", error?.data || error.message || error);
    }
  });

  // Action: Open Detailed Pacing Report Modal
  app.action("open_report_modal", async ({ ack, body, client, context }) => {
    const b = body as any;
    const triggerId = b.trigger_id;
    const teamId = b.team?.id || context.teamId;

    try {
      const [, stats] = await Promise.all([
        ack(),
        MeetupService.getPacingReportStats(30, teamId),
      ]);

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
    } catch (error: any) {
      console.error("Error opening pacing report modal:", error?.data || error.message || error);
    }
  });
}
