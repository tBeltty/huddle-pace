/**
 * Timezone helpers for scheduling. A workspace stores one setting:
 * "PT" (default), "USER" (each scheduler's own Slack timezone) or an IANA zone id.
 * Wall-clock times picked in the schedule modal are read in the resolved zone.
 */

export const PT_ZONE = "America/Los_Angeles";
export const DEFAULT_TIMEZONE_SETTING = "PT";

export const COMMON_ZONES: { id: string; label: string }[] = [
  { id: "America/Los_Angeles", label: "Los Angeles (Pacific)" },
  { id: "America/Denver", label: "Denver (Mountain)" },
  { id: "America/Chicago", label: "Chicago (Central)" },
  { id: "America/New_York", label: "New York (Eastern)" },
  { id: "America/Mexico_City", label: "Mexico City" },
  { id: "America/Bogota", label: "Bogotá" },
  { id: "America/Lima", label: "Lima" },
  { id: "America/Santiago", label: "Santiago" },
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { id: "America/Sao_Paulo", label: "São Paulo" },
  { id: "UTC", label: "UTC" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Madrid", label: "Madrid" },
  { id: "Europe/Paris", label: "Paris" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "Africa/Johannesburg", label: "Johannesburg" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Kolkata", label: "India (Kolkata)" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Pacific/Auckland", label: "Auckland" },
];

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A stored setting is "PT", "USER" or a valid IANA id. Anything else falls back to PT. */
export function normalizeTimezoneSetting(value: string | null | undefined): string {
  if (!value) return DEFAULT_TIMEZONE_SETTING;
  if (value === "PT" || value === "USER") return value;
  return isValidZone(value) ? value : DEFAULT_TIMEZONE_SETTING;
}

/** Resolves the setting to an IANA zone. "USER" uses the scheduler's own zone, PT when unknown. */
export function resolveSchedulingZone(setting: string | null | undefined, userZone?: string | null): string {
  const normalized = normalizeTimezoneSetting(setting);
  if (normalized === "PT") return PT_ZONE;
  if (normalized === "USER") return userZone && isValidZone(userZone) ? userZone : PT_ZONE;
  return normalized;
}

/** Offset in milliseconds of `zone` from UTC at `instantMilliseconds` (positive east of UTC). */
function zoneOffsetMilliseconds(instantMilliseconds: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMilliseconds));
  const partValue = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    partValue("year"),
    partValue("month") - 1,
    partValue("day"),
    partValue("hour"),
    partValue("minute"),
    partValue("second")
  );
  return wallClockAsUtc - Math.floor(instantMilliseconds / 1000) * 1000;
}

/**
 * Converts a wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in `zone` to the UTC instant.
 * Times skipped by a spring-forward gap resolve to the instant just after the gap.
 */
export function zonedWallTimeToUtc(date: string, time: string, zone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  // The offset can differ before and after a DST boundary, so test both candidate instants.
  const offsetBefore = zoneOffsetMilliseconds(wallClockAsUtc - 24 * 3_600_000, zone);
  const offsetAfter = zoneOffsetMilliseconds(wallClockAsUtc + 24 * 3_600_000, zone);
  const candidates = [wallClockAsUtc - offsetBefore, wallClockAsUtc - offsetAfter].map((ms) => new Date(ms));

  const exact = candidates.find((candidate) => {
    const seen = zonedParts(candidate, zone);
    return seen.date === date && seen.time === time;
  });
  // A time inside a spring-forward gap matches neither; the later instant is just after the gap.
  return exact ?? candidates.reduce((later, candidate) => (candidate > later ? candidate : later));
}

/** "YYYY-MM-DD" and "HH:mm" of an instant as seen in `zone`. */
export function zonedParts(instant: Date, zone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const partValue = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${partValue("year")}-${partValue("month")}-${partValue("day")}`,
    time: `${partValue("hour")}:${partValue("minute")}`,
  };
}

/** Short zone label: "PT" for the Pacific zone, otherwise the Intl abbreviation (e.g. "GMT-5"). */
export function zoneLabel(zone: string, at: Date = new Date()): string {
  if (zone === PT_ZONE) return "PT";
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  return name || zone;
}

/** "10:00 AM PT": the event time with its timezone, for summaries and notices. */
export function formatEventTime(instant: Date, zone: string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(instant);
  return `${time} ${zoneLabel(zone, instant)}`;
}

/** "Wed, Oct 7 at 10:00 AM PT" */
export function formatEventDateTime(instant: Date, zone: string): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(instant);
  return `${day} at ${formatEventTime(instant, zone)}`;
}

/** Next quarter hour after `now` in `zone`, as a default for the time picker. */
export function nextQuarterHour(now: Date, zone: string): { date: string; time: string } {
  const quarterHourMilliseconds = 15 * 60_000;
  const next = new Date(Math.ceil((now.getTime() + 1) / quarterHourMilliseconds) * quarterHourMilliseconds);
  return zonedParts(next, zone);
}
