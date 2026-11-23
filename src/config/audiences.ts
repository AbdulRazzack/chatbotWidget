import type { Audience } from "../types";

export interface AudienceSettings {
  title: string;
  subtitle: string;
  greeting: string;
  quickReplies: string[];
  /** Public visitors must say whether they're a candidate, client or referee before handoff. */
  askVisitorType: boolean;
  /** Logged-in portals may show the user's own open cases. */
  canViewCases: boolean;
  /** Show the paperclip so visitors can attach screenshots. Also needs "File uploads" on in Copilot Studio. */
  allowAttachments: boolean;
}

// UI copy only. Which agent actually answers is decided server-side from the verified token.
export const AUDIENCES: Record<Audience, AudienceSettings> = {
  public: {
    title: "VETTING Support",
    subtitle: "Ask us anything about our screening services",
    greeting:
      "Hi! I can help with questions about VETTING's checks and services. If you need a person, I can pass you to our support team.",
    quickReplies: [
      "What checks do you offer?",
      "I'm a referee, what do I need to do?",
      "How long does a DBS check take?",
      "Talk to a person",
    ],
    askVisitorType: true,
    canViewCases: false,
    allowAttachments: true,
  },
  client: {
    title: "Client Support",
    subtitle: "Help with your account, candidates and checks",
    greeting:
      "Hi! I can help with your account, candidate checks and licences. Ask me a question or raise a ticket with our team.",
    quickReplies: [
      "A candidate can't submit their check",
      "Licence upgrade or renewal",
      "I can't log in",
      "Talk to a person",
    ],
    askVisitorType: false,
    canViewCases: true,
    allowAttachments: true,
  },
  candidate: {
    title: "Candidate Help",
    subtitle: "Help completing your background check",
    greeting:
      "Hi! I can help you complete your checks. Please don't share passwords, passport images or criminal-record details in this chat.",
    quickReplies: [
      "My check link has expired",
      "I can't submit my application",
      "What documents do I need?",
      "Talk to a person",
    ],
    askVisitorType: false,
    canViewCases: true,
    allowAttachments: true,
  },
};

/** Typing any of these opens the handoff form instead of sending to the agent. */
export const HANDOFF_PHRASES = ["talk to a person", "human", "speak to someone", "agent please"];
