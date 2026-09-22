export interface DetectedHuddle {
  ts: string;
  isActive: boolean;
  startedAt?: Date;
  timeFormatted: string;
  createdBy?: string;
  roomName?: string;
}

/**
 * Checks if a Slack message represents a Huddle call (English, Spanish, French, German, or raw JSON).
 */
export function isHuddleMessage(msg: any): boolean {
  if (!msg) return false;
  const rawSubtype = (msg.subtype || "").toLowerCase();

  if (
    rawSubtype === "huddle_thread" ||
    rawSubtype === "sh_room_created" ||
    rawSubtype === "channel_huddle" ||
    rawSubtype === "room_topic" ||
    msg.room != null
  ) {
    return true;
  }

  const rawText = (msg.text || "").toLowerCase();
  if (
    rawText.includes("huddle") ||
    rawText.includes("started a call") ||
    rawText.includes("inició una llamada")
  ) {
    return true;
  }

  try {
    const rawJson = JSON.stringify(msg).toLowerCase();
    if (rawJson.includes("huddle_thread") || rawJson.includes('"room":') || rawJson.includes("huddle")) {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Checks if a Huddle call message has formally ended.
 */
export function isHuddleEnded(msg: any): boolean {
  if (!msg) return false;
  if (msg.room?.has_ended === true) return true;
  if (msg.room?.date_end != null && msg.room.date_end > 0) return true;

  const rawText = (msg.text || "").toLowerCase();
  const endedKeywords = [
    "huddle ended",
    "ended a huddle",
    "call ended",
    "ended the call",
    "huddle finalizado",
    "finalizó el huddle",
    "finalizó un huddle",
    "terminó el huddle",
    "terminó un huddle",
    "llamada finalizada",
    "huddle terminé",
    "huddle beendet",
  ];

  return endedKeywords.some((kw) => rawText.includes(kw));
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
    const seenTs = new Set<string>();

    for (const msg of res.messages) {
      if (!isHuddleMessage(msg)) continue;

      // Identify the Huddle thread root (even if msg is an in-huddle reply)
      const rootTs = msg.thread_ts || msg.ts;
      if (seenTs.has(rootTs)) continue;
      seenTs.add(rootTs);

      const hasEnded = isHuddleEnded(msg);
      const creator = msg.room?.created_by || msg.user || "";
      const timestampMs = parseFloat(rootTs) * 1000;
      const startedAt = !isNaN(timestampMs) ? new Date(timestampMs) : undefined;
      const timeFormatted = startedAt
        ? startedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "recent";

      let roomName = msg.room?.name || "";
      if (!roomName && msg.text) {
        const textMatch = msg.text.match(/(?:started a huddle|inici(?:ó|ado) un huddle)(?::\s*(.+))?/i);
        if (textMatch && textMatch[1]) {
          roomName = textMatch[1].trim();
        }
      }

      huddles.push({
        ts: rootTs,
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

