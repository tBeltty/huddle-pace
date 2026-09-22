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
 * Automatically ensures bot is joined to public channels to prevent not_in_channel errors.
 */
export async function findChannelHuddles(client: any, channelId: string): Promise<DetectedHuddle[]> {
  if (!channelId) return [];

  try {
    // Proactively attempt to join channel (silently ignored if already a member or private)
    try {
      await client.conversations.join({ channel: channelId });
    } catch {
      // Ignore join failures
    }

    const res = await client.conversations.history({
      channel: channelId,
      limit: 50,
    });

    if (!res.messages) return [];

    const huddles: DetectedHuddle[] = [];
    for (const msg of res.messages) {
      const isHuddle =
        msg.subtype === "huddle_thread" ||
        msg.subtype === "sh_room_created" ||
        msg.room != null ||
        (msg.text &&
          (msg.text.toLowerCase().includes("started a huddle") ||
            msg.text.toLowerCase().includes("joined the huddle") ||
            msg.text.toLowerCase().includes("huddle started")));

      if (!isHuddle) continue;

      const hasEnded =
        msg.room?.has_ended === true ||
        (msg.room?.date_end != null && msg.room.date_end > 0) ||
        (msg.text &&
          (msg.text.toLowerCase().includes("huddle ended") ||
            msg.text.toLowerCase().includes("ended a huddle") ||
            msg.text.toLowerCase().includes("call ended")));

      const creator = msg.room?.created_by || msg.user || "";
      const timestampMs = parseFloat(msg.ts) * 1000;
      const startedAt = !isNaN(timestampMs) ? new Date(timestampMs) : undefined;
      const timeFormatted = startedAt
        ? startedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "recent";

      let roomName = msg.room?.name || "";
      if (!roomName && msg.text) {
        const textMatch = msg.text.match(/started a huddle(?::\s*(.+))?/i);
        if (textMatch && textMatch[1]) {
          roomName = textMatch[1].trim();
        }
      }

      huddles.push({
        ts: msg.ts,
        isActive: !hasEnded,
        startedAt,
        timeFormatted,
        createdBy: creator,
        roomName: roomName || undefined,
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
