import { ModalView } from "@slack/bolt";

export interface SettingsModalOptions {
  reminderTextEnabled: boolean;
  reminderImageEnabled: boolean;
  flexibilityMode?: "STRICT" | "STANDARD" | "RELAXED";
  managerUserIds?: string[];
  teamId?: string;
  canEdit?: boolean;
}

/**
 * Builds the Settings modal for configuring workspace reminder preferences,
 * pacing flexibility, and delegated Bot Manager permissions.
 */
export function buildSettingsModal(options: SettingsModalOptions): ModalView {
  const canEdit = options.canEdit !== false;
  const flexMode = (options.flexibilityMode || "STANDARD").toUpperCase();

  const flexDescriptions: Record<string, { label: string; desc: string }> = {
    STANDARD: {
      label: "Standard (15% grace buffer)",
      desc: "Grants ~3m on short standups and 10m on 1-hour meetings before marking overtime.",
    },
    RELAXED: {
      label: "Relaxed (25% grace buffer)",
      desc: "Grants ~5m on short standups and 15m on 1-hour meetings for open-ended discussions.",
    },
    STRICT: {
      label: "Strict (0% grace buffer)",
      desc: "Zero overtime tolerance. Meetings exceeding scheduled budget lower compliance.",
    },
  };

  const currentFlex = flexDescriptions[flexMode] || flexDescriptions.STANDARD;

  // Read-only modal for regular members without admin or manager privileges
  if (!canEdit) {
    const managerMentions =
      options.managerUserIds && options.managerUserIds.length > 0
        ? options.managerUserIds.map((u) => `<@${u}>`).join(", ")
        : "_No delegated managers (Admins & Owners only)_";

    return {
      type: "modal",
      callback_id: "view_settings_modal_readonly",
      private_metadata: JSON.stringify({ teamId: options.teamId || "default" }),
      title: {
        type: "plain_text",
        text: "HuddlePace Settings",
      },
      close: {
        type: "plain_text",
        text: "Close",
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🔒 *Read-Only View*\nWorkspace settings can only be modified by Slack Admins and designated Bot Managers. You are viewing the active workspace defaults.",
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Thread Reminders (Approaching Finish Line)*\n• *Finish-line text checkpoint:* ${
              options.reminderTextEnabled ? "*Active*" : "*Disabled*"
            }\n• *Visual illustration banner:* ${
              options.reminderImageEnabled ? "*Active*" : "*Disabled*"
            }`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Pacing Analytics & Flexibility*\n• *Grace Buffer:* *${currentFlex.label}*\n_${currentFlex.desc}_`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Delegated Bot Managers*\n${managerMentions}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 _Contact a workspace admin or designated bot manager to adjust these defaults._",
            },
          ],
        },
      ],
    };
  }

  // Editable modal for Workspace Admins, App Installers, and Bot Managers
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
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Delegated Bot Managers*\nWorkspace Admins and Owners always have full settings access. You can designate teammates as Bot Managers to configure reminders and pacing rules.",
        },
      },
      {
        type: "input",
        block_id: "manager_settings_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Designated Bot Managers",
        },
        element: {
          type: "multi_users_select",
          action_id: "manager_users_select",
          placeholder: {
            type: "plain_text",
            text: "Select teammates",
          },
          ...(options.managerUserIds && options.managerUserIds.length > 0
            ? { initial_users: options.managerUserIds }
            : {}),
        },
        hint: {
          type: "plain_text",
          text: "Users selected here can open and save workspace settings.",
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
