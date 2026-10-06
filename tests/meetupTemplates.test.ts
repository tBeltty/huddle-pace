import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { MeetupService } from "../src/services/meetupService.js";
import { buildScheduleModal, getModalAction, findModalBlockId } from "../src/slack/ui/scheduleModal.js";
import { prisma } from "../src/db/client.js";

const TEAM = `tpl-team-${Date.now()}`;
const OWNER = "UOWNER";

const baseTemplate = {
  teamId: TEAM,
  ownerUserId: OWNER,
  name: "Weekly Sync",
  channelId: "C123",
  speakerUserId: "U1,U2",
  totalMinutes: 30,
  threadTs: "1700000000.000100",
  reminderTextEnabled: true,
  reminderImageEnabled: false,
  modules: [
    { title: "Intro", percentage: 20 },
    { title: "Demo", percentage: 80 },
  ],
};

describe("Meetup templates (service)", () => {
  after(async () => {
    await prisma.meetupTemplate.deleteMany({ where: { teamId: TEAM } });
  });

  test("saves a template and never persists a specific Huddle thread", async () => {
    const saved = await MeetupService.saveTemplate(baseTemplate);
    assert.equal(saved.destination, "auto");
    assert.deepEqual(saved.modules, baseTemplate.modules);
    assert.equal(saved.speakerUserId, "U1,U2");
  });

  test("keeps the main-feed destination", async () => {
    const saved = await MeetupService.saveTemplate({ ...baseTemplate, name: "Main feed", threadTs: "main" });
    assert.equal(saved.destination, "main");
  });

  test("saving the same name updates instead of duplicating", async () => {
    await MeetupService.saveTemplate({ ...baseTemplate, totalMinutes: 45 });
    const list = await MeetupService.listTemplates(TEAM, OWNER);
    assert.equal(list.filter((t) => t.name === "Weekly Sync").length, 1);
    assert.equal(list.find((t) => t.name === "Weekly Sync")?.totalMinutes, 45);
  });

  test("templates are private to their owner and workspace", async () => {
    assert.deepEqual(await MeetupService.listTemplates(TEAM, "UOTHER"), []);
    assert.deepEqual(await MeetupService.listTemplates("other-team", OWNER), []);
    const [mine] = await MeetupService.listTemplates(TEAM, OWNER);
    assert.equal(await MeetupService.getTemplate(mine.id, TEAM, "UOTHER"), null);
    assert.equal(await MeetupService.deleteTemplate(mine.id, TEAM, "UOTHER"), false);
  });

  test("owner can delete a template", async () => {
    const [mine] = await MeetupService.listTemplates(TEAM, OWNER);
    assert.equal(await MeetupService.deleteTemplate(mine.id, TEAM, OWNER), true);
    assert.equal(await MeetupService.getTemplate(mine.id, TEAM, OWNER), null);
  });
});

describe("Schedule modal template UI", () => {
  const blocksOf = (view: any) => view.blocks as any[];

  test("hides the picker when the user has no templates", () => {
    const view = buildScheduleModal({ subtopicCount: 3 });
    assert.equal(blocksOf(view).some((b) => b.block_id === "template_picker_block"), false);
  });

  test("shows the picker, and a delete button only once one is selected", () => {
    const templates = [{ id: "t1", name: "Weekly Sync" }];
    const idle = blocksOf(buildScheduleModal({ subtopicCount: 3, templates })).find(
      (b) => b.block_id === "template_picker_block"
    );
    assert.equal(idle.elements.length, 1);

    const selected = blocksOf(buildScheduleModal({ subtopicCount: 3, templates, selectedTemplateId: "t1" })).find(
      (b) => b.block_id === "template_picker_block"
    );
    assert.equal(selected.elements[0].initial_option.value, "t1");
    assert.equal(selected.elements[1].action_id, "delete_template_action");
  });

  test("always offers the save-as-template checkbox", () => {
    const block = blocksOf(buildScheduleModal({ subtopicCount: 3 })).find((b) => b.block_id === "save_template_block");
    assert.equal(block.optional, true);
    assert.equal(block.element.action_id, "save_template_checkbox");
  });

  test("a new revision changes input block_ids so Slack applies the prefill", () => {
    const ids = (rev?: string) =>
      blocksOf(buildScheduleModal({ subtopicCount: 2, rev }))
        .filter((b) => b.type === "input" && b.block_id !== "save_template_block")
        .map((b) => b.block_id as string);
    const before = ids();
    const after = ids("abc");
    assert.equal(before.length, after.length);
    before.forEach((id, i) => assert.notEqual(id, after[i]));
  });

  test("values are found by action_id whatever the revision suffix", () => {
    const values = { title_block_abc: { title_input: { value: "Hi" } } };
    assert.equal(getModalAction(values, "title_input").value, "Hi");
    assert.equal(findModalBlockId(values, "title_input"), "title_block_abc");
    assert.equal(getModalAction(values, "missing"), undefined);
  });

  test("prefills agenda rows from a template", () => {
    const view = buildScheduleModal({
      subtopicCount: 2,
      customSubtopics: [
        { title: "Intro", pct: "20" },
        { title: "Demo", pct: "80" },
      ],
    });
    const demo = blocksOf(view).find((b) => b.element?.action_id === "subtopic_title_input_1");
    assert.equal(demo.element.initial_value, "Demo");
  });
});
