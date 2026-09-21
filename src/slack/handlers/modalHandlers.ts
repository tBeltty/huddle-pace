import { App } from "@slack/bolt";
import { MeetupService, SubtopicInput } from "../../services/meetupService.js";
import { buildScheduleModal } from "../ui/scheduleModal.js";

export function registerModalHandlers(app: App) {
  // Action: Add another subtopic row in the modal dynamically
  app.action("add_subtopic_row_action", async ({ ack, body, client }) => {
    await ack();
    try {
      const b = body as any;
      const metadata = JSON.parse(b.view.private_metadata || "{}");
      const currentCount = metadata.subtopicCount || 3;
      const newCount = currentCount + 1;

      await client.views.update({
        view_id: b.view.id,
        view: buildScheduleModal({
          subtopicCount: newCount,
          currentUserId: b.user?.id,
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
        modules,
      });

      const speakerText = MeetupService.formatSpeakerMentions(speakerUserId);

      // Silent scheduling: post ephemeral confirmation to creator without public channel spam
      try {
        await client.chat.postEphemeral({
          channel: channelId,
          user: body.user.id,
          text: `📅 *Scheduled:* '${title}' (${totalMinutes}m) with ${speakerText}. It is saved to your Home tab and ready to launch in your Huddle!`,
        });
      } catch {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `📅 *Scheduled:* '${title}' (${totalMinutes}m) in <#${channelId}> with ${speakerText}. Launch it whenever you start the Huddle!`,
        });
      }
    } catch (error) {
      console.error("Error creating meetup from modal submission:", error);
    }
  });
}
