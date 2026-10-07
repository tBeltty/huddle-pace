import { App } from "@slack/bolt";
import { MeetupService } from "../../services/meetupService.js";
import { buildScheduleModal, getModalAction, findModalBlockId, MAX_SUBTOPICS, templateToModalState } from "../ui/scheduleModal.js";
import { buildTemplatesModal, TemplatesListState } from "../ui/templatesModal.js";
import { scheduleModalInputSchema } from "../schemas/scheduleSchema.js";
import { findChannelHuddles } from "../utils/huddleDiscovery.js";

function parseListState(raw: string | undefined): TemplatesListState {
  try {
    const parsed = JSON.parse(raw || "{}");
    return {
      tab: parsed.tab === "community" ? "community" : "mine",
      page: Number.isInteger(parsed.page) && parsed.page >= 0 ? parsed.page : 0,
      isManager: parsed.isManager === true,
      confirmDeleteId: typeof parsed.confirmDeleteId === "string" ? parsed.confirmDeleteId : undefined,
    };
  } catch {
    return { tab: "mine", page: 0, isManager: false };
  }
}

async function renderList(teamId: string, userId: string, state: TemplatesListState) {
  const templates = await MeetupService.listTemplates(teamId, userId);
  return buildTemplatesModal(templates, userId, state);
}

function ids(body: any) {
  return { teamId: body.team?.id || body.user?.team_id || "default", userId: body.user?.id as string | undefined };
}

export function registerTemplateHandlers(app: App) {
  app.action("open_templates_modal", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const { teamId, userId } = ids(b);
      if (!userId) return;
      const isManager = await MeetupService.isUserWorkspaceManager(client, userId, teamId);
      await client.views.open({
        trigger_id: b.trigger_id,
        view: await renderList(teamId, userId, { tab: "mine", page: 0, isManager }),
      });
    } catch (error: any) {
      console.error("Error opening templates modal:", error?.data || error?.message || error);
    }
  });

  const navigate = (action: string, change: (s: TemplatesListState) => TemplatesListState) =>
    app.action(action, async ({ ack, body, client }) => {
      await ack();
      try {
        const b = body as any;
        const { teamId, userId } = ids(b);
        if (!userId) return;
        const state = change({ ...parseListState(b.view.private_metadata), confirmDeleteId: undefined });
        await client.views.update({ view_id: b.view.id, view: await renderList(teamId, userId, state) });
      } catch (error) {
        console.error(`Error handling ${action}:`, error);
      }
    });

  navigate("templates_tab_mine", (s) => ({ ...s, tab: "mine", page: 0 }));
  navigate("templates_tab_community", (s) => ({ ...s, tab: "community", page: 0 }));
  navigate("templates_page_prev", (s) => ({ ...s, page: Math.max(0, s.page - 1) }));
  navigate("templates_page_next", (s) => ({ ...s, page: s.page + 1 }));
  navigate("cancel_delete_template", (s) => s);

  app.action("confirm_delete_template", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const { teamId, userId } = ids(b);
      const templateId = b.actions[0]?.value;
      if (!userId || !templateId) return;
      await MeetupService.deleteTemplate(templateId, teamId, userId);
      const state = { ...parseListState(b.view.private_metadata), confirmDeleteId: undefined };
      await client.views.update({ view_id: b.view.id, view: await renderList(teamId, userId, state) });
    } catch (error) {
      console.error("Error deleting template from Templates modal:", error);
    }
  });

  app.action("template_row_menu", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const { teamId, userId } = ids(b);
      const [op, templateId] = String(b.actions[0]?.selected_option?.value || "").split(":");
      if (!userId || !op || !templateId) return;
      const state = parseListState(b.view.private_metadata);
      const refresh = async (next: TemplatesListState) =>
        client.views.update({ view_id: b.view.id, view: await renderList(teamId, userId, next) });

      const template = await MeetupService.getTemplate(templateId, teamId, userId);
      if (!template) {
        await refresh(state); // Gone or unshared in the meantime: redraw so the stale row disappears.
        return;
      }
      const isOwn = template.ownerUserId === userId;

      switch (op) {
        case "schedule": {
          const huddles = isOwn ? await findChannelHuddles(client, template.channelId) : [];
          await client.views.push({
            trigger_id: b.trigger_id,
            view: buildScheduleModal({ ...templateToModalState(template, userId, huddles), rev: Date.now().toString(36) }),
          });
          return;
        }
        case "edit": {
          if (!isOwn) return;
          await client.views.push({
            trigger_id: b.trigger_id,
            view: buildScheduleModal({
              ...templateToModalState(template, userId),
              editTemplateId: template.id,
              templateName: template.name,
              templateListState: state,
              rev: Date.now().toString(36),
            }),
          });
          return;
        }
        case "share":
        case "unshare":
          if (isOwn) await MeetupService.setTemplateShared(template.id, teamId, userId, op === "share");
          await refresh(state);
          return;
        case "delete":
          if (isOwn) await refresh({ ...state, confirmDeleteId: template.id });
          return;
        case "duplicate":
          await MeetupService.duplicateTemplate(template.id, teamId, userId);
          await refresh({ ...state, tab: "mine", page: 0 });
          return;
        case "unpublish": {
          // Never trust the flag stored in the view: re-check the role on every moderation action.
          if (await MeetupService.isUserWorkspaceManager(client, userId, teamId)) {
            await MeetupService.unpublishTemplate(template.id, teamId);
          }
          await refresh(state);
          return;
        }
      }
    } catch (error: any) {
      console.error("Error handling template menu action:", error?.data || error?.message || error);
    }
  });

  app.view("submit_edit_template_modal", async ({ ack, view, body, client }) => {
    const values = view.state.values;
    const metadata = JSON.parse(view.private_metadata || "{}");
    const { teamId, userId } = ids(body);
    const count = metadata.subtopicCount || 3;
    const nameBlock = findModalBlockId(values, "template_name_input") ?? "template_name_block";

    const name = (getModalAction(values, "template_name_input")?.value || "").trim();
    const channelId = getModalAction(values, "channel_select")?.selected_conversation || "";
    const totalMinutes = parseInt(getModalAction(values, "duration_select")?.selected_option?.value || "60", 10);
    const speakers: string[] = getModalAction(values, "speaker_select")?.selected_users || [];
    const destination = getModalAction(values, "huddle_select")?.selected_option?.value === "main" ? "main" : "auto";
    const reminders = (getModalAction(values, "schedule_reminder_checkboxes")?.selected_options || []).map((o: any) => o.value);

    const rawModules = [];
    for (let i = 0; i < count; i++) {
      const parsed = Number(getModalAction(values, `subtopic_pct_input_${i}`)?.value);
      rawModules.push({
        title: getModalAction(values, `subtopic_title_input_${i}`)?.value || "",
        percentage: isNaN(parsed) ? -1 : parsed,
      });
    }

    const result = scheduleModalInputSchema.safeParse({
      title: name,
      channelId,
      totalMinutes,
      speakerUserId: speakers.length > 0 ? speakers.join(",") : userId,
      threadTs: destination,
      reminderTextEnabled: reminders.includes("reminder_text"),
      reminderImageEnabled: reminders.includes("reminder_image"),
      modules: rawModules,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const [field, index, sub] = issue.path;
        if (field === "modules" && typeof index === "number") {
          const actionId = sub === "percentage" ? `subtopic_pct_input_${index}` : `subtopic_title_input_${index}`;
          errors[findModalBlockId(values, actionId) ?? actionId] = issue.message;
        } else if (field === "title") {
          errors[nameBlock] = "Please give the template a name.";
        } else if (field === "channelId") {
          errors[findModalBlockId(values, "channel_select") ?? "channel_block"] = issue.message;
        } else if (field === "totalMinutes") {
          errors[findModalBlockId(values, "duration_select") ?? "duration_block"] = issue.message;
        }
      }
      await ack({ response_action: "errors", errors });
      return;
    }

    if (!userId || !metadata.templateId) {
      await ack({ response_action: "errors", errors: { [nameBlock]: "This template can no longer be edited." } });
      return;
    }

    const data = result.data;
    const outcome = await MeetupService.updateTemplate(metadata.templateId, teamId, userId, {
      name: data.title,
      channelId: data.channelId,
      speakerUserId: data.speakerUserId,
      totalMinutes: data.totalMinutes,
      threadTs: destination,
      reminderTextEnabled: data.reminderTextEnabled,
      reminderImageEnabled: data.reminderImageEnabled,
      modules: data.modules,
    });

    if (!outcome.ok) {
      await ack({
        response_action: "errors",
        errors: {
          [nameBlock]:
            outcome.reason === "name_taken" ? "You already have a template with this name." : "This template no longer exists.",
        },
      });
      return;
    }

    await ack();
    if ((view as any).previous_view_id) {
      try {
        const state = parseListState(JSON.stringify(metadata.templateListState || {}));
        await client.views.update({
          view_id: (view as any).previous_view_id,
          view: await renderList(teamId, userId, { ...state, confirmDeleteId: undefined }),
        });
      } catch (error) {
        console.warn("Template saved but the Templates list could not be refreshed:", error);
      }
    }
  });
}
