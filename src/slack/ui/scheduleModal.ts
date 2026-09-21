import { ModalView } from "@slack/bolt";

export interface ModalStateData {
  title?: string;
  duration?: number;
  channelId?: string;
  subtopicCount: number;
}

export function buildScheduleModal(initialState?: Partial<ModalStateData>): ModalView {
  const count = initialState?.subtopicCount ?? 3;

  // Default suggested distribution presets for 3 rows
  const defaultPresets = [
    { title: "Context & Introduction", pct: "15" },
    { title: "Core Topic / Demo", pct: "60" },
    { title: "Open Q&A & Wrap-up", pct: "25" },
  ];

  const blocks: any[] = [
    {
      type: "input",
      block_id: "title_block",
      element: {
        type: "plain_text_input",
        action_id: "title_input",
        placeholder: {
          type: "plain_text",
          text: "e.g., Docker & Kubernetes Architecture Deep-Dive",
        },
        initial_value: initialState?.title || "",
      },
      label: {
        type: "plain_text",
        text: "Meetup Title / Topic",
      },
    },
    {
      type: "input",
      block_id: "channel_block",
      element: {
        type: "conversations_select",
        action_id: "channel_select",
        default_to_current_conversation: true,
        response_url_enabled: false,
        placeholder: {
          type: "plain_text",
          text: "Select channel or Huddle room",
        },
      },
      label: {
        type: "plain_text",
        text: "Target Channel",
      },
    },
    {
      type: "input",
      block_id: "duration_block",
      element: {
        type: "static_select",
        action_id: "duration_select",
        placeholder: {
          type: "plain_text",
          text: "Select duration",
        },
        initial_option: {
          text: { type: "plain_text", text: "60 minutes" },
          value: "60",
        },
        options: [
          { text: { type: "plain_text", text: "30 minutes" }, value: "30" },
          { text: { type: "plain_text", text: "45 minutes" }, value: "45" },
          { text: { type: "plain_text", text: "60 minutes" }, value: "60" },
          { text: { type: "plain_text", text: "90 minutes" }, value: "90" },
          { text: { type: "plain_text", text: "120 minutes" }, value: "120" },
        ],
      },
      label: {
        type: "plain_text",
        text: "Total Scheduled Duration",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📌 Subtopics & Percentage (%) Allocation*\nDefine modules and allocate percentages. *Total must equal 100%*.",
      },
    },
  ];

  // Dynamically render subtopic rows
  for (let i = 0; i < count; i++) {
    const preset = defaultPresets[i] || { title: `Subtopic ${i + 1}`, pct: "0" };

    blocks.push(
      {
        type: "input",
        block_id: `subtopic_title_${i}`,
        element: {
          type: "plain_text_input",
          action_id: `subtopic_title_input_${i}`,
          placeholder: {
            type: "plain_text",
            text: `Subtopic #${i + 1} Name`,
          },
          initial_value: preset.title,
        },
        label: {
          type: "plain_text",
          text: `Module ${i + 1} Topic`,
        },
      },
      {
        type: "input",
        block_id: `subtopic_pct_${i}`,
        element: {
          type: "plain_text_input",
          action_id: `subtopic_pct_input_${i}`,
          placeholder: {
            type: "plain_text",
            text: "e.g. 25",
          },
          initial_value: preset.pct,
        },
        label: {
          type: "plain_text",
          text: `Module ${i + 1} Time Budget (%)`,
        },
      }
    );
  }

  // Add More Subtopics Button
  blocks.push(
    {
      type: "actions",
      block_id: "add_row_actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "➕ Add Another Subtopic",
            emoji: true,
          },
          action_id: "add_subtopic_row_action",
          value: JSON.stringify({ subtopicCount: count + 1 }),
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "💡 _Example: 15% intro + 60% talk + 25% Q&A = 100%._",
        },
      ],
    }
  );

  return {
    type: "modal",
    callback_id: "submit_schedule_modal",
    title: {
      type: "plain_text",
      text: "Schedule Meetup",
    },
    submit: {
      type: "plain_text",
      text: "Schedule & Ready",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    private_metadata: JSON.stringify({ subtopicCount: count }),
    blocks,
  };
}
