import { ModalView } from "@slack/bolt";

export interface SettingsModalOptions {
  reminderTextEnabled: boolean;
  reminderImageEnabled: boolean;
  flexibilityMode?: "STRICT" | "STANDARD" | "RELAXED";
  teamId?: string;
}

/**
 * Builds the Settings modal for configuring workspace reminder preferences and pacing flexibility.
 */
export function buildSettingsModal(options: SettingsModalOptions): ModalView {
  const initialOptions: any[] = [];

  const textOption = {
    text: {
      type: "mrkdwn" as const,
      text: "*Send reminder text*\nPost a subtle finish-line checkpoint message in the Huddle thread.",
    },
    value: "reminder_text",
  };

  const imageOption = {
    text: {
      type: "mrkdwn" as const,
      text: "*Send reminder image*\nPost Vector's visual illustration banner in the Huddle thread.",
    },
    value: "reminder_image",
  };

  if (options.reminderTextEnabled) {
    initialOptions.push(textOption);
  }
  if (options.reminderImageEnabled) {
    initialOptions.push(imageOption);
  }

  const flexMode = (options.flexibilityMode || "STANDARD").toUpperCase();

  const flexibilityOptions = [
    {
      text: {
        type: "plain_text" as const,
        text: "Standard (15% grace buffer — ~3m on short, 10m on 1h)",
      },
      value: "STANDARD",
    },
    {
      text: {
        type: "plain_text" as const,
        text: "Relaxed (25% grace buffer — ~5m on short, 15m on 1h)",
      },
      value: "RELAXED",
    },
    {
      text: {
        type: "plain_text" as const,
        text: "Strict (0% grace buffer — zero overtime tolerance)",
      },
      value: "STRICT",
    },
  ];

  const initialFlexOption =
    flexibilityOptions.find((o) => o.value === flexMode) || flexibilityOptions[0];

  return {
    type: "modal",
    callback_id: "submit_settings_modal",
    private_metadata: JSON.stringify({ teamId: options.teamId || "default" }),
    title: {
      type: "plain_text",
      text: "HuddlePace Settings",
    },
    submit: {
      type: "plain_text",
      text: "Save Settings",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Thread Reminders (Approaching Finish Line)*\nConfigure default checkpoints dispatched when ~16.7% of meeting time remains (e.g. 10m before close on 1-hour sessions, 2–3m on shorter calls).",
        },
      },
      {
        type: "input",
        block_id: "reminder_settings_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Reminder Format",
        },
        element: {
          type: "checkboxes",
          action_id: "reminder_checkboxes",
          options: [textOption, imageOption],
          ...(initialOptions.length > 0 ? { initial_options: initialOptions } : {}),
        },
        hint: {
          type: "plain_text",
          text: "Uncheck both options to disable automated finish-line reminders entirely.",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Pacing Analytics & Flexibility*\nDefine the grace margin applied before marking sessions as overtime in workspace reports.",
        },
      },
      {
        type: "input",
        block_id: "flexibility_settings_block",
        label: {
          type: "plain_text",
          text: "Grace Margin Buffer",
        },
        element: {
          type: "static_select",
          action_id: "flexibility_mode_select",
          placeholder: {
            type: "plain_text",
            text: "Select flexibility mode",
          },
          initial_option: initialFlexOption,
          options: flexibilityOptions,
        },
        hint: {
          type: "plain_text",
          text: "Sessions wrapping up within the grace buffer are marked ⏳ Flexible without lowering team on-time compliance.",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 _Workspace defaults apply to all new scheduled sessions and instant `/pace 15m` launches._",
          },
        ],
      },
    ],
  };
}
