import { View } from "@slack/bolt";
import { renderProgressBar, formatMinutes } from "../../utils/progressBar.js";

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
  upcomingMeetups: MeetupWithModules[]
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
      const statusBadge = isOvertime ? "🔴 *Overtime*" : "🟢 *In Progress*";

      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${meetup.title}*  •  ${statusBadge}\nChannel: <#${meetup.channelId}> | Speaker: <@${meetup.speakerUserId}>\nElapsed: *${elapsedMinutes} / ${meetup.totalMinutes} min*\n${renderProgressBar(percent, 16)}`,
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

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${meetup.title}* (${formatMinutes(meetup.totalMinutes)})\nSpeaker: <@${meetup.speakerUserId}> in <#${meetup.channelId}>\n${breakdownText}`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "🚀 Start Now",
            emoji: true,
          },
          style: "primary",
          value: meetup.id,
          action_id: "start_scheduled_meetup_action",
        },
      });
    }
  }

  return {
    type: "home",
    blocks,
  };
}
