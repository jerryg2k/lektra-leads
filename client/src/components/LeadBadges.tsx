import { cn } from "@/lib/utils";

// ─── Score Badge ──────────────────────────────────────────────────────────────

export function getScoreLabel(score: number): string {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  if (score >= 25) return "Cool";
  return "Cold";
}

export function getScoreClass(score: number): string {
  if (score >= 75) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  if (score >= 50) return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
  if (score >= 25) return "bg-sky-500/20 text-sky-400 border border-sky-500/30";
  return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const label = getScoreLabel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold",
        getScoreClass(score),
        className
      )}
    >
      <span className="font-bold">{score}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

// ─── Pipeline Stage Badge ─────────────────────────────────────────────────────

export function getStageBadgeClass(stage: string): string {
  switch (stage) {
    case "New": return "bg-sky-500/20 text-sky-400 border border-sky-500/30";
    case "Contacted": return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    case "Qualified": return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    case "Closed Won": return "bg-emerald-600/30 text-emerald-300 border border-emerald-600/40";
    case "Closed Lost": return "bg-red-500/20 text-red-400 border border-red-500/30";
    default: return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
  }
}

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        getStageBadgeClass(stage),
        className
      )}
    >
      {stage}
    </span>
  );
}

// ─── Funding Stage Badge ──────────────────────────────────────────────────────

export function getFundingBadgeClass(stage: string): string {
  switch (stage) {
    case "Pre-Seed": return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
    case "Seed": return "bg-violet-500/20 text-violet-400 border border-violet-500/30";
    case "Series A": return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    case "Series B": return "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30";
    case "Series C": return "bg-teal-500/20 text-teal-400 border border-teal-500/30";
    case "Series D+": return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    default: return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
  }
}

export function FundingBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        getFundingBadgeClass(stage),
        className
      )}
    >
      {stage}
    </span>
  );
}

// ─── GPU Use Case Tag ─────────────────────────────────────────────────────────

const GPU_USE_CASE_LABELS: Record<string, string> = {
  inference: "Inference",
  training: "Training",
  fine_tuning: "Fine-tuning",
  edge_compute: "Edge Compute",
  remote_viz: "Remote Viz",
  hpc: "HPC",
  rendering: "Rendering",
  simulation: "Simulation",
};

export function GpuUseCaseTag({ useCase, className }: { useCase: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20",
        className
      )}
    >
      {GPU_USE_CASE_LABELS[useCase] ?? useCase}
    </span>
  );
}

// ─── GPU Recommendation Badge ─────────────────────────────────────────────────

export function GpuRecommendBadge({ gpu, className }: { gpu: string; className?: string }) {
  const colorMap: Record<string, string> = {
    H200: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    "RTX Pro 6000": "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    B200: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
    Multiple: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    TBD: "bg-slate-500/20 text-slate-400 border border-slate-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        colorMap[gpu] ?? colorMap.TBD,
        className
      )}
    >
      {gpu}
    </span>
  );
}
