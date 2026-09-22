import { View, ModalView } from "@slack/bolt";
import { renderProgressBar, formatMinutes } from "../../utils/progressBar.js";
import { MeetupService, PacingReportStats } from "../../services/meetupService.js";

interface MeetupWithModules {
  id: string;
  title: string;
  totalMinutes: number;
  channelId: string;
  speakerUserId: string;
  startedAt: Date | null;
  status: string;
  modules: Array<{
    title: string;
    percentage: number;
    durationMinutes: number;
  }>;
}

/**
 * Builds the streamlined, minimalist App Home view.
 */
export function buildHomeTabView(
  activeMeetups: MeetupWithModules[],
  upcomingMeetups: MeetupWithModules[],
  _stats?: PacingReportStats,
  currentUserId?: string
): View {
  const greeting = currentUserId ? `Hi, <@${currentUserId}> :wave:` : "Hi there :wave:";

  const blocks: any[] = [
    // 1. Personalized greeting
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${greeting}*`,
      },
    },
    // 2. Action row (Schedule Meetup, Analytics, Guide)
    {
      type: "actions",
      block_id: "home_action_bar",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "➕ Schedule Meetup",
            emoji: true,
          },
          style: "primary",
          action_id: "open_schedule_modal",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Analytics",
            emoji: true,
          },
          action_id: "open_report_modal",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Guide",
            emoji: true,
          },
          action_id: "open_guide_modal",
        },
      ],
    },
    { type: "divider" },
  ];

  const isCleanSlate = activeMeetups.length === 0 && upcomingMeetups.length === 0;

  if (isCleanSlate) {
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "☕ *Your agenda is clear*\nNo active or upcoming meetups scheduled right now.\n\nClick *➕ Schedule Meetup* above to plan your next timed session with modular checkpoints.",
        },
      }
    );
  } else {
    // 3. Active Sessions (if any)
    if (activeMeetups.length > 0) {
      blocks.push({
        type: "header",
        text: {
          type: "plain_text",
          text: "🟢 Active Sessions",
          emoji: true,
        },
      });

      for (const meetup of activeMeetups) {
        const elapsedMinutes = meetup.startedAt
          ? Math.floor((Date.now() - new Date(meetup.startedAt).getTime()) / (60 * 1000))
          : 0;
        const isOvertime = elapsedMinutes >= meetup.totalMinutes;
        const percent = Math.min(100, Math.round((elapsedMinutes / meetup.totalMinutes) * 100));
        const statusBadge =
          meetup.status === "JUST_CHATTING"
            ? "☕ *Just Chatting*"
            : isOvertime
            ? "🔴 *Overtime*"
            : "🟢 *In Progress*";

        const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);
        const isSpeaker = currentUserId
          ? MeetupService.parseSpeakerIds(meetup.speakerUserId).includes(currentUserId)
          : false;
        const roleBadge = currentUserId
          ? isSpeaker
            ? "  •  🌟 *You are a speaker*"
            : "  •  👀 _Spectator_"
          : "";

        const remainingMinutes = Math.max(0, meetup.totalMinutes - elapsedMinutes);
        blocks.push(
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${meetup.title}*  •  ${statusBadge}${roleBadge}\nChannel: <#${meetup.channelId}> | Speakers: ${speakers}\nElapsed: *${elapsedMinutes} / ${meetup.totalMinutes} min* (${percent}%) • *${formatMinutes(remainingMinutes)} remaining*\n${renderProgressBar(percent, 16)}`,
            },
            accessory: {
              type: "button",
              text: {
                type: "plain_text",
                text: "⏹️ Conclude",
                emoji: true,
              },
              style: "danger",
              value: meetup.id,
              action_id: "conclude_meetup_action",
            },
          },
          { type: "divider" }
        );
      }
    }

    // 4. Upcoming Sessions (if any)
    if (upcomingMeetups.length > 0) {
      const isSpeakerMatch = (meetup: MeetupWithModules) =>
        currentUserId ? MeetupService.parseSpeakerIds(meetup.speakerUserId).includes(currentUserId) : false;

      const myUpcoming = currentUserId ? upcomingMeetups.filter(isSpeakerMatch) : [];
      const teamUpcoming = currentUserId
        ? upcomingMeetups.filter((m) => !isSpeakerMatch(m))
        : upcomingMeetups;

      if (currentUserId) {
        if (myUpcoming.length > 0) {
          blocks.push({
            type: "header",
            text: {
              type: "plain_text",
              text: "🌟 My Scheduled Meetups",
              emoji: true,
            },
          });

          for (const meetup of myUpcoming) {
            const breakdownText = meetup.modules
              .map((m) => `• *${m.title}* (${m.percentage}% — ${formatMinutes(m.durationMinutes)})`)
              .join("\n");
            const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

            blocks.push(
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${meetup.title}* (${formatMinutes(meetup.totalMinutes)})\nChannel: <#${meetup.channelId}> | Speakers: ${speakers}\n${breakdownText}`,
                },
                accessory: {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "🚀 Start in Huddle",
                    emoji: true,
                  },
                  style: "primary",
                  value: meetup.id,
                  action_id: "start_scheduled_meetup_action",
                },
              },
              { type: "divider" }
            );
          }
        }

        if (teamUpcoming.length > 0) {
          blocks.push({
            type: "header",
            text: {
              type: "plain_text",
              text: "📅 Workspace Meetups",
              emoji: true,
            },
          });

          for (const meetup of teamUpcoming) {
            const breakdownText = meetup.modules
              .map((m) => `• *${m.title}* (${m.percentage}% — ${formatMinutes(m.durationMinutes)})`)
              .join("\n");
            const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

            blocks.push(
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${meetup.title}* (${formatMinutes(meetup.totalMinutes)})\nChannel: <#${meetup.channelId}> | Speakers: ${speakers}\n${breakdownText}`,
                },
                accessory: {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "🚀 Start in Huddle",
                    emoji: true,
                  },
                  style: "primary",
                  value: meetup.id,
                  action_id: "start_scheduled_meetup_action",
                },
              },
              { type: "divider" }
            );
          }
        }
      } else {
        blocks.push({
          type: "header",
          text: {
            type: "plain_text",
            text: "📅 Upcoming Meetups",
            emoji: true,
          },
        });

        for (const meetup of upcomingMeetups) {
          const breakdownText = meetup.modules
            .map((m) => `• *${m.title}* (${m.percentage}% — ${formatMinutes(m.durationMinutes)})`)
            .join("\n");
          const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

          blocks.push(
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${meetup.title}* (${formatMinutes(meetup.totalMinutes)})\nSpeakers: ${speakers} in <#${meetup.channelId}>\n${breakdownText}`,
              },
              accessory: {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "🚀 Start in Huddle",
                  emoji: true,
                },
                style: "primary",
                value: meetup.id,
                action_id: "start_scheduled_meetup_action",
              },
            },
            { type: "divider" }
          );
        }
      }
    }
  }

  // Safety: Slack caps Home tab view to 100 blocks maximum
  let finalBlocks = blocks;
  if (blocks.length > 98) {
    finalBlocks = blocks.slice(0, 98);
    finalBlocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "⚠️ _Additional meetups truncated to respect Slack's 100-block limit._",
        },
      ],
    });
  }

  return {
    type: "home",
    blocks: finalBlocks,
  };
}

/**
 * Builds the focused Quick Guide modal.
 */
export function buildGuideModal(): ModalView {
  return {
    type: "modal",
    title: {
      type: "plain_text",
      text: "HuddlePace Guide",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Close",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Keep talks on schedule and respect everyone's time in 3 easy steps:*\n\n" +
            "1️⃣ *Schedule with Modules:*\nClick *➕ Schedule Meetup* to divide your agenda into timed sections (e.g. Context 15%, Demo 60%, Q&A 25%).\n\n" +
            "2️⃣ *Launch in a Slack Huddle:*\nWhen you join your Huddle, click *🚀 Start in Huddle* to attach a live progress tracker to the channel feed.\n\n" +
            "3️⃣ *Distraction-Free Pacing Alerts:*\nSpeakers receive private DM checkpoints as modules advance, preventing meeting drift without interrupting the conversation.",
        },
      },
      { type: "divider" },
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚡ Quick Slash Commands",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "• `/pace` — Open the meetup scheduler in any channel\n" +
            "• `/pace status` — Check active sessions in the current channel\n" +
            "• `/pace report [days]` — View pacing compliance metrics (default: 30 days)\n" +
            "• `/pace help` — Show command reference and tips",
        },
      },
    ],
  };
}
