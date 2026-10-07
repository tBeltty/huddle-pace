import type { App } from "@slack/bolt";

/** The Web API client Bolt hands to every listener. */
export type SlackClient = App["client"];
