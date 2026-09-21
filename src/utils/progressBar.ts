/**
 * Generates a clean text progress bar for Slack messages.
 *
 * @param percent Number between 0 and 100
 * @param length Total character width of the bar
 * @returns e.g. "[████████░░░░░░░░] 50%"
 */
export function renderProgressBar(percent: number, length = 16): string {
  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
  const filledBlocks = Math.round((clampedPercent / 100) * length);
  const emptyBlocks = length - filledBlocks;

  const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
  return `\`[${bar}]\` *${clampedPercent}%*`;
}

/**
 * Formats a duration in minutes into a human-readable string.
 * e.g., 65 -> "1h 5m", 45 -> "45m"
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
