import { prisma } from "../db/client.js";
import { normalizeTimezoneSetting } from "../utils/timezone.js";

export interface SubtopicInput {
  title: string;
  percentage: number;
}

export interface CreateMeetupDTO {
  title: string;
  totalMinutes: number;
  channelId: string;
  speakerUserId: string; // Can be a single ID or comma-separated IDs
  createdByUserId?: string | null;
  isPrivate?: boolean;
  teamId?: string;
  threadTs?: string | null;
  scheduledFor?: Date;
  /** Saves the meetup outside automatic capture; started with /pace start <code>. */
  manualStart?: boolean;
  reminderTextEnabled?: boolean;
  reminderImageEnabled?: boolean;
  modules: SubtopicInput[];
}

export interface SaveTemplateDTO {
  teamId: string;
  ownerUserId: string;
  name: string;
  channelId: string;
  speakerUserId: string;
  totalMinutes: number;
  threadTs?: string | null;
  reminderTextEnabled: boolean;
  reminderImageEnabled: boolean;
  isShared?: boolean;
  modules: SubtopicInput[];
}

export interface MeetupTemplateData {
  id: string;
  ownerUserId: string;
  isShared: boolean;
  name: string;
  channelId: string;
  speakerUserId: string;
  totalMinutes: number;
  destination: "auto" | "main";
  reminderTextEnabled: boolean;
  reminderImageEnabled: boolean;
  modules: SubtopicInput[];
}

export interface ReportViewer {
  userId: string;
  isManager: boolean;
}

export interface PacingReportStats {
  /** "workspace": all non-private meetups. "personal": only meetups the viewer spoke in or created. */
  scope: "workspace" | "personal";
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
    isWithinGrace?: boolean;
    graceMinutes?: number;
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
   * Calculates smart grace buffer in minutes based on total scheduled meeting minutes and flexibility mode.
   * Standard: ~16.7% (10m buffer for 60m call, min 3m).
   * Relaxed: 25% (15m buffer for 60m call, min 5m).
   * Strict: 0m (zero grace buffer).
   */
  static calculateGraceMinutes(totalMinutes: number, flexibilityMode = "STANDARD"): number {
    switch (flexibilityMode.toUpperCase()) {
      case "STRICT":
        return 0;
      case "RELAXED":
        return Math.max(5, Math.round(totalMinutes * 0.25));
      case "STANDARD":
      default:
        return Math.max(3, Math.round(totalMinutes * 0.1667));
    }
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
   * Retrieves workspace settings for a given team, falling back to defaults
   * (reminder text enabled: true, reminder image enabled: false, flexibilityMode: "STANDARD", managerUserIds: []).
   */
  static async getWorkspaceSettings(teamId = "default"): Promise<{
    reminderTextEnabled: boolean;
    reminderImageEnabled: boolean;
    flexibilityMode: "STRICT" | "STANDARD" | "RELAXED";
    managerUserIds: string[];
    timezone: string;
  }> {
    try {
      const settings = await prisma.workspaceSettings.findUnique({
        where: { teamId },
      });
      if (settings) {
        const managers = settings.managerUserIds
          ? settings.managerUserIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : [];

        return {
          reminderTextEnabled: settings.reminderTextEnabled,
          reminderImageEnabled: settings.reminderImageEnabled,
          flexibilityMode: (settings.flexibilityMode as any) || "STANDARD",
          managerUserIds: managers,
          timezone: normalizeTimezoneSetting(settings.timezone),
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch workspace settings for team ${teamId}:`, err);
    }
    return {
      reminderTextEnabled: true,
      reminderImageEnabled: false,
      flexibilityMode: "STANDARD",
      managerUserIds: [],
      timezone: "PT",
    };
  }

  /**
   * Updates or creates workspace settings for a given team.
   */
  static async updateWorkspaceSettings(
    teamId = "default",
    settings: {
      reminderTextEnabled?: boolean;
      reminderImageEnabled?: boolean;
      flexibilityMode?: "STRICT" | "STANDARD" | "RELAXED";
      managerUserIds?: string[] | string | null;
      timezone?: string;
    }
  ) {
    let normalizedManagers: string | null | undefined = undefined;
    if (settings.managerUserIds !== undefined) {
      if (Array.isArray(settings.managerUserIds)) {
        normalizedManagers = settings.managerUserIds.map((u) => u.trim()).filter(Boolean).join(",");
      } else if (typeof settings.managerUserIds === "string") {
        normalizedManagers = settings.managerUserIds.trim() || null;
      } else {
        normalizedManagers = null;
      }
    }

    return await prisma.workspaceSettings.upsert({
      where: { teamId },
      update: {
        ...(settings.reminderTextEnabled !== undefined ? { reminderTextEnabled: settings.reminderTextEnabled } : {}),
        ...(settings.reminderImageEnabled !== undefined ? { reminderImageEnabled: settings.reminderImageEnabled } : {}),
        ...(settings.flexibilityMode !== undefined ? { flexibilityMode: settings.flexibilityMode } : {}),
        ...(settings.timezone !== undefined ? { timezone: normalizeTimezoneSetting(settings.timezone) } : {}),
        ...(normalizedManagers !== undefined ? { managerUserIds: normalizedManagers || null } : {}),
      },
      create: {
        teamId,
        reminderTextEnabled: settings.reminderTextEnabled ?? true,
        reminderImageEnabled: settings.reminderImageEnabled ?? false,
        flexibilityMode: settings.flexibilityMode || "STANDARD",
        timezone: normalizeTimezoneSetting(settings.timezone),
        managerUserIds: normalizedManagers || null,
      },
    });
  }

  /**
   * Who may start, edit or reschedule a pace: its speakers, the person who created it, and
   * workspace managers (delegated Bot Managers, the installer, Slack Admins and Owners).
   */
  static async canUserManageMeetup(
    client: unknown,
    meetup: { speakerUserId: string; createdByUserId: string | null; teamId: string },
    userId: string
  ): Promise<boolean> {
    if (this.parseSpeakerIds(meetup.speakerUserId).includes(userId)) return true;
    if (meetup.createdByUserId === userId) return true;
    return await this.isUserWorkspaceManager(client, userId, meetup.teamId);
  }

  /**
   * Verifies if a user has permission to manage workspace settings.
   * Access is granted if:
   * 1. The user is in the delegated managerUserIds list.
   * 2. The user is the installer of the Slack app for this workspace.
   * 3. The user is a Slack Workspace Admin or Owner (is_admin, is_owner, or is_primary_owner).
   */
  static async isUserWorkspaceManager(
    client: any,
    userId: string,
    teamId = "default"
  ): Promise<boolean> {
    if (!userId) return false;

    try {
      // 1. Delegated Bot Managers configured in WorkspaceSettings
      const wsSettings = await prisma.workspaceSettings.findUnique({
        where: { teamId },
      });
      if (wsSettings?.managerUserIds) {
        const managers = wsSettings.managerUserIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        if (managers.includes(userId)) {
          return true;
        }
      }

      // 2. Original Slack App Installer for this workspace
      const installation = await prisma.slackInstallation.findUnique({
        where: { teamId },
      });
      if (installation?.installedByUserId && installation.installedByUserId === userId) {
        return true;
      }

      // 3. Slack Workspace Admins & Owners via Slack Web API
      if (client?.users?.info && typeof client.users.info === "function") {
        try {
          const res = await client.users.info({ user: userId });
          if (res?.ok && res?.user) {
            const u = res.user;
            if (u.is_admin || u.is_owner || u.is_primary_owner) {
              return true;
            }
          }
        } catch (userErr: any) {
          console.warn(`Could not verify Slack admin status for ${userId}:`, userErr?.message || userErr);
        }
      }
    } catch (err) {
      console.warn(`Error checking workspace manager permission for ${userId} in team ${teamId}:`, err);
    }

    return false;
  }

  /**
   * Resolves what a user may see in analytics: managers and admins get the workspace view,
   * everyone else only their own meetups.
   */
  static async getReportViewer(client: any, userId: string, teamId = "default"): Promise<ReportViewer> {
    return { userId, isManager: await this.isUserWorkspaceManager(client, userId, teamId) };
  }

  /**
   * Creates a new scheduled meetup with its modules.
   */
  static async createMeetup(data: CreateMeetupDTO) {
    const computedModules = this.calculateModuleAllocations(data.totalMinutes, data.modules);

    let textEnabled = data.reminderTextEnabled;
    let imageEnabled = data.reminderImageEnabled;

    if (textEnabled === undefined || imageEnabled === undefined) {
      const wsSettings = await this.getWorkspaceSettings(data.teamId || "default");
      if (textEnabled === undefined) textEnabled = wsSettings.reminderTextEnabled;
      if (imageEnabled === undefined) imageEnabled = wsSettings.reminderImageEnabled;
    }

    return await prisma.meetup.create({
      data: {
        title: data.title.trim(),
        totalMinutes: data.totalMinutes,
        channelId: data.channelId,
        teamId: data.teamId || "default",
        threadTs: data.threadTs || null,
        speakerUserId: data.speakerUserId,
        createdByUserId: data.createdByUserId || null,
        isPrivate: data.isPrivate ?? false,
        scheduledFor: data.scheduledFor || new Date(),
        status: data.manualStart ? "MANUAL_START" : "SCHEDULED",
        manualStartCode: data.manualStart ? await this.nextManualStartCode(data.channelId, data.teamId) : null,
        reminderTextEnabled: textEnabled,
        reminderImageEnabled: imageEnabled,
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
   * Maps a stored thread destination to a reusable one. Specific Huddle threads
   * expire with the call, so only "main" survives; everything else re-detects.
   */
  static templateDestination(threadTs?: string | null): "auto" | "main" {
    return threadTs === "main" ? "main" : "auto";
  }

  private static toTemplateData(row: {
    id: string;
    ownerUserId: string;
    isShared: boolean;
    name: string;
    channelId: string;
    speakerUserId: string;
    totalMinutes: number;
    destination: string;
    reminderTextEnabled: boolean;
    reminderImageEnabled: boolean;
    modulesJson: string;
  }): MeetupTemplateData {
    let modules: SubtopicInput[] = [];
    try {
      const parsed = JSON.parse(row.modulesJson);
      if (Array.isArray(parsed)) {
        modules = parsed.map((m: any) => ({
          title: String(m?.title ?? ""),
          percentage: Number(m?.percentage) || 0,
        }));
      }
    } catch {
      // Corrupt payload: fall through with an empty agenda so the modal still opens.
    }
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      isShared: row.isShared,
      name: row.name,
      channelId: row.channelId,
      speakerUserId: row.speakerUserId,
      totalMinutes: row.totalMinutes,
      destination: row.destination === "main" ? "main" : "auto",
      reminderTextEnabled: row.reminderTextEnabled,
      reminderImageEnabled: row.reminderImageEnabled,
      modules,
    };
  }

  /**
   * Saves a template for a user, overwriting their existing template of the same name.
   */
  static async saveTemplate(data: SaveTemplateDTO): Promise<MeetupTemplateData> {
    const name = data.name.trim();
    const fields = {
      channelId: data.channelId,
      speakerUserId: data.speakerUserId,
      totalMinutes: data.totalMinutes,
      destination: this.templateDestination(data.threadTs),
      reminderTextEnabled: data.reminderTextEnabled,
      reminderImageEnabled: data.reminderImageEnabled,
      modulesJson: JSON.stringify(data.modules.map((m) => ({ title: m.title.trim(), percentage: m.percentage }))),
    };
    // Overwriting a template by name must not change who can see it unless the caller says so.
    const sharing = data.isShared === undefined ? {} : { isShared: data.isShared };
    const row = await prisma.meetupTemplate.upsert({
      where: {
        teamId_ownerUserId_name: { teamId: data.teamId, ownerUserId: data.ownerUserId, name },
      },
      create: { teamId: data.teamId, ownerUserId: data.ownerUserId, name, ...fields, isShared: data.isShared ?? false },
      update: { ...fields, ...sharing },
    });
    return this.toTemplateData(row);
  }

  /**
   * Edits one of the owner's templates in place. Sharing is untouched.
   */
  static async updateTemplate(
    id: string,
    teamId: string,
    ownerUserId: string,
    data: Omit<SaveTemplateDTO, "teamId" | "ownerUserId" | "isShared">
  ): Promise<{ ok: true; template: MeetupTemplateData } | { ok: false; reason: "not_found" | "name_taken" }> {
    const name = data.name.trim();
    const existing = await prisma.meetupTemplate.findFirst({ where: { id, teamId, ownerUserId } });
    if (!existing) return { ok: false, reason: "not_found" };

    const clash = await prisma.meetupTemplate.findFirst({
      where: { teamId, ownerUserId, name, NOT: { id } },
    });
    if (clash) return { ok: false, reason: "name_taken" };

    const row = await prisma.meetupTemplate.update({
      where: { id },
      data: {
        name,
        channelId: data.channelId,
        speakerUserId: data.speakerUserId,
        totalMinutes: data.totalMinutes,
        destination: this.templateDestination(data.threadTs),
        reminderTextEnabled: data.reminderTextEnabled,
        reminderImageEnabled: data.reminderImageEnabled,
        modulesJson: JSON.stringify(data.modules.map((m) => ({ title: m.title.trim(), percentage: m.percentage }))),
      },
    });
    return { ok: true, template: this.toTemplateData(row) };
  }

  /**
   * Shares or unshares a template. Only its owner can do it.
   */
  static async setTemplateShared(id: string, teamId: string, ownerUserId: string, isShared: boolean): Promise<boolean> {
    const result = await prisma.meetupTemplate.updateMany({ where: { id, teamId, ownerUserId }, data: { isShared } });
    return result.count > 0;
  }

  /**
   * Moderation: pulls any shared template of the workspace back to its owner's private list.
   * Callers must verify the viewer is a workspace manager.
   */
  static async unpublishTemplate(id: string, teamId: string): Promise<boolean> {
    const result = await prisma.meetupTemplate.updateMany({
      where: { id, teamId, isShared: true },
      data: { isShared: false },
    });
    return result.count > 0;
  }

  /**
   * Copies any template the user can see into their own private list under a free name.
   */
  static async duplicateTemplate(id: string, teamId: string, userId: string): Promise<MeetupTemplateData | null> {
    const source = await prisma.meetupTemplate.findFirst({
      where: { id, teamId, OR: [{ ownerUserId: userId }, { isShared: true }] },
    });
    if (!source) return null;

    const taken = new Set(
      (await prisma.meetupTemplate.findMany({ where: { teamId, ownerUserId: userId }, select: { name: true } })).map(
        (t) => t.name
      )
    );
    const base = source.name.slice(0, 60);
    let name = `${base} (copy)`;
    for (let n = 2; taken.has(name); n++) name = `${base} (copy ${n})`;

    const row = await prisma.meetupTemplate.create({
      data: {
        teamId,
        ownerUserId: userId,
        name,
        channelId: source.channelId,
        speakerUserId: source.speakerUserId,
        totalMinutes: source.totalMinutes,
        destination: source.destination,
        reminderTextEnabled: source.reminderTextEnabled,
        reminderImageEnabled: source.reminderImageEnabled,
        modulesJson: source.modulesJson,
        isShared: false,
      },
    });
    return this.toTemplateData(row);
  }

  /**
   * Lists the templates a user can start from: their own plus those teammates shared
   * with the workspace. Most recently updated first.
   */
  static async listTemplates(teamId: string, viewerUserId: string): Promise<MeetupTemplateData[]> {
    const rows = await prisma.meetupTemplate.findMany({
      where: { teamId, OR: [{ ownerUserId: viewerUserId }, { isShared: true }] },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r) => this.toTemplateData(r));
  }

  /**
   * Template picker entries for the schedule modal, flagged by whether the viewer owns them.
   */
  static async listTemplateOptions(teamId: string, viewerUserId: string) {
    const templates = await this.listTemplates(teamId, viewerUserId);
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      isOwn: t.ownerUserId === viewerUserId,
      isShared: t.isShared,
    }));
  }

  static async getTemplate(id: string, teamId: string, viewerUserId: string): Promise<MeetupTemplateData | null> {
    const row = await prisma.meetupTemplate.findFirst({
      where: { id, teamId, OR: [{ ownerUserId: viewerUserId }, { isShared: true }] },
    });
    return row ? this.toTemplateData(row) : null;
  }

  static async deleteTemplate(id: string, teamId: string, ownerUserId: string): Promise<boolean> {
    const result = await prisma.meetupTemplate.deleteMany({ where: { id, teamId, ownerUserId } });
    return result.count > 0;
  }

  /**
   * Edits a meetup that has not started yet (SCHEDULED, MANUAL_START or MISSED). Replaces its
   * modules. A MISSED meetup saved with a new time goes back to SCHEDULED so detection watches
   * for it again. Returns null when the meetup is missing or already started.
   */
  static async updateScheduledMeetup(id: string, data: Omit<CreateMeetupDTO, "teamId">) {
    const computedModules = this.calculateModuleAllocations(data.totalMinutes, data.modules);

    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.meetup.updateMany({
        where: { id, status: { in: ["SCHEDULED", "MANUAL_START", "MISSED"] } },
        data: {
          title: data.title.trim(),
          ...(data.scheduledFor ? { scheduledFor: data.scheduledFor } : {}),
          totalMinutes: data.totalMinutes,
          channelId: data.channelId,
          threadTs: data.threadTs || null,
          speakerUserId: data.speakerUserId,
          ...(data.isPrivate !== undefined ? { isPrivate: data.isPrivate } : {}),
          reminderTextEnabled: data.reminderTextEnabled ?? true,
          reminderImageEnabled: data.reminderImageEnabled ?? false,
        },
      });
      if (claimed.count === 0) return null;

      if (data.scheduledFor) {
        await tx.meetup.updateMany({ where: { id, status: "MISSED" }, data: { status: "SCHEDULED" } });
      }

      await tx.meetupModule.deleteMany({ where: { meetupId: id } });
      await tx.meetupModule.createMany({
        data: computedModules.map((m) => ({ ...m, meetupId: id })),
      });
      return await tx.meetup.findUnique({
        where: { id },
        include: { modules: { orderBy: { orderIndex: "asc" } } },
      });
    });
  }

  /**
   * Atomically claims a SCHEDULED or MANUAL_START meetup for launch. Only the caller that
   * flips the status gets `true`, so two speakers entering one Huddle (or the timer worker
   * racing a Huddle event) cannot publish two trackers for the same meetup.
   * Returns the status the meetup had before the claim, or null when it was already taken.
   */
  static async claimMeetupForLaunch(id: string): Promise<"SCHEDULED" | "MANUAL_START" | null> {
    const meetup = await prisma.meetup.findUnique({ where: { id } });
    if (!meetup || (meetup.status !== "SCHEDULED" && meetup.status !== "MANUAL_START")) return null;

    const now = new Date();
    const claimed = await prisma.meetup.updateMany({
      where: { id, status: meetup.status },
      data: {
        status: "ACTIVE",
        startedAt: now,
        endsAt: new Date(now.getTime() + meetup.totalMinutes * 60_000),
        manualStartCode: null,
      },
    });
    return claimed.count === 1 ? meetup.status : null;
  }

  /** Puts a claimed meetup back when its tracker could not be posted. */
  static async releaseLaunchClaim(id: string, previousStatus: "SCHEDULED" | "MANUAL_START", manualStartCode?: string | null) {
    await prisma.meetup.updateMany({
      where: { id, status: "ACTIVE", trackerMessageTs: null },
      data: { status: previousStatus, startedAt: null, endsAt: null, manualStartCode: manualStartCode ?? null },
    });
  }

  /**
   * Finds a SCHEDULED meetup in the channel whose time sits within the capture window of
   * `scheduledFor`. Two paces that close would compete for the same Huddle.
   */
  static async findScheduleConflict(
    channelId: string,
    teamId: string | undefined,
    scheduledFor: Date,
    excludeMeetupId?: string
  ) {
    const radiusMilliseconds = this.CAPTURE_WINDOW_MINUTES * 60_000;
    return await prisma.meetup.findFirst({
      where: {
        channelId,
        status: "SCHEDULED",
        ...(teamId && teamId !== "default" ? { teamId } : {}),
        ...(excludeMeetupId ? { id: { not: excludeMeetupId } } : {}),
        scheduledFor: {
          gte: new Date(scheduledFor.getTime() - radiusMilliseconds),
          lte: new Date(scheduledFor.getTime() + radiusMilliseconds),
        },
      },
      orderBy: { scheduledFor: "asc" },
    });
  }

  /** Next free manual start code (m1, m2...) among the channel's Manual start meetups. */
  static async nextManualStartCode(channelId: string, teamId?: string): Promise<string> {
    const taken = await prisma.meetup.findMany({
      where: {
        channelId,
        status: "MANUAL_START",
        ...(teamId && teamId !== "default" ? { teamId } : {}),
      },
      select: { manualStartCode: true },
    });
    const used = new Set(taken.map((m) => m.manualStartCode));
    let n = 1;
    while (used.has(`m${n}`)) n++;
    return `m${n}`;
  }

  /** Moves a SCHEDULED meetup out of automatic capture and gives it the channel's next manual start code. */
  static async moveToManualStart(id: string) {
    const meetup = await prisma.meetup.findUnique({ where: { id } });
    if (!meetup || meetup.status !== "SCHEDULED") return null;
    const manualStartCode = await this.nextManualStartCode(meetup.channelId, meetup.teamId);
    const moved = await prisma.meetup.updateMany({
      where: { id, status: "SCHEDULED" },
      data: { status: "MANUAL_START", manualStartCode },
    });
    if (moved.count === 0) return null;
    return await prisma.meetup.findUnique({ where: { id }, include: { modules: { orderBy: { orderIndex: "asc" } } } });
  }

  /**
   * Marks SCHEDULED meetups whose capture window closed without a Huddle as MISSED. They leave
   * automatic capture and wait for a new time (rescheduling puts them back to SCHEDULED).
   * Returns the meetups that moved.
   */
  static async markMissedMeetups(now: Date = new Date()) {
    const cutoff = new Date(now.getTime() - this.CAPTURE_WINDOW_MINUTES * 60_000);
    const missed = await prisma.meetup.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lt: cutoff } },
      orderBy: { scheduledFor: "asc" },
    });

    const moved = [];
    for (const meetup of missed) {
      // Conditional on SCHEDULED so a launch claimed a moment ago is not overwritten.
      const result = await prisma.meetup.updateMany({
        where: { id: meetup.id, status: "SCHEDULED" },
        data: { status: "MISSED" },
      });
      if (result.count === 1) moved.push({ ...meetup, status: "MISSED" });
    }
    return moved;
  }

  /** Paces whose Huddle never started, newest first, for the App Home. */
  static async getMissedMeetups(teamId?: string) {
    return await prisma.meetup.findMany({
      where: { status: "MISSED", ...(teamId ? { teamId } : {}) },
      orderBy: { scheduledFor: "desc" },
      take: 10,
      include: { modules: { orderBy: { orderIndex: "asc" } } },
    });
  }

  /** Meetups waiting for `/pace start <code>` in a channel, oldest code first. */
  static async getManualStartMeetups(channelId: string, teamId?: string) {
    const list = await prisma.meetup.findMany({
      where: {
        channelId,
        status: "MANUAL_START",
        ...(teamId && teamId !== "default" ? { teamId } : {}),
      },
      include: { modules: { orderBy: { orderIndex: "asc" } } },
    });
    return list.sort((a, b) => (a.manualStartCode ?? "").localeCompare(b.manualStartCode ?? "", undefined, { numeric: true }));
  }

  static async findManualStartMeetup(channelId: string, code: string, teamId?: string) {
    return await prisma.meetup.findFirst({
      where: {
        channelId,
        status: "MANUAL_START",
        manualStartCode: code.toLowerCase(),
        ...(teamId && teamId !== "default" ? { teamId } : {}),
      },
      include: { modules: { orderBy: { orderIndex: "asc" } } },
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
   * Advances an active meetup immediately to the next module.
   * Concludes the current module at the current elapsed time and transfers all
   * saved minutes directly into the next module, keeping subsequent modules on their original schedule.
   */
  static async skipToNextModule(id: string) {
    const meetup = await prisma.meetup.findUnique({
      where: { id },
      include: { modules: { orderBy: { orderIndex: "asc" } } },
    });
    if (!meetup || !meetup.startedAt) {
      throw new Error(`Active meetup ${id} not found.`);
    }

    const currentModuleInfo = this.getCurrentModule(meetup);
    if (!currentModuleInfo || !currentModuleInfo.nextModule) {
      return null;
    }

    const currentMod = currentModuleInfo.module;
    const nextMod = currentModuleInfo.nextModule;
    const elapsedMinutes = currentModuleInfo.elapsedMinutes;

    const newEndOffset = Math.max(currentMod.startOffsetMin + 1, elapsedMinutes);
    const newCurrentDuration = Math.max(1, newEndOffset - currentMod.startOffsetMin);
    const newNextDuration = Math.max(1, nextMod.endOffsetMin - newEndOffset);

    await prisma.$transaction([
      prisma.meetupModule.update({
        where: { id: currentMod.id },
        data: {
          endOffsetMin: newEndOffset,
          durationMinutes: newCurrentDuration,
          isNotified: true,
        },
      }),
      prisma.meetupModule.update({
        where: { id: nextMod.id },
        data: {
          startOffsetMin: newEndOffset,
          durationMinutes: newNextDuration,
          isNotified: true,
        },
      }),
    ]);

    return await prisma.meetup.findUnique({
      where: { id },
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
   * Appends a sent speaker DM (channel + ts) to the meetup's cleanup list so it can be
   * deleted once the session concludes, instead of accumulating in the speaker's DM history.
   */
  static async recordDmMessage(meetupId: string, channel: string, ts: string) {
    try {
      const meetup = await prisma.meetup.findUnique({ where: { id: meetupId }, select: { dmMessageRefs: true } });
      const refs: { channel: string; ts: string }[] = meetup?.dmMessageRefs ? JSON.parse(meetup.dmMessageRefs) : [];
      refs.push({ channel, ts });
      await prisma.meetup.update({
        where: { id: meetupId },
        data: { dmMessageRefs: JSON.stringify(refs) },
      });
    } catch (err) {
      console.warn(`Failed to record DM reminder for meetup ${meetupId}:`, err);
    }
  }

  /**
   * Deletes every speaker DM reminder recorded for a meetup (1-minute warnings, module
   * transitions, auto-launch notices) so the speaker's DM history doesn't fill up with stale
   * pacing messages once the session is over.
   */
  static async cleanupReminderDMs(meetup: { id: string; dmMessageRefs?: string | null }, client: any, botToken?: string) {
    if (!meetup.dmMessageRefs) return;

    let refs: { channel: string; ts: string }[] = [];
    try {
      refs = JSON.parse(meetup.dmMessageRefs);
    } catch {
      return;
    }

    for (const ref of refs) {
      try {
        await client.chat.delete({
          token: botToken,
          channel: ref.channel,
          ts: ref.ts,
        });
      } catch (err: any) {
        // Ignore messages already deleted or too old to remove
      }
    }

    await prisma.meetup.update({
      where: { id: meetup.id },
      data: { dmMessageRefs: null },
    }).catch(() => {});
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

  /** A Huddle only captures a scheduled meetup starting within this many minutes of now (before or after). */
  static readonly CAPTURE_WINDOW_MINUTES = 20;

  /**
   * Picks the scheduled meetup a Huddle starting at `now` belongs to: the one nearest to
   * now among those inside the capture window (±CAPTURE_WINDOW_MINUTES of scheduledFor).
   * With several meetups on the same day, each Huddle captures only its own.
   * A meetup without scheduledFor has no window and is always eligible.
   */
  static pickClosestToNow<T extends { scheduledFor: Date | null }>(
    meetups: T[],
    now: Date = new Date(),
    windowMinutes: number = this.CAPTURE_WINDOW_MINUTES
  ): T | undefined {
    const windowMilliseconds = windowMinutes * 60_000;
    let best: T | undefined;
    let bestDistanceMilliseconds = Infinity;
    for (const m of meetups) {
      const distance = m.scheduledFor ? Math.abs(m.scheduledFor.getTime() - now.getTime()) : 0;
      if (distance <= windowMilliseconds && distance < bestDistanceMilliseconds) {
        best = m;
        bestDistanceMilliseconds = distance;
      }
    }
    return best;
  }

  /** Paces saved for manual start across a workspace, for the App Home. */
  static async getManualStartMeetupsForTeam(teamId?: string) {
    return await prisma.meetup.findMany({
      where: { status: "MANUAL_START", ...(teamId ? { teamId } : {}) },
      orderBy: [{ channelId: "asc" }, { manualStartCode: "asc" }],
      take: 20,
      include: { modules: { orderBy: { orderIndex: "asc" } } },
    });
  }

  /**
   * Finds the scheduled meetup awaiting launch in a specific channel that is closest to now.
   * Automatic detection only takes meetups inside the capture window; pass `anyTime` when a
   * person asked for it explicitly (/pace start, @mention) and the window should not apply.
   */
  static async findPendingScheduledMeetup(channelId: string, teamId?: string, options: { anyTime?: boolean } = {}) {
    const scheduled = await prisma.meetup.findMany({
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
    return this.pickClosestToNow(scheduled, new Date(), options.anyTime ? Infinity : this.CAPTURE_WINDOW_MINUTES) ?? null;
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
   * Returns the single scheduled meetup a speaker's Huddle should launch, or null when the
   * speaker already has a meetup in flight (their other scheduled ones wait for a later Huddle).
   */
  static async findMeetupToLaunchForSpeaker(speakerUserId: string, teamId?: string) {
    const active = await this.getActiveMeetups(teamId && teamId !== "default" ? teamId : undefined);
    if (active.some((m) => this.parseSpeakerIds(m.speakerUserId).includes(speakerUserId))) {
      return null;
    }
    const pending = await this.findPendingScheduledMeetupsForSpeaker(speakerUserId, teamId);
    return this.pickClosestToNow(pending) ?? null;
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
  static async getPacingReportStats(
    days = 30,
    teamId?: string,
    viewer?: ReportViewer
  ): Promise<PacingReportStats> {
    const scope: PacingReportStats["scope"] = !viewer || viewer.isManager ? "workspace" : "personal";
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await prisma.meetup.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: cutoffDate },
        ...(teamId ? { teamId } : {}),
        ...(scope === "workspace" ? { isPrivate: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { modules: true },
    });

    const completed =
      scope === "personal" && viewer
        ? rows.filter(
            (m) => m.createdByUserId === viewer.userId || this.parseSpeakerIds(m.speakerUserId).includes(viewer.userId)
          )
        : rows;

    let completedOnTime = 0;
    let totalFormalMinutes = 0;
    let totalChattingMinutes = 0;

    const wsSettings = await this.getWorkspaceSettings(teamId || "default");

    const recentSessions = completed.map((m) => {
      const started = m.startedAt ? new Date(m.startedAt).getTime() : new Date(m.createdAt).getTime();
      const formalEnded = m.formalEndsAt ? new Date(m.formalEndsAt).getTime() : (m.endsAt ? new Date(m.endsAt).getTime() : started);
      const ended = m.endsAt ? new Date(m.endsAt).getTime() : formalEnded;

      const formalDurationMin = Math.max(1, Math.round((formalEnded - started) / (60 * 1000)));
      const chattingDurationMin = Math.max(0, Math.round((ended - formalEnded) / (60 * 1000)));
      const graceMinutes = this.calculateGraceMinutes(m.totalMinutes, wsSettings.flexibilityMode);
      const isStrictOnTime = formalDurationMin <= m.totalMinutes;
      const isWithinGrace = graceMinutes > 0 && !isStrictOnTime && formalDurationMin <= (m.totalMinutes + graceMinutes);
      const isOnTime = isStrictOnTime || isWithinGrace;

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
        isWithinGrace,
        graceMinutes,
        date: m.startedAt || m.createdAt,
      };
    });

    const totalSessions = completed.length;
    const complianceRate = totalSessions > 0 ? Math.round((completedOnTime / totalSessions) * 100) : 100;
    const totalMinutesSpent = totalFormalMinutes + totalChattingMinutes;

    return {
      scope,
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
