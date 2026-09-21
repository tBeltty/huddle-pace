import { prisma } from "../db/client.js";

export interface SubtopicInput {
  title: string;
  percentage: number;
}

export interface CreateMeetupDTO {
  title: string;
  totalMinutes: number;
  channelId: string;
  speakerUserId: string;
  scheduledFor?: Date;
  modules: SubtopicInput[];
}

export class MeetupService {
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
   * Creates a new scheduled or ready meetup with its modules.
   */
  static async createMeetup(data: CreateMeetupDTO) {
    const computedModules = this.calculateModuleAllocations(data.totalMinutes, data.modules);

    return await prisma.meetup.create({
      data: {
        title: data.title.trim(),
        totalMinutes: data.totalMinutes,
        channelId: data.channelId,
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
   * Concludes an active meetup.
   */
  static async concludeMeetup(id: string) {
    return await prisma.meetup.update({
      where: { id },
      data: {
        status: "COMPLETED",
        endsAt: new Date(),
      },
      include: { modules: true },
    });
  }

  /**
   * Returns all active meetups currently being tracked.
   */
  static async getActiveMeetups() {
    return await prisma.meetup.findMany({
      where: { status: "ACTIVE" },
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  /**
   * Returns scheduled meetups that have not yet started.
   */
  static async getUpcomingMeetups() {
    return await prisma.meetup.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        modules: { orderBy: { orderIndex: "asc" } },
      },
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
   * Determines the current active module based on elapsed minutes.
   */
  static getCurrentModule(meetup: {
    startedAt: Date | null;
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

    const elapsedMinutes = (Date.now() - new Date(meetup.startedAt).getTime()) / (60 * 1000);

    // Find the module where elapsed is within [startOffsetMin, endOffsetMin)
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

    // If elapsed time exceeded all modules, return last module or overflow state
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
