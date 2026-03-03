import DashboardLayout from "@/components/DashboardLayout";
import { FundingBadge, GpuRecommendBadge, ScoreBadge, StageBadge } from "@/components/LeadBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Cpu,
  Flame,
  Plus,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";

const STAGE_ORDER = ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: pipelineStats, isLoading: statsLoading } = trpc.leads.pipelineStats.useQuery();
  const { data: hotLeads, isLoading: leadsLoading } = trpc.leads.list.useQuery({
    minScore: 60,
    isArchived: false,
  });
  const { data: allLeads } = trpc.leads.list.useQuery({ isArchived: false });

  const totalLeads = allLeads?.length ?? 0;
  const hotCount = allLeads?.filter((l) => (l.score ?? 0) >= 75).length ?? 0;
  const avgScore =
    allLeads && allLeads.length > 0
      ? Math.round(allLeads.reduce((s, l) => s + (l.score ?? 0), 0) / allLeads.length)
      : 0;

  const stageMap: Record<string, { count: number; avgScore: number }> = {};
  pipelineStats?.forEach((s) => {
    stageMap[s.stage ?? "New"] = { count: Number(s.count), avgScore: Math.round(Number(s.avgScore ?? 0)) };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lektra Cloud GPU Lead Intelligence
            </p>
          </div>
          <Button
            onClick={() => setLocation("/leads")}
            className="gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Building2}
            label="Total Leads"
            value={totalLeads}
            loading={!allLeads}
            color="text-sky-400"
            bg="bg-sky-500/10"
          />
          <KpiCard
            icon={Flame}
            label="Hot Leads"
            value={hotCount}
            loading={!allLeads}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
          />
          <KpiCard
            icon={BarChart3}
            label="Avg Score"
            value={avgScore}
            loading={!allLeads}
            color="text-amber-400"
            bg="bg-amber-500/10"
          />
          <KpiCard
            icon={TrendingUp}
            label="Qualified"
            value={stageMap["Qualified"]?.count ?? 0}
            loading={statsLoading}
            color="text-primary"
            bg="bg-primary/10"
          />
        </div>

        {/* Pipeline Summary */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Pipeline Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {STAGE_ORDER.map((s) => <Skeleton key={s} className="h-20 rounded-lg" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {STAGE_ORDER.map((stage) => {
                  const data = stageMap[stage] ?? { count: 0, avgScore: 0 };
                  return (
                    <button
                      key={stage}
                      onClick={() => setLocation("/pipeline")}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors border border-border hover:border-primary/30 text-center"
                    >
                      <StageBadge stage={stage} />
                      <span className="text-2xl font-bold text-foreground">{data.count}</span>
                      {data.count > 0 && (
                        <span className="text-xs text-muted-foreground">avg {data.avgScore}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hot Leads */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Top GPU Prospects
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground gap-1"
              onClick={() => setLocation("/leads")}
            >
              View all <ChevronRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {leadsLoading ? (
              <div className="space-y-1 px-4 pb-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : !hotLeads || hotLeads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Cpu className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hot leads yet. Import or add leads to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {hotLeads.slice(0, 8).map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => setLocation(`/leads/${lead.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {lead.companyName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground truncate">
                          {lead.companyName}
                        </span>
                        {lead.fundingStage && lead.fundingStage !== "Unknown" && (
                          <FundingBadge stage={lead.fundingStage} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground truncate">
                          {lead.industry ?? "AI/ML"}
                        </span>
                        {lead.location && (
                          <span className="text-xs text-muted-foreground">· {lead.location}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <GpuRecommendBadge gpu={lead.recommendedGpu ?? "TBD"} />
                      <ScoreBadge score={lead.score ?? 0} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  loading,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  loading: boolean;
  color: string;
  bg: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <div>
            {loading ? (
              <Skeleton className="h-7 w-12 mb-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
