import "dotenv/config";
import { getEnv } from "./config/env.js";
import { createSlackApp } from "./slack/app.js";
import { TimerWorker } from "./scheduler/timerWorker.js";
import { prisma } from "./db/client.js";

async function main() {
  // Validate runtime environment variables early
  getEnv();

  const app = createSlackApp();
  const worker = new TimerWorker(app);

  // Start background periodic timer loop
  worker.start(30000); // 30-second ticks

  // Connect to Slack via Socket Mode
  await app.start();

  console.log("⚡️ HuddlePace is live and connected via Slack Socket Mode!");
  console.log("⏱️ Periodic scheduler is tracking active meetups.");

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
