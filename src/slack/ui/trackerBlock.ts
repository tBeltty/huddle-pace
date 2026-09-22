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
  const remainingMinutes = Math.max(0, data.totalMinutes - data.elapsedMinutes);

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
          text: `> ☕ *Casual Chat Mode Active*\n> Formal presentation has finished at *${data.elapsedMinutes}m* (budget: ${data.totalMinutes}m). The room remains open for casual discussion and Q&A.`,
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
            text: `☕ *Casual Chat Duration*\n*${chatMinutes}m*`,
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
            text: "🔄 _In-place updates every 30s. Automatically concludes when the Huddle call ends._",
          },
        ],
      },
    ];
  }

  const statusBadge = data.isOvertime ? "🔴 *Session Overtime*" : "🟢 *Pacing On Track*";
  const nextModuleDisplay = data.nextModuleName
    ? `*${data.nextModuleName}*`
    : "_Final Segment / Wrap-up_";

  // Determine dynamic Vector Flight Companion check
  let companionAlert: string;
  if (data.isOvertime) {
    companionAlert = `> 🔴 *Holding Pattern (Overtime):* Meeting has exceeded the ${data.totalMinutes}m scheduled budget. Conclude or switch to casual chat.`;
  } else if (data.moduleRemainingMinutes <= 1 && data.nextModuleName) {
    companionAlert = `> ⏱️ *1-Minute Warning:* Wrapping up *${data.currentModuleName}*. Transitioning next to *${data.nextModuleName}*.`;
  } else if (remainingMinutes <= 2) {
    companionAlert = `> ⚠️ *Final Approach (${remainingMinutes}m remaining):* Begin summarizing action items and key takeaways before touchdown.`;
  } else if (percent >= 50) {
    companionAlert = `> 🧭 *Midpoint Flight Check:* Over 50% of estimated time has elapsed. If you have critical technical blockers, bring them to the table now before touchdown.`;
  } else {
    companionAlert = `> ⏱️ *Flight Plan Active:* Pacing is steady. Moving through *${data.currentModuleName}*.`;
  }

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
        text: `${statusBadge}  •  *${data.elapsedMinutes} / ${data.totalMinutes} min* (${percent}%)\n${progressVisual}  •  *${formatMinutes(remainingMinutes)} remaining*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: companionAlert,
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
          text: `📍 *Active Module*\n*${data.currentModuleName}* (${data.moduleRemainingMinutes}m left)`,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `⏭️ *Next Up:* ${nextModuleDisplay}`,
        },
      ],
    },
    {
      type: "divider",
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "☕ Just Chatting",
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
          text: "🔄 _In-place updates every 30s. Vector keeps your team on flight path._",
        },
      ],
    },
  ];
}
