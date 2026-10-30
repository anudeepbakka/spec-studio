import type { EdgeCase, Spec, Task, UserStory } from "@/lib/schemas/spec";

// SPEC §7: Markdown export. Output must be deterministic (snapshot-tested).

// Table cells must stay on one line and must not break on pipes.
const cell = (text: string) => text.replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|");

const idList = (ids: string[]) => (ids.length ? ids.join(", ") : "-");

function storyBlock(story: UserStory): string {
  const criteria = story.acceptanceCriteria.map(
    (criterion) =>
      `- ${criterion.id}: **Given** ${criterion.given}, **when** ${criterion.when}, **then** ${criterion.then}`,
  );
  return [
    `### ${story.id} (${story.priority}): As a ${story.role}, I want ${story.want}, so that ${story.benefit}`,
    "",
    "**Acceptance criteria**",
    ...criteria,
  ].join("\n");
}

function edgeCaseRow(edge: EdgeCase): string {
  return `| ${edge.id} | ${cell(edge.scenario)} | ${cell(edge.expectedBehavior)} | ${idList(edge.relatedStoryIds)} |`;
}

function taskRow(task: Task): string {
  return `| ${task.id} | ${cell(task.title)} | ${task.estimate} | ${idList(task.dependsOn)} | ${idList(task.relatedStoryIds)} |`;
}

export function toMarkdown(spec: Spec): string {
  const sections: string[] = [
    [`# ${spec.title}`, `> ${spec.summary}`].join("\n"),
    ["## Goals", ...spec.goals.map((goal) => `- ${goal}`)].join("\n"),
    ["## User stories", ...spec.userStories.map(storyBlock)].join("\n\n"),
    [
      "## Edge cases",
      "| ID | Scenario | Expected behavior | Related |",
      "|---|---|---|---|",
      ...spec.edgeCases.map(edgeCaseRow),
    ].join("\n"),
    [
      "## Open questions",
      ...(spec.openQuestions.length
        ? spec.openQuestions.map((question) => `- ${question}`)
        : ["- None"]),
    ].join("\n"),
    [
      "## Task breakdown",
      "| ID | Task | Size | Depends on | Stories |",
      "|---|---|---|---|---|",
      ...spec.tasks.map(taskRow),
    ].join("\n"),
    "Generated with Spec Studio",
  ];
  return `${sections.join("\n\n")}\n`;
}
