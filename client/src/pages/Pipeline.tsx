import DashboardLayout from "@/components/DashboardLayout";
import { FundingBadge, GpuRecommendBadge, ScoreBadge, StageBadge } from "@/components/LeadBadges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Kanban } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STAGES = ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_COLORS: Record<Stage, string> = {
  New: "border-t-sky-500",
  Contacted: "border-t-amber-500",
  Qualified: "border-t-emerald-500",
  "Closed Won": "border-t-emerald-600",
  "Closed Lost": "border-t-red-500",
};

export default function Pipeline() {
  const [, setLocation] = useLocation();
  const { data: leads, isLoading } = trpc.leads.list.useQuery({ isArchived: false });
  const utils = trpc.useUtils();

  const updateStageMutation = trpc.leads.updateStage.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.pipelineStats.invalidate();
    },
    onError: () => toast.error("Failed to update stage"),
  });

  const leadsByStage: Record<Stage, typeof leads> = {
    New: [],
    Contacted: [],
    Qualified: [],
    "Closed Won": [],
    "Closed Lost": [],
  };

  leads?.forEach((lead) => {
    const stage = (lead.pipelineStage ?? "New") as Stage;
    if (leadsByStage[stage]) {
      leadsByStage[stage]!.push(lead);
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {leads ? `${leads.length} active leads` : "Loading..."}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {STAGES.map((s) => (
              <div key={s} className="space-y-2">
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
            {STAGES.map((stage) => {
              const stageLeads = leadsByStage[stage] ?? [];
              return (
                <div key={stage} className="flex flex-col gap-2">
                  {/* Column Header */}
                  <div className={`flex items-center justify-between px-3 py-2 bg-card rounded-xl border-t-2 border border-border ${STAGE_COLORS[stage]}`}>
                    <StageBadge stage={stage} />
                    <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Lead Cards */}
                  <div className="flex flex-col gap-2 min-h-[80px]">
                    {stageLeads.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground">No leads</p>
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-all group"
                        >
                          {/* Company name + score */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <button
                              onClick={() => setLocation(`/leads/${lead.id}`)}
                              className="font-semibold text-sm text-foreground hover:text-primary transition-colors text-left leading-tight"
                            >
                              {lead.companyName}
                            </button>
                            <ScoreBadge score={lead.score ?? 0} className="shrink-0" />
                          </div>

                          {/* Meta */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {lead.fundingStage && lead.fundingStage !== "Unknown" && (
                              <FundingBadge stage={lead.fundingStage} />
                            )}
                            <GpuRecommendBadge gpu={lead.recommendedGpu ?? "TBD"} />
                          </div>

                          {lead.industry && (
                            <p className="text-xs text-muted-foreground mb-2 truncate">{lead.industry}</p>
                          )}

                          {/* Stage Mover */}
                          <Select
                            value={lead.pipelineStage ?? "New"}
                            onValueChange={(newStage) => {
                              updateStageMutation.mutate({
                                id: lead.id,
                                stage: newStage as Stage,
                              });
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs bg-secondary border-border w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              {STAGES.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && leads?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Kanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Pipeline is empty</p>
            <p className="text-sm mt-1">Add leads from the Leads page to populate your pipeline.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
