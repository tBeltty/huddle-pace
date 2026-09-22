import bolt from "@slack/bolt";
const { App, LogLevel } = bolt;
import { registerHomeHandlers } from "./handlers/homeHandlers.js";
import { registerModalHandlers } from "./handlers/modalHandlers.js";
import { registerActionHandlers } from "./handlers/actionHandlers.js";
import { registerCommandHandlers } from "./handlers/commandHandlers.js";
import { registerHuddleHandlers } from "./handlers/huddleHandlers.js";
import { prismaInstallationStore } from "./oauth/installationStore.js";
import { getEnv } from "../config/env.js";
import { getWebCustomRoutes } from "../web/landingPage.js";

export function createSlackApp(): bolt.App {
  const env = getEnv();

  const redirectUri = env.SLACK_REDIRECT_URI || "https://huddlepace.com/slack/oauth_redirect";
  const redirectUriPath = new URL(redirectUri).pathname;

  const customRoutes = [
    {
      path: "/healthz",
      method: ["GET", "HEAD"],
      handler: (_req: any, res: any) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        if (_req.method === "HEAD") {
          res.end();
          return;
        }
        res.end(
          JSON.stringify({
            status: "ok",
            mode: env.SOCKET_MODE ? "socket-mode" : "http-oauth",
            version: "1.1.0-home-reactivity",
            timestamp: new Date().toISOString(),
          })
        );
      },
    },
    {
      path: "/debug-publish-home",
      method: ["GET"],
      handler: async (req: any, res: any) => {
        try {
          const { prisma } = await import("../db/client.js");
          const install = await prisma.slackInstallation.findFirst();
          if (!install || !install.botToken) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "No installation found" }));
            return;
          }

          const urlObj = new URL(req.url, "http://localhost");
          let targetUserId = urlObj.searchParams.get("userId");

          const usersRes = (await fetch("https://slack.com/api/users.list?limit=100", {
            headers: { Authorization: `Bearer ${install.botToken}` },
          }).then((r) => r.json())) as any;

          const nonBotUsers = (usersRes.members || []).filter(
            (m: any) => !m.is_bot && !m.deleted && m.id !== "USLACKBOT"
          );

          const { publishHomeTab } = await import("./handlers/homeHandlers.js");
          const customClient = {
            views: {
              publish: async (args: any) => {
                const apiRes = (await fetch("https://slack.com/api/views.publish", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${install.botToken}`,
                    "Content-Type": "application/json; charset=utf-8",
                  },
                  body: JSON.stringify(args),
                }).then((r) => r.json())) as any;
                if (!apiRes.ok) {
                  throw new Error(`Slack API error: ${apiRes.error} (${JSON.stringify(apiRes.response_metadata || {})})`);
                }
                return apiRes;
              },
            },
          };

          const publishedUsers = [];
          for (const u of nonBotUsers) {
            await publishHomeTab(customClient, u.id, install.teamId || undefined);
            publishedUsers.push({
              id: u.id,
              name: u.name,
              real_name: u.real_name || u.profile?.real_name,
            });
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            status: "published_all",
            teamId: install.teamId,
            publishedCount: publishedUsers.length,
            users: publishedUsers,
          }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: err.message,
            data: err.data,
          }));
        }
      },
    },
    {
      path: "/debug-logs",
      method: ["GET"],
      handler: async (_req: any, res: any) => {
        try {
          const { execSync } = await import("node:child_process");
          const logs = execSync("pm2 logs huddle-pace --lines 40 --nostream", { encoding: "utf8" });
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(logs);
        } catch (e: any) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(e.message);
        }
      },
    },
    ...getWebCustomRoutes(),
  ];

  const app = env.SOCKET_MODE
    ? new App({
        token: env.SLACK_BOT_TOKEN,
        appToken: env.SLACK_APP_TOKEN,
        socketMode: true,
        tokenVerificationEnabled: false,
        installerOptions: {
          port: env.PORT,
        },
        customRoutes,
        logLevel: LogLevel.INFO,
      })
    : new App({
        signingSecret: env.SLACK_SIGNING_SECRET!,
        clientId: env.SLACK_CLIENT_ID,
        clientSecret: env.SLACK_CLIENT_SECRET,
        stateSecret: env.SLACK_STATE_SECRET,
        redirectUri,
        scopes: [
          "commands",
          "chat:write",
          "channels:join",
          "im:write",
          "channels:history",
          "groups:history",
          "im:history",
          "mpim:history",
          "users:read",
        ],
        installationStore: prismaInstallationStore,
        installerOptions: {
          directInstall: true,
          redirectUriPath,
        },
        customRoutes,
        logLevel: LogLevel.INFO,
      });

  // Register all interactive listeners
  registerHomeHandlers(app);
  registerModalHandlers(app);
  registerActionHandlers(app);
  registerCommandHandlers(app);
  registerHuddleHandlers(app);

  return app;
}
