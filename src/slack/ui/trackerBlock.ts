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
  const progressVisual = renderProgressBar(percent, 18);

  const statusPrefix = data.isOvertime ? "⚠️ *OVERTIME WARNING:*" : "🎙️ *Live Meetup Tracker:*";

  const nextSectionText = data.nextModuleName
    ? `\n⏭️ *Next Up:* ${data.nextModuleName}`
    : "\n🏁 *Final Segment / Conclusion*";

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
      text: {
        type: "mrkdwn",
        text: `${statusPrefix} *${data.title}*\n👤 *Speaker:* <@${data.speakerUserId}> | Total Budget: *${formatMinutes(data.totalMinutes)}*\n\n⏱️ *Elapsed Time:* ${data.elapsedMinutes}m / ${data.totalMinutes}m\n${progressVisual}\n\n📍 *Current Module:* *${data.currentModuleName}* (${data.moduleRemainingMinutes}m remaining)${nextSectionText}`,
      },
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
              text: "Are you sure you want to stop tracking and mark this meetup as completed?",
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
          text: "🔄 _Updates automatically in-place every 30s. Speaker receives private pacing DMs._",
        },
      ],
    },
  ];
}
