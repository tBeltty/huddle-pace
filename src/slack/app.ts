import bolt from "@slack/bolt";
const { App, LogLevel } = bolt;
import { registerHomeHandlers } from "./handlers/homeHandlers.js";
import { registerModalHandlers } from "./handlers/modalHandlers.js";
import { registerActionHandlers } from "./handlers/actionHandlers.js";
import { registerCommandHandlers } from "./handlers/commandHandlers.js";

export function createSlackApp(): bolt.App {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  // Register all interactive listeners
  registerHomeHandlers(app);
  registerModalHandlers(app);
  registerActionHandlers(app);
  registerCommandHandlers(app);

  return app;
}
