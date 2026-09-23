import bolt from "@slack/bolt";
const { App, LogLevel } = bolt;
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version: APP_VERSION } = require("../../package.json") as { version: string };
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
            version: APP_VERSION,
            timestamp: new Date().toISOString(),
          })
        );
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
