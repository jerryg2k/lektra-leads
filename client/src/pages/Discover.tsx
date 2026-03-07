import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  BookmarkPlus,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Linkedin,
  Loader2,
  Search,
  Sparkles,
  Users,
  Zap,
  ScanLine,
  CheckCircle2,
  XCircle,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ScoreBadge, StageBadge, GpuUseCaseTag, LeadTypeBadge } from "@/components/LeadBadges";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeedCompany {
  slug: string;
  name: string;
  gpuUseCases: string[];
  fundingStage: string;
  industry: string;
  location: string;
  website?: string;
  linkedinUrl: string;
  techStack?: string;
}

interface EnrichedCompany extends SeedCompany {
  description?: string;
  headcount?: string;
  specialities?: string[];
  crunchbaseUrl?: string;
  followerCount?: number;
  tagline?: string;
  founders?: Array<{ fullName: string; headline: string; location: string; profileURL: string }>;
  score: number;
  engineScore: number;
  breakdown: Record<string, number>;
  fitReason: string;
  recommendedGpu: string;
  outreachAngle: string;
}

// ─── GPU Use Case labels ──────────────────────────────────────────────────────

const GPU_LABELS: Record<string, string> = {
  inference: "Inference",
  training: "Training",
  fine_tuning: "Fine-Tuning",
  edge_compute: "Edge Compute",
  remote_viz: "Remote Viz",
  hpc: "HPC",
};

const FUNDING_STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D+"];

// ─── Score ring component ─────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-emerald-400" :
    score >= 55 ? "text-yellow-400" :
    score >= 35 ? "text-orange-400" : "text-red-400";
  const label =
    score >= 75 ? "Hot" :
    score >= 55 ? "Warm" :
    score >= 35 ? "Cool" : "Cold";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
}

// ─── Enriched Card ────────────────────────────────────────────────────────────

function EnrichedCard({
  company,
  onAddToLeads,
  isAdding,
  alreadyAdded,
}: {
  company: EnrichedCompany;
  onAddToLeads: (c: EnrichedCompany) => void;
  isAdding: boolean;
  alreadyAdded: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-border bg-card hover:border-primary/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left: company info */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold text-foreground">
                  {company.name}
                </CardTitle>
                <Badge variant="outline" className="text-xs shrink-0">
                  {company.fundingStage}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {company.industry} · {company.location}
              </p>
              {company.tagline && (
                <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                  "{company.tagline}"
                </p>
              )}
            </div>
          </div>

          {/* Right: score + action */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <ScoreRing score={company.score} />
            <Button
              size="sm"
              variant={alreadyAdded ? "outline" : "default"}
              disabled={isAdding || alreadyAdded}
              onClick={() => onAddToLeads(company)}
              className="text-xs h-7 px-2"
            >
              {isAdding ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : alreadyAdded ? (
                "Added ✓"
              ) : (
                <>
                  <BookmarkPlus className="w-3 h-3 mr-1" />
                  Add Lead
                </>
              )}
            </Button>
          </div>
        </div>

        {/* GPU use cases */}
        <div className="flex flex-wrap gap-1 mt-2">
          {company.gpuUseCases.map((uc) => (
            <Badge key={uc} className="text-xs bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
              {GPU_LABELS[uc] ?? uc}
            </Badge>
          ))}
          {company.recommendedGpu && company.recommendedGpu !== "TBD" && (
            <Badge className="text-xs bg-blue-500/15 text-blue-400 border-blue-500/30">
              <Zap className="w-2.5 h-2.5 mr-1" />
              {company.recommendedGpu}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Fit reason */}
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Lektra Fit Analysis</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{company.fitReason}</p>
          {company.outreachAngle && (
            <p className="text-xs text-primary/80 mt-1.5 font-medium">
              💬 {company.outreachAngle}
            </p>
          )}
        </div>

        {/* Quick stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {company.headcount && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {company.headcount} employees
            </span>
          )}
          {company.followerCount && (
            <span className="flex items-center gap-1">
              <Linkedin className="w-3 h-3" />
              {company.followerCount.toLocaleString()} followers
            </span>
          )}
        </div>

        {/* Links row */}
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={company.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Linkedin className="w-3 h-3" />
            LinkedIn
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {company.website && (
            <a
              href={`https://${company.website.replace(/^https?:\/\//, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {company.website}
            </a>
          )}
          {company.crunchbaseUrl && (
            <a
              href={company.crunchbaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Crunchbase
            </a>
          )}
        </div>

        {/* Expandable: founders + description */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expanded ? "Hide details" : "Show founders & description"}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1">
            {company.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {company.description}
              </p>
            )}

            {company.founders && company.founders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Key Contacts</p>
                <div className="space-y-2">
                  {company.founders.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-bold text-foreground">
                        {f.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <a
                          href={f.profileURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          {f.fullName}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <p className="text-xs text-muted-foreground truncate">{f.headline}</p>
                        {f.location && (
                          <p className="text-xs text-muted-foreground/70">{f.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {company.specialities && company.specialities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Specialities</p>
                <div className="flex flex-wrap gap-1">
                  {company.specialities.slice(0, 8).map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seed Card (before enrichment) ───────────────────────────────────────────

function SeedCard({
  company,
  onEnrich,
  isEnriching,
}: {
  company: SeedCompany;
  onEnrich: (c: SeedCompany) => void;
  isEnriching: boolean;
}) {
  return (
    <Card className="border-border bg-card/60 hover:bg-card transition-colors cursor-pointer" onClick={() => !isEnriching && onEnrich(company)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
              <p className="text-xs text-muted-foreground truncate">{company.industry} · {company.fundingStage}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {company.gpuUseCases.slice(0, 3).map((uc) => (
                  <Badge key={uc} className="text-xs bg-primary/10 text-primary border-primary/20">
                    {GPU_LABELS[uc] ?? uc}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={isEnriching} className="shrink-0 text-xs h-7">
            {isEnriching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Analyze"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Discover Page ───────────────────────────────────────────────────────

export default function Discover() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"discover" | "autoscan" | "gtc">("discover");
  const [gtcTier, setGtcTier] = useState<"Must Meet" | "High Value" | "Worth Visiting" | "all">("all");
  const [gtcSearch, setGtcSearch] = useState("");
  const [gtcExpandedId, setGtcExpandedId] = useState<number | null>(null);
  const [gtcNotesMap, setGtcNotesMap] = useState<Record<number, string>>({});

  const { data: gtcTargets, isLoading: gtcLoading, refetch: refetchGtc } = trpc.gtc.targets.useQuery(
    { tier: gtcTier, search: gtcSearch || undefined },
    { enabled: activeTab === "gtc" }
  );
  const addToPipelineMutation = trpc.gtc.addToPipeline.useMutation({
    onSuccess: (data) => {
      refetchGtc();
      utils.leads.list.invalidate();
      toast.success("Added to pipeline!");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const updateNotesMutation = trpc.gtc.updateNotes.useMutation({
    onSuccess: () => { refetchGtc(); toast.success("Notes saved"); },
  });
  const [keyword, setKeyword] = useState("");
  const [gpuUseCase, setGpuUseCase] = useState("all");
  const [fundingStage, setFundingStage] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [enrichedMap, setEnrichedMap] = useState<Record<string, EnrichedCompany>>({});
  const [enrichingSet, setEnrichingSet] = useState<Set<string>>(new Set());
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set());
  const [batchEnriching, setBatchEnriching] = useState(false);
  const [discoverLeadType, setDiscoverLeadType] = useState<"Prospect" | "Partner" | "Investor" | "Other">("Prospect");
  const [gtcLeadType, setGtcLeadType] = useState<"Prospect" | "Partner" | "Investor" | "Other">("Prospect");
  const [gtcCardLeadTypes, setGtcCardLeadTypes] = useState<Record<number, "Prospect" | "Partner" | "Investor" | "Other">>({});

  // Fetch filter options
  const { data: filterOpts } = trpc.discover.filterOptions.useQuery();

  // Fetch seed list
  const { data: seedData, isLoading: seedLoading } = trpc.discover.list.useQuery({
    keyword: keyword || undefined,
    gpuUseCase: gpuUseCase === "all" ? undefined : gpuUseCase,
    fundingStage: fundingStage === "all" ? undefined : fundingStage,
    industry: industry === "all" ? undefined : industry,
    limit: 30,
  });

  const enrichMutation = trpc.discover.enrich.useMutation();
  const batchEnrichMutation = trpc.discover.batchEnrich.useMutation();
  const createLeadMutation = trpc.leads.create.useMutation();
  const utils = trpc.useUtils();

  const scanRunMutation = trpc.scan.runNow.useMutation({
    onSuccess: (result) => {
      utils.scan.history.invalidate();
      utils.scan.latestAddedLeads.invalidate();
      utils.leads.list.invalidate();
      if (result.error) {
        toast.error(`Scan failed: ${result.error}`);
      } else {
        toast.success(`Scan complete — ${result.added} new lead${result.added === 1 ? "" : "s"} added`);
      }
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });
  const { data: scanHistoryData, isLoading: scanHistoryLoading } = trpc.scan.history.useQuery();
  const { data: latestScanLeads } = trpc.scan.latestAddedLeads.useQuery();

  const seeds: SeedCompany[] = seedData?.items ?? [];

  // Separate enriched from not-yet-enriched
  const enrichedResults = useMemo(
    () => seeds.filter((s) => enrichedMap[s.slug]).map((s) => enrichedMap[s.slug]!),
    [seeds, enrichedMap]
  );
  const unenrichedSeeds = useMemo(
    () => seeds.filter((s) => !enrichedMap[s.slug]),
    [seeds, enrichedMap]
  );

  // Sort enriched by score desc
  const sortedEnriched = useMemo(
    () => [...enrichedResults].sort((a, b) => b.score - a.score),
    [enrichedResults]
  );

  async function handleEnrich(company: SeedCompany) {
    if (enrichingSet.has(company.slug)) return;
    setEnrichingSet((prev) => new Set(prev).add(company.slug));
    try {
      const result = await enrichMutation.mutateAsync({
        slug: company.slug,
        name: company.name,
        gpuUseCases: company.gpuUseCases,
        fundingStage: company.fundingStage,
        industry: company.industry,
        techStack: company.techStack,
        location: company.location,
        website: company.website,
      });
      setEnrichedMap((prev) => ({ ...prev, [company.slug]: result as EnrichedCompany }));
    } catch (e: any) {
      toast.error(`Failed to analyze ${company.name}: ${e.message}`);
    } finally {
      setEnrichingSet((prev) => { const s = new Set(prev); s.delete(company.slug); return s; });
    }
  }

  async function handleBatchEnrich() {
    const toEnrich = unenrichedSeeds.slice(0, 5);
    if (toEnrich.length === 0) return;
    setBatchEnriching(true);
    try {
      const results = await batchEnrichMutation.mutateAsync({
        companies: toEnrich.map((c) => ({
          slug: c.slug,
          name: c.name,
          gpuUseCases: c.gpuUseCases,
          fundingStage: c.fundingStage,
          industry: c.industry,
          techStack: c.techStack,
          location: c.location,
          website: c.website,
        })),
      });
      const newMap: Record<string, EnrichedCompany> = {};
      for (const r of results as EnrichedCompany[]) {
        newMap[r.slug] = r;
      }
      setEnrichedMap((prev) => ({ ...prev, ...newMap }));
      toast.success(`Analyzed ${results.length} companies`);
    } catch (e: any) {
      toast.error(`Batch analysis failed: ${e.message}`);
    } finally {
      setBatchEnriching(false);
    }
  }

  async function handleAddToLeads(company: EnrichedCompany) {
    try {
      await createLeadMutation.mutateAsync({
        companyName: company.name,
        website: company.website,
        description: company.description,
        industry: company.industry,
        location: company.location,
        headcount: company.headcount,
        linkedinUrl: company.linkedinUrl,
        fundingStage: company.fundingStage as any,
        gpuUseCases: company.gpuUseCases,
        techStack: company.techStack,
        pipelineStage: "New",
        leadType: discoverLeadType,
        source: "Discover Engine",
        assignedTo: user?.name ?? undefined,
      });
      setAddedSet((prev) => new Set(prev).add(company.slug));
      utils.leads.list.invalidate();
      utils.leads.pipelineStats.invalidate();
      toast.success(`${company.name} added to your leads pipeline!`);
    } catch (e: any) {
      toast.error(`Failed to add lead: ${e.message}`);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" />
            Lead Discovery Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {seedData?.total ?? 0} AI startups in the US curated for Lektra GPU fit. Filter, analyze with AI, and add to your pipeline.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("discover")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "discover"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Discover
            </span>
          </button>
          <button
            onClick={() => setActiveTab("autoscan")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "autoscan"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ScanLine className="w-3.5 h-3.5" />
              Auto-Scan
              {scanHistoryData && scanHistoryData[0]?.status === "completed" && (scanHistoryData[0]?.added ?? 0) > 0 && (
                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-1.5 py-0.5 rounded-full">
                  {scanHistoryData[0].added} new
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("gtc")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "gtc"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              GTC Strategy
              <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full">34</span>
            </span>
          </button>
        </div>

        {/* Auto-Scan Panel */}
        {activeTab === "autoscan" && (
          <div className="space-y-6">
            {/* Run Now card */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-primary" />
                  Daily AI Startup Scanner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Automatically discovers new AI startups with GPU compute needs and adds qualifying leads (score ≥55) to your pipeline. Runs every day at 6:00 AM UTC. Leads are tagged <code className="bg-secondary px-1 py-0.5 rounded text-xs">auto-scan</code>.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    onClick={() => scanRunMutation.mutate()}
                    disabled={scanRunMutation.isPending}
                    className="gap-2"
                  >
                    {scanRunMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...(~30s)</>
                    ) : (
                      <><RefreshCw className="w-4 h-4" /> Run Scan Now</>
                    )}
                  </Button>
                  {scanHistoryData && scanHistoryData[0] && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Last run: {new Date(scanHistoryData[0].runAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Latest scan leads */}
            {latestScanLeads && latestScanLeads.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Latest Scan Results
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{latestScanLeads.length} leads</Badge>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {latestScanLeads.map((lead: any) => (
                    <Card key={lead.id} className="border-border bg-card/80 hover:border-primary/40 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{lead.companyName}</p>
                            <p className="text-xs text-muted-foreground truncate">{lead.industry ?? "AI"} · {lead.fundingStage ?? "Unknown"}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <ScoreBadge score={lead.score ?? 0} />
                              <StageBadge stage={lead.pipelineStage ?? "New"} />
                            </div>
                            {lead.lektraFitReason && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{lead.lektraFitReason}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Scan history */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                Scan History
              </h2>
              {scanHistoryLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}
              {!scanHistoryLoading && (!scanHistoryData || scanHistoryData.length === 0) && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No scans run yet. Click "Run Scan Now" to start.
                </div>
              )}
              {scanHistoryData && scanHistoryData.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Run At</th>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Trigger</th>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Found</th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Added</th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Skipped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanHistoryData.map((run: any) => (
                        <tr key={run.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                          <td className="p-3 text-xs text-foreground">{new Date(run.runAt).toLocaleString()}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs capitalize">{run.trigger}</Badge>
                          </td>
                          <td className="p-3">
                            {run.status === "completed" ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                              </span>
                            ) : run.status === "failed" ? (
                              <span className="flex items-center gap-1 text-xs text-red-400">
                                <XCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-yellow-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right text-xs text-muted-foreground">{run.found}</td>
                          <td className="p-3 text-right">
                            <span className={`text-xs font-semibold ${run.added > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                              {run.added}
                            </span>
                          </td>
                          <td className="p-3 text-right text-xs text-muted-foreground">{run.skipped}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Discover tab content */}
        {activeTab === "discover" && (<>

        {/* Filters */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Keyword</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="e.g. inference, robotics..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">GPU Use Case</Label>
                <Select value={gpuUseCase} onValueChange={setGpuUseCase}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All use cases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All use cases</SelectItem>
                    {(filterOpts?.gpuUseCases ?? []).map((uc) => (
                      <SelectItem key={uc} value={uc}>{GPU_LABELS[uc] ?? uc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Funding Stage</Label>
                <Select value={fundingStage} onValueChange={setFundingStage}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {FUNDING_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All industries</SelectItem>
                    {(filterOpts?.industries ?? []).map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lead type selector for adding leads */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Add as:</span>
          {(["Prospect", "Partner", "Investor", "Other"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDiscoverLeadType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                discoverLeadType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Enriched results */}
        {sortedEnriched.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI-Analyzed Results
                <Badge className="bg-primary/20 text-primary border-primary/30">{sortedEnriched.length}</Badge>
              </h2>
              <p className="text-xs text-muted-foreground">Sorted by Lektra fit score</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sortedEnriched.map((company) => (
                <EnrichedCard
                  key={company.slug}
                  company={company}
                  onAddToLeads={handleAddToLeads}
                  isAdding={createLeadMutation.isPending}
                  alreadyAdded={addedSet.has(company.slug)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Unenriched seeds */}
        {unenrichedSeeds.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                {sortedEnriched.length > 0 ? "Remaining Companies" : "Matching Companies"}
                <Badge variant="outline">{unenrichedSeeds.length}</Badge>
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchEnrich}
                disabled={batchEnriching || unenrichedSeeds.length === 0}
                className="text-xs h-8"
              >
                {batchEnriching ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Analyzing 5...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1.5 text-primary" />
                    Analyze Next 5
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click any company card or "Analyze" to run live LinkedIn enrichment + AI fit scoring.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {unenrichedSeeds.map((company) => (
                <SeedCard
                  key={company.slug}
                  company={company}
                  onEnrich={handleEnrich}
                  isEnriching={enrichingSet.has(company.slug)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!seedLoading && seeds.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No companies match your filters</p>
            <p className="text-sm text-muted-foreground mt-1">Try broadening your search criteria</p>
            <Button variant="outline" className="mt-4" onClick={() => { setKeyword(""); setGpuUseCase("all"); setFundingStage("all"); setIndustry("all"); }}>
              Clear Filters
            </Button>
          </div>
        )}

        {seedLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        </>)}

        {/* GTC Strategy Panel */}
        {activeTab === "gtc" && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  GTC 2026 Strategy Targets
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  34 curated targets — sponsors, speakers, and exhibitors prioritized by GPU spend potential for Lektra.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "Must Meet", "High Value", "Worth Visiting"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setGtcTier(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      gtcTier === t
                        ? t === "Must Meet" ? "bg-red-500/20 text-red-400 border-red-500/40"
                          : t === "High Value" ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : t === "Worth Visiting" ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                          : "bg-primary/20 text-primary border-primary/40"
                        : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {t === "all" ? "All Tiers" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Lead type selector for GTC adds */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Add as:</span>
              {(["Prospect", "Partner", "Investor", "Other"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGtcLeadType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    gtcLeadType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search companies, contacts..."
                value={gtcSearch}
                onChange={(e) => setGtcSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Targets list */}
            {gtcLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !gtcTargets || gtcTargets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">No targets found.</div>
            ) : (
              <div className="space-y-3">
                {gtcTargets.map((target) => {
                  const isExpanded = gtcExpandedId === target.id;
                  const isAdded = !!target.addedToLeadsId;
                  const tierColor = target.priorityTier === "Must Meet"
                    ? "text-red-400 bg-red-500/10 border-red-500/30"
                    : target.priorityTier === "High Value"
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                    : "text-blue-400 bg-blue-500/10 border-blue-500/30";
                  return (
                    <Card key={target.id} className={`border-border bg-card transition-all ${
                      target.priorityTier === "Must Meet" ? "border-l-2 border-l-red-500" :
                      target.priorityTier === "High Value" ? "border-l-2 border-l-amber-500" :
                      "border-l-2 border-l-blue-500"
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground text-sm">{target.companyName}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tierColor}`}>
                                {target.priorityTier}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                {target.type}
                              </span>
                              {target.priorityScore >= 90 && (
                                <span className="text-xs text-amber-400 flex items-center gap-0.5">
                                  <Zap className="w-3 h-3" /> Score {target.priorityScore}
                                </span>
                              )}
                              {/* Per-card lead type badge */}
                              {(gtcCardLeadTypes[target.id] ?? gtcLeadType) !== "Prospect" && (
                                <LeadTypeBadge type={gtcCardLeadTypes[target.id] ?? gtcLeadType} />
                              )}
                            </div>
                            {target.contactName && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium text-foreground/80">{target.contactName}</span>
                                {target.contactTitle && <span className="ml-1">· {target.contactTitle}</span>}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{target.description}</p>
                            {target.gpuFitReason && (
                              <p className="text-xs text-primary/80 mt-1.5 italic">💡 {target.gpuFitReason}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            {/* Per-card type selector */}
                            {!isAdded && (
                              <select
                                value={gtcCardLeadTypes[target.id] ?? gtcLeadType}
                                onChange={(e) => setGtcCardLeadTypes((prev) => ({ ...prev, [target.id]: e.target.value as "Prospect" | "Partner" | "Investor" | "Other" }))}
                                className="text-xs bg-secondary border border-border rounded px-1.5 py-1 text-foreground cursor-pointer"
                              >
                                <option value="Prospect">Prospect</option>
                                <option value="Partner">Partner</option>
                                <option value="Investor">Investor</option>
                                <option value="Other">Other</option>
                              </select>
                            )}
                            {isAdded ? (
                              <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> In Pipeline
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => addToPipelineMutation.mutate({ targetId: target.id, leadType: gtcCardLeadTypes[target.id] ?? gtcLeadType })}
                                disabled={addToPipelineMutation.isPending}
                              >
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                Add
                              </Button>
                            )}
                            <button
                              onClick={() => setGtcExpandedId(isExpanded ? null : target.id)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              Notes
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-2">
                            <Label className="text-xs text-muted-foreground">Strategy Notes</Label>
                            <textarea
                              className="w-full text-sm bg-secondary/50 border border-border rounded-lg p-2.5 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                              rows={3}
                              placeholder="Add your approach notes, talking points, or reminders..."
                              value={gtcNotesMap[target.id] ?? target.notes ?? ""}
                              onChange={(e) => setGtcNotesMap((prev) => ({ ...prev, [target.id]: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => updateNotesMutation.mutate({
                                  targetId: target.id,
                                  notes: gtcNotesMap[target.id] ?? target.notes ?? "",
                                })}
                                disabled={updateNotesMutation.isPending}
                              >
                                Save Notes
                              </Button>
                              {target.website && (
                                <a href={target.website} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                    <ExternalLink className="w-3 h-3" /> Website
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
