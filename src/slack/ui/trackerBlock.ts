import { renderProgressBar, formatMinutes } from "../../utils/progressBar.js";

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
}

export function buildLiveTrackerBlocks(data: TrackerData): any[] {
  const percent = Math.min(100, Math.round((data.elapsedMinutes / data.totalMinutes) * 100));
  const progressVisual = renderProgressBar(percent, 16);

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
          text: `👤 *Speaker*\n<@${data.speakerUserId}>`,
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
