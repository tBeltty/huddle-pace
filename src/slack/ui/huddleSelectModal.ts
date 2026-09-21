import { ModalView } from "@slack/bolt";
import { DetectedHuddle } from "../utils/huddleDiscovery.js";

export function buildHuddleSelectionModal(
  meetupId: string,
  meetupTitle: string,
  channelId: string,
  huddles: DetectedHuddle[]
): ModalView {
  const options = huddles.map((h, index) => {
    const timePart = h.timeFormatted ? ` (${h.timeFormatted})` : "";
    const label = `🟢 Active Huddle #${index + 1}${timePart}`.slice(0, 75);
    return {
      text: { type: "plain_text" as const, text: label, emoji: true },
      value: h.ts,
    };
  });

  options.push({
    text: { type: "plain_text" as const, text: "💬 Main Channel Feed (No Huddle thread)", emoji: true },
    value: "main",
  });

  return {
    type: "modal",
    callback_id: "submit_launch_huddle_select_modal",
    title: {
      type: "plain_text",
      text: "Select Huddle",
    },
    submit: {
      type: "plain_text",
      text: "Launch Tracker",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    private_metadata: JSON.stringify({ meetupId, channelId }),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Multiple Huddles were found in <#${channelId}> for *${meetupTitle}*.\nSelect which Huddle thread the live tracker should attach to:`,
        },
      },
      {
        type: "input",
        block_id: "launch_huddle_block",
        element: {
          type: "static_select",
          action_id: "launch_huddle_select",
          initial_option: options[0],
          options,
        },
        label: {
          type: "plain_text",
          text: "Target Huddle Thread",
        },
      },
    ],
  };
}
