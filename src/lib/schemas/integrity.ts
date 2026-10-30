import type { Spec, Task } from "./spec";

// SPEC §6 integrity checks. Each issue carries a path so Zod can report it,
// and a readable message that the repair prompt can quote back to the model.

export type IntegrityIssue = { path: (string | number)[]; message: string };

type IdentifiedItem = { id: string; path: (string | number)[] };

export function findSpecIntegrityIssues(spec: Spec): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const storyIds = new Set(spec.userStories.map((story) => story.id));
  const taskIds = new Set(spec.tasks.map((task) => task.id));

  issues.push(
    ...findDuplicates(
      spec.userStories.map((story, i) => ({ id: story.id, path: ["userStories", i, "id"] })),
      "user story",
    ),
  );
  issues.push(
    ...findDuplicates(
      spec.userStories.flatMap((story, i) =>
        story.acceptanceCriteria.map((criterion, j) => ({
          id: criterion.id,
          path: ["userStories", i, "acceptanceCriteria", j, "id"],
        })),
      ),
      "acceptance criterion",
    ),
  );
  issues.push(
    ...findDuplicates(
      spec.edgeCases.map((edge, i) => ({ id: edge.id, path: ["edgeCases", i, "id"] })),
      "edge case",
    ),
  );
  issues.push(
    ...findDuplicates(
      spec.tasks.map((task, i) => ({ id: task.id, path: ["tasks", i, "id"] })),
      "task",
    ),
  );

  spec.edgeCases.forEach((edge, i) => {
    issues.push(...findUnknownIds(edge.relatedStoryIds, storyIds, ["edgeCases", i, "relatedStoryIds"], "user story"));
  });

  spec.tasks.forEach((task, i) => {
    issues.push(...findUnknownIds(task.relatedStoryIds, storyIds, ["tasks", i, "relatedStoryIds"], "user story"));
    issues.push(...findUnknownIds(task.dependsOn, taskIds, ["tasks", i, "dependsOn"], "task"));
    if (task.dependsOn.includes(task.id)) {
      issues.push({ path: ["tasks", i, "dependsOn"], message: `task "${task.id}" depends on itself` });
    }
  });

  const cycle = findDependencyCycle(spec.tasks);
  if (cycle) {
    issues.push({ path: ["tasks"], message: `dependency cycle: ${cycle.join(" -> ")}` });
  }

  const coveredStoryIds = new Set(spec.tasks.flatMap((task) => task.relatedStoryIds));
  spec.userStories.forEach((story, i) => {
    if (!coveredStoryIds.has(story.id)) {
      issues.push({
        path: ["userStories", i],
        message: `user story "${story.id}" is not covered by any task`,
      });
    }
  });

  return issues;
}

function findDuplicates(items: IdentifiedItem[], label: string): IntegrityIssue[] {
  const seen = new Set<string>();
  const issues: IntegrityIssue[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      issues.push({ path: item.path, message: `duplicate ${label} ID "${item.id}"` });
    }
    seen.add(item.id);
  }
  return issues;
}

function findUnknownIds(
  ids: string[],
  known: Set<string>,
  path: (string | number)[],
  label: string,
): IntegrityIssue[] {
  return ids
    .filter((id) => !known.has(id))
    .map((id) => ({ path, message: `unknown ${label} "${id}" referenced` }));
}

// Depth-first search over task dependencies. Returns the first cycle found,
// as a list of IDs that starts and ends with the same task, or null.
// Unknown IDs and self-dependencies are skipped here; they are reported elsewhere.
function findDependencyCycle(tasks: Task[]): string[] | null {
  const known = new Set(tasks.map((task) => task.id));
  const graph = new Map<string, string[]>();
  for (const task of tasks) {
    graph.set(
      task.id,
      task.dependsOn.filter((dep) => known.has(dep) && dep !== task.id),
    );
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    state.set(id, "visiting");
    stack.push(id);
    for (const dep of graph.get(id) ?? []) {
      if (state.get(dep) === "visiting") {
        return [...stack.slice(stack.indexOf(dep)), dep];
      }
      if (!state.has(dep)) {
        const cycle = visit(dep);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };

  for (const id of graph.keys()) {
    if (!state.has(id)) {
      const cycle = visit(id);
      if (cycle) return cycle;
    }
  }
  return null;
}
