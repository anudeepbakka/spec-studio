import type { Spec } from "@/lib/schemas/spec";

// A generic, valid spec used by tests. No real company data.
export const sampleSpec: Spec = {
  title: "Password reset by email",
  summary: "Registered users can reset a forgotten password from a link sent to their email address.",
  goals: [
    "Let users regain access without contacting support",
    "Keep reset links short-lived and single-use",
  ],
  userStories: [
    {
      id: "US-1",
      role: "registered user",
      want: "to reset a forgotten password from a link sent to my email",
      benefit: "I can regain access without contacting support",
      priority: "must",
      acceptanceCriteria: [
        {
          id: "AC-1.1",
          given: "I am on the sign-in page",
          when: "I request a reset for my registered email",
          then: "I receive an email with a reset link within 2 minutes",
        },
        {
          id: "AC-1.2",
          given: "I open a valid reset link",
          when: "I enter and confirm a new password",
          then: "my password is updated and I can sign in with it",
        },
      ],
    },
    {
      id: "US-2",
      role: "registered user",
      want: "the reset link to expire after a set time",
      benefit: "old links cannot be used",
      priority: "must",
      acceptanceCriteria: [
        {
          id: "AC-2.1",
          given: "a reset link is older than 30 minutes",
          when: "I open it",
          then: "I see an expired-link message and a button to request a new link",
        },
        {
          id: "AC-2.2",
          given: "I have already used a reset link",
          when: "I open the same link again",
          then: "I see a message that the link has already been used",
        },
      ],
    },
    {
      id: "US-3",
      role: "support agent",
      want: "to see when a password reset was requested for an account",
      benefit: "I can answer customer questions quickly",
      priority: "should",
      acceptanceCriteria: [
        {
          id: "AC-3.1",
          given: "a reset was requested for an account",
          when: "I open that account in the support view",
          then: "the request time is listed",
        },
        {
          id: "AC-3.2",
          given: "no reset was requested for an account",
          when: "I open that account in the support view",
          then: "the reset history is shown as empty",
        },
      ],
    },
  ],
  edgeCases: [
    {
      id: "EC-1",
      scenario: "A reset is requested for an email that is not registered",
      expectedBehavior: "The same confirmation message is shown and no email is sent",
      relatedStoryIds: ["US-1"],
    },
    {
      id: "EC-2",
      scenario: "A reset link is clicked after it has expired",
      expectedBehavior: "The user sees an expired-link message with a button to request a new link",
      relatedStoryIds: ["US-2"],
    },
    {
      id: "EC-3",
      scenario: "A reset link is used twice",
      expectedBehavior: "The second use is rejected",
      relatedStoryIds: ["US-2"],
    },
  ],
  openQuestions: [
    "Is 30 minutes the right link lifetime? (Assumed for now)",
    "Is there a limit on reset requests per hour per account?",
  ],
  tasks: [
    {
      id: "T-1",
      title: "Create reset token storage",
      description: "Store hashed, single-use tokens with an expiry time.",
      dependsOn: [],
      relatedStoryIds: ["US-1", "US-2"],
      estimate: "S",
    },
    {
      id: "T-2",
      title: "Request reset endpoint",
      description: "Accept an email, create a token when the account exists, and always return the same response.",
      dependsOn: ["T-1"],
      relatedStoryIds: ["US-1"],
      estimate: "M",
    },
    {
      id: "T-3",
      title: "Send reset email",
      description: "Email the reset link to the account address.",
      dependsOn: ["T-2"],
      relatedStoryIds: ["US-1"],
      estimate: "S",
    },
    {
      id: "T-4",
      title: "Reset form and password update",
      description: "Validate the token, show the expiry message, and save the new password.",
      dependsOn: ["T-1", "T-2"],
      relatedStoryIds: ["US-1", "US-2"],
      estimate: "M",
    },
    {
      id: "T-5",
      title: "Reset history in support view",
      description: "List reset requests per account for support agents.",
      dependsOn: ["T-1"],
      relatedStoryIds: ["US-3"],
      estimate: "M",
    },
  ],
};
