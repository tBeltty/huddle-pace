import { renderProgressBar, formatMinutes } from "../../utils/progressBar.js";
import { MeetupService } from "../../services/meetupService.js";

interface TrackerData {
  meetupId: string;
  title: string;
  totalMinutes: number;
  speakerUserId: string;
  elapsedMinutes: number;
  currentModuleName: string;
  moduleRemainingMinutes: number;
  nextModuleName: string | null;
  isOvertime?: boolean;
  isChatting?: boolean;
  chattingElapsedMinutes?: number;
}

export function buildLiveTrackerBlocks(data: TrackerData): any[] {
  const percent = Math.min(100, Math.round((data.elapsedMinutes / data.totalMinutes) * 100));
  const progressVisual = renderProgressBar(percent, 16);
  const speakerDisplay = MeetupService.formatSpeakerMentions(data.speakerUserId);

  if (data.isChatting) {
    const chatMinutes = data.chattingElapsedMinutes || 0;
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `☕ ${data.title} (Just Chatting)`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `☕ *Formal Agenda Complete — Casual Chatting*\n\n• *Formal Duration:* ${data.elapsedMinutes}m (Budget: ${data.totalMinutes}m)\n• *Casual Chatting:* ${chatMinutes}m\n• *Speakers:* ${speakerDisplay}\n\nThe scheduled presentation has finished. The Huddle remains open for questions and casual discussion.`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "⏹️ Conclude Session",
              emoji: true,
            },
            style: "danger",
            value: data.meetupId,
            action_id: "conclude_meetup_action",
            confirm: {
              title: {
                type: "plain_text",
                text: "Conclude Session?",
              },
              text: {
                type: "mrkdwn",
                text: "Stop tracking and mark this session as finished?",
              },
              confirm: {
                type: "plain_text",
                text: "Yes, Conclude",
              },
              deny: {
                type: "plain_text",
                text: "Keep Chatting",
              },
            },
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "🔄 _Updates automatically in-place. Concludes when the Huddle call ends._",
          },
        ],
      },
    ];
  }

  const statusBadge = data.isOvertime ? "🔴 *Session Overtime*" : "🟢 *Pacing On Track*";
  const nextModuleDisplay = data.nextModuleName
    ? `*${data.nextModuleName}*`
    : "_Final Segment / Conclusion_";

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `⏱️ ${data.title}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `👤 *Speaker(s)*\n${speakerDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `⏳ *Total Budget*\n${formatMinutes(data.totalMinutes)}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusBadge} • *${data.elapsedMinutes} / ${data.totalMinutes} min* (${percent}%)\n${progressVisual}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `📍 *Current Module*\n*${data.currentModuleName}* (${data.moduleRemainingMinutes}m remaining)`,
        },
        {
          type: "mrkdwn",
          text: `⏭️ *Next Up*\n${nextModuleDisplay}`,
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
            text: "☕ Switch to Just Chatting",
            emoji: true,
          },
          value: data.meetupId,
          action_id: "switch_to_chatting_action",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⏹️ Conclude Meetup",
            emoji: true,
          },
          style: "danger",
          value: data.meetupId,
          action_id: "conclude_meetup_action",
          confirm: {
            title: {
              type: "plain_text",
              text: "Conclude Meetup?",
            },
            text: {
              type: "mrkdwn",
              text: "Stop live tracking and mark this session as completed?",
            },
            confirm: {
              type: "plain_text",
              text: "Yes, Conclude",
            },
            deny: {
              type: "plain_text",
              text: "Keep Running",
            },
          },
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "🔄 _In-place updates every 30s. Speaker receives private pacing notifications._",
        },
      ],
    },
  ];
}
