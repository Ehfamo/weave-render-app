export type ResearchSource = {
  id: number;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
};

export type ResearchSubmission = {
  jobId: string;
  conversationId: string;
  created: boolean;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  sources: readonly ResearchSource[];
};

export type ResearchSourcesByJob = Record<string, readonly ResearchSource[]>;
