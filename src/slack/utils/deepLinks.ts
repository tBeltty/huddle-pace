/**
 * Utilities for generating native Slack deep links to App surfaces.
 * Reference: https://docs.slack.dev/surfaces/app-home/#deep_linking
 */

export interface DeepLinkOptions {
  teamId?: string;
  appId?: string;
  tab?: "home" | "about";
}

/**
 * Builds a native Slack protocol URI to navigate users directly to App Home.
 * Format: slack://app?team={TEAM_ID}&id={APP_ID}&tab={TAB}
 */
export function buildAppHomeDeepLink(options: DeepLinkOptions = {}): string {
  const appId = options.appId || process.env.SLACK_APP_ID || "";
  const tab = options.tab || "home";
  const params = new URLSearchParams();

  if (options.teamId) {
    params.set("team", options.teamId);
  }
  if (appId) {
    params.set("id", appId);
  }
  params.set("tab", tab);

  return `slack://app?${params.toString()}`;
}

/**
 * Builds a Slack mrkdwn link for App Home.
 */
export function buildAppHomeMrkdwnLink(
  label = "App Home",
  options: DeepLinkOptions = {}
): string {
  const url = buildAppHomeDeepLink(options);
  return `<${url}|${label}>`;
}
