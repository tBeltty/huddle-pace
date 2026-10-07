import type { SlackClient } from "./slackClient.js";
import { MeetupService } from "../../services/meetupService.js";
import { nextQuarterHour, resolveSchedulingZone, zonedParts } from "../../utils/timezone.js";

export interface ScheduleContext {
  zone: string;
  scheduleDate: string;
  scheduleTime: string;
}

/** Slack timezone of a user, or null when it cannot be read. */
async function fetchUserZone(client: SlackClient, userId: string): Promise<string | null> {
  try {
    const res = await client.users.info({ user: userId });
    return res?.user?.tz || null;
  } catch {
    return null;
  }
}

/** Zone the workspace setting resolves to for this scheduler ("My timezone" reads their Slack tz). */
export async function resolveZoneForUser(client: SlackClient, userId: string | undefined, teamId = "default"): Promise<string> {
  const settings = await MeetupService.getWorkspaceSettings(teamId);
  const userZone = settings.timezone === "USER" && userId ? await fetchUserZone(client, userId) : null;
  return resolveSchedulingZone(settings.timezone, userZone);
}

/** Zone plus a default date and time (next quarter hour) for a fresh schedule modal. */
export async function getScheduleContext(client: SlackClient, userId: string | undefined, teamId = "default"): Promise<ScheduleContext> {
  const zone = await resolveZoneForUser(client, userId, teamId);
  const { date, time } = nextQuarterHour(new Date(), zone);
  return { zone, scheduleDate: date, scheduleTime: time };
}

/** Date and time of an existing meetup as the modal shows them in `zone`. */
export function scheduleContextFor(scheduledFor: Date | null | undefined, zone: string): ScheduleContext {
  if (!scheduledFor) {
    const { date, time } = nextQuarterHour(new Date(), zone);
    return { zone, scheduleDate: date, scheduleTime: time };
  }
  const { date, time } = zonedParts(scheduledFor, zone);
  return { zone, scheduleDate: date, scheduleTime: time };
}
