import "dotenv/config";
import { getEnv } from "./config/env.js";
import { createSlackApp } from "./slack/app.js";
import { TimerWorker } from "./scheduler/timerWorker.js";
import { prisma } from "./db/client.js";
import { ensureDefaultInstallation } from "./slack/oauth/installationStore.js";

async function main() {
  const env = getEnv();

  // Ensure primary workspace installation is seeded for HTTP OAuth mode
  await ensureDefaultInstallation();

  const app = createSlackApp();
  const worker = new TimerWorker(app);

  // Start background periodic timer loop
  worker.start(30000); // 30-second ticks

  if (env.SOCKET_MODE) {
    await app.start(env.PORT);
    console.log(`⚡️ HuddlePace is live and connected via Slack Socket Mode (HTTP web port: ${env.PORT})!`);
    console.log(`🔗 Healthcheck endpoint: http://localhost:${env.PORT}/healthz`);
  } else {
    await app.start(env.PORT);
    console.log(`⚡️ HuddlePace is live on port ${env.PORT} via Slack HTTP OAuth mode!`);
    console.log(`🔗 Healthcheck endpoint: http://localhost:${env.PORT}/healthz`);
    console.log(`🔗 Install URL: http://localhost:${env.PORT}/slack/install`);
    console.log(`🔗 Events endpoint: http://localhost:${env.PORT}/slack/events`);
  }

  console.log("⏱️ Periodic scheduler is tracking active meetups.");

  // Proactively push updated App Home views to all workspace members on boot
  const { syncAllAppHomes } = await import("./slack/handlers/homeHandlers.js");
  syncAllAppHomes(app).catch((err) =>
    console.warn("Notice: Startup App Home sync deferred:", err?.message || err)
  );

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log("\nStopping HuddlePace gracefully...");
    worker.stop();
    await app.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error starting HuddlePace:", err);
  process.exit(1);
});
