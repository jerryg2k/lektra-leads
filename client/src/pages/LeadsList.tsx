import DashboardLayout from "@/components/DashboardLayout";
import { FundingBadge, GpuRecommendBadge, ScoreBadge, StageBadge } from "@/components/LeadBadges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bell, Building2, Check, ChevronDown, Download, Filter, Loader2, Phone, Plus, ScanLine, Search, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const INDUSTRIES = [
  "Artificial Intelligence", "Machine Learning", "Computer Vision", "NLP",
  "Generative AI", "MLOps", "AI Infrastructure", "Robotics",
  "Autonomous Vehicles", "Drug Discovery", "Fintech AI", "Healthcare AI",
  "HPC", "Cloud Computing", "Edge Computing", "Remote Workstation",
  "Gaming", "3D Rendering", "Digital Twin", "Cybersecurity",
];

const FUNDING_STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Unknown"];
const PIPELINE_STAGES = ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"];

const GPU_USE_CASES = [
  { value: "inference", label: "Inference" },
  { value: "training", label: "Training" },
  { value: "fine_tuning", label: "Fine-tuning" },
  { value: "edge_compute", label: "Edge Compute" },
  { value: "remote_viz", label: "Remote Viz" },
  { value: "hpc", label: "HPC" },
];

export default function LeadsList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState<string | undefined>();
  const [fundingStage, setFundingStage] = useState<string | undefined>();
  const [pipelineStage, setPipelineStage] = useState<string | undefined>();
  const [minScore, setMinScore] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const filters = {
    search: search || undefined,
    industry: industry || undefined,
    fundingStage: fundingStage || undefined,
    pipelineStage: pipelineStage || undefined,
    minScore,
    isArchived: false,
  };

  const { data: leads, isLoading, refetch } = trpc.leads.list.useQuery(filters);
  const utils = trpc.useUtils();

  const [exportOpen, setExportOpen] = useState(false);
  const [minCompleteness, setMinCompleteness] = useState(0);

  const exportMutation = trpc.leads.exportHubspot.useMutation({
    onSuccess: ({ csv, count, previewOnly }) => {
      if (previewOnly) return; // just a count preview
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lektra-leads-hubspot-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${count} leads to HubSpot CSV`);
      setExportOpen(false);
    },
    onError: () => toast.error("Export failed"),
  });

  const previewMutation = trpc.leads.exportHubspot.useMutation();

  const bulkReEnrichMutation = trpc.leads.bulkReEnrich.useMutation({
    onSuccess: ({ total, enriched }) => {
      utils.leads.list.invalidate();
      toast.success(`Bulk re-enrich complete: ${enriched}/${total} leads updated`);
    },
    onError: () => toast.error("Bulk re-enrich failed"),
  });

  const [pendingReviewMode, setPendingReviewMode] = useState(false);

  // When pending review mode is on, filter to auto-scan tagged leads
  const autoScanLeads = leads?.filter((l: any) =>
    Array.isArray(l.tags) ? l.tags.includes("auto-scan") : false
  ) ?? [];
  const displayedLeads = pendingReviewMode ? autoScanLeads : leads ?? [];

  const hasActiveFilters = !!(industry || fundingStage || pipelineStage || minScore !== undefined);

  const clearFilters = () => {
    setIndustry(undefined);
    setFundingStage(undefined);
    setPipelineStage(undefined);
    setMinScore(undefined);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {leads ? `${leads.length} companies` : "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border"
              onClick={() => {
                if (confirm(`Re-enrich all leads with completeness < 7? This may take a minute.`)) {
                  bulkReEnrichMutation.mutate({ minCompleteness: 7 });
                }
              }}
              disabled={bulkReEnrichMutation.isPending}
              title="Re-enrich all leads with data completeness below 7/10"
            >
              {bulkReEnrichMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
              <span className="hidden md:inline">{bulkReEnrichMutation.isPending ? "Enriching..." : "Bulk Re-enrich"}</span>
            </Button>
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-border">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export HubSpot</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Export to HubSpot CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Minimum Data Completeness</Label>
                    <p className="text-xs text-muted-foreground">Only export leads with a completeness score at or above this threshold (0 = export all).</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={0} max={10} step={1}
                        value={minCompleteness}
                        onChange={e => setMinCompleteness(Number(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-sm font-bold w-8 text-center">{minCompleteness}/10</span>
                    </div>
                    <div className="flex gap-2">
                      {[0, 5, 7, 9].map(v => (
                        <button key={v} onClick={() => setMinCompleteness(v)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            minCompleteness === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                          }`}>
                          {v === 0 ? "All" : `≥${v}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {previewMutation.data && !previewMutation.data.previewOnly === false && (
                    <p className="text-sm text-muted-foreground">
                      {previewMutation.data.count} leads match this filter
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1"
                      onClick={() => previewMutation.mutate({ filters, minCompleteness: minCompleteness || undefined, previewOnly: true })}
                      disabled={previewMutation.isPending}>
                      {previewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview Count"}
                    </Button>
                    <Button size="sm" className="flex-1"
                      onClick={() => exportMutation.mutate({ filters, minCompleteness: minCompleteness || undefined })}
                      disabled={exportMutation.isPending}>
                      {exportMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                      Export CSV
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Lead</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                </DialogHeader>
                <AddLeadForm
                  onSuccess={() => {
                    setAddOpen(false);
                    utils.leads.list.invalidate();
                    utils.leads.pipelineStats.invalidate();
                    toast.success("Lead added and scored successfully");
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick filter tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl w-fit">
          <button
            onClick={() => setPendingReviewMode(false)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !pendingReviewMode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Leads
            {leads && <span className="ml-1.5 text-xs text-muted-foreground">({leads.length})</span>}
          </button>
          <button
            onClick={() => setPendingReviewMode(true)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              pendingReviewMode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            Pending Review
            {autoScanLeads.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                pendingReviewMode ? "bg-amber-500/20 text-amber-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                {autoScanLeads.length}
              </span>
            )}
          </button>
        </div>

        {/* Search + Filter Bar */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies, industries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`gap-2 border-border ${hasActiveFilters ? "border-primary text-primary" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 py-0.5 font-bold">
                {[industry, fundingStage, pipelineStage, minScore !== undefined ? 1 : 0].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-card rounded-xl border border-border">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Industry</Label>
              <Select value={industry ?? "all"} onValueChange={(v) => setIndustry(v === "all" ? undefined : v)}>
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="All industries" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All industries</SelectItem>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Funding Stage</Label>
              <Select value={fundingStage ?? "all"} onValueChange={(v) => setFundingStage(v === "all" ? undefined : v)}>
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All stages</SelectItem>
                  {FUNDING_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Pipeline Stage</Label>
              <Select value={pipelineStage ?? "all"} onValueChange={(v) => setPipelineStage(v === "all" ? undefined : v)}>
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="All pipeline" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All pipeline</SelectItem>
                  {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Min Score</Label>
              <Select
                value={minScore?.toString() ?? "all"}
                onValueChange={(v) => setMinScore(v === "all" ? undefined : Number(v))}
              >
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="Any score" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">Any score</SelectItem>
                  <SelectItem value="75">Hot (75+)</SelectItem>
                  <SelectItem value="50">Warm (50+)</SelectItem>
                  <SelectItem value="25">Cool (25+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Lead Table / Cards */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : displayedLeads.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No leads found</p>
            <p className="text-sm mt-1">
              {pendingReviewMode ? "No auto-scan leads pending review" : hasActiveFilters || search ? "Try adjusting your filters" : "Add your first lead or import from Apollo.io"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Industry</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funding</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">GPU Fit</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                      className="hover:bg-secondary/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {lead.companyName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{lead.companyName}</p>
                            {lead.location && (
                              <p className="text-xs text-muted-foreground">{lead.location}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{lead.industry ?? "—"}</td>
                      <td className="px-4 py-3">
                        {lead.fundingStage && lead.fundingStage !== "Unknown" ? (
                          <FundingBadge stage={lead.fundingStage} />
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <GpuRecommendBadge gpu={lead.recommendedGpu ?? "TBD"} />
                      </td>
                      <td className="px-4 py-3">
                        <StageBadge stage={lead.pipelineStage ?? "New"} />
                      </td>
                      <td className="px-4 py-3">
                        <CompletenessBar score={(lead as any).completenessScore ?? 0} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={lead.score ?? 0} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <QuickActions lead={lead} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {displayedLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setLocation(`/leads/${lead.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {lead.companyName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{lead.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.industry ?? "AI/ML"}</p>
                      </div>
                    </div>
                    <ScoreBadge score={lead.score ?? 0} />
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {lead.fundingStage && lead.fundingStage !== "Unknown" && (
                      <FundingBadge stage={lead.fundingStage} />
                    )}
                    <StageBadge stage={lead.pipelineStage ?? "New"} />
                    <GpuRecommendBadge gpu={lead.recommendedGpu ?? "TBD"} />
                  </div>
                  <div className="mt-2">
                    <CompletenessBar score={(lead as any).completenessScore ?? 0} />
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Quick actions</span>
                    <QuickActions lead={lead} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────────────────

const STAGE_OPTIONS = ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"];

function QuickActions({ lead }: { lead: { id: number; companyName: string; pipelineStage?: string | null; followUpAt?: Date | null } }) {
  const utils = trpc.useUtils();
  const [stageOpen, setStageOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [followDate, setFollowDate] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [logContent, setLogContent] = useState("");

  const updateStageMutation = trpc.leads.updateStage.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); setStageOpen(false); toast.success("Stage updated"); },
  });
  const setFollowUpMutation = trpc.leads.setFollowUp.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); setFollowOpen(false); toast.success("Follow-up scheduled"); },
  });
  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); setLogOpen(false); setLogContent(""); toast.success("Call logged"); },
  });

  return (
    <div className="flex items-center gap-1">
      {/* Log Call */}
      <div className="relative">
        <button
          title="Log Call"
          onClick={() => setLogOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
        >
          <Phone className="h-3.5 w-3.5" />
        </button>
        {logOpen && (
          <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-xl p-3 w-64 space-y-2">
            <p className="text-xs font-semibold text-foreground">Log Call — {lead.companyName}</p>
            <textarea
              value={logContent}
              onChange={(e) => setLogContent(e.target.value)}
              placeholder="Call notes..."
              className="w-full text-xs bg-secondary border border-border rounded p-2 resize-none h-20 text-foreground"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { if (logContent.trim()) createNoteMutation.mutate({ leadId: lead.id, content: logContent, noteType: "Call" }); }}
                disabled={!logContent.trim() || createNoteMutation.isPending}
                className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90 disabled:opacity-50"
              >Save</button>
              <button onClick={() => setLogOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Move Stage */}
      <div className="relative">
        <button
          title="Move Stage"
          onClick={() => setStageOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {stageOpen && (
          <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 w-40">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1">Move to Stage</p>
            {STAGE_OPTIONS.map((stage) => (
              <button
                key={stage}
                onClick={() => updateStageMutation.mutate({ id: lead.id, stage: stage as "New" | "Contacted" | "Qualified" | "Closed Won" | "Closed Lost" })}
                className={`w-full text-left text-xs px-3 py-1.5 hover:bg-secondary transition-colors ${
                  lead.pipelineStage === stage ? "text-primary font-semibold" : "text-foreground"
                }`}
              >
                {lead.pipelineStage === stage && <Check className="inline h-3 w-3 mr-1" />}{stage}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Follow-up */}
      <div className="relative">
        <button
          title="Schedule Follow-up"
          onClick={() => setFollowOpen((v) => !v)}
          className={`p-1.5 rounded hover:bg-secondary transition-colors ${
            lead.followUpAt && new Date(lead.followUpAt) < new Date() ? "text-red-400" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
        </button>
        {followOpen && (
          <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-xl p-3 w-56 space-y-2">
            <p className="text-xs font-semibold text-foreground">Schedule Follow-up</p>
            <input
              type="date"
              value={followDate}
              onChange={(e) => setFollowDate(e.target.value)}
              className="w-full text-xs bg-secondary border border-border rounded p-2 text-foreground"
              min={new Date().toISOString().split("T")[0]}
            />
            <div className="flex gap-1 flex-wrap">
              {[1, 3, 5, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    const dt = new Date(); dt.setDate(dt.getDate() + d);
                    setFollowDate(dt.toISOString().split("T")[0]);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:bg-accent text-muted-foreground hover:text-accent-foreground border border-border"
                >+{d}d</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { if (followDate) setFollowUpMutation.mutate({ id: lead.id, followUpAt: followDate + "T12:00:00", followUpNote: undefined }); }}
                disabled={!followDate || setFollowUpMutation.isPending}
                className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90 disabled:opacity-50"
              >Set</button>
              <button onClick={() => setFollowOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Completeness Bar ───────────────────────────────────────────────────────

export function CompletenessBar({ score }: { score: number }) {
  const pct = Math.round((score / 10) * 100);
  const color = score < 4 ? "bg-red-500" : score < 8 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = score < 4 ? "text-red-400" : score < 8 ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>{score}/10</span>
    </div>
  );
}

// ─── Add Lead Form ────────────────────────────────────────────────────────────

// Fields that can be auto-filled by enrichment
type EnrichedFields = Set<string>;

function AddLeadForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    companyName: "",
    website: "",
    description: "",
    industry: "",
    location: "",
    headcount: "",
    linkedinUrl: "",
    fundingStage: "" as any,
    totalFunding: "",
    investors: "",
    techStack: "",
    aiProducts: "",
    gpuUseCases: [] as string[],
  });

  const [enrichedFields, setEnrichedFields] = useState<EnrichedFields>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [enrichDone, setEnrichDone] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createMutation = trpc.leads.create.useMutation({ onSuccess });
  const enrichMutation = trpc.leads.enrichLead.useMutation({
    onSuccess: (data) => {
      const filled = new Set<string>();
      setForm((f) => {
        const next = { ...f };
        const fill = <K extends keyof typeof next>(key: K, val: string | undefined) => {
          if (val && !f[key]) { (next as any)[key] = val; filled.add(key); }
        };
        fill("description", data.description);
        fill("industry", data.industry);
        fill("location", data.location);
        fill("headcount", data.headcount);
        fill("fundingStage", data.fundingStage !== "Unknown" ? data.fundingStage : undefined);
        fill("techStack", data.techStack);
        fill("website", data.website);
        fill("linkedinUrl", data.linkedinUrl);
        fill("aiProducts", data.aiProducts);
        // GPU use cases
        if (data.gpuUseCases && data.gpuUseCases.length > 0 && f.gpuUseCases.length === 0) {
          next.gpuUseCases = data.gpuUseCases;
          filled.add("gpuUseCases");
        }
        return next;
      });
      setEnrichedFields(filled);
      setEnrichDone(true);
      setEnriching(false);
      const count = filled.size;
      if (count > 0) {
        toast.success(`Auto-filled ${count} field${count !== 1 ? "s" : ""} from LinkedIn & AI`);
      } else {
        toast.info("No additional data found — fill in manually");
      }
    },
    onError: () => {
      setEnriching(false);
      toast.error("Enrichment failed — fill in manually");
    },
  });

  // Debounced enrichment trigger when company name or website changes
  const triggerEnrich = (name: string, site: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!name.trim() && !site.trim()) return;
    debounceRef.current = setTimeout(() => {
      if (name.trim().length >= 3 || site.trim().length >= 5) {
        setEnriching(true);
        setEnrichDone(false);
        setEnrichedFields(new Set());
        enrichMutation.mutate({
          companyName: name.trim() || undefined,
          website: site.trim() || undefined,
        });
      }
    }, 1200);
  };

  const handleNameChange = (v: string) => {
    setForm((f) => { triggerEnrich(v, f.website); return { ...f, companyName: v }; });
  };
  const handleWebsiteChange = (v: string) => {
    setForm((f) => { triggerEnrich(f.companyName, v); return { ...f, website: v }; });
  };

  const toggleUseCase = (uc: string) => {
    setForm((f) => ({
      ...f,
      gpuUseCases: f.gpuUseCases.includes(uc)
        ? f.gpuUseCases.filter((u) => u !== uc)
        : [...f.gpuUseCases, uc],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) return;
    createMutation.mutate({
      ...form,
      fundingStage: form.fundingStage || undefined,
      gpuUseCases: form.gpuUseCases.length > 0 ? form.gpuUseCases : undefined,
    });
  };

  // Small badge shown next to auto-filled labels
  const AutoBadge = ({ field }: { field: string }) =>
    enrichedFields.has(field) ? (
      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
        <Sparkles className="h-2.5 w-2.5" /> AI
      </span>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Enrichment status banner */}
      {enriching && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/25 rounded-xl text-xs text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>Looking up company data from LinkedIn & AI...</span>
        </div>
      )}
      {enrichDone && enrichedFields.size > 0 && !enriching && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-green-500/10 border border-green-500/25 rounded-xl text-xs text-green-400">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>Auto-filled <strong>{enrichedFields.size} fields</strong> — review and edit anything below before saving.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Company Name *</Label>
          <div className="relative mt-1">
            <Input
              value={form.companyName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Type a company name to auto-fill..."
              className="bg-secondary border-border pr-8"
              required
            />
            {enriching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
            )}
            {enrichDone && !enriching && (
              <Sparkles className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Website <AutoBadge field="website" /></Label>
          <Input
            value={form.website}
            onChange={(e) => handleWebsiteChange(e.target.value)}
            placeholder="https://... (triggers auto-fill)"
            className={`mt-1 bg-secondary border-border ${
              enrichedFields.has("website") ? "border-primary/40" : ""
            }`}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">LinkedIn URL <AutoBadge field="linkedinUrl" /></Label>
          <Input
            value={form.linkedinUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
            placeholder="https://linkedin.com/company/..."
            className={`mt-1 bg-secondary border-border ${
              enrichedFields.has("linkedinUrl") ? "border-primary/40" : ""
            }`}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Industry <AutoBadge field="industry" /></Label>
          <Select value={form.industry} onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}>
            <SelectTrigger className={`mt-1 bg-secondary border-border ${
              enrichedFields.has("industry") ? "border-primary/40" : ""
            }`}>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Funding Stage <AutoBadge field="fundingStage" /></Label>
          <Select value={form.fundingStage} onValueChange={(v) => setForm((f) => ({ ...f, fundingStage: v }))}>
            <SelectTrigger className={`mt-1 bg-secondary border-border ${
              enrichedFields.has("fundingStage") ? "border-primary/40" : ""
            }`}>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {FUNDING_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Location <AutoBadge field="location" /></Label>
          <Input
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. San Francisco, CA"
            className={`mt-1 bg-secondary border-border ${
              enrichedFields.has("location") ? "border-primary/40" : ""
            }`}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Headcount <AutoBadge field="headcount" /></Label>
          <Select value={form.headcount} onValueChange={(v) => setForm((f) => ({ ...f, headcount: v }))}>
            <SelectTrigger className={`mt-1 bg-secondary border-border ${
              enrichedFields.has("headcount") ? "border-primary/40" : ""
            }`}>
              <SelectValue placeholder="Team size" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Total Funding</Label>
          <Input
            value={form.totalFunding}
            onChange={(e) => setForm((f) => ({ ...f, totalFunding: e.target.value }))}
            placeholder="e.g. $12M"
            className="mt-1 bg-secondary border-border"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Investors</Label>
          <Input
            value={form.investors}
            onChange={(e) => setForm((f) => ({ ...f, investors: e.target.value }))}
            placeholder="e.g. a16z, YC"
            className="mt-1 bg-secondary border-border"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">GPU Use Cases <AutoBadge field="gpuUseCases" /></Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {GPU_USE_CASES.map((uc) => (
            <button
              key={uc.value}
              type="button"
              onClick={() => toggleUseCase(uc.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                form.gpuUseCases.includes(uc.value)
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {uc.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Tech Stack <AutoBadge field="techStack" /></Label>
        <Input
          value={form.techStack}
          onChange={(e) => setForm((f) => ({ ...f, techStack: e.target.value }))}
          placeholder="e.g. PyTorch, CUDA, Kubernetes, vLLM"
          className={`mt-1 bg-secondary border-border ${
            enrichedFields.has("techStack") ? "border-primary/40" : ""
          }`}
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">AI Products / Description <AutoBadge field="description" /></Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Describe what this company builds and their AI/GPU workloads..."
          className={`mt-1 bg-secondary border-border resize-none ${
            enrichedFields.has("description") ? "border-primary/40" : ""
          }`}
          rows={3}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={createMutation.isPending || enrichMutation.isPending || !form.companyName.trim()}
      >
        {createMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Scoring & Saving...</>
        ) : (
          "Add Lead & Auto-Score"
        )}
      </Button>
    </form>
  );
}
