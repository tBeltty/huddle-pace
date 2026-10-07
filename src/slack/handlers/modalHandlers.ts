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
  templateToModalState,
} from "../ui/scheduleModal.js";
import { findChannelHuddles, DetectedHuddle } from "../utils/huddleDiscovery.js";
import { rebalanceAfterEdit, addRowKeepingTotal } from "../../utils/percentages.js";
import { launchMeetupInThread } from "./actionHandlers.js";
import { scheduleModalInputSchema, ScheduleModalInputDTO } from "../schemas/scheduleSchema.js";
import { buildScheduleConflictModal } from "../ui/conflictModal.js";
import { resolveZoneForUser, scheduleContextFor } from "../utils/scheduleZone.js";
import { stashPendingSchedule, takePendingSchedule } from "../utils/pendingSchedule.js";
import { PendingSchedule, createScheduledMeetup, updateScheduledMeetup } from "./scheduleSubmission.js";
import { PT_ZONE, formatEventTime, isValidZone, normalizeTimezoneSetting, zonedWallTimeToUtc } from "../../utils/timezone.js";
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
    zone: metadata.zone,
    scheduleDate: getModalAction(values, "schedule_date_picker")?.selected_date || undefined,
    scheduleTime: getModalAction(values, "schedule_time_picker")?.selected_time || undefined,
    blockedRange: metadata.blocked,
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
    saveAsTemplate: (getModalAction(values, "save_template_checkbox")?.selected_options || []).length > 0,
    editTemplateId: metadata.templateId,
    templateName: getModalAction(values, "template_name_input")?.value || "",
    templateListState: metadata.templateListState,
    selectedTemplateId: getModalAction(values, "template_select")?.selected_option?.value,
    rev: metadata.rev,
    editMeetupId: metadata.meetupId,
  };
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

/** Paces that have not started and can still be edited. A MISSED pace is edited to reschedule it. */
function isEditableStatus(status: string): boolean {
  return status === "SCHEDULED" || status === "MANUAL_START" || status === "MISSED";
}

/** The date, time and zone fields of a modal state, so re-renders from a template keep them. */
function scheduleSlice(state: Partial<ModalStateData>): Partial<ModalStateData> {
  return {
    zone: state.zone,
    scheduleDate: state.scheduleDate,
    scheduleTime: state.scheduleTime,
    blockedRange: state.blockedRange,
  };
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
      if (!meetup || meetup.teamId !== teamId || !isEditableStatus(meetup.status)) return;
      if (!(await MeetupService.canUserManageMeetup(client, meetup, userId))) return;

      const zone = await resolveZoneForUser(client, userId, teamId);

      const hasSpecificThread = !!meetup.threadTs && meetup.threadTs !== "auto" && meetup.threadTs !== "main";
      await client.views.open({
        trigger_id: b.trigger_id,
        view: buildScheduleModal({
          // A missed pace's old time is in the past, so offer the next quarter hour instead
          ...scheduleContextFor(meetup.status === "MISSED" ? null : meetup.scheduledFor, zone),
          ...(meetup.status === "MISSED"
            ? { scheduleNotice: "⏳ *This pace missed its Huddle.* Pick a new date and time and HuddlePace will watch for a Huddle again." }
            : {}),
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

  // Action: Cancel a pace that has not started
  app.action("cancel_scheduled_meetup_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const userId = b.user?.id;
      const teamId = b.team?.id || b.user?.team_id || "default";
      const meetup = await MeetupService.getMeetupById(b.actions[0]?.value);
      if (!meetup || meetup.teamId !== teamId || !isEditableStatus(meetup.status)) return;
      if (!(await MeetupService.canUserManageMeetup(client, meetup, userId))) return;

      if (await MeetupService.cancelMeetup(meetup.id)) {
        const owners = [userId, meetup.createdByUserId, ...MeetupService.parseSpeakerIds(meetup.speakerUserId)];
        for (const owner of new Set(owners.filter((id): id is string => !!id))) {
          publishHomeTab(client, owner, teamId).catch((error) => {
            console.error(`Could not refresh App Home for ${owner} after cancelling a pace:`, error);
          });
        }
      }
    } catch (error) {
      console.error("Error cancelling scheduled meetup:", error);
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

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          ...templateToModalState(template, userId, huddles),
          ...scheduleSlice(readScheduleModalState(b.view.state.values, JSON.parse(b.view.private_metadata || "{}"))),
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
    const saveAsTemplate = (getModalAction(values, "save_template_checkbox")?.selected_options || []).length > 0;

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
    const userId: string = body.user.id;
    const validatedData = validationResult.data;
    const zone: string = isValidZone(metadata.zone) ? metadata.zone : PT_ZONE;
    const titleBlock = findModalBlockId(values, "title_input") ?? "title_block";
    const timeBlock = findModalBlockId(values, "schedule_time_picker") ?? "schedule_time_block";

    const existing = editMeetupId ? await MeetupService.getMeetupById(editMeetupId) : null;
    if (editMeetupId) {
      if (!existing || existing.teamId !== teamId) {
        await ack({ response_action: "errors", errors: { [titleBlock]: "This meetup no longer exists." } });
        return;
      }
      if (!(await MeetupService.canUserManageMeetup(client, existing, userId))) {
        await ack({ response_action: "errors", errors: { [titleBlock]: "Only the speaker(s), the creator or a workspace manager can edit this meetup." } });
        return;
      }
      if (!isEditableStatus(existing.status)) {
        await ack({ response_action: "errors", errors: { [titleBlock]: "This meetup already started and can no longer be edited." } });
        return;
      }
    }

    // Exact event time, read in the workspace zone
    const pickedDate: string | undefined = getModalAction(values, "schedule_date_picker")?.selected_date;
    const pickedTime: string | undefined = getModalAction(values, "schedule_time_picker")?.selected_time;
    if (!pickedDate || !pickedTime) {
      await ack({ response_action: "errors", errors: { [timeBlock]: "Pick the date and time of the Huddle." } });
      return;
    }
    const scheduledFor = zonedWallTimeToUtc(pickedDate, pickedTime, zone);
    const windowMilliseconds = MeetupService.CAPTURE_WINDOW_MINUTES * 60_000;
    if (scheduledFor.getTime() + windowMilliseconds < Date.now()) {
      await ack({ response_action: "errors", errors: { [timeBlock]: "That time has already passed. Pick a time from now on." } });
      return;
    }

    // After "Change time" the range around the other pace stays blocked
    const blocked = metadata.blocked as { from: string; to: string; title: string; channelId: string } | undefined;
    if (
      blocked &&
      blocked.channelId === validatedData.channelId &&
      scheduledFor.getTime() >= new Date(blocked.from).getTime() &&
      scheduledFor.getTime() <= new Date(blocked.to).getTime()
    ) {
      await ack({
        response_action: "errors",
        errors: {
          [timeBlock]: `Too close to "${blocked.title}". Pick a time before ${formatEventTime(new Date(blocked.from), zone)} or after ${formatEventTime(new Date(blocked.to), zone)}.`,
        },
      });
      return;
    }

    // A pace that starts within the capture window of another would compete for the same Huddle
    if (!existing || existing.status !== "MANUAL_START") {
      const conflict = await MeetupService.findScheduleConflict(validatedData.channelId, teamId, scheduledFor, editMeetupId);
      if (conflict?.scheduledFor) {
        const token = stashPendingSchedule<PendingSchedule>({
          validatedData,
          saveAsTemplate,
          scheduledForIso: scheduledFor.toISOString(),
          editMeetupId,
          zone,
          userId,
          teamId,
          formState: readScheduleModalState(values, metadata),
          conflict: {
            title: conflict.title,
            scheduledForIso: conflict.scheduledFor.toISOString(),
            channelId: validatedData.channelId,
          },
        });
        const manualCode = existing?.manualStartCode ?? (await MeetupService.nextManualStartCode(validatedData.channelId, teamId));
        await ack({
          response_action: "push",
          view: buildScheduleConflictModal({
            token,
            channelId: validatedData.channelId,
            zone,
            existingTitle: conflict.title,
            existingTime: conflict.scheduledFor,
            manualCode,
          }),
        });
        return;
      }
    }

    await ack();

    if (editMeetupId && existing) {
      await updateScheduledMeetup({
        client, userId, teamId, validatedData, saveAsTemplate, scheduledFor, zone,
        manualStart: existing.status === "MANUAL_START",
        editMeetupId,
        previousSpeakerIds: MeetupService.parseSpeakerIds(existing.speakerUserId),
      });
      return;
    }

    await createScheduledMeetup({ client, userId, teamId, validatedData, saveAsTemplate, scheduledFor, zone, manualStart: false });
  });

  // Submission: "Save for manual start" on the time conflict notice
  app.view("submit_schedule_conflict_modal", async ({ ack, view, client }) => {
    const { token } = JSON.parse(view.private_metadata || "{}");
    const pending = takePendingSchedule<PendingSchedule>(token);
    if (!pending) {
      await ack({
        response_action: "update",
        view: {
          type: "modal",
          title: { type: "plain_text", text: "Time conflict" },
          close: { type: "plain_text", text: "Close" },
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: "This form expired. Close it and schedule the pace again." },
            },
          ],
        },
      });
      return;
    }

    await ack({ response_action: "clear" });

    const request = {
      client,
      userId: pending.userId,
      teamId: pending.teamId,
      validatedData: pending.validatedData,
      saveAsTemplate: pending.saveAsTemplate,
      scheduledFor: new Date(pending.scheduledForIso),
      zone: pending.zone,
      manualStart: true,
    };

    if (pending.editMeetupId) {
      const existing = await MeetupService.getMeetupById(pending.editMeetupId);
      if (!existing || existing.teamId !== pending.teamId) return;
      await updateScheduledMeetup({
        ...request,
        editMeetupId: pending.editMeetupId,
        previousSpeakerIds: MeetupService.parseSpeakerIds(existing.speakerUserId),
      });
      return;
    }
    await createScheduledMeetup(request);
  });

  // "Change time" on the conflict notice: back to the form with the other pace's range blocked
  app.view({ callback_id: "submit_schedule_conflict_modal", type: "view_closed" }, async ({ ack, view, client }) => {
    await ack();
    try {
      const { token } = JSON.parse(view.private_metadata || "{}");
      const pending = takePendingSchedule<PendingSchedule>(token);
      if (!pending || !view.previous_view_id) return;

      const windowMilliseconds = MeetupService.CAPTURE_WINDOW_MINUTES * 60_000;
      const otherPaceAt = new Date(pending.conflict.scheduledForIso).getTime();
      const from = new Date(otherPaceAt - windowMilliseconds);
      const to = new Date(otherPaceAt + windowMilliseconds);
      const fromLabel = formatEventTime(from, pending.zone);
      const toLabel = formatEventTime(to, pending.zone);

      await client.views.update({
        view_id: view.previous_view_id,
        view: buildScheduleModal({
          ...pending.formState,
          zone: pending.zone,
          scheduleNotice: `🔒 *${fromLabel} to ${toLabel} is taken by "${pending.conflict.title}".* Pick a time before ${fromLabel} or after ${toLabel}.`,
          blockedRange: {
            from: from.toISOString(),
            to: to.toISOString(),
            title: pending.conflict.title,
            channelId: pending.conflict.channelId,
          },
          rev: Date.now().toString(36),
        }),
      });
    } catch (error) {
      console.error("Error returning to the schedule form after a time conflict:", error);
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

      const timezone = normalizeTimezoneSetting(values.timezone_settings_block?.timezone_select?.selected_option?.value);
      const managerSelected = values.manager_settings_block?.manager_users_select?.selected_users || [];

      await MeetupService.updateWorkspaceSettings(teamId, {
        reminderTextEnabled,
        reminderImageEnabled,
        flexibilityMode,
        timezone,
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
