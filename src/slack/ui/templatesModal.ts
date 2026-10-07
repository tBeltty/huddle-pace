import { ModalView } from "@slack/bolt";
import type { MeetupTemplateData } from "../../services/meetupService.js";

export const TEMPLATES_PAGE_SIZE = 12;

export type TemplatesTab = "mine" | "community";

export interface TemplatesListState {
  tab: TemplatesTab;
  page: number;
  isManager: boolean;
  confirmDeleteId?: string;
}

export function splitTemplates(templates: MeetupTemplateData[], viewerUserId: string) {
  return {
    mine: templates.filter((t) => t.ownerUserId === viewerUserId),
    community: templates.filter((t) => t.isShared && t.ownerUserId !== viewerUserId),
  };
}

function overflowOption(label: string, op: string, id: string) {
  return { text: { type: "plain_text" as const, text: label, emoji: true }, value: `${op}:${id}` };
}

function templateSummary(t: MeetupTemplateData, showAuthor: boolean): string {
  const speakers = t.speakerUserId.split(",").map((s) => s.trim()).filter(Boolean);
  const parts = [`${t.totalMinutes}m`, `${t.modules.length} module${t.modules.length === 1 ? "" : "s"}`];
  if (!showAuthor) {
    parts.push(`<#${t.channelId}>`);
    if (speakers.length > 0) parts.push(speakers.map((s) => `<@${s}>`).join(", "));
  }
  const agenda = t.modules.map((m) => `${m.title} ${m.percentage}%`).join(" · ");
  const head = `*${t.name}*${!showAuthor && t.isShared ? "  ·  _shared with workspace_" : ""}`;
  const author = showAuthor ? `\nby <@${t.ownerUserId}>` : "";
  return `${head}${author}\n${parts.join("  ·  ")}\n_${agenda.slice(0, 200)}_`;
}

function templateRow(t: MeetupTemplateData, viewerUserId: string, isManager: boolean): any[] {
  const isOwn = t.ownerUserId === viewerUserId;
  const options = isOwn
    ? [
        overflowOption("📅 Schedule a pace", "schedule", t.id),
        overflowOption("✏️ Edit", "edit", t.id),
        overflowOption(t.isShared ? "🔒 Stop sharing" : "🌐 Share with workspace", t.isShared ? "unshare" : "share", t.id),
        overflowOption("🗑 Delete", "delete", t.id),
      ]
    : [
        overflowOption("📅 Schedule a pace", "schedule", t.id),
        overflowOption("📋 Duplicate to my templates", "duplicate", t.id),
        ...(isManager ? [overflowOption("🚫 Unpublish (admin)", "unpublish", t.id)] : []),
      ];
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: templateSummary(t, !isOwn) },
      accessory: { type: "overflow", action_id: "template_row_menu", options },
    },
    { type: "divider" },
  ];
}

export function buildTemplatesModal(
  templates: MeetupTemplateData[],
  viewerUserId: string,
  state: TemplatesListState
): ModalView {
  const { mine, community } = splitTemplates(templates, viewerUserId);
  const base = {
    type: "modal" as const,
    callback_id: "templates_modal",
    title: { type: "plain_text" as const, text: "Templates" },
    close: { type: "plain_text" as const, text: "Close" },
  };

  const confirmTarget = state.confirmDeleteId ? mine.find((t) => t.id === state.confirmDeleteId) : undefined;
  if (confirmTarget) {
    return {
      ...base,
      private_metadata: JSON.stringify({ ...state, confirmDeleteId: confirmTarget.id }),
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Delete "${confirmTarget.name}"?*\nSessions already scheduled are not affected.${
              confirmTarget.isShared ? " Teammates lose access to this shared template." : ""
            }`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Delete" },
              style: "danger",
              action_id: "confirm_delete_template",
              value: confirmTarget.id,
            },
            { type: "button", text: { type: "plain_text", text: "Keep" }, action_id: "cancel_delete_template" },
          ],
        },
      ],
    };
  }

  const list = state.tab === "mine" ? mine : community;
  const pages = Math.max(1, Math.ceil(list.length / TEMPLATES_PAGE_SIZE));
  const page = Math.min(Math.max(0, state.page), pages - 1);
  const slice = list.slice(page * TEMPLATES_PAGE_SIZE, (page + 1) * TEMPLATES_PAGE_SIZE);

  const tabButton = (tab: TemplatesTab, label: string) => ({
    type: "button",
    text: { type: "plain_text", text: label, emoji: true },
    action_id: `templates_tab_${tab}`,
    ...(state.tab === tab ? { style: "primary" } : {}),
  });

  const blocks: any[] = [
    {
      type: "actions",
      block_id: "templates_tabs",
      elements: [tabButton("mine", `My templates (${mine.length})`), tabButton("community", `Community (${community.length})`)],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text:
            state.tab === "mine"
              ? "Only you see your templates until you share them with the workspace."
              : "Templates your teammates shared. Scheduling one uses its agenda with you as the speaker.",
        },
      ],
    },
    { type: "divider" },
  ];

  if (slice.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          state.tab === "mine"
            ? "_You have no templates yet._ Tick *Save as template* when you schedule a pace, or duplicate one from Community."
            : "_Nobody has shared a template yet._ Share one of yours from *My templates*.",
      },
    });
  } else {
    for (const t of slice) blocks.push(...templateRow(t, viewerUserId, state.isManager));
  }

  if (pages > 1) {
    const elements: any[] = [];
    if (page > 0) elements.push({ type: "button", text: { type: "plain_text", text: "← Previous" }, action_id: "templates_page_prev" });
    if (page < pages - 1) elements.push({ type: "button", text: { type: "plain_text", text: "Next →" }, action_id: "templates_page_next" });
    blocks.push({ type: "actions", elements });
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Page ${page + 1} of ${pages}` }] });
  }

  return { ...base, private_metadata: JSON.stringify({ ...state, page }), blocks };
}
