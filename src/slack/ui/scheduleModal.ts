import { ModalView } from "@slack/bolt";
import { DetectedHuddle } from "../utils/huddleDiscovery.js";
import type { MeetupTemplateData } from "../../services/meetupService.js";
import { PT_ZONE, zoneLabel } from "../../utils/timezone.js";

export const MAX_SUBTOPICS = 10;

export interface ModalSubtopicState {
  title: string;
  pct: string;
}

export interface ModalTemplateOption {
  id: string;
  name: string;
  isOwn: boolean;
  isShared: boolean;
}

/**
 * Slack keeps user-typed values for inputs whose block_id is unchanged across views.update,
 * ignoring the new initial_value. Suffixing block_ids with a revision forces a fresh prefill.
 */
export function modalBlockId(base: string, rev?: string): string {
  return rev ? `${base}_${rev}` : base;
}

/**
 * Finds a submitted/current value by action_id regardless of the block_id revision suffix.
 */
export function findModalBlockId(values: Record<string, any>, actionId: string): string | undefined {
  return Object.keys(values).find((blockId) => values[blockId]?.[actionId] !== undefined);
}

export function getModalAction(values: Record<string, any>, actionId: string): any {
  const blockId = findModalBlockId(values, actionId);
  return blockId ? values[blockId][actionId] : undefined;
}

export interface ModalStateData {
  /** IANA zone the picked date and time are read in (workspace setting resolved for the scheduler). */
  zone?: string;
  /** "YYYY-MM-DD" and "HH:mm" wall clock in `zone`. */
  scheduleDate?: string;
  scheduleTime?: string;
  /** Shown above the time field, e.g. the range blocked by another pace after "Change time". */
  scheduleNotice?: string;
  /** Times inside this range (ISO instants, inclusive) are rejected on submit for `channelId`. */
  blockedRange?: { from: string; to: string; title: string; channelId: string };
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
  reminderTextEnabled?: boolean;
  reminderImageEnabled?: boolean;
  isPrivate?: boolean;
  templates?: ModalTemplateOption[];
  selectedTemplateId?: string;
  saveAsTemplate?: boolean;
  /** Set when the modal edits a saved template instead of scheduling a session. */
  editTemplateId?: string;
  templateName?: string;
  /** Opaque list state so the Templates modal can be refreshed after saving. */
  templateListState?: unknown;
  rev?: string;
  editMeetupId?: string;
}

/**
 * Prefill for scheduling from a saved template. A teammate's template keeps its agenda but not
 * its speakers or channel, so the viewer is the speaker and picks where it runs.
 */
export function templateToModalState(
  template: MeetupTemplateData,
  viewerUserId: string,
  huddles: DetectedHuddle[] = []
): Partial<ModalStateData> {
  const isOwn = template.ownerUserId === viewerUserId;
  const speakerIds = template.speakerUserId.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    title: template.name,
    currentUserId: viewerUserId,
    channelId: isOwn ? template.channelId : undefined,
    speakerUserIds: isOwn ? speakerIds : [viewerUserId],
    duration: template.totalMinutes,
    selectedHuddleChoice: template.destination,
    subtopicCount: Math.min(MAX_SUBTOPICS, Math.max(1, template.modules.length)),
    customSubtopics: template.modules.slice(0, MAX_SUBTOPICS).map((m) => ({ title: m.title, pct: String(m.percentage) })),
    reminderTextEnabled: template.reminderTextEnabled,
    reminderImageEnabled: template.reminderImageEnabled,
    availableHuddles: isOwn ? huddles : [],
  };
}

export function buildScheduleModal(initialState?: Partial<ModalStateData>): ModalView {
  const count = initialState?.subtopicCount ?? 3;
  const rev = initialState?.rev;
  const isTemplateEdit = !!initialState?.editTemplateId;
  const bid = (base: string) => modalBlockId(base, rev);
  const zone = initialState?.zone || PT_ZONE;

  // Default suggested distribution presets for 3 rows
  const defaultPresets = [
    { title: "Context + Introduction", pct: "15" },
    { title: "Core Topic / Demo", pct: "60" },
    { title: "Open Q+A / Wrap-up", pct: "25" },
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
  const detectedHuddles = isTemplateEdit ? [] : initialState?.availableHuddles || [];
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

  // 4. Custom thread option (a template never stores a specific thread)
  if (!isTemplateEdit) {
    huddleOptions.push({
      text: { type: "plain_text", text: "🔗 Custom Thread Link / TS", emoji: true },
      value: "custom",
    });
  }

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

  // Meetups created via `/pace` can have any length; keep it selectable so editing never changes it silently.
  const requestedDuration = initialState?.duration;
  if (requestedDuration && !durationOptions.some((d) => d.value === String(requestedDuration))) {
    durationOptions.push({ text: { type: "plain_text" as const, text: `${requestedDuration} minutes` }, value: String(requestedDuration) });
    durationOptions.sort((a, b) => Number(a.value) - Number(b.value));
  }

  const durationStr = (initialState?.duration || 60).toString();
  const initialDuration =
    durationOptions.find((d) => d.value === durationStr) ||
    durationOptions.find((d) => d.value === "60") ||
    durationOptions[0];

  const reminderTextEnabled = initialState?.reminderTextEnabled ?? true;
  const reminderImageEnabled = initialState?.reminderImageEnabled ?? false;
  const initialReminderOptions: any[] = [];
  if (reminderTextEnabled) {
    initialReminderOptions.push({
      text: {
        type: "mrkdwn" as const,
        text: "*Send reminder text* (subtle finish-line check in thread)",
      },
      value: "reminder_text",
    });
  }
  if (reminderImageEnabled) {
    initialReminderOptions.push({
      text: {
        type: "mrkdwn" as const,
        text: "*Send reminder image* (Vector illustration banner)",
      },
      value: "reminder_image",
    });
  }

  const privateOption = {
    text: { type: "mrkdwn" as const, text: "*Private huddle* (excluded from workspace analytics)" },
    value: "private_huddle",
  };

  const blocks: any[] = [];

  const isEdit = !!initialState?.editMeetupId;
  // Slack caps static_select at 100 options; own templates take priority over shared ones.
  const templates = isEdit || isTemplateEdit
    ? []
    : [...(initialState?.templates || [])].sort((a, b) => Number(b.isOwn) - Number(a.isOwn)).slice(0, 100);
  if (templates.length > 0) {
    const toOption = (t: ModalTemplateOption) => ({
      text: {
        type: "plain_text" as const,
        text: (t.isOwn && t.isShared ? `${t.name.slice(0, 62)} · shared` : t.name).slice(0, 75),
        emoji: true,
      },
      value: t.id,
    });
    const mine = templates.filter((t) => t.isOwn).map(toOption);
    const shared = templates.filter((t) => !t.isOwn).map(toOption);
    const templateOptions = [...mine, ...shared];
    const selectedTemplate = templates.find((t) => t.id === initialState?.selectedTemplateId);
    const selectedTemplateOption = templateOptions.find((o) => o.value === initialState?.selectedTemplateId);
    const optionGroups = [
      ...(mine.length > 0 ? [{ label: { type: "plain_text" as const, text: "My templates" }, options: mine }] : []),
      ...(shared.length > 0 ? [{ label: { type: "plain_text" as const, text: "Shared by teammates" }, options: shared }] : []),
    ];
    const templateElements: any[] = [
      {
        type: "static_select",
        action_id: "template_select",
        placeholder: { type: "plain_text", text: "📋 Start from a template" },
        option_groups: optionGroups,
        ...(selectedTemplateOption ? { initial_option: selectedTemplateOption } : {}),
      },
    ];
    if (selectedTemplateOption && selectedTemplate?.isOwn) {
      templateElements.push({
        type: "button",
        text: { type: "plain_text", text: "🗑 Delete template", emoji: true },
        action_id: "delete_template_action",
        value: selectedTemplateOption.value,
        confirm: {
          title: { type: "plain_text", text: "Delete template?" },
          text: { type: "mrkdwn", text: `*${selectedTemplateOption.text.text}* will be removed. Sessions already scheduled are not affected.` },
          confirm: { type: "plain_text", text: "Delete" },
          deny: { type: "plain_text", text: "Keep" },
          style: "danger",
        },
      });
    }
    blocks.push(
      { type: "actions", block_id: "template_picker_block", elements: templateElements },
      { type: "divider" }
    );
  }

  blocks.push(
    {
      type: "input",
      block_id: bid("title_block"),
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
      block_id: bid("speaker_block"),
      element: speakerElement,
      label: {
        type: "plain_text",
        text: "Session Speaker(s)",
      },
    },
    {
      type: "input",
      block_id: bid("channel_block"),
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
      block_id: bid("schedule_date_block"),
      element: {
        type: "datepicker",
        action_id: "schedule_date_picker",
        ...(initialState?.scheduleDate ? { initial_date: initialState.scheduleDate } : {}),
      },
      label: { type: "plain_text", text: "Date" },
    },
    ...(initialState?.scheduleNotice
      ? [{ type: "section", block_id: bid("schedule_notice_block"), text: { type: "mrkdwn", text: initialState.scheduleNotice } }]
      : []),
    {
      type: "input",
      block_id: bid("schedule_time_block"),
      element: {
        type: "timepicker",
        action_id: "schedule_time_picker",
        ...(initialState?.scheduleTime ? { initial_time: initialState.scheduleTime } : {}),
        placeholder: { type: "plain_text", text: "Select time" },
      },
      label: { type: "plain_text", text: `Time (${zoneLabel(zone)})` },
      hint: {
        type: "plain_text",
        text: "Exact start time. HuddlePace watches for a Huddle from 20 minutes before to 20 minutes after.",
      },
    },
    {
      type: "input",
      block_id: bid("huddle_select_block"),
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
      block_id: bid("custom_thread_block"),
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
      block_id: bid("duration_block"),
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
      type: "input",
      block_id: bid("reminder_options_block"),
      optional: true,
      label: {
        type: "plain_text",
        text: "Finish-Line Reminders",
      },
      element: {
        type: "checkboxes",
        action_id: "schedule_reminder_checkboxes",
        options: [
          {
            text: {
              type: "mrkdwn",
              text: "*Send reminder text* (subtle finish-line check in thread)",
            },
            value: "reminder_text",
          },
          {
            text: {
              type: "mrkdwn",
              text: "*Send reminder image* (Vector illustration banner)",
            },
            value: "reminder_image",
          },
        ],
        ...(initialReminderOptions.length > 0 ? { initial_options: initialReminderOptions } : {}),
      },
      hint: {
        type: "plain_text",
        text: "Dispatched once when ~16.7% time remains to wrap up action items.",
      },
    },
    {
      type: "input",
      block_id: bid("private_huddle_block"),
      optional: true,
      label: { type: "plain_text", text: "Analytics Privacy" },
      element: {
        type: "checkboxes",
        action_id: "private_huddle_checkbox",
        options: [privateOption],
        ...(initialState?.isPrivate ? { initial_options: [privateOption] } : {}),
      },
      hint: {
        type: "plain_text",
        text: "Private huddles only show in the analytics of their speakers and creator. The channel tracker works as usual.",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📌 Agenda Modules & Time Budget (%) Allocation*\nAllocate percentage for each module. *Total must equal 100%*. Edit a % and press Enter to split the rest evenly across the other modules.",
      },
    }
  );

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
      dispatch_action_config: { trigger_actions_on: ["on_enter_pressed"] },
    };
    // The 3-row default split is real content (sums to 100), so it can be submitted as-is.
    const pctValue = custom?.pct || (count === 3 ? defaultSuggestion.pct : "");
    if (pctValue) {
      pctElement.initial_value = pctValue;
    }

    blocks.push(
      {
        type: "input",
        block_id: bid(`subtopic_title_${i}`),
        element: titleElement,
        label: {
          type: "plain_text",
          text: `Module ${i + 1} Topic`,
        },
      },
      {
        type: "input",
        block_id: bid(`subtopic_pct_${i}`),
        dispatch_action: true,
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

  const saveOption = {
    text: { type: "mrkdwn" as const, text: "*Save as template* (reuse this setup for recurring calls)" },
    description: {
      type: "plain_text" as const,
      text: "Named after the session title and kept private. Share it from Templates. Saving the same title again updates it.",
    },
    value: "save_template",
  };
  blocks.push({
    type: "input",
    block_id: "save_template_block",
    optional: true,
    label: { type: "plain_text", text: "Template" },
    element: {
      type: "checkboxes",
      action_id: "save_template_checkbox",
      options: [saveOption],
      ...(initialState?.saveAsTemplate ? { initial_options: [saveOption] } : {}),
    },
  });

  if (isTemplateEdit) {
    const sessionOnly = [
      "schedule_date_block",
      "schedule_notice_block",
      "schedule_time_block",
      "custom_thread_block",
      "private_huddle_block",
      "save_template_block",
    ];
    const templateBlocks = blocks
      .filter((b) => !sessionOnly.some((id) => typeof b.block_id === "string" && b.block_id.startsWith(id)))
      .map((b) =>
        typeof b.block_id === "string" && b.block_id.startsWith("title_block")
          ? {
              type: "input",
              block_id: bid("template_name_block"),
              label: { type: "plain_text", text: "Template Name" },
              element: {
                type: "plain_text_input",
                action_id: "template_name_input",
                max_length: 75,
                initial_value: initialState?.templateName || "",
              },
            }
          : b
      );
    return {
      type: "modal",
      callback_id: "submit_edit_template_modal",
      title: { type: "plain_text", text: "Edit Template" },
      submit: { type: "plain_text", text: "Save Template" },
      close: { type: "plain_text", text: "Cancel" },
      private_metadata: JSON.stringify({
        subtopicCount: count,
        channelId: initialState?.channelId,
        rev,
        templateId: initialState?.editTemplateId,
        templateListState: initialState?.templateListState,
      }),
      blocks: templateBlocks,
    };
  }

  return {
    type: "modal",
    callback_id: "submit_schedule_modal",
    title: {
      type: "plain_text",
      text: isEdit ? "Edit Meetup" : "Schedule Meetup",
    },
    submit: {
      type: "plain_text",
      text: isEdit ? "Save Changes" : "Schedule & Ready",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    private_metadata: JSON.stringify({
      subtopicCount: count,
      channelId: initialState?.channelId,
      rev,
      meetupId: initialState?.editMeetupId,
      zone,
      blocked: initialState?.blockedRange,
    }),
    blocks,
  };
}
