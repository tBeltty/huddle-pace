import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildHomeTabView, buildGuideModal } from "../ui/homeTab.js";
import { buildScheduleModal } from "../ui/scheduleModal.js";
import { buildPacingReportBlocks } from "../ui/reportBlock.js";
import { prisma } from "../../db/client.js";

/**
 * Centralized publisher for a user's App Home view.
 */
export async function publishHomeTab(
  client: any,
  userId: string,
  teamId?: string
): Promise<void> {
  try {
    const [active, upcoming, stats] = await Promise.all([
      MeetupService.getActiveMeetups(teamId),
      MeetupService.getUpcomingMeetups(teamId),
      MeetupService.getPacingReportStats(30, teamId),
    ]);

    const view = buildHomeTabView(active, upcoming, stats, userId);
    await client.views.publish({
      user_id: userId,
      view,
    });
    console.info(`⚡ App Home tab published for user ${userId} (blocks: ${view.blocks.length})`);
  } catch (error: any) {
    console.error(`Error publishing App Home tab for user ${userId}:`, error?.data || error.message || error);
  }
}

/**
 * Proactively pushes updated App Home views to all non-bot workspace members on server boot.
 */
export async function syncAllAppHomes(app: App): Promise<void> {
  try {
    const installations = await prisma.slackInstallation.findMany();
    for (const install of installations) {
      if (!install.botToken) continue;
      // Fetch workspace members using WebClient
      const client = app.client;
      const usersRes = (await client.users.list({
        token: install.botToken,
        limit: 100,
      })) as any;

      const nonBots = (usersRes.members || []).filter(
        (m: any) => !m.is_bot && !m.deleted && m.id !== "USLACKBOT"
      );

      for (const member of nonBots) {
        // Use custom client wrapper with the team's bot token
        const teamClient = {
          views: {
            publish: (args: any) =>
              client.views.publish({
                ...args,
                token: install.botToken!,
              }),
            open: (args: any) =>
              client.views.open({
                ...args,
                token: install.botToken!,
              }),
          },
        };
        await publishHomeTab(teamClient, member.id, install.teamId || undefined);
      }
    }
    console.info("⚡ Startup sync completed: Proactively updated App Home views across workspaces.");
  } catch (err: any) {
    console.warn("Notice: Startup sync of App Home tabs deferred:", err?.message || err);
  }
}

export function registerHomeHandlers(app: App) {
  // Publish Home tab whenever a user opens the App Home
  app.event("app_home_opened", async ({ event, client, context }) => {
    console.info(`📥 app_home_opened received for user ${event.user}, tab: ${(event as any).tab}`);
    const teamId = (event as any).view?.team_id || context.teamId;
    await publishHomeTab(client, event.user, teamId);
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

  // Action: Open Detailed Pacing Report Modal from Analytics button
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

  // Action: Open Quick Guide Modal from Guide button
  app.action("open_guide_modal", async ({ ack, body, client }) => {
    const b = body as any;
    const triggerId = b.trigger_id;

    try {
      await Promise.all([
        ack(),
        client.views.open({
          trigger_id: triggerId,
          view: buildGuideModal(),
        }),
      ]);
    } catch (error: any) {
      console.error("Error opening guide modal:", error?.data || error.message || error);
    }
  });

  // Backward-compatibility: If a user clicks Refresh on a cached legacy view
  app.action("refresh_home_tab", async ({ ack, body, client, context }) => {
    await ack();
    const b = body as any;
    const teamId = b.team?.id || context.teamId;
    const userId = b.user?.id;
    if (userId) {
      await publishHomeTab(client, userId, teamId);
    }
  });

  // Backward-compatibility: If a user clicks any sub-tab button on a cached view
  app.action("nav_tab_meetups", async ({ ack, body, client, context }) => {
    await ack();
    const b = body as any;
    const teamId = b.team?.id || context.teamId;
    const userId = b.user?.id;
    if (userId) {
      await publishHomeTab(client, userId, teamId);
    }
  });

  app.action("nav_tab_analytics", async ({ ack, body, client, context }) => {
    const b = body as any;
    const triggerId = b.trigger_id;
    const teamId = b.team?.id || context.teamId;

    try {
      const [, stats] = await Promise.all([
        ack(),
        MeetupService.getPacingReportStats(30, teamId),
        publishHomeTab(client, b.user?.id, teamId),
      ]);

      if (triggerId) {
        await client.views.open({
          trigger_id: triggerId,
          view: {
            type: "modal",
            title: { type: "plain_text", text: "Pacing Report", emoji: true },
            close: { type: "plain_text", text: "Close" },
            blocks: buildPacingReportBlocks(stats, 30),
          },
        });
      }
    } catch (error: any) {
      console.error("Error handling legacy nav_tab_analytics:", error?.message || error);
    }
  });

  app.action("nav_tab_guide", async ({ ack, body, client, context }) => {
    const b = body as any;
    const triggerId = b.trigger_id;
    const teamId = b.team?.id || context.teamId;

    try {
      await Promise.all([
        ack(),
        publishHomeTab(client, b.user?.id, teamId),
        triggerId
          ? client.views.open({
              trigger_id: triggerId,
              view: buildGuideModal(),
            })
          : Promise.resolve(),
      ]);
    } catch (error: any) {
      console.error("Error handling legacy nav_tab_guide:", error?.message || error);
    }
  });
}
