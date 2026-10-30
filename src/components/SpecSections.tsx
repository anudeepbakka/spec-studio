import type { Spec } from "@/lib/schemas/spec";

// SPEC §11 Result: collapsible sections. Plain <details> markup, so it works without JavaScript.
export function SpecSections({ spec }: { spec: Spec }) {
  return (
    <div className="space-y-4">
      <details open className="rounded-md border border-neutral-200 p-4">
        <summary className="cursor-pointer font-semibold">Goals</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {spec.goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </details>

      <details open className="rounded-md border border-neutral-200 p-4">
        <summary className="cursor-pointer font-semibold">User stories ({spec.userStories.length})</summary>
        <div className="mt-3 space-y-5">
          {spec.userStories.map((story) => (
            <article key={story.id} className="space-y-2 text-sm">
              <h3 className="font-semibold">
                {story.id} ({story.priority}): As a {story.role}, I want {story.want}, so that {story.benefit}
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                {story.acceptanceCriteria.map((criterion) => (
                  <li key={criterion.id}>
                    <span className="font-medium">{criterion.id}:</span> Given {criterion.given}, when {criterion.when},
                    then {criterion.then}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </details>

      <details open className="rounded-md border border-neutral-200 p-4">
        <summary className="cursor-pointer font-semibold">Edge cases ({spec.edgeCases.length})</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="py-2 pr-3 font-semibold">ID</th>
                <th className="py-2 pr-3 font-semibold">Scenario</th>
                <th className="py-2 pr-3 font-semibold">Expected behavior</th>
                <th className="py-2 font-semibold">Related</th>
              </tr>
            </thead>
            <tbody>
              {spec.edgeCases.map((edgeCase) => (
                <tr key={edgeCase.id} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3">{edgeCase.id}</td>
                  <td className="py-2 pr-3">{edgeCase.scenario}</td>
                  <td className="py-2 pr-3">{edgeCase.expectedBehavior}</td>
                  <td className="py-2">{edgeCase.relatedStoryIds.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details open className="rounded-md border border-neutral-200 p-4">
        <summary className="cursor-pointer font-semibold">Open questions ({spec.openQuestions.length})</summary>
        {spec.openQuestions.length === 0 ? (
          <p className="mt-3 text-sm">None.</p>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {spec.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        )}
      </details>

      <details open className="rounded-md border border-neutral-200 p-4">
        <summary className="cursor-pointer font-semibold">Task breakdown ({spec.tasks.length})</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="py-2 pr-3 font-semibold">ID</th>
                <th className="py-2 pr-3 font-semibold">Task</th>
                <th className="py-2 pr-3 font-semibold">Size</th>
                <th className="py-2 pr-3 font-semibold">Depends on</th>
                <th className="py-2 font-semibold">Stories</th>
              </tr>
            </thead>
            <tbody>
              {spec.tasks.map((task) => (
                <tr key={task.id} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3">{task.id}</td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{task.title}</span>
                    <br />
                    <span className="text-neutral-600">{task.description}</span>
                  </td>
                  <td className="py-2 pr-3">{task.estimate}</td>
                  <td className="py-2 pr-3">{task.dependsOn.join(", ") || "None"}</td>
                  <td className="py-2">{task.relatedStoryIds.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
