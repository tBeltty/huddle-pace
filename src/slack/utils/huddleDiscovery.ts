export interface DetectedHuddle {
  ts: string;
  isActive: boolean;
  startedAt?: Date;
  timeFormatted: string;
  createdBy?: string;
  roomName?: string;
}

/**
 * Scans recent channel history for active and recent Huddle calls.
 */
export async function findChannelHuddles(client: any, channelId: string): Promise<DetectedHuddle[]> {
  if (!channelId) return [];

  try {
    const res = await client.conversations.history({
      channel: channelId,
      limit: 30,
    });

    if (!res.messages) return [];

    const huddles: DetectedHuddle[] = [];
    for (const msg of res.messages) {
      const isHuddle = msg.subtype === "huddle_thread" || msg.room != null;
      if (!isHuddle) continue;

      const hasEnded = msg.room?.has_ended === true || (msg.text && msg.text.toLowerCase().includes("huddle ended"));
      const creator = msg.room?.created_by || msg.user || "";
      const timestampMs = parseFloat(msg.ts) * 1000;
      const startedAt = !isNaN(timestampMs) ? new Date(timestampMs) : undefined;
      const timeFormatted = startedAt
        ? startedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "recent";

      huddles.push({
        ts: msg.ts,
        isActive: !hasEnded,
        startedAt,
        timeFormatted,
        createdBy: creator,
        roomName: msg.room?.name,
      });
    }

    return huddles;
  } catch (err: any) {
    if (err?.data?.error === "not_in_channel") {
      console.info(`HuddlePace is not a member of channel ${channelId}. Cannot inspect huddles directly.`);
    } else {
      console.warn(`Could not inspect conversations.history for channel ${channelId}:`, err?.data?.error || err.message);
    }
    return [];
  }
}

/**
 * Convenience helper to find the latest active Huddle thread ts, if any.
 */
export async function findActiveHuddleThread(client: any, channelId: string): Promise<string | null> {
  const huddles = await findChannelHuddles(client, channelId);
  const active = huddles.filter((h) => h.isActive);
  return active.length > 0 ? active[0].ts : null;
}
