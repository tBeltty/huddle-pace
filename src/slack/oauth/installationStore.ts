import { Installation, InstallationQuery, InstallationStore } from "@slack/bolt";
import { prisma } from "../../db/client.js";

/**
 * Prisma-backed multi-tenant InstallationStore for Slack OAuth v2.
 */
export const prismaInstallationStore: InstallationStore = {
  storeInstallation: async (installation: Installation) => {
    const teamId = installation.team?.id;
    const enterpriseId = installation.enterprise?.id;

    if (!teamId && !enterpriseId) {
      throw new Error("Cannot store installation: both teamId and enterpriseId are missing.");
    }

    const payload = {
      teamId: teamId || null,
      enterpriseId: enterpriseId || null,
      teamName: installation.team?.name || null,
      botToken: installation.bot?.token || null,
      botId: installation.bot?.id || null,
      botUserId: installation.bot?.userId || null,
      installedByUserId: installation.user?.id || null,
      installationData: JSON.stringify(installation),
    };

    if (teamId) {
      await prisma.slackInstallation.upsert({
        where: { teamId },
        create: payload,
        update: payload,
      });
    } else if (enterpriseId) {
      const existing = await prisma.slackInstallation.findFirst({
        where: { enterpriseId },
      });
      if (existing) {
        await prisma.slackInstallation.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await prisma.slackInstallation.create({
          data: payload,
        });
      }
    }
  },

  fetchInstallation: async (
    installQuery: InstallationQuery<boolean>
  ): Promise<Installation> => {
    let record = null;

    if (installQuery.teamId) {
      record = await prisma.slackInstallation.findUnique({
        where: { teamId: installQuery.teamId },
      });
    } else if (installQuery.enterpriseId) {
      record = await prisma.slackInstallation.findFirst({
        where: { enterpriseId: installQuery.enterpriseId },
      });
    } else {
      // Fallback only when query has neither teamId nor enterpriseId
      record = await prisma.slackInstallation.findFirst();
    }

    if (!record || !record.installationData) {
      throw new Error(
        `Installation not found for query: teamId=${installQuery.teamId}, enterpriseId=${installQuery.enterpriseId}`
      );
    }

    return JSON.parse(record.installationData) as Installation;
  },

  deleteInstallation: async (
    installQuery: InstallationQuery<boolean>
  ): Promise<void> => {
    if (installQuery.teamId) {
      await prisma.slackInstallation.deleteMany({
        where: { teamId: installQuery.teamId },
      });
    } else if (installQuery.enterpriseId) {
      await prisma.slackInstallation.deleteMany({
        where: { enterpriseId: installQuery.enterpriseId },
      });
    }
  },
};

/**
 * Resolves the bot token for background tasks (like TimerWorker).
 * Falls back to process.env.SLACK_BOT_TOKEN when running in single-tenant / dev mode.
 */
export async function getBotTokenForTeam(teamId?: string | null): Promise<string | undefined> {
  if (!teamId || teamId === "default") {
    return process.env.SLACK_BOT_TOKEN;
  }

  try {
    const record = await prisma.slackInstallation.findUnique({
      where: { teamId },
      select: { botToken: true },
    });
    return record?.botToken || process.env.SLACK_BOT_TOKEN;
  } catch (err) {
    console.warn(`Failed to resolve bot token for team ${teamId}:`, err);
    return process.env.SLACK_BOT_TOKEN;
  }
}

/**
 * Ensures that if a workspace has a static SLACK_BOT_TOKEN (e.g. primary workspace or dev mode),
 * it is registered in the database so Bolt's HTTP receiver can authorize it seamlessly.
 */
export async function ensureDefaultInstallation(): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) return;

  try {
    const existingCount = await prisma.slackInstallation.count();
    if (existingCount > 0) return;

    const res = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const auth = (await res.json()) as any;

    if (auth.ok && auth.team_id) {
      const installation = {
        team: { id: auth.team_id, name: auth.team as string },
        bot: {
          token: botToken,
          id: auth.bot_id as string,
          userId: auth.user_id as string,
        },
        tokenType: "bot" as const,
      };

      await prisma.slackInstallation.upsert({
        where: { teamId: auth.team_id },
        create: {
          teamId: auth.team_id,
          teamName: (auth.team as string) || null,
          botToken,
          botId: (auth.bot_id as string) || null,
          botUserId: (auth.user_id as string) || null,
          installedByUserId: (auth.user_id as string) || null,
          installationData: JSON.stringify(installation),
        },
        update: {
          teamName: (auth.team as string) || null,
          botToken,
          botId: (auth.bot_id as string) || null,
          botUserId: (auth.user_id as string) || null,
          installationData: JSON.stringify(installation),
        },
      });
      console.log(`✅ Default workspace installation auto-seeded for team: ${auth.team} (${auth.team_id})`);
    }
  } catch (err) {
    console.warn("Could not auto-seed default installation:", err);
  }
}
