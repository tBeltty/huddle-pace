import { ModalView } from "@slack/bolt";
import { formatEventTime } from "../../utils/timezone.js";

export interface ScheduleConflictOptions {
  token: string;
  channelId: string;
  zone: string;
  /** The pace already scheduled close to the requested time. */
  existingTitle: string;
  existingTime: Date;
  /** Code the new pace gets if the user saves it for manual start, e.g. "m1". */
  manualCode: string;
}

/**
 * Notice pushed on top of the schedule form when another pace sits within the capture window.
 * Submit saves the pace for manual start; closing returns to the form to pick another time.
 */
export function buildScheduleConflictModal(options: ScheduleConflictOptions): ModalView {
  const when = formatEventTime(options.existingTime, options.zone);
  return {
    type: "modal",
    callback_id: "submit_schedule_conflict_modal",
    notify_on_close: true,
    private_metadata: JSON.stringify({ token: options.token }),
    title: { type: "plain_text", text: "Time conflict" },
    submit: { type: "plain_text", text: "Save for manual start" },
    close: { type: "plain_text", text: "Change time" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*There is already a pace at ${when} in <#${options.channelId}>*\n"${options.existingTitle}" starts around the same time. Both would look for the same Huddle, so HuddlePace could attach the wrong one.`,
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Save for manual start*\nKeeps this pace as \`${options.manualCode}\`. It will not start on its own. When its Huddle begins, type \`/pace start ${options.manualCode}\` in <#${options.channelId}>.`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Change time*\nGoes back to the form. Times within 20 minutes of the other pace stay blocked.",
        },
      },
    ],
  };
}
