import DashboardLayout from "@/components/DashboardLayout";
import { FundingBadge, GpuRecommendBadge, ScoreBadge, StageBadge } from "@/components/LeadBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Cpu,
  Flame,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STAGE_ORDER = ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: pipelineStats, isLoading: statsLoading } = trpc.leads.pipelineStats.useQuery();
  const { data: hotLeads, isLoading: leadsLoading } = trpc.leads.list.useQuery({
    minScore: 60,
    isArchived: false,
  });
  const { data: allLeads } = trpc.leads.list.useQuery({ isArchived: false });
  const { data: overdueLeads, isLoading: overdueLoading } = trpc.leads.overdueFollowUps.useQuery();
  const { data: sourceStats } = trpc.leads.sourceStats.useQuery();

  const sendDigestMutation = trpc.leads.sendDigest.useMutation({
    onSuccess: (result) => {
      if (result.sent) {
        toast.success("Weekly digest sent! Check your Manus notifications.");
      } else {
        toast.error("Digest compiled but notification delivery failed. Try again.");
      }
    },
    onError: () => toast.error("Failed to send digest. Please try again."),
  });

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border text-xs"
              onClick={() => sendDigestMutation.mutate()}
              disabled={sendDigestMutation.isPending}
              title="Send weekly BD digest now (also auto-sends every Monday 7AM UTC)"
            >
              {sendDigestMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{sendDigestMutation.isPending ? "Sending..." : "Send Digest"}</span>
            </Button>
            <Button
              onClick={() => setLocation("/leads")}
              className="gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Lead</span>
            </Button>
          </div>
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

        {/* Overdue Follow-ups */}
        {(overdueLeads && overdueLeads.length > 0) && (
          <NeedsAttentionSection leads={overdueLeads} />
        )}

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

        {/* Lead Source Analytics */}
        {sourceStats && sourceStats.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Lead Source Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sourceStats.map((s) => {
                  const maxCount = Math.max(...sourceStats.map((x) => x.count));
                  const pct = maxCount > 0 ? Math.round((s.count / maxCount) * 100) : 0;
                  const scoreColor = s.avgScore >= 75 ? "text-green-400" : s.avgScore >= 55 ? "text-amber-400" : "text-red-400";
                  return (
                    <div key={s.source}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-foreground font-medium">{s.source}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{s.count} lead{s.count !== 1 ? "s" : ""}</span>
                          <span className={`font-semibold ${scoreColor}`}>avg {s.avgScore}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Bar width = relative lead count. Avg score shows quality per source.
              </p>
            </CardContent>
          </Card>
        )}
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

// ─── Needs Attention Section ──────────────────────────────────────────────────

function NeedsAttentionSection({ leads }: { leads: any[] }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [clearingAll, setClearingAll] = useState(false);

  const setFollowUpMutation = trpc.leads.setFollowUp.useMutation({
    onSuccess: () => {
      utils.leads.overdueFollowUps.invalidate();
      toast.success("Follow-up updated");
    },
    onError: () => toast.error("Failed to update follow-up"),
  });

  const clearFollowUpMutation = trpc.leads.setFollowUp.useMutation({
    onSuccess: () => {
      utils.leads.overdueFollowUps.invalidate();
      toast.success("Follow-up cleared");
    },
    onError: () => toast.error("Failed to clear follow-up"),
  });

  const snoozeFollowUpMutation = trpc.leads.setFollowUp.useMutation({
    onSuccess: () => {
      utils.leads.overdueFollowUps.invalidate();
      toast.success("Snoozed 3 days");
    },
    onError: () => toast.error("Failed to snooze"),
  });

  const handleClearAll = async () => {
    if (!confirm(`Clear all ${leads.length} overdue follow-up alarms?`)) return;
    setClearingAll(true);
    try {
      for (const lead of leads) {
        await clearFollowUpMutation.mutateAsync({ id: lead.id, followUpAt: null, followUpNote: "" });
      }
      toast.success(`Cleared ${leads.length} follow-up alarms`);
    } catch {
      toast.error("Some alarms could not be cleared");
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <Card className="bg-card border-red-500/30 border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          Needs Attention — {leads.length} Overdue Follow-up{leads.length !== 1 ? "s" : ""}
        </CardTitle>
        {leads.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            onClick={handleClearAll}
            disabled={clearingAll}
          >
            {clearingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Clear All
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {leads.map((lead: any) => (
            <NeedsAttentionRow
              key={lead.id}
              lead={lead}
              onGoToNotes={() => setLocation(`/leads/${lead.id}#notes`)}
              onMarkComplete={() =>
                clearFollowUpMutation.mutate({ id: lead.id, followUpAt: null, followUpNote: "" })
              }
              onSnooze={() => {
                const snoozeDate = new Date();
                snoozeDate.setDate(snoozeDate.getDate() + 3);
                snoozeFollowUpMutation.mutate({
                  id: lead.id,
                  followUpAt: snoozeDate.toISOString(),
                  followUpNote: lead.followUpNote ?? "",
                });
              }}
              onSaveEdit={(date, note) =>
                setFollowUpMutation.mutate({ id: lead.id, followUpAt: date, followUpNote: note })
              }
              isSaving={setFollowUpMutation.isPending || clearFollowUpMutation.isPending || snoozeFollowUpMutation.isPending}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NeedsAttentionRow({
  lead,
  onGoToNotes,
  onMarkComplete,
  onSnooze,
  onSaveEdit,
  isSaving,
}: {
  lead: any;
  onGoToNotes: () => void;
  onMarkComplete: () => void;
  onSnooze: () => void;
  onSaveEdit: (date: string, note: string) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(() => {
    const d = new Date(lead.followUpAt);
    return d.toISOString().slice(0, 10);
  });
  const [editNote, setEditNote] = useState(lead.followUpNote ?? "");

  const daysOverdue = Math.floor(
    (Date.now() - new Date(lead.followUpAt).getTime()) / 86400000
  );

  return (
    <div className="px-4 py-3 space-y-2">
      {/* Top row: company + overdue badge + action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
          <Bell className="h-3.5 w-3.5 text-red-400" />
        </div>
        <span className="font-medium text-sm text-foreground">{lead.companyName}</span>
        <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
          {daysOverdue === 0 ? "Due today" : `${daysOverdue}d overdue`}
        </span>

        {/* Action buttons pushed to the right */}
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Edit toggle */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>

          {/* Go to Notes & Next Steps */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-border"
            onClick={onGoToNotes}
          >
            <MessageSquare className="h-3 w-3" />
            Notes & Next Steps
          </Button>

          {/* Snooze 3 days */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-border text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/30"
            onClick={onSnooze}
            disabled={isSaving}
          >
            <Bell className="h-3 w-3" />
            Snooze 3d
          </Button>

          {/* Mark Complete — clears alarm */}
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
            onClick={onMarkComplete}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Mark Complete
          </Button>
        </div>
      </div>

      {/* Follow-up note (read mode) */}
      {!editing && lead.followUpNote && (
        <p className="text-xs text-muted-foreground pl-10">{lead.followUpNote}</p>
      )}

      {/* Inline edit form */}
      {editing && (
        <div className="pl-10 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="text-sm bg-secondary border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="Follow-up note..."
            rows={2}
            className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={isSaving}
              onClick={() => {
                onSaveEdit(new Date(editDate).toISOString(), editNote);
                setEditing(false);
              }}
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setEditDate(new Date(lead.followUpAt).toISOString().slice(0, 10));
                setEditNote(lead.followUpNote ?? "");
                setEditing(false);
              }}
            >
              <X className="h-3 w-3" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
