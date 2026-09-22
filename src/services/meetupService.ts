import { prisma } from "../db/client.js";

export interface SubtopicInput {
  title: string;
  percentage: number;
}

export interface CreateMeetupDTO {
  title: string;
  totalMinutes: number;
  channelId: string;
  speakerUserId: string; // Can be a single ID or comma-separated IDs
  teamId?: string;
  threadTs?: string | null;
  scheduledFor?: Date;
  modules: SubtopicInput[];
}

export interface PacingReportStats {
  totalSessions: number;
  completedOnTime: number;
  complianceRate: number;
  totalFormalMinutes: number;
  totalChattingMinutes: number;
  totalMinutesSpent: number;
  recentSessions: Array<{
    id: string;
    title: string;
    speakerMentions: string;
    totalBudgetMin: number;
    formalDurationMin: number;
    chattingDurationMin: number;
    isOnTime: boolean;
    date: Date;
  }>;
}

export class MeetupService {
  /**
   * Parses single or comma-separated speaker IDs into a clean array.
   */
  static parseSpeakerIds(speakerUserId: string): string[] {
    return (speakerUserId || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Formats speaker user IDs into Slack mrkdwn mentions (<@ID1>, <@ID2>).
   */
  static formatSpeakerMentions(speakerUserId: string): string {
    const ids = this.parseSpeakerIds(speakerUserId);
    if (ids.length === 0) return "Not specified";
    return ids.map((id) => `<@${id}>`).join(", ");
  }

  /**
   * Validates module percentages and normalizes minute allocations so they sum exactly to totalMinutes.
   */
  static calculateModuleAllocations(totalMinutes: number, modules: SubtopicInput[]) {
    if (!modules || modules.length === 0) {
      throw new Error("At least one topic module is required.");
    }

    const totalPercentage = modules.reduce((sum, m) => sum + m.percentage, 0);
    if (totalPercentage !== 100) {
      throw new Error(`Total percentage must equal 100%. Currently received: ${totalPercentage}%.`);
    }

    let allocatedMinutesSum = 0;
    const computedModules = modules.map((m, index) => {
      const duration = Math.max(1, Math.round((totalMinutes * m.percentage) / 100));
      allocatedMinutesSum += duration;
      return {
        title: m.title.trim(),
        orderIndex: index,
        percentage: m.percentage,
        durationMinutes: duration,
        startOffsetMin: 0,
        endOffsetMin: 0,
      };
    });

    // Fix rounding discrepancies on the last item so exact sum matches totalMinutes
    const discrepancy = totalMinutes - allocatedMinutesSum;
    if (discrepancy !== 0 && computedModules.length > 0) {
      computedModules[computedModules.length - 1].durationMinutes += discrepancy;
    }

    // Assign cumulative minute offsets
    let currentOffset = 0;
    for (const mod of computedModules) {
      mod.startOffsetMin = currentOffset;
      currentOffset += mod.durationMinutes;
      mod.endOffsetMin = currentOffset;
    }

    return computedModules;
  }

  /**
   * Creates a new scheduled meetup with its modules.
   */
  static async createMeetup(data: CreateMeetupDTO) {
    const computedModules = this.calculateModuleAllocations(data.totalMinutes, data.modules);

    return await prisma.meetup.create({
      data: {
        title: data.title.trim(),
        totalMinutes: data.totalMinutes,
        channelId: data.channelId,
        teamId: data.teamId || "default",
        threadTs: data.threadTs || null,
        speakerUserId: data.speakerUserId,
        scheduledFor: data.scheduledFor || new Date(),
        status: "SCHEDULED",
        modules: {
          create: computedModules,
        },
      },
      include: {
        modules: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  /**
   * Starts an active meetup tracking session.
   */
  static async startMeetup(id: string, trackerMessageTs: string, threadTs?: string) {
    const now = new Date();
    const meetup = await prisma.meetup.findUnique({
      where: { id },
      include: { modules: true },
    });

    if (!meetup) {
      throw new Error(`Meetup with ID ${id} not found.`);
    }

    const endsAt = new Date(now.getTime() + meetup.totalMinutes * 60 * 1000);

    return await prisma.meetup.update({
      where: { id },
      data: {
        status: "ACTIVE",
        startedAt: now,
        endsAt: endsAt,
        trackerMessageTs: trackerMessageTs,
        threadTs: threadTs || trackerMessageTs,
      },
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  /**
   * Switches an active meetup to casual "Just Chatting" mode, freezing formal agenda time.
   */
  static async switchToJustChatting(id: string) {
    const meetup = await prisma.meetup.findUnique({ where: { id } });
    if (!meetup) throw new Error(`Meetup ${id} not found.`);

    return await prisma.meetup.update({
      where: { id },
      data: {
        status: "JUST_CHATTING",
        formalEndsAt: new Date(),
      },
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  /**
   * Extends the duration of an active meetup by additional minutes (Snooze / Time Extension).
   */
  static async extendMeetup(id: string, additionalMinutes: number) {
    const meetup = await prisma.meetup.findUnique({
      where: { id },
      include: { modules: { orderBy: { orderIndex: "desc" } } },
    });
    if (!meetup) throw new Error(`Meetup ${id} not found.`);

    const newTotalMinutes = meetup.totalMinutes + additionalMinutes;
    const now = new Date();
    const started = meetup.startedAt || now;
    const newEndsAt = new Date(started.getTime() + newTotalMinutes * 60 * 1000);

    // Extend the final module
    if (meetup.modules.length > 0) {
      const lastMod = meetup.modules[0]; // sorted desc
      await prisma.meetupModule.update({
        where: { id: lastMod.id },
        data: {
          durationMinutes: lastMod.durationMinutes + additionalMinutes,
          endOffsetMin: lastMod.endOffsetMin + additionalMinutes,
        },
      });
    }

    return await prisma.meetup.update({
      where: { id },
      data: {
        totalMinutes: newTotalMinutes,
        endsAt: newEndsAt,
        status: "ACTIVE",
      },
      include: { modules: { orderBy: { orderIndex: "asc" } } },
    });
  }

  /**
   * Concludes a meetup completely.
   */
  static async concludeMeetup(id: string) {
    const meetup = await prisma.meetup.findUnique({ where: { id } });
    const now = new Date();

    return await prisma.meetup.update({
      where: { id },
      data: {
        status: "COMPLETED",
        formalEndsAt: meetup?.formalEndsAt || now,
        endsAt: now,
      },
      include: { modules: true },
    });
  }

  /**
   * Returns all active meetups currently in flight (ACTIVE or JUST_CHATTING).
   */
  static async getActiveMeetups(teamId?: string) {
    return await prisma.meetup.findMany({
      where: {
        status: { in: ["ACTIVE", "JUST_CHATTING"] },
        ...(teamId ? { teamId } : {}),
      },
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  /**
   * Returns scheduled meetups that have not yet started.
   */
  static async getUpcomingMeetups(teamId?: string) {
    return await prisma.meetup.findMany({
      where: {
        status: "SCHEDULED",
        ...(teamId ? { teamId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  /**
   * Finds the next scheduled meetup awaiting launch in a specific channel.
   */
  static async findPendingScheduledMeetup(channelId: string, teamId?: string) {
    return await prisma.meetup.findFirst({
      where: {
        channelId,
        status: "SCHEDULED",
        ...(teamId && teamId !== "default" ? { teamId } : {}),
      },
      orderBy: { scheduledFor: "asc" },
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  /**
   * Finds pending scheduled meetups where the given user is an assigned speaker.
   */
  static async findPendingScheduledMeetupsForSpeaker(speakerUserId: string, teamId?: string) {
    const scheduled = await prisma.meetup.findMany({
      where: {
        status: "SCHEDULED",
        ...(teamId && teamId !== "default" ? { teamId } : {}),
      },
      orderBy: { scheduledFor: "asc" },
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });

    return scheduled.filter((m) => {
      const ids = this.parseSpeakerIds(m.speakerUserId);
      return ids.includes(speakerUserId);
    });
  }

  /**
   * Retrieves a single meetup by ID.
   */
  static async getMeetupById(id: string) {
    return await prisma.meetup.findUnique({
      where: { id },
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  /**
   * Finds an active or chatting meetup associated with a channel or thread.
   */
  static async findActiveMeetupByChannelOrThread(channelId: string, threadTs?: string, teamId?: string) {
    if (threadTs) {
      const byThread = await prisma.meetup.findFirst({
        where: {
          channelId,
          threadTs,
          status: { in: ["ACTIVE", "JUST_CHATTING"] },
          ...(teamId ? { teamId } : {}),
        },
        include: { modules: { orderBy: { orderIndex: "asc" } } },
      });
      if (byThread) return byThread;
    }

    return await prisma.meetup.findFirst({
      where: {
        channelId,
        status: { in: ["ACTIVE", "JUST_CHATTING"] },
        ...(teamId ? { teamId } : {}),
      },
      orderBy: { startedAt: "desc" },
      include: { modules: { orderBy: { orderIndex: "asc" } } },
    });
  }

  /**
   * Calculates comprehensive time management analytics for a given timeframe.
   */
  static async getPacingReportStats(days = 30, teamId?: string): Promise<PacingReportStats> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const completed = await prisma.meetup.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: cutoffDate },
        ...(teamId ? { teamId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { modules: true },
    });

    let completedOnTime = 0;
    let totalFormalMinutes = 0;
    let totalChattingMinutes = 0;

    const recentSessions = completed.map((m) => {
      const started = m.startedAt ? new Date(m.startedAt).getTime() : new Date(m.createdAt).getTime();
      const formalEnded = m.formalEndsAt ? new Date(m.formalEndsAt).getTime() : (m.endsAt ? new Date(m.endsAt).getTime() : started);
      const ended = m.endsAt ? new Date(m.endsAt).getTime() : formalEnded;

      const formalDurationMin = Math.max(1, Math.round((formalEnded - started) / (60 * 1000)));
      const chattingDurationMin = Math.max(0, Math.round((ended - formalEnded) / (60 * 1000)));
      const isOnTime = formalDurationMin <= m.totalMinutes;

      if (isOnTime) completedOnTime++;
      totalFormalMinutes += formalDurationMin;
      totalChattingMinutes += chattingDurationMin;

      return {
        id: m.id,
        title: m.title,
        speakerMentions: this.formatSpeakerMentions(m.speakerUserId),
        totalBudgetMin: m.totalMinutes,
        formalDurationMin,
        chattingDurationMin,
        isOnTime,
        date: m.startedAt || m.createdAt,
      };
    });

    const totalSessions = completed.length;
    const complianceRate = totalSessions > 0 ? Math.round((completedOnTime / totalSessions) * 100) : 100;
    const totalMinutesSpent = totalFormalMinutes + totalChattingMinutes;

    return {
      totalSessions,
      completedOnTime,
      complianceRate,
      totalFormalMinutes,
      totalChattingMinutes,
      totalMinutesSpent,
      recentSessions: recentSessions.slice(0, 8),
    };
  }

  /**
   * Determines the current active module based on elapsed minutes.
   */
  static getCurrentModule(meetup: {
    startedAt: Date | null;
    formalEndsAt?: Date | null;
    modules: Array<{
      id: string;
      title: string;
      startOffsetMin: number;
      endOffsetMin: number;
      percentage: number;
      durationMinutes: number;
      isNotified: boolean;
    }>;
  }) {
    if (!meetup.startedAt) return null;

    const referenceEndTime = meetup.formalEndsAt ? new Date(meetup.formalEndsAt).getTime() : Date.now();
    const elapsedMinutes = (referenceEndTime - new Date(meetup.startedAt).getTime()) / (60 * 1000);

    const current = meetup.modules.find(
      (m) => elapsedMinutes >= m.startOffsetMin && elapsedMinutes < m.endOffsetMin
    );

    if (current) {
      const nextModule = meetup.modules.find((m) => m.startOffsetMin === current.endOffsetMin);
      const remainingModuleMinutes = Math.max(0, Math.ceil(current.endOffsetMin - elapsedMinutes));
      return {
        module: current,
        nextModule: nextModule || null,
        remainingMinutes: remainingModuleMinutes,
        elapsedMinutes: Math.floor(elapsedMinutes),
      };
    }

    const lastModule = meetup.modules[meetup.modules.length - 1];
    return {
      module: lastModule,
      nextModule: null,
      remainingMinutes: 0,
      elapsedMinutes: Math.floor(elapsedMinutes),
      isOvertime: true,
    };
  }
}
