import { App } from "@slack/bolt";
import { MeetupService, SubtopicInput } from "../../services/meetupService.js";
import { buildScheduleModal, MAX_SUBTOPICS } from "../ui/scheduleModal.js";
import { findChannelHuddles, DetectedHuddle } from "../utils/huddleDiscovery.js";
import { launchMeetupInThread } from "./actionHandlers.js";
import { scheduleModalInputSchema } from "../schemas/scheduleSchema.js";
import { ensureBotInChannel } from "../utils/channelUtils.js";
import { publishHomeTab } from "./homeHandlers.js";

export function registerModalHandlers(app: App) {
  // Action: Dynamically refresh Huddle list when user selects a target channel in the modal
  app.action("channel_select", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const selectedChannel = b.actions[0]?.selected_conversation;
      if (!selectedChannel) return;

      const huddles = await findChannelHuddles(client, selectedChannel);

      const values = b.view.state.values;
      const title = values.title_block?.title_input?.value || "";
      const selectedSpeakers = values.speaker_block?.speaker_select?.selected_users || [];
      const duration = parseInt(values.duration_block?.duration_select?.selected_option?.value || "60", 10);
      const customDuration = values.custom_duration_block?.custom_duration_input?.value || "";
      const customThreadTs = values.custom_thread_block?.custom_thread_input?.value || "";
      const metadata = JSON.parse(b.view.private_metadata || "{}");
      const count = metadata.subtopicCount || 3;

      const customSubtopics: Array<{ title: string; pct: string }> = [];
      for (let i = 0; i < count; i++) {
        customSubtopics.push({
          title: values[`subtopic_title_${i}`]?.[`subtopic_title_input_${i}`]?.value || "",
          pct: values[`subtopic_pct_${i}`]?.[`subtopic_pct_input_${i}`]?.value || "",
        });
      }

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          title,
          channelId: selectedChannel,
          speakerUserIds: selectedSpeakers,
          duration,
          customDuration,
          subtopicCount: count,
          customThreadTs,
          availableHuddles: huddles,
          customSubtopics,
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
      const newCount = Math.min(MAX_SUBTOPICS, currentCount + 1);

      const values = b.view.state.values;
      const channelId = values.channel_block?.channel_select?.selected_conversation || metadata.channelId;
      const title = values.title_block?.title_input?.value || "";
      const selectedSpeakers = values.speaker_block?.speaker_select?.selected_users || [];
      const duration = parseInt(values.duration_block?.duration_select?.selected_option?.value || "60", 10);
      const customDuration = values.custom_duration_block?.custom_duration_input?.value || "";
      const selectedHuddleChoice = values.huddle_select_block?.huddle_select?.selected_option?.value;
      const customThreadTs = values.custom_thread_block?.custom_thread_input?.value || "";

      let huddles: DetectedHuddle[] = [];
      if (channelId) {
        huddles = await findChannelHuddles(client, channelId);
      }

      const customSubtopics: Array<{ title: string; pct: string }> = [];
      for (let i = 0; i < currentCount; i++) {
        customSubtopics.push({
          title: values[`subtopic_title_${i}`]?.[`subtopic_title_input_${i}`]?.value || "",
          pct: values[`subtopic_pct_${i}`]?.[`subtopic_pct_input_${i}`]?.value || "",
        });
      }

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          title,
          channelId,
          speakerUserIds: selectedSpeakers,
          duration,
          customDuration,
          subtopicCount: newCount,
          selectedHuddleChoice,
          customThreadTs,
          availableHuddles: huddles,
          customSubtopics,
        }),
      });
    } catch (error) {
      console.error("Error dynamically appending subtopic row:", error);
    }
  });

  // Submission: Handle schedule modal submission
  app.view("submit_schedule_modal", async ({ ack, view, body, client }) => {
    const values = view.state.values;
    const metadata = JSON.parse(view.private_metadata || "{}");
    const count = metadata.subtopicCount || 3;

    const title = values.title_block?.title_input?.value || "";
    const channelId = values.channel_block?.channel_select?.selected_conversation || "";
    const presetMinutes = parseInt(values.duration_block?.duration_select?.selected_option?.value || "60", 10);
    const customDurationStr = values.custom_duration_block?.custom_duration_input?.value?.trim() || "";

    let totalMinutes = presetMinutes;
    if (customDurationStr) {
      const parsedCustom = Number(customDurationStr);
      totalMinutes = isNaN(parsedCustom) ? -1 : parsedCustom;
    }

    // Multi-speaker selection support
    const selectedSpeakers: string[] = values.speaker_block?.speaker_select?.selected_users || [];
    const speakerUserId = selectedSpeakers.length > 0 ? selectedSpeakers.join(",") : body.user.id;

    // Huddle destination selection
    const huddleChoice = values.huddle_select_block?.huddle_select?.selected_option?.value || "auto";
    const customThread = values.custom_thread_block?.custom_thread_input?.value?.trim() || "";

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

    const rawModules = [];
    for (let i = 0; i < count; i++) {
      const subTitle = values[`subtopic_title_${i}`]?.[`subtopic_title_input_${i}`]?.value || "";
      const rawPct = values[`subtopic_pct_${i}`]?.[`subtopic_pct_input_${i}`]?.value;
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
            errors[`subtopic_pct_${index}`] = issue.message;
          } else {
            errors[`subtopic_title_${index}`] = issue.message;
          }
        } else if (path[0] === "title") {
          errors["title_block"] = issue.message;
        } else if (path[0] === "channelId") {
          errors["channel_block"] = issue.message;
        } else if (path[0] === "totalMinutes") {
          const targetBlock = customDurationStr ? "custom_duration_block" : "duration_block";
          errors[targetBlock] = issue.message;
        }
      }

      await ack({
        response_action: "errors",
        errors,
      });
      return;
    }

    // Acknowledge submission cleanly
    await ack();

    const validatedData = validationResult.data;

    // Seamlessly ensure bot is present in target channel (auto-joins public channels)
    await ensureBotInChannel(client, validatedData.channelId, body.user.id);

    try {
      const teamId = body.team?.id || body.user?.team_id || "default";
      await MeetupService.createMeetup({
        title: validatedData.title,
        totalMinutes: validatedData.totalMinutes,
        channelId: validatedData.channelId,
        speakerUserId: validatedData.speakerUserId,
        threadTs: validatedData.threadTs,
        teamId,
        modules: validatedData.modules,
      });

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
          text: `*Scheduled:* '${title}' (${totalMinutes}m) with ${speakerText} (${destinationNote}). Ready to launch from your Home tab!`,
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
