import { App } from "@slack/bolt";
import { MeetupService, SubtopicInput } from "../../services/meetupService.js";
import { buildScheduleModal } from "../ui/scheduleModal.js";
import { findChannelHuddles, DetectedHuddle } from "../utils/huddleDiscovery.js";
import { launchMeetupInThread } from "./actionHandlers.js";

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
      const newCount = currentCount + 1;

      const values = b.view.state.values;
      const channelId = values.channel_block?.channel_select?.selected_conversation || metadata.channelId;
      const title = values.title_block?.title_input?.value || "";
      const selectedSpeakers = values.speaker_block?.speaker_select?.selected_users || [];
      const duration = parseInt(values.duration_block?.duration_select?.selected_option?.value || "60", 10);
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
    const totalMinutes = parseInt(values.duration_block?.duration_select?.selected_option?.value || "60", 10);

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

    const modules: SubtopicInput[] = [];
    let totalPercentage = 0;
    const errors: Record<string, string> = {};

    for (let i = 0; i < count; i++) {
      const subTitle = values[`subtopic_title_${i}`]?.[`subtopic_title_input_${i}`]?.value || "";
      const rawPct = values[`subtopic_pct_${i}`]?.[`subtopic_pct_input_${i}`]?.value || "0";
      const pct = parseInt(rawPct, 10);

      if (!subTitle.trim()) {
        errors[`subtopic_title_${i}`] = "Please provide a name for this subtopic.";
      }
      if (isNaN(pct) || pct <= 0) {
        errors[`subtopic_pct_${i}`] = "Percentage must be a positive number.";
      }

      modules.push({ title: subTitle, percentage: pct });
      totalPercentage += pct;
    }

    if (totalPercentage !== 100) {
      errors[`subtopic_pct_${count - 1}`] = `Total must equal 100%. Currently: ${totalPercentage}%.`;
    }

    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: "errors",
        errors,
      });
      return;
    }

    // Acknowledge submission cleanly
    await ack();

    try {
      await MeetupService.createMeetup({
        title,
        totalMinutes,
        channelId,
        speakerUserId,
        threadTs,
        modules,
      });

      const speakerText = MeetupService.formatSpeakerMentions(speakerUserId);
      const destinationNote = threadTs && threadTs !== "auto" && threadTs !== "main"
        ? "locked to selected Huddle thread"
        : threadTs === "main"
        ? "main channel feed"
        : "auto-detect active Huddle on launch";

      // Silent scheduling: post ephemeral confirmation to creator without public channel spam
      try {
        await client.chat.postEphemeral({
          channel: channelId,
          user: body.user.id,
          text: `📅 *Scheduled:* '${title}' (${totalMinutes}m) with ${speakerText} (${destinationNote}). Ready to launch from your Home tab!`,
        });
      } catch {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `📅 *Scheduled:* '${title}' (${totalMinutes}m) in <#${channelId}> with ${speakerText} (${destinationNote}).`,
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
