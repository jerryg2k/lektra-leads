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
import { Building2, Download, Filter, Plus, Search, X } from "lucide-react";
import { useState } from "react";
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

  const exportMutation = trpc.leads.exportHubspot.useMutation({
    onSuccess: ({ csv, count }) => {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lektra-leads-hubspot-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${count} leads to HubSpot CSV`);
    },
    onError: () => toast.error("Export failed"),
  });

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
              onClick={() => exportMutation.mutate(filters)}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export HubSpot</span>
            </Button>
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
              <Select value={industry ?? ""} onValueChange={(v) => setIndustry(v || undefined)}>
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="All industries" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="">All industries</SelectItem>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Funding Stage</Label>
              <Select value={fundingStage ?? ""} onValueChange={(v) => setFundingStage(v || undefined)}>
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="">All stages</SelectItem>
                  {FUNDING_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Pipeline Stage</Label>
              <Select value={pipelineStage ?? ""} onValueChange={(v) => setPipelineStage(v || undefined)}>
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="All pipeline" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="">All pipeline</SelectItem>
                  {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Min Score</Label>
              <Select
                value={minScore?.toString() ?? ""}
                onValueChange={(v) => setMinScore(v ? Number(v) : undefined)}
              >
                <SelectTrigger className="bg-secondary border-border text-sm h-9">
                  <SelectValue placeholder="Any score" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="">Any score</SelectItem>
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
        ) : !leads || leads.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No leads found</p>
            <p className="text-sm mt-1">
              {hasActiveFilters || search ? "Try adjusting your filters" : "Add your first lead or import from Apollo.io"}
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead) => (
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
                        <ScoreBadge score={lead.score ?? 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {leads.map((lead) => (
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
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Add Lead Form ────────────────────────────────────────────────────────────

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

  const createMutation = trpc.leads.create.useMutation({ onSuccess });

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Company Name *</Label>
          <Input
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            placeholder="e.g. Acme AI Labs"
            className="mt-1 bg-secondary border-border"
            required
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Website</Label>
          <Input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://..."
            className="mt-1 bg-secondary border-border"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">LinkedIn URL</Label>
          <Input
            value={form.linkedinUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
            placeholder="https://linkedin.com/company/..."
            className="mt-1 bg-secondary border-border"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Industry</Label>
          <Select value={form.industry} onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}>
            <SelectTrigger className="mt-1 bg-secondary border-border">
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Funding Stage</Label>
          <Select value={form.fundingStage} onValueChange={(v) => setForm((f) => ({ ...f, fundingStage: v }))}>
            <SelectTrigger className="mt-1 bg-secondary border-border">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {FUNDING_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Location</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. San Francisco, CA"
            className="mt-1 bg-secondary border-border"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Headcount</Label>
          <Select value={form.headcount} onValueChange={(v) => setForm((f) => ({ ...f, headcount: v }))}>
            <SelectTrigger className="mt-1 bg-secondary border-border">
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
        <Label className="text-xs text-muted-foreground">GPU Use Cases</Label>
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
        <Label className="text-xs text-muted-foreground">Tech Stack</Label>
        <Input
          value={form.techStack}
          onChange={(e) => setForm((f) => ({ ...f, techStack: e.target.value }))}
          placeholder="e.g. PyTorch, CUDA, Kubernetes, vLLM"
          className="mt-1 bg-secondary border-border"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">AI Products / Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Describe what this company builds and their AI/GPU workloads..."
          className="mt-1 bg-secondary border-border resize-none"
          rows={3}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={createMutation.isPending || !form.companyName.trim()}
      >
        {createMutation.isPending ? "Scoring & Saving..." : "Add Lead & Auto-Score"}
      </Button>
    </form>
  );
}
