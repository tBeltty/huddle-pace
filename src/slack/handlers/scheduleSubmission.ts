import { MeetupService } from "../../services/meetupService.js";
import type { ModalStateData } from "../ui/scheduleModal.js";
import type { ScheduleModalInputDTO } from "../schemas/scheduleSchema.js";
import { ensureBotInChannel } from "../utils/channelUtils.js";
import type { SlackClient } from "../utils/slackClient.js";
import { formatEventDateTime, formatEventTime } from "../../utils/timezone.js";
import { publishHomeTab } from "./homeHandlers.js";

/** A validated schedule form held while the user answers the time conflict notice. */
export interface PendingSchedule {
  validatedData: ScheduleModalInputDTO;
  saveAsTemplate: boolean;
  scheduledForIso: string;
  editMeetupId?: string;
  zone: string;
  userId: string;
  teamId: string;
  formState: Partial<ModalStateData>;
  conflict: { title: string; scheduledForIso: string; channelId: string };
}

export interface ScheduleRequest {
  client: SlackClient;
  userId: string;
  teamId: string;
  validatedData: ScheduleModalInputDTO;
  saveAsTemplate: boolean;
  scheduledFor: Date;
  zone: string;
  /** Keep the pace out of automatic capture; it starts with /pace start <code>. */
  manualStart: boolean;
}

export interface EditScheduleRequest extends ScheduleRequest {
  editMeetupId: string;
  previousSpeakerIds: string[];
}

function refreshHomeTabs(client: SlackClient, teamId: string, userIds: string[]) {
  for (const userId of new Set(userIds)) {
    publishHomeTab(client, userId, teamId).catch((error) => {
      console.warn(`Failed to auto-refresh App Home for user ${userId}:`, error);
    });
  }
}

/** "Wed, Oct 7 at 10:00 AM PT. HuddlePace watches for a Huddle from 9:40 AM to 10:20 AM PT." */
export function describeCaptureWindow(scheduledFor: Date, zone: string): string {
  const windowMilliseconds = MeetupService.CAPTURE_WINDOW_MINUTES * 60_000;
  const opens = formatEventTime(new Date(scheduledFor.getTime() - windowMilliseconds), zone);
  const closes = formatEventTime(new Date(scheduledFor.getTime() + windowMilliseconds), zone);
  return `${formatEventDateTime(scheduledFor, zone)}. HuddlePace watches for a Huddle from ${opens} to ${closes}.`;
}

function describeDestination(threadTs: string | null): string {
  if (threadTs === "main") return "main channel feed";
  if (threadTs && threadTs !== "auto") return "locked to selected Huddle thread";
  return "auto-detect active Huddle on launch";
}

async function saveTemplateNote(request: ScheduleRequest): Promise<string> {
  if (!request.saveAsTemplate) return "";
  const { validatedData, teamId, userId } = request;
  try {
    await MeetupService.saveTemplate({
      teamId,
      ownerUserId: userId,
      name: validatedData.title,
      channelId: validatedData.channelId,
      speakerUserId: validatedData.speakerUserId,
      totalMinutes: validatedData.totalMinutes,
      threadTs: validatedData.threadTs,
      reminderTextEnabled: validatedData.reminderTextEnabled,
      reminderImageEnabled: validatedData.reminderImageEnabled,
      modules: validatedData.modules,
    });
    return " Saved to My templates.";
  } catch (error) {
    console.error(`Meetup scheduled but template could not be saved (channelId=${validatedData.channelId}):`, error);
    return " The template could not be saved.";
  }
}

/** Saves a new pace and confirms privately to its creator. */
export async function createScheduledMeetup(request: ScheduleRequest): Promise<void> {
  const { client, userId, teamId, validatedData, scheduledFor, zone, manualStart } = request;

  await ensureBotInChannel(client, validatedData.channelId, userId);

  try {
    const created = await MeetupService.createMeetup({
      title: validatedData.title,
      totalMinutes: validatedData.totalMinutes,
      channelId: validatedData.channelId,
      speakerUserId: validatedData.speakerUserId,
      createdByUserId: userId,
      isPrivate: validatedData.isPrivate,
      threadTs: validatedData.threadTs,
      teamId,
      scheduledFor,
      manualStart,
      reminderTextEnabled: validatedData.reminderTextEnabled,
      reminderImageEnabled: validatedData.reminderImageEnabled,
      modules: validatedData.modules,
    });

    const templateNote = await saveTemplateNote(request);
    const speakerText = MeetupService.formatSpeakerMentions(validatedData.speakerUserId);
    refreshHomeTabs(client, teamId, [userId, ...MeetupService.parseSpeakerIds(validatedData.speakerUserId)]);

    const text = manualStart
      ? `*Saved for manual start:* '${validatedData.title}' (${validatedData.totalMinutes}m) with ${speakerText} as \`${created.manualStartCode}\`. It will not start on its own. When its Huddle begins, type \`/pace start ${created.manualStartCode}\` in <#${validatedData.channelId}>.${templateNote}`
      : `*Scheduled:* '${validatedData.title}' (${validatedData.totalMinutes}m) with ${speakerText} (${describeDestination(validatedData.threadTs)}) for ${describeCaptureWindow(scheduledFor, zone)}${templateNote}`;

    // Silent scheduling: confirm to the creator without public channel spam
    try {
      await client.chat.postEphemeral({ channel: validatedData.channelId, user: userId, text });
    } catch {
      await client.chat.postMessage({ channel: userId, text });
    }
  } catch (error) {
    console.error(`Error creating meetup from modal submission (channelId=${validatedData.channelId}, userId=${userId}):`, error);
  }
}

/** Applies an edit to a pace that has not started and confirms privately to the editor. */
export async function updateScheduledMeetup(request: EditScheduleRequest): Promise<void> {
  const { client, userId, teamId, validatedData, scheduledFor, zone, manualStart, editMeetupId } = request;

  await ensureBotInChannel(client, validatedData.channelId, userId);

  try {
    const updated = await MeetupService.updateScheduledMeetup(editMeetupId, {
      title: validatedData.title,
      totalMinutes: validatedData.totalMinutes,
      channelId: validatedData.channelId,
      speakerUserId: validatedData.speakerUserId,
      threadTs: validatedData.threadTs,
      scheduledFor,
      reminderTextEnabled: validatedData.reminderTextEnabled,
      reminderImageEnabled: validatedData.reminderImageEnabled,
      isPrivate: validatedData.isPrivate,
      modules: validatedData.modules,
    });
    const result = updated && manualStart && updated.status === "SCHEDULED"
      ? (await MeetupService.moveToManualStart(editMeetupId)) ?? updated
      : updated;

    refreshHomeTabs(client, teamId, [
      userId,
      ...request.previousSpeakerIds,
      ...MeetupService.parseSpeakerIds(validatedData.speakerUserId),
    ]);

    const text = !result
      ? `⚠️ '${validatedData.title}' started before your changes were saved, so they were not applied.`
      : result.status === "MANUAL_START"
      ? `*Updated:* '${validatedData.title}' (${validatedData.totalMinutes}m) in <#${validatedData.channelId}>. Start it with \`/pace start ${result.manualStartCode}\` when its Huddle begins.`
      : `*Updated:* '${validatedData.title}' (${validatedData.totalMinutes}m) in <#${validatedData.channelId}> for ${describeCaptureWindow(scheduledFor, zone)}`;
    await client.chat.postMessage({ channel: userId, text });
  } catch (error) {
    console.error(`Error updating meetup from modal submission (meetupId=${editMeetupId}, userId=${userId}):`, error);
  }
}
