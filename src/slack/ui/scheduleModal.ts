import { ModalView } from "@slack/bolt";
import { DetectedHuddle } from "../utils/huddleDiscovery.js";

export const MAX_SUBTOPICS = 10;

export interface ModalSubtopicState {
  title: string;
  pct: string;
}

export interface ModalStateData {
  title?: string;
  duration?: number;
  channelId?: string;
  currentUserId?: string;
  speakerUserIds?: string[];
  subtopicCount: number;
  selectedHuddleChoice?: string;
  customThreadTs?: string;
  availableHuddles?: DetectedHuddle[];
  customSubtopics?: ModalSubtopicState[];
  customDuration?: string;
}

export function buildScheduleModal(initialState?: Partial<ModalStateData>): ModalView {
  const count = initialState?.subtopicCount ?? 3;

  // Default suggested distribution presets for 3 rows
  const defaultPresets = [
    { title: "Context & Introduction", pct: "15" },
    { title: "Core Topic / Demo", pct: "60" },
    { title: "Open Q&A & Wrap-up", pct: "25" },
  ];

  const initialSpeakers = initialState?.speakerUserIds && initialState.speakerUserIds.length > 0
    ? initialState.speakerUserIds
    : initialState?.currentUserId
    ? [initialState.currentUserId]
    : [];

  const speakerElement: any = {
    type: "multi_users_select",
    action_id: "speaker_select",
    placeholder: {
      type: "plain_text",
      text: "Select one or more speakers",
    },
  };

  if (initialSpeakers.length > 0) {
    speakerElement.initial_users = initialSpeakers;
  }

  // Construct Huddle selector options
  const detectedHuddles = initialState?.availableHuddles || [];
  const huddleOptions: any[] = [];

  // 1. Detected Huddles in this channel
  if (detectedHuddles.length > 0) {
    detectedHuddles.forEach((h, index) => {
      const statusIcon = h.isActive ? "🟢 Active" : "⚪ Recent";
      const timePart = h.timeFormatted ? ` (${h.timeFormatted})` : "";
      const namePart = h.roomName
        ? `"${h.roomName}"`
        : h.createdBy
        ? `by <@${h.createdBy}>`
        : `Huddle #${index + 1}`;
      const labelText = `${statusIcon} ${namePart}${timePart}`.slice(0, 75);
      huddleOptions.push({
        text: { type: "plain_text", text: labelText, emoji: true },
        value: `huddle_${h.ts}`,
      });
    });
  }

  // 2. Auto-detect option
  huddleOptions.push({
    text: { type: "plain_text", text: "⚡ Auto-detect active Huddle on start", emoji: true },
    value: "auto",
  });

  // 3. Main channel feed option
  huddleOptions.push({
    text: { type: "plain_text", text: "💬 Main Channel Feed (No Huddle thread)", emoji: true },
    value: "main",
  });

  // 4. Custom thread option
  huddleOptions.push({
    text: { type: "plain_text", text: "🔗 Custom Thread Link / TS", emoji: true },
    value: "custom",
  });

  // Select initial option
  let initialHuddleOption = huddleOptions.find((o) => o.value === initialState?.selectedHuddleChoice);
  if (!initialHuddleOption) {
    const firstActive = detectedHuddles.find((h) => h.isActive);
    if (firstActive) {
      initialHuddleOption = huddleOptions.find((o) => o.value === `huddle_${firstActive.ts}`) || huddleOptions[0];
    } else {
      initialHuddleOption = huddleOptions.find((o) => o.value === "auto");
    }
  }

  const durationOptions = [
    { text: { type: "plain_text" as const, text: "15 minutes" }, value: "15" },
    { text: { type: "plain_text" as const, text: "20 minutes" }, value: "20" },
    { text: { type: "plain_text" as const, text: "30 minutes" }, value: "30" },
    { text: { type: "plain_text" as const, text: "45 minutes" }, value: "45" },
    { text: { type: "plain_text" as const, text: "60 minutes (1 hour)" }, value: "60" },
    { text: { type: "plain_text" as const, text: "90 minutes (1.5 hours)" }, value: "90" },
    { text: { type: "plain_text" as const, text: "120 minutes (2 hours)" }, value: "120" },
  ];

  const durationStr = (initialState?.duration || 60).toString();
  const initialDuration =
    durationOptions.find((d) => d.value === durationStr) ||
    durationOptions.find((d) => d.value === "60") ||
    durationOptions[0];

  const blocks: any[] = [
    {
      type: "input",
      block_id: "title_block",
      element: {
        type: "plain_text_input",
        action_id: "title_input",
        placeholder: {
          type: "plain_text",
          text: "e.g. Onboarding Sprint, Architecture Sync",
        },
        initial_value: initialState?.title || "",
      },
      label: {
        type: "plain_text",
        text: "Session Title",
      },
    },
    {
      type: "input",
      block_id: "speaker_block",
      element: speakerElement,
      label: {
        type: "plain_text",
        text: "Session Speaker(s)",
      },
    },
    {
      type: "input",
      block_id: "channel_block",
      element: {
        type: "conversations_select",
        action_id: "channel_select",
        response_url_enabled: false,
        filter: {
          include: ["public", "private"],
        },
        placeholder: {
          type: "plain_text",
          text: "Select target channel",
        },
        ...(initialState?.channelId
          ? { initial_conversation: initialState.channelId }
          : {}),
      },
      label: {
        type: "plain_text",
        text: "Target Channel",
      },
    },
    {
      type: "input",
      block_id: "huddle_select_block",
      element: {
        type: "static_select",
        action_id: "huddle_select",
        placeholder: {
          type: "plain_text",
          text: "Select Huddle destination",
        },
        initial_option: initialHuddleOption,
        options: huddleOptions,
      },
      label: {
        type: "plain_text",
        text: "Huddle Destination",
      },
      hint: {
        type: "plain_text",
        text: detectedHuddles.length > 0
          ? `Found ${detectedHuddles.length} Huddle(s) in this channel. Choose one to lock it in directly.`
          : "Choose whether to auto-detect on start, link to a Huddle, or post to main feed.",
      },
    },
    {
      type: "input",
      block_id: "custom_thread_block",
      optional: true,
      element: {
        type: "plain_text_input",
        action_id: "custom_thread_input",
        placeholder: {
          type: "plain_text",
          text: "Leave blank, or paste Slack message URL / thread timestamp",
        },
        initial_value: initialState?.customThreadTs || "",
      },
      label: {
        type: "plain_text",
        text: "Custom Thread Link / TS (Optional)",
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
        initial_option: initialDuration,
        options: durationOptions,
      },
      label: {
        type: "plain_text",
        text: "Duration",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📌 Agenda Modules & Time Budget (%) Allocation*\nAllocate percentage for each module. *Total must equal 100%*.",
      },
    },
  ];

  // Dynamically render subtopic rows
  for (let i = 0; i < count; i++) {
    const custom = initialState?.customSubtopics?.[i];
    const defaultSuggestion = defaultPresets[i] || { title: `Subtopic #${i + 1} Name`, pct: "25" };

    const titlePlaceholder = defaultSuggestion.title;
    const pctPlaceholder = defaultSuggestion.pct;

    const titleElement: any = {
      type: "plain_text_input",
      action_id: `subtopic_title_input_${i}`,
      placeholder: {
        type: "plain_text",
        text: titlePlaceholder,
      },
    };
    if (custom?.title) {
      titleElement.initial_value = custom.title;
    }

    const pctElement: any = {
      type: "plain_text_input",
      action_id: `subtopic_pct_input_${i}`,
      placeholder: {
        type: "plain_text",
        text: pctPlaceholder,
      },
    };
    if (custom?.pct) {
      pctElement.initial_value = custom.pct;
    }

    blocks.push(
      {
        type: "input",
        block_id: `subtopic_title_${i}`,
        element: titleElement,
        label: {
          type: "plain_text",
          text: `Module ${i + 1} Topic`,
        },
      },
      {
        type: "input",
        block_id: `subtopic_pct_${i}`,
        element: pctElement,
        label: {
          type: "plain_text",
          text: `Module ${i + 1} Time Budget (%)`,
        },
      }
    );
  }

  // Add More Subtopics Button (capped at MAX_SUBTOPICS to prevent Slack 100-block limit errors)
  if (count < MAX_SUBTOPICS) {
    blocks.push({
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
    });
  } else {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "ℹ️ _Maximum of 10 agenda modules reached._",
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "💡 _Example: 15% intro + 60% talk + 25% Q&A = 100%._",
      },
    ],
  });

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
    private_metadata: JSON.stringify({
      subtopicCount: count,
      channelId: initialState?.channelId,
    }),
    blocks,
  };
}
