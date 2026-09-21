import { PacingReportStats } from "../../services/meetupService.js";
import { formatMinutes } from "../../utils/progressBar.js";

export function buildPacingReportBlocks(stats: PacingReportStats, days = 30): any[] {
  const complianceEmoji = stats.complianceRate >= 80 ? "🟢" : stats.complianceRate >= 60 ? "🟡" : "🔴";

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 HuddlePace Time Management Report",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Summary of team meeting discipline and timebox efficiency for the *last ${days} days*.`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `🎯 *Timebox Compliance*\n${complianceEmoji} *${stats.complianceRate}%* (${stats.completedOnTime} / ${stats.totalSessions} on time)`,
        },
        {
          type: "mrkdwn",
          text: `⏱️ *Total Formal Time*\n*${formatMinutes(stats.totalFormalMinutes)}*`,
        },
        {
          type: "mrkdwn",
          text: `☕ *Casual Chatting Time*\n*${formatMinutes(stats.totalChattingMinutes)}*`,
        },
        {
          type: "mrkdwn",
          text: `👥 *Total Sessions Tracked*\n*${stats.totalSessions} meetups*`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📅 Recent Meeting Log",
        emoji: true,
      },
    },
  ];

  if (stats.recentSessions.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No completed meetings recorded in this timeframe._",
      },
    });
  } else {
    for (const session of stats.recentSessions) {
      const statusIcon = session.isOnTime ? "✅" : "⚠️ Overtime";
      const diff = session.formalDurationMin - session.totalBudgetMin;
      const diffText = diff > 0 ? `+${diff}m` : `${diff}m`;

      const chatText = session.chattingDurationMin > 0
        ? ` | ☕ Chatting: *${session.chattingDurationMin}m*`
        : "";

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${session.title}*  •  ${statusIcon} (${diffText})\nSpeakers: ${session.speakerMentions}\nFormal Duration: *${session.formalDurationMin}m* (Budget: ${session.totalBudgetMin}m)${chatText}`,
        },
      });
    }
  }

  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "💡 _HuddlePace decouples structured presentation time from casual post-meeting chatter._",
        },
      ],
    }
  );

  return blocks;
}
