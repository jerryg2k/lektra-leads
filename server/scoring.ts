/**
 * Lektra Cloud Lead Scoring Engine
 *
 * Scores leads 0–100 based on their likelihood of GPU spend
 * for AI inference, training, remote visualization, or edge compute.
 *
 * Scoring dimensions and max weights:
 *  - GPU Use Cases       : 30 pts  (direct signal of GPU spend)
 *  - Funding Stage       : 20 pts  (budget availability)
 *  - Industry Fit        : 20 pts  (AI/ML/HPC relevance)
 *  - Headcount Signal    : 15 pts  (team size → compute scale)
 *  - Tech Stack / AI     : 15 pts  (AI product signals)
 */

export type ScoreBreakdown = {
  gpuUseCases: number;
  fundingStage: number;
  industryFit: number;
  headcountSignal: number;
  techStackSignal: number;
};

export type ScoringInput = {
  gpuUseCases?: string[] | null;
  fundingStage?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
  headcount?: string | null;
  techStack?: string | null;
  aiProducts?: string | null;
  description?: string | null;
};

// ─── GPU Use Case Scoring (max 30) ────────────────────────────────────────────

const GPU_USE_CASE_SCORES: Record<string, number> = {
  inference: 30,
  training: 30,
  fine_tuning: 28,
  edge_compute: 25,
  remote_viz: 22,
  hpc: 20,
  rendering: 18,
  simulation: 15,
};

function scoreGpuUseCases(useCases: string[] | null | undefined): number {
  if (!useCases || useCases.length === 0) return 0;
  const max = Math.max(...useCases.map((u) => GPU_USE_CASE_SCORES[u] ?? 5));
  // Bonus for multiple use cases
  const bonus = Math.min(useCases.length - 1, 3) * 2;
  return Math.min(max + bonus, 30);
}

// ─── Funding Stage Scoring (max 20) ───────────────────────────────────────────

const FUNDING_STAGE_SCORES: Record<string, number> = {
  Seed: 14,
  "Pre-Seed": 10,
  "Series A": 18,
  "Series B": 20,
  "Series C": 20,
  "Series D+": 16, // May already have hyperscaler contracts
  Unknown: 5,
};

function scoreFundingStage(stage: string | null | undefined): number {
  if (!stage) return 5;
  return FUNDING_STAGE_SCORES[stage] ?? 5;
}

// ─── Industry Fit Scoring (max 20) ────────────────────────────────────────────

const HIGH_FIT_INDUSTRIES = [
  "artificial intelligence",
  "machine learning",
  "deep learning",
  "generative ai",
  "computer vision",
  "nlp",
  "natural language processing",
  "robotics",
  "autonomous vehicles",
  "self-driving",
  "drug discovery",
  "biotech ai",
  "fintech ai",
  "ai infrastructure",
  "mlops",
  "gpu computing",
  "hpc",
  "remote workstation",
  "cloud computing",
  "edge computing",
];

const MEDIUM_FIT_INDUSTRIES = [
  "healthcare",
  "biotech",
  "fintech",
  "cybersecurity",
  "data analytics",
  "enterprise software",
  "developer tools",
  "media",
  "gaming",
  "simulation",
  "3d rendering",
  "digital twin",
  "iot",
  "semiconductor",
];

function scoreIndustryFit(
  industry: string | null | undefined,
  subIndustry: string | null | undefined,
  description: string | null | undefined
): number {
  const combined = [industry, subIndustry, description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (HIGH_FIT_INDUSTRIES.some((kw) => combined.includes(kw))) return 20;
  if (MEDIUM_FIT_INDUSTRIES.some((kw) => combined.includes(kw))) return 12;
  return 4;
}

// ─── Headcount Signal (max 15) ────────────────────────────────────────────────

function scoreHeadcount(headcount: string | null | undefined): number {
  if (!headcount) return 5;
  const h = headcount.toLowerCase();
  if (h.includes("1-10") || h.includes("1 - 10")) return 8;
  if (h.includes("11-50") || h.includes("11 - 50")) return 12;
  if (h.includes("51-200") || h.includes("51 - 200")) return 15;
  if (h.includes("201-500") || h.includes("201 - 500")) return 13;
  if (h.includes("501") || h.includes("1000+")) return 10;
  // Try to parse a number
  const num = parseInt(h.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(num)) {
    if (num >= 10 && num <= 200) return 15;
    if (num > 200 && num <= 500) return 13;
    if (num < 10) return 8;
    return 10;
  }
  return 5;
}

// ─── Tech Stack / AI Product Signal (max 15) ─────────────────────────────────

const AI_TECH_KEYWORDS = [
  "pytorch",
  "tensorflow",
  "jax",
  "cuda",
  "triton",
  "vllm",
  "llama",
  "hugging face",
  "transformers",
  "diffusion",
  "stable diffusion",
  "openai",
  "anthropic",
  "langchain",
  "ray",
  "spark",
  "kubernetes",
  "docker",
  "mlflow",
  "wandb",
  "nvidia",
  "a100",
  "h100",
  "h200",
  "gpu cluster",
  "inference server",
  "triton inference",
  "onnx",
  "trt",
  "tensorrt",
];

function scoreTechStack(
  techStack: string | null | undefined,
  aiProducts: string | null | undefined
): number {
  const combined = [techStack, aiProducts].filter(Boolean).join(" ").toLowerCase();
  if (!combined) return 3;
  const matches = AI_TECH_KEYWORDS.filter((kw) => combined.includes(kw)).length;
  if (matches >= 4) return 15;
  if (matches >= 2) return 11;
  if (matches >= 1) return 7;
  return 3;
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

export function scoreLead(input: ScoringInput): {
  score: number;
  breakdown: ScoreBreakdown;
} {
  const breakdown: ScoreBreakdown = {
    gpuUseCases: scoreGpuUseCases(input.gpuUseCases),
    fundingStage: scoreFundingStage(input.fundingStage),
    industryFit: scoreIndustryFit(input.industry, input.subIndustry, input.description),
    headcountSignal: scoreHeadcount(input.headcount),
    techStackSignal: scoreTechStack(input.techStack, input.aiProducts),
  };

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const score = Math.min(Math.round(total), 100);

  return { score, breakdown };
}

export function getScoreLabel(score: number): string {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  if (score >= 25) return "Cool";
  return "Cold";
}

export function getRecommendedGpu(useCases: string[] | null | undefined): string {
  if (!useCases || useCases.length === 0) return "TBD";
  if (useCases.includes("training") || useCases.includes("fine_tuning")) return "H200";
  if (useCases.includes("inference") && useCases.includes("training")) return "Multiple";
  if (useCases.includes("inference")) return "RTX Pro 6000";
  if (useCases.includes("remote_viz")) return "RTX Pro 6000";
  if (useCases.includes("edge_compute")) return "RTX Pro 6000";
  if (useCases.includes("hpc")) return "H200";
  return "TBD";
}

export function generateLektraFitReason(input: ScoringInput): string {
  const parts: string[] = [];

  const useCases = input.gpuUseCases ?? [];
  if (useCases.includes("inference"))
    parts.push("Active AI inference workloads align with Lektra's low-latency edge GPU clusters");
  if (useCases.includes("training") || useCases.includes("fine_tuning"))
    parts.push("Model training/fine-tuning needs match Lektra's H200 high-memory GPU offering");
  if (useCases.includes("remote_viz"))
    parts.push("Remote visualization use case is a direct fit for Lektra's RTX Pro 6000 nodes");
  if (useCases.includes("edge_compute"))
    parts.push("Edge compute requirements align with Lektra's distributed solar-powered datacenter model");

  const stage = input.fundingStage ?? "";
  if (["Seed", "Series A", "Series B", "Series C"].includes(stage))
    parts.push(`${stage} funding stage indicates active growth and GPU budget expansion`);

  const combined = [input.industry, input.subIndustry].filter(Boolean).join(", ");
  if (combined) parts.push(`Industry focus (${combined}) indicates GPU-intensive workloads`);

  parts.push("Lektra's 30-50% cost advantage over hyperscalers with zero egress fees provides compelling ROI");

  return parts.join(". ") + ".";
}
