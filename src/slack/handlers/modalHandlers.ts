import { App } from "@slack/bolt";
import { MeetupService, SubtopicInput } from "../../services/meetupService.js";
import {
  buildScheduleModal,
  getModalAction,
  findModalBlockId,
  MAX_SUBTOPICS,
  ModalStateData,
  ModalSubtopicState,
  ModalTemplateOption,
} from "../ui/scheduleModal.js";
import { findChannelHuddles, DetectedHuddle } from "../utils/huddleDiscovery.js";
import { rebalanceAfterEdit, addRowKeepingTotal } from "../../utils/percentages.js";
import { launchMeetupInThread } from "./actionHandlers.js";
import { scheduleModalInputSchema } from "../schemas/scheduleSchema.js";
import { ensureBotInChannel } from "../utils/channelUtils.js";
import { publishHomeTab } from "./homeHandlers.js";

/**
 * Reads the current schedule modal inputs (by action_id, so block_id revisions don't matter)
 * so the view can be re-rendered without losing what the user already typed.
 */
function readScheduleModalState(values: Record<string, any>, metadata: any): Partial<ModalStateData> {
  const count: number = metadata.subtopicCount || 3;
  const reminderValues: string[] = (getModalAction(values, "schedule_reminder_checkboxes")?.selected_options || []).map(
    (o: any) => o.value
  );

  const customSubtopics: ModalSubtopicState[] = [];
  for (let i = 0; i < count; i++) {
    customSubtopics.push({
      title: getModalAction(values, `subtopic_title_input_${i}`)?.value || "",
      pct: getModalAction(values, `subtopic_pct_input_${i}`)?.value || "",
    });
  }

  return {
    title: getModalAction(values, "title_input")?.value || "",
    channelId: getModalAction(values, "channel_select")?.selected_conversation || metadata.channelId,
    speakerUserIds: getModalAction(values, "speaker_select")?.selected_users || [],
    duration: parseInt(getModalAction(values, "duration_select")?.selected_option?.value || "60", 10),
    selectedHuddleChoice: getModalAction(values, "huddle_select")?.selected_option?.value,
    customThreadTs: getModalAction(values, "custom_thread_input")?.value || "",
    subtopicCount: count,
    customSubtopics,
    reminderTextEnabled: reminderValues.includes("reminder_text"),
    reminderImageEnabled: reminderValues.includes("reminder_image"),
    isPrivate: (getModalAction(values, "private_huddle_checkbox")?.selected_options || []).length > 0,
    saveAsTemplate: templateChoices(values).includes("save_template"),
    shareTemplate: templateChoices(values).includes("share_template"),
    selectedTemplateId: getModalAction(values, "template_select")?.selected_option?.value,
    rev: metadata.rev,
    editMeetupId: metadata.meetupId,
  };
}

function templateChoices(values: Record<string, any>): string[] {
  return (getModalAction(values, "save_template_checkbox")?.selected_options || []).map((o: any) => o.value);
}

async function loadTemplateOptions(teamId: string | undefined, userId: string | undefined): Promise<ModalTemplateOption[]> {
  if (!userId) return [];
  try {
    return await MeetupService.listTemplateOptions(teamId || "default", userId);
  } catch (error) {
    console.warn("Could not load meetup templates:", error);
    return [];
  }
}

export function registerModalHandlers(app: App) {
  // Action: Dynamically refresh Huddle list when user selects a target channel in the modal
  app.action("channel_select", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const selectedChannel = b.actions[0]?.selected_conversation;
      if (!selectedChannel) return;

      const huddles = await findChannelHuddles(client, selectedChannel);
      const state = readScheduleModalState(b.view.state.values, JSON.parse(b.view.private_metadata || "{}"));
      const templates = await loadTemplateOptions(b.team?.id || b.user?.team_id, b.user?.id);

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          ...state,
          channelId: selectedChannel,
          selectedHuddleChoice: undefined,
          subtopicCount: state.subtopicCount ?? 3,
          availableHuddles: huddles,
          templates,
        }),
      });
    } catch (error) {
      console.error("Error refreshing huddles for channel in modal:", error);
    }
  });

  // Action: Add another subtopic row in the modal dynamically
  app.action("add_subtopic_row_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const metadata = JSON.parse(b.view.private_metadata || "{}");
      const currentCount = metadata.subtopicCount || 3;
      if (currentCount >= MAX_SUBTOPICS) {
        return;
      }

      const state = readScheduleModalState(b.view.state.values, metadata);
      let huddles: DetectedHuddle[] = [];
      if (state.channelId) {
        huddles = await findChannelHuddles(client, state.channelId);
      }
      const templates = await loadTemplateOptions(b.team?.id || b.user?.team_id, b.user?.id);

      // Keep the total at 100 when a row is added, but only if every current value is usable.
      let customSubtopics = state.customSubtopics;
      const current = (state.customSubtopics || []).map((m) => Number(m.pct));
      if (current.length > 0 && current.every((v) => Number.isInteger(v) && v >= 1)) {
        const rebalanced = addRowKeepingTotal(current);
        customSubtopics = [
          ...(state.customSubtopics || []).map((m, i) => ({ ...m, pct: String(rebalanced[i]) })),
          { title: "", pct: String(rebalanced[rebalanced.length - 1]) },
        ];
      }

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          ...state,
          customSubtopics,
          rev: customSubtopics !== state.customSubtopics ? Date.now().toString(36) : state.rev,
          subtopicCount: Math.min(MAX_SUBTOPICS, currentCount + 1),
          availableHuddles: huddles,
          templates,
        }),
      });
    } catch (error) {
      console.error("Error dynamically appending subtopic row:", error);
    }
  });

  // Action: Editing a Time Budget % (Enter) splits the remainder evenly across the other modules
  app.action(/^subtopic_pct_input_\d+$/, async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const action = b.actions[0];
      const editedIndex = Number(String(action.action_id).replace("subtopic_pct_input_", ""));
      const metadata = JSON.parse(b.view.private_metadata || "{}");
      const state = readScheduleModalState(b.view.state.values, metadata);
      const subtopics = state.customSubtopics || [];

      const rebalanced = rebalanceAfterEdit(
        subtopics.map((m) => Number(m.pct) || 0),
        editedIndex,
        Number(action.value)
      );
      if (!rebalanced) return; // Not a usable whole number: leave the form as the user typed it.

      let huddles: DetectedHuddle[] = [];
      if (state.channelId) {
        huddles = await findChannelHuddles(client, state.channelId);
      }
      const templates = await loadTemplateOptions(b.team?.id || b.user?.team_id, b.user?.id);

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          ...state,
          customSubtopics: subtopics.map((m, i) => ({ ...m, pct: String(rebalanced[i]) })),
          availableHuddles: huddles,
          templates,
          rev: Date.now().toString(36),
        }),
      });
    } catch (error) {
      console.error("Error rebalancing time budget percentages:", error);
    }
  });

  // Action: Open the schedule modal prefilled with a meetup that has not started yet
  app.action("edit_scheduled_meetup_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const userId = b.user?.id;
      const teamId = b.team?.id || b.user?.team_id || "default";
      const meetup = await MeetupService.getMeetupById(b.actions[0]?.value);
      if (!meetup || meetup.teamId !== teamId || meetup.status !== "SCHEDULED") return;
      if (!MeetupService.parseSpeakerIds(meetup.speakerUserId).includes(userId)) return;

      const hasSpecificThread = !!meetup.threadTs && meetup.threadTs !== "auto" && meetup.threadTs !== "main";
      await client.views.open({
        trigger_id: b.trigger_id,
        view: buildScheduleModal({
          editMeetupId: meetup.id,
          title: meetup.title,
          channelId: meetup.channelId,
          speakerUserIds: MeetupService.parseSpeakerIds(meetup.speakerUserId),
          duration: meetup.totalMinutes,
          selectedHuddleChoice: meetup.threadTs === "main" ? "main" : "auto",
          customThreadTs: hasSpecificThread ? meetup.threadTs! : undefined,
          subtopicCount: Math.min(MAX_SUBTOPICS, Math.max(1, meetup.modules.length)),
          customSubtopics: meetup.modules.map((m) => ({ title: m.title, pct: String(m.percentage) })),
          reminderTextEnabled: meetup.reminderTextEnabled,
          reminderImageEnabled: meetup.reminderImageEnabled,
          isPrivate: meetup.isPrivate,
        }),
      });
    } catch (error) {
      console.error("Error opening edit modal for scheduled meetup:", error);
    }
  });

  // Action: Prefill the schedule modal from a saved template
  app.action("template_select", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const templateId = b.actions[0]?.selected_option?.value;
      const teamId = b.team?.id || b.user?.team_id || "default";
      const userId = b.user?.id;
      if (!templateId || !userId) return;

      const template = await MeetupService.getTemplate(templateId, teamId, userId);
      const templates = await loadTemplateOptions(teamId, userId);
      if (!template) {
        // Deleted elsewhere: refresh the picker so the stale entry disappears.
        const state = readScheduleModalState(b.view.state.values, JSON.parse(b.view.private_metadata || "{}"));
        await client.views.update({
          view_id: b.view.id,
          view: buildScheduleModal({ ...state, selectedTemplateId: undefined, templates }),
        });
        return;
      }

      const huddles = await findChannelHuddles(client, template.channelId);
      const moduleCount = Math.min(MAX_SUBTOPICS, Math.max(1, template.modules.length));

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          title: template.name,
          channelId: template.channelId,
          speakerUserIds: MeetupService.parseSpeakerIds(template.speakerUserId),
          duration: template.totalMinutes,
          selectedHuddleChoice: template.destination,
          subtopicCount: moduleCount,
          customSubtopics: template.modules
            .slice(0, MAX_SUBTOPICS)
            .map((m) => ({ title: m.title, pct: String(m.percentage) })),
          reminderTextEnabled: template.reminderTextEnabled,
          reminderImageEnabled: template.reminderImageEnabled,
          availableHuddles: huddles,
          templates,
          selectedTemplateId: template.id,
          rev: Date.now().toString(36),
        }),
      });
    } catch (error) {
      console.error("Error applying meetup template to modal:", error);
    }
  });

  // Action: Delete the selected template and reset the picker
  app.action("delete_template_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const teamId = b.team?.id || b.user?.team_id || "default";
      const userId = b.user?.id;
      const templateId = b.actions[0]?.value;
      if (!templateId || !userId) return;

      await MeetupService.deleteTemplate(templateId, teamId, userId);

      const state = readScheduleModalState(b.view.state.values, JSON.parse(b.view.private_metadata || "{}"));
      const templates = await loadTemplateOptions(teamId, userId);
      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({ ...state, selectedTemplateId: undefined, templates }),
      });
    } catch (error) {
      console.error("Error deleting meetup template:", error);
    }
  });

  // Submission: Handle schedule modal submission
  app.view("submit_schedule_modal", async ({ ack, view, body, client }) => {
    const values = view.state.values;
    const metadata = JSON.parse(view.private_metadata || "{}");
    const count = metadata.subtopicCount || 3;

    const title = getModalAction(values, "title_input")?.value || "";
    const channelId = getModalAction(values, "channel_select")?.selected_conversation || "";
    const totalMinutes = parseInt(getModalAction(values, "duration_select")?.selected_option?.value || "60", 10);

    // Multi-speaker selection support
    const selectedSpeakers: string[] = getModalAction(values, "speaker_select")?.selected_users || [];
    const speakerUserId = selectedSpeakers.length > 0 ? selectedSpeakers.join(",") : body.user.id;

    // Huddle destination selection
    const huddleChoice = getModalAction(values, "huddle_select")?.selected_option?.value || "auto";
    const customThread = getModalAction(values, "custom_thread_input")?.value?.trim() || "";

    let threadTs: string | null = null;
    if (customThread) {
      const urlMatch = customThread.match(/p(\d{10})(\d{6})/);
      if (urlMatch) {
        threadTs = `${urlMatch[1]}.${urlMatch[2]}`;
      } else {
        threadTs = customThread;
      }
    } else if (huddleChoice.startsWith("huddle_")) {
      threadTs = huddleChoice.replace("huddle_", "");
    } else if (huddleChoice === "main") {
      threadTs = "main";
    } else {
      threadTs = "auto";
    }

    const reminderSelected = getModalAction(values, "schedule_reminder_checkboxes")?.selected_options || [];
    const reminderValues = reminderSelected.map((o: any) => o.value);
    const reminderTextEnabled = reminderValues.includes("reminder_text");
    const reminderImageEnabled = reminderValues.includes("reminder_image");
    const isPrivate = (getModalAction(values, "private_huddle_checkbox")?.selected_options || []).length > 0;
    const saveAsTemplate = templateChoices(values).includes("save_template");
    const shareTemplate = saveAsTemplate && templateChoices(values).includes("share_template");

    const rawModules = [];
    for (let i = 0; i < count; i++) {
      const subTitle = getModalAction(values, `subtopic_title_input_${i}`)?.value || "";
      const rawPct = getModalAction(values, `subtopic_pct_input_${i}`)?.value;
      const parsedPct = Number(rawPct);
      rawModules.push({
        title: subTitle,
        percentage: isNaN(parsedPct) ? -1 : parsedPct,
      });
    }

    const validationResult = scheduleModalInputSchema.safeParse({
      title,
      channelId,
      totalMinutes,
      speakerUserId,
      threadTs,
      reminderTextEnabled,
      reminderImageEnabled,
      isPrivate,
      modules: rawModules,
    });

    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const path = issue.path;
        if (path[0] === "modules" && typeof path[1] === "number") {
          const index = path[1];
          const field = path[2];
          if (field === "percentage") {
            errors[findModalBlockId(values, `subtopic_pct_input_${index}`) ?? `subtopic_pct_${index}`] = issue.message;
          } else {
            errors[findModalBlockId(values, `subtopic_title_input_${index}`) ?? `subtopic_title_${index}`] = issue.message;
          }
        } else if (path[0] === "title") {
          errors[findModalBlockId(values, "title_input") ?? "title_block"] = issue.message;
        } else if (path[0] === "channelId") {
          errors[findModalBlockId(values, "channel_select") ?? "channel_block"] = issue.message;
        } else if (path[0] === "totalMinutes") {
          errors[findModalBlockId(values, "duration_select") ?? "duration_block"] = issue.message;
        }
      }

      await ack({
        response_action: "errors",
        errors,
      });
      return;
    }

    const editMeetupId: string | undefined = metadata.meetupId;
    const teamId = body.team?.id || body.user?.team_id || "default";
    const validatedData = validationResult.data;

    if (editMeetupId) {
      const existing = await MeetupService.getMeetupById(editMeetupId);
      const titleBlock = findModalBlockId(values, "title_input") ?? "title_block";
      if (!existing || existing.teamId !== teamId) {
        await ack({ response_action: "errors", errors: { [titleBlock]: "This meetup no longer exists." } });
        return;
      }
      if (!MeetupService.parseSpeakerIds(existing.speakerUserId).includes(body.user.id)) {
        await ack({ response_action: "errors", errors: { [titleBlock]: "Only the designated speaker(s) can edit this meetup." } });
        return;
      }
      if (existing.status !== "SCHEDULED") {
        await ack({ response_action: "errors", errors: { [titleBlock]: "This meetup already started and can no longer be edited." } });
        return;
      }

      await ack();
      await ensureBotInChannel(client, validatedData.channelId, body.user.id);

      try {
        const updated = await MeetupService.updateScheduledMeetup(editMeetupId, {
          title: validatedData.title,
          totalMinutes: validatedData.totalMinutes,
          channelId: validatedData.channelId,
          speakerUserId: validatedData.speakerUserId,
          threadTs: validatedData.threadTs,
          reminderTextEnabled: validatedData.reminderTextEnabled,
          reminderImageEnabled: validatedData.reminderImageEnabled,
          isPrivate: validatedData.isPrivate,
          modules: validatedData.modules,
        });

        const usersToRefresh = Array.from(
          new Set([
            body.user.id,
            ...MeetupService.parseSpeakerIds(existing.speakerUserId),
            ...MeetupService.parseSpeakerIds(validatedData.speakerUserId),
          ])
        );
        for (const uid of usersToRefresh) {
          publishHomeTab(client, uid, teamId).catch((err) => {
            console.warn(`Failed to auto-refresh App Home for user ${uid}:`, err);
          });
        }

        await client.chat.postMessage({
          channel: body.user.id,
          text: updated
            ? `*Updated:* '${validatedData.title}' (${validatedData.totalMinutes}m) in <#${validatedData.channelId}>.`
            : `⚠️ '${validatedData.title}' started before your changes were saved, so they were not applied.`,
        });
      } catch (error) {
        console.error("Error updating meetup from modal submission:", error);
      }
      return;
    }

    // Acknowledge submission cleanly
    await ack();

    // Seamlessly ensure bot is present in target channel (auto-joins public channels)
    await ensureBotInChannel(client, validatedData.channelId, body.user.id);

    try {
      await MeetupService.createMeetup({
        title: validatedData.title,
        totalMinutes: validatedData.totalMinutes,
        channelId: validatedData.channelId,
        speakerUserId: validatedData.speakerUserId,
        createdByUserId: body.user.id,
        isPrivate: validatedData.isPrivate,
        threadTs: validatedData.threadTs,
        teamId,
        reminderTextEnabled: validatedData.reminderTextEnabled,
        reminderImageEnabled: validatedData.reminderImageEnabled,
        modules: validatedData.modules,
      });

      let templateNote = "";
      if (saveAsTemplate) {
        try {
          await MeetupService.saveTemplate({
            teamId,
            ownerUserId: body.user.id,
            name: validatedData.title,
            channelId: validatedData.channelId,
            speakerUserId: validatedData.speakerUserId,
            totalMinutes: validatedData.totalMinutes,
            threadTs: validatedData.threadTs,
            reminderTextEnabled: validatedData.reminderTextEnabled,
            reminderImageEnabled: validatedData.reminderImageEnabled,
            isShared: shareTemplate,
            modules: validatedData.modules,
          });
          templateNote = shareTemplate ? " Saved as a template shared with the workspace." : " Saved to My templates.";
        } catch (templateError) {
          console.error("Meetup scheduled but template could not be saved:", templateError);
          templateNote = " The template could not be saved.";
        }
      }

      const speakerText = MeetupService.formatSpeakerMentions(speakerUserId);
      const destinationNote = threadTs && threadTs !== "auto" && threadTs !== "main"
        ? "locked to selected Huddle thread"
        : threadTs === "main"
        ? "main channel feed"
        : "auto-detect active Huddle on launch";

      // Refresh App Home for creator and speakers so the session appears immediately
      const usersToRefresh = Array.from(new Set([body.user.id, ...MeetupService.parseSpeakerIds(speakerUserId)]));
      for (const uid of usersToRefresh) {
        publishHomeTab(client, uid, teamId).catch((err) => {
          console.warn(`Failed to auto-refresh App Home for user ${uid}:`, err);
        });
      }

      // Silent scheduling: post ephemeral confirmation to creator without public channel spam
      try {
        await client.chat.postEphemeral({
          channel: channelId,
          user: body.user.id,
          text: `*Scheduled:* '${title}' (${totalMinutes}m) with ${speakerText} (${destinationNote}). Ready to launch from your Home tab!${templateNote}`,
        });
      } catch {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `*Scheduled:* '${title}' (${totalMinutes}m) in <#${channelId}> with ${speakerText} (${destinationNote}).`,
        });
      }
    } catch (error) {
      console.error("Error creating meetup from modal submission:", error);
    }
  });

  // Submission: Handle workspace settings modal submission
  app.view("submit_settings_modal", async ({ ack, view, body, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}");
    const teamId = metadata.teamId || body.team?.id || "default";
    const userId = body.user?.id;

    // Security Gate: Ensure submitting user is authorized (Admin, Installer, or Bot Manager)
    const canEdit = await MeetupService.isUserWorkspaceManager(client, userId, teamId);
    if (!canEdit) {
      await ack({
        response_action: "errors",
        errors: {
          reminder_settings_block: "You do not have permission to modify workspace settings. Only Admins and designated Bot Managers can save changes.",
        },
      });
      return;
    }

    await ack();

    try {
      const values = view.state.values;
      const reminderSelected = values.reminder_settings_block?.reminder_checkboxes?.selected_options || [];
      const reminderValues = reminderSelected.map((o: any) => o.value);

      const reminderTextEnabled = reminderValues.includes("reminder_text");
      const reminderImageEnabled = reminderValues.includes("reminder_image");

      const flexMode = values.flexibility_settings_block?.flexibility_mode_select?.selected_option?.value as any;
      const flexibilityMode = flexMode === "STRICT" || flexMode === "RELAXED" ? flexMode : "STANDARD";

      const managerSelected = values.manager_settings_block?.manager_users_select?.selected_users || [];

      await MeetupService.updateWorkspaceSettings(teamId, {
        reminderTextEnabled,
        reminderImageEnabled,
        flexibilityMode,
        managerUserIds: managerSelected,
      });

      if (body.user?.id) {
        publishHomeTab(client, body.user.id, teamId).catch((err) => {
          console.warn(`Failed to auto-refresh App Home after settings update for user ${body.user?.id}:`, err);
        });
      }
    } catch (error) {
      console.error("Error saving workspace settings from modal:", error);
    }
  });

  // Submission: Handle launch Huddle disambiguation modal
  app.view("submit_launch_huddle_select_modal", async ({ ack, view, client }) => {
    await ack();
    try {
      const values = view.state.values;
      const metadata = JSON.parse(view.private_metadata || "{}");
      const meetupId = metadata.meetupId;
      const selectedOption = values.launch_huddle_block?.launch_huddle_select?.selected_option?.value;

      const threadTs = selectedOption === "main" ? undefined : selectedOption;
      await launchMeetupInThread(client, meetupId, threadTs);
    } catch (error) {
      console.error("Error launching meetup from disambiguation modal:", error);
    }
  });
}
