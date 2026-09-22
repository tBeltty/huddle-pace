import { View } from "@slack/bolt";
import { renderProgressBar, formatMinutes } from "../../utils/progressBar.js";
import { MeetupService, PacingReportStats } from "../../services/meetupService.js";

export type HomeTabType = "meetups" | "analytics" | "guide";

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
  stats?: PacingReportStats,
  currentUserId?: string,
  activeTab: HomeTabType = "meetups"
): View {
  const blocks: any[] = [
    // 1. Dashboard Header
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
    // 2. Action Bar
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
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔄 Refresh",
            emoji: true,
          },
          action_id: "refresh_home_tab",
        },
      ],
    },
    { type: "divider" },
    // 3. Sub-tabs Navigation Bar (Capas)
    {
      type: "actions",
      block_id: "home_subtabs_nav",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: activeTab === "meetups" ? "📅 Meetups & Agenda •" : "📅 Meetups & Agenda",
            emoji: true,
          },
          style: activeTab === "meetups" ? "primary" : undefined,
          action_id: "nav_tab_meetups",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: activeTab === "analytics" ? "📊 Analytics •" : "📊 Analytics",
            emoji: true,
          },
          style: activeTab === "analytics" ? "primary" : undefined,
          action_id: "nav_tab_analytics",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: activeTab === "guide" ? "❓ Guide & Tips •" : "❓ Guide & Tips",
            emoji: true,
          },
          style: activeTab === "guide" ? "primary" : undefined,
          action_id: "nav_tab_guide",
        },
      ],
    },
    { type: "divider" },
  ];

  // --------------------------------------------------------------------------
  // TAB 1: MEETUPS & AGENDA
  // --------------------------------------------------------------------------
  if (activeTab === "meetups") {
    const isCleanSlate = activeMeetups.length === 0 && upcomingMeetups.length === 0;

    if (isCleanSlate) {
      // Clean, spaced empty state
      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "\n☕ *Your agenda is clear*\nNo active or upcoming meetups scheduled right now.\n\nClick *➕ Schedule New Meetup* above to plan your next timed session with modular checkpoints.\n",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 *Tip:* Check out the *❓ Guide & Tips* tab above or type `/pace` in any channel to get started.",
            },
          ],
        }
      );
    } else {
      // Active Sessions Section
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

          blocks.push(
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${meetup.title}*  •  ${statusBadge}${roleBadge}\nChannel: <#${meetup.channelId}> | Speakers: ${speakers}\nElapsed: *${elapsedMinutes} / ${meetup.totalMinutes} min*\n${renderProgressBar(percent, 16)}`,
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

      // Upcoming Sessions Section
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
  }

  // --------------------------------------------------------------------------
  // TAB 2: ANALYTICS & REPORTS
  // --------------------------------------------------------------------------
  if (activeTab === "analytics") {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 Pacing & Timebox Analytics (Last 30 Days)",
        emoji: true,
      },
    });

    if (stats) {
      const complianceEmoji = stats.complianceRate >= 80 ? "🟢" : stats.complianceRate >= 60 ? "🟡" : "🔴";
      blocks.push(
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `🎯 *Compliance Rate:*\n${complianceEmoji} *${stats.complianceRate}%* (${stats.completedOnTime} / ${stats.totalSessions})`,
            },
            {
              type: "mrkdwn",
              text: `⏱️ *Formal Talk Time:*\n*${formatMinutes(stats.totalFormalMinutes)}*`,
            },
            {
              type: "mrkdwn",
              text: `☕ *Casual Chat Time:*\n*${formatMinutes(stats.totalChattingMinutes)}*`,
            },
            {
              type: "mrkdwn",
              text: `👥 *Sessions Tracked:*\n*${stats.totalSessions} meetups*`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Meeting Timebox Compliance:*\n${renderProgressBar(stats.complianceRate, 18)}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "🎯 *Compliance standard:* A session is compliant when formal talk stays within its allotted total time budget.",
            },
          ],
        },
        { type: "divider" },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "📊 Open Detailed Pacing Report",
                emoji: true,
              },
              style: "primary",
              action_id: "open_report_modal",
            },
          ],
        }
      );
    } else {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_No analytics data available for this workspace yet._",
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // TAB 3: GUIDE & TIPS
  // --------------------------------------------------------------------------
  if (activeTab === "guide") {
    blocks.push(
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "👋 Welcome to HuddlePace",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Keep your talks on schedule and respect everyone's time in 3 easy steps:*\n\n" +
            "1️⃣ *Schedule with Modules:*\nClick *➕ Schedule New Meetup* above to divide your agenda into timed sections (e.g. Context 15%, Demo 60%, Q&A 25%).\n\n" +
            "2️⃣ *Launch in a Slack Huddle:*\nWhen you join your Huddle, click *🚀 Start in Huddle* to attach an interactive, real-time pacing tracker in the channel feed.\n\n" +
            "3️⃣ *Distraction-Free Speaker Alerts:*\nDesignated speakers receive private DM checkpoints as each module finishes, so you never have to interrupt anyone.",
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
          text: "• `/pace` — Open the meetup scheduling modal in any channel\n" +
            "• `/pace status` — View active sessions currently running in this channel\n" +
            "• `/pace report [days]` — Display timebox compliance statistics (default: 30 days)\n" +
            "• `/pace help` — View full command reference and tips",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 *Tip:* HuddlePace automatically matches talks to active Slack Huddles in the channel.",
          },
        ],
      }
    );
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
