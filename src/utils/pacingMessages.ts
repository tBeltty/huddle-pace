/**
 * Pacing message formatting for Slack thread context notes and speaker DMs.
 */

/**
 * Builds the compact 1-minute early warning message.
 *
 * Format:
 * :stopwatch: 1 Minute Remaining: Wrapping up "Module Name".
 *
 * next up is "Next Module" (Xm).
 */
export function formatOneMinuteWarningText(
  currentModuleTitle: string,
  nextModule?: { title: string; durationMinutes: number } | null
): string {
  if (nextModule) {
    return `:stopwatch: 1 Minute Remaining: Wrapping up "${currentModuleTitle}".\n\nnext up is "${nextModule.title}" (${nextModule.durationMinutes}m).`;
  }
  return `:stopwatch: 1 Minute Remaining: Wrapping up "${currentModuleTitle}".`;
}

/**
 * Builds the compact module starting / transition message.
 *
 * Format:
 * :compass: Starting "Module Name" (Xm)
 */
export function formatModuleStartingText(moduleTitle: string, durationMinutes: number): string {
  return `:compass: Starting "${moduleTitle}" (${durationMinutes}m)`;
}
