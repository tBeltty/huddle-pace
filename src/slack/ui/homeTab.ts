import { View } from "@slack/bolt";
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

export function buildHomeTabView(
  activeMeetups: MeetupWithModules[],
  upcomingMeetups: MeetupWithModules[],
  stats?: PacingReportStats
): View {
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "⚡ HuddlePace Dashboard",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Schedule timed talks, track modular agendas in real time, and end on schedule.",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "➕ Schedule New Meetup",
            emoji: true,
          },
          style: "primary",
          action_id: "open_schedule_modal",
        },
      ],
    },
    { type: "divider" },
  ];

  // Active Sessions
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "🟢 Active Sessions",
      emoji: true,
    },
  });

  if (activeMeetups.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No active meetups currently running._ Click *Schedule New Meetup* above to start one.",
      },
    });
  } else {
    for (const meetup of activeMeetups) {
      const elapsedMinutes = meetup.startedAt
        ? Math.floor((Date.now() - new Date(meetup.startedAt).getTime()) / (60 * 1000))
        : 0;
      const isOvertime = elapsedMinutes >= meetup.totalMinutes;
      const percent = Math.min(100, Math.round((elapsedMinutes / meetup.totalMinutes) * 100));
      const statusBadge = meetup.status === "JUST_CHATTING"
        ? "☕ *Just Chatting*"
        : isOvertime
        ? "🔴 *Overtime*"
        : "🟢 *In Progress*";

      const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${meetup.title}*  •  ${statusBadge}\nChannel: <#${meetup.channelId}> | Speakers: ${speakers}\nElapsed: *${elapsedMinutes} / ${meetup.totalMinutes} min*\n${renderProgressBar(percent, 16)}`,
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

  // Upcoming Scheduled Sessions
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "📅 Upcoming Meetups",
      emoji: true,
    },
  });

  if (upcomingMeetups.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No upcoming scheduled meetups._",
      },
    });
  } else {
    for (const meetup of upcomingMeetups) {
      const breakdownText = meetup.modules
        .map((m) => `• *${m.title}* (${m.percentage}% — ${formatMinutes(m.durationMinutes)})`)
        .join("\n");

      const speakers = MeetupService.formatSpeakerMentions(meetup.speakerUserId);

      blocks.push({
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
      });
    }
  }

  // 30-Day Pacing Analytics Section
  if (stats) {
    const complianceEmoji = stats.complianceRate >= 80 ? "🟢" : stats.complianceRate >= 60 ? "🟡" : "🔴";
    blocks.push(
      { type: "divider" },
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 30-Day Pacing Analytics",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `🎯 *Compliance Rate*\n${complianceEmoji} *${stats.complianceRate}%* (${stats.completedOnTime} / ${stats.totalSessions})`,
          },
          {
            type: "mrkdwn",
            text: `⏱️ *Formal Talk Time*\n*${formatMinutes(stats.totalFormalMinutes)}*`,
          },
          {
            type: "mrkdwn",
            text: `☕ *Casual Chat Time*\n*${formatMinutes(stats.totalChattingMinutes)}*`,
          },
          {
            type: "mrkdwn",
            text: `👥 *Sessions Tracked*\n*${stats.totalSessions} meetups*`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📊 View Full Report",
              emoji: true,
            },
            action_id: "open_report_modal",
          },
        ],
      }
    );
  }

  return {
    type: "home",
    blocks,
  };
}
