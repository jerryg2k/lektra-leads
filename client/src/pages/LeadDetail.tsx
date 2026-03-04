import DashboardLayout from "@/components/DashboardLayout";
import { FundingBadge, GpuRecommendBadge, GpuUseCaseTag, ScoreBadge, StageBadge } from "@/components/LeadBadges";
import { CompletenessBar } from "@/pages/LeadsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Bell,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Cpu,
  ExternalLink,
  Globe,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const PIPELINE_STAGES = ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"] as const;
const NOTE_TYPES = ["Note", "Call", "Email", "Meeting", "Follow-up"] as const;

const NOTE_TEMPLATES: { label: string; type: string; text: string }[] = [
  { label: "Left voicemail", type: "Call", text: "Left voicemail — introduced Lektra Cloud GPU rental offering. Mentioned 30-50% savings vs hyperscalers. Will follow up in 2 days." },
  { label: "Sent intro email", type: "Email", text: "Sent intro email introducing Lektra Cloud and our H200/RTX Pro 6000 GPU rental offering. Highlighted edge deployment, no egress fees, and solar-powered infrastructure." },
  { label: "Sent LinkedIn note", type: "Note", text: "Sent LinkedIn Sales Navigator connection request with personalized note about GPU cost savings." },
  { label: "Demo scheduled", type: "Meeting", text: "Demo scheduled for [DATE] at [TIME]. Will cover H200 performance benchmarks, pricing vs AWS/Azure, and edge deployment options." },
  { label: "Demo completed", type: "Meeting", text: "Demo completed. Covered H200/RTX Pro 6000 specs, 30-50% cost advantage, no egress fees, and solar-powered edge locations. Next step: [ACTION]." },
  { label: "Interested — follow up", type: "Follow-up", text: "Expressed interest in GPU rental pricing. Requested detailed quote for [USE_CASE] workloads. Follow up with pricing deck." },
  { label: "Not interested", type: "Note", text: "Not interested at this time. Reason: [REASON]. Revisit in [TIMEFRAME]." },
  { label: "Referred to colleague", type: "Note", text: "Referred to [NAME] at [COMPANY] who handles infrastructure decisions. Will follow up with them directly." },
  { label: "Pricing discussion", type: "Call", text: "Pricing discussion — reviewed H200 and RTX Pro 6000 rates. Compared against current AWS/Azure spend. Potential savings of [X]% identified. Sending formal quote." },
  { label: "Contract sent", type: "Email", text: "Sent contract and MSA for GPU rental agreement. Requested review and signature by [DATE]." },
];

// ─── Follow-Up Scheduler ──────────────────────────────────────────────────────
function FollowUpButton({ leadId, currentFollowUpAt, currentNote }: {
  leadId: number;
  currentFollowUpAt?: Date | null;
  currentNote?: string | null;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(
    currentFollowUpAt
      ? new Date(currentFollowUpAt).toISOString().split("T")[0]
      : ""
  );
  const [note, setNote] = useState(currentNote ?? "");

  const setFollowUpMutation = trpc.leads.setFollowUp.useMutation({
    onSuccess: () => {
      utils.leads.get.invalidate({ id: leadId });
      utils.leads.overdueFollowUps.invalidate();
      toast.success(date ? `Follow-up scheduled for ${new Date(date + "T12:00:00").toLocaleDateString()}` : "Follow-up cleared");
      setOpen(false);
    },
    onError: (e) => toast.error("Failed to set follow-up: " + e.message),
  });

  const isOverdue = currentFollowUpAt && new Date(currentFollowUpAt) < new Date();
  const isDueToday = currentFollowUpAt && (() => {
    const d = new Date(currentFollowUpAt);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 border-border text-xs ${
            isOverdue ? "border-red-500 text-red-400 hover:bg-red-500/10" :
            isDueToday ? "border-amber-500 text-amber-400 hover:bg-amber-500/10" :
            currentFollowUpAt ? "border-primary text-primary hover:bg-primary/10" : ""
          }`}
          title="Schedule a follow-up reminder"
        >
          <Bell className="h-3 w-3" />
          {currentFollowUpAt
            ? (isOverdue ? "Overdue" : isDueToday ? "Due Today" : new Date(currentFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }))
            : "Follow-up"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Schedule Follow-up
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-sm">Follow-up Date</Label>
            <Input
              type="date"
              value={date}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setDate(e.target.value)}
              className="bg-secondary border-border"
            />
            <div className="flex gap-2 mt-1">
              {[1, 3, 5, 7, 14].map(days => (
                <button key={days} onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  setDate(d.toISOString().split("T")[0]);
                }} className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  +{days}d
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Send pricing deck, follow up on demo interest..."
              className="bg-secondary border-border text-sm h-20 resize-none"
            />
          </div>
          <div className="flex gap-2">
            {currentFollowUpAt && (
              <Button variant="outline" size="sm" className="text-muted-foreground border-border"
                onClick={() => setFollowUpMutation.mutate({ id: leadId, followUpAt: null })}
                disabled={setFollowUpMutation.isPending}>
                Clear
              </Button>
            )}
            <Button size="sm" className="flex-1"
              onClick={() => setFollowUpMutation.mutate({ id: leadId, followUpAt: date || null, followUpNote: note || undefined })}
              disabled={setFollowUpMutation.isPending || !date}>
              {setFollowUpMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Save Follow-up
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LeadDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: lead, isLoading } = trpc.leads.get.useQuery({ id });
  const { data: contacts } = trpc.contacts.listByLead.useQuery({ leadId: id });
  const { data: notes } = trpc.notes.listByLead.useQuery({ leadId: id });
  const [noteRefreshKey, setNoteRefreshKey] = useState(0);

  const updateStageMutation = trpc.leads.updateStage.useMutation({
    onSuccess: () => {
      utils.leads.get.invalidate({ id });
      utils.leads.pipelineStats.invalidate();
      toast.success("Pipeline stage updated");
    },
  });

  const rescoreMutation = trpc.leads.rescore.useMutation({
    onSuccess: ({ score }) => {
      utils.leads.get.invalidate({ id });
      utils.leads.list.invalidate();
      toast.success(`Lead re-scored: ${score}/100`);
    },
  });

  const reEnrichMutation = trpc.leads.reEnrich.useMutation({
    onSuccess: ({ updatedCount, fieldsUpdated }) => {
      utils.leads.get.invalidate({ id });
      utils.leads.list.invalidate();
      if (updatedCount > 0) {
        toast.success(`Re-enriched: ${updatedCount} field${updatedCount !== 1 ? "s" : ""} updated (${fieldsUpdated.join(", ")})`);
      } else {
        toast.info("All fields already complete — nothing new to fill in.");
      }
    },
    onError: (err) => toast.error("Re-enrich failed: " + err.message),
  });

  const deleteMutation = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead archived");
      setLocation("/leads");
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Lead not found.</p>
          <Button variant="ghost" onClick={() => setLocation("/leads")} className="mt-4">
            Back to Leads
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const breakdown = lead.scoreBreakdown as Record<string, number> | null;
  const gpuUseCases = (lead.gpuUseCases as string[] | null) ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-5 pb-10">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/leads")}
            className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Leads
          </Button>
        </div>

        {/* Company Header Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-2xl font-black text-primary">
                  {lead.companyName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{lead.companyName}</h1>
                  <ScoreBadge score={lead.score ?? 0} />
                  <GpuRecommendBadge gpu={lead.recommendedGpu ?? "TBD"} />
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {lead.industry && (
                    <span className="text-sm text-muted-foreground">{lead.industry}</span>
                  )}
                  {lead.location && (
                    <span className="text-sm text-muted-foreground">· {lead.location}</span>
                  )}
                  {lead.headcount && (
                    <span className="text-sm text-muted-foreground">· {lead.headcount} employees</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {lead.fundingStage && lead.fundingStage !== "Unknown" && (
                    <FundingBadge stage={lead.fundingStage} />
                  )}
                  {lead.totalFunding && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {lead.totalFunding}
                    </span>
                  )}
                  {lead.source && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {lead.source}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <CompletenessBar score={(lead as any).completenessScore ?? 0} />
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {/* Pipeline Stage */}
                <Select
                  value={lead.pipelineStage ?? "New"}
                  onValueChange={(stage) =>
                    updateStageMutation.mutate({ id, stage: stage as any })
                  }
                >
                  <SelectTrigger className="w-40 bg-secondary border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border text-xs"
                    onClick={() => reEnrichMutation.mutate({ id })}
                    disabled={reEnrichMutation.isPending}
                    title="Re-fetch company data from LinkedIn & AI"
                  >
                    {reEnrichMutation.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Sparkles className="h-3 w-3" />}
                    {reEnrichMutation.isPending ? "Enriching..." : "Re-enrich"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border text-xs"
                    onClick={() => rescoreMutation.mutate({ id })}
                    disabled={rescoreMutation.isPending}
                  >
                    <RefreshCw className={`h-3 w-3 ${rescoreMutation.isPending ? "animate-spin" : ""}`} />
                    Re-score
                  </Button>
                  <FollowUpButton
                    leadId={id}
                    currentFollowUpAt={(lead as any).followUpAt}
                    currentNote={(lead as any).followUpNote}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Archive this lead?")) deleteMutation.mutate({ id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <EmailDraftButton leadId={id} contacts={contacts ?? []} />
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {lead.website && (
                <a
                  href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}
              {lead.linkedinUrl && (
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}
            </div>

            {lead.description && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{lead.description}</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* GPU Use Case Analysis */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                GPU Use Case Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {gpuUseCases.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {gpuUseCases.map((uc) => <GpuUseCaseTag key={uc} useCase={uc} />)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No GPU use cases identified yet.</p>
              )}

              {lead.techStack && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">Tech Stack</p>
                  <p className="text-sm text-foreground">{lead.techStack}</p>
                </div>
              )}

              {lead.aiProducts && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">AI Products</p>
                  <p className="text-sm text-foreground">{lead.aiProducts}</p>
                </div>
              )}

              {lead.estimatedGpuSpend && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">Estimated GPU Spend</p>
                  <p className="text-sm text-foreground font-semibold">{lead.estimatedGpuSpend}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Score Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {breakdown ? (
                Object.entries({
                  gpuUseCases: { label: "GPU Use Cases", max: 30 },
                  fundingStage: { label: "Funding Stage", max: 20 },
                  industryFit: { label: "Industry Fit", max: 20 },
                  headcountSignal: { label: "Team Size Signal", max: 15 },
                  techStackSignal: { label: "Tech Stack Signal", max: 15 },
                }).map(([key, { label, max }]) => {
                  const val = breakdown[key] ?? 0;
                  const pct = Math.round((val / max) * 100);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold text-foreground">{val}/{max}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No score breakdown available. Click Re-score.</p>
              )}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Total Score</span>
                <ScoreBadge score={lead.score ?? 0} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lektra Value Proposition Match */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Lektra Value Proposition Match
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
              <GpuRecommendBadge gpu={lead.recommendedGpu ?? "TBD"} />
              <div className="text-sm">
                <p className="text-foreground font-medium">Recommended GPU</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {lead.recommendedGpu === "H200" && "141 GB VRAM · $2.79/hr · Best for large model training & fine-tuning"}
                  {lead.recommendedGpu === "RTX Pro 6000" && "96 GB VRAM · $1.39/hr · Best for inference & remote visualization"}
                  {lead.recommendedGpu === "B200" && "Coming soon · Next-gen Blackwell architecture · Best for frontier model training"}
                  {lead.recommendedGpu === "Multiple" && "Multiple GPU types recommended based on mixed workload profile"}
                  {lead.recommendedGpu === "TBD" && "Needs further qualification to determine GPU fit"}
                </p>
              </div>
            </div>

            {lead.lektraFitReason && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Fit Analysis</p>
                <p className="text-sm text-foreground leading-relaxed">{lead.lektraFitReason}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Cost Advantage", value: "30–50% cheaper than AWS/Azure/GCP" },
                { label: "Zero Egress Fees", value: "No data transfer costs" },
                { label: "Edge Deployment", value: "Solar-powered, lower latency" },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 bg-secondary/50 rounded-xl border border-border">
                  <p className="text-xs text-primary font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Key Contacts
            </CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-border text-xs">
                  <Plus className="h-3 w-3" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Add Contact</DialogTitle>
                </DialogHeader>
                <AddContactForm
                  leadId={id}
                  onSuccess={() => {
                    utils.contacts.listByLead.invalidate({ leadId: id });
                    toast.success("Contact added");
                  }}
                />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {!contacts || contacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No contacts yet. Add founders and leadership team members.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onDelete={() => utils.contacts.listByLead.invalidate({ leadId: id })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity / Notes */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddNoteForm
              leadId={id}
              onSuccess={() => utils.notes.listByLead.invalidate({ leadId: id })}
              onNoteAdded={() => setNoteRefreshKey(k => k + 1)}
            />
            {notes && notes.length > 0 && (
              <div className="space-y-2 mt-2">
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onUpdated={() => utils.notes.listByLead.invalidate({ leadId: id })}
                    onDeleted={() => utils.notes.listByLead.invalidate({ leadId: id })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Strategy Advisor */}
        <StrategyAdvisorCard leadId={id} refreshKey={noteRefreshKey} />

        {/* Email Sequences */}
        <EmailSequenceCard leadId={id} contacts={contacts ?? []} />

      </div>
    </DashboardLayout>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({
  contact,
  onDelete,
}: {
  contact: any;
  onDelete: () => void;
}) {
  const deleteContact = trpc.contacts.delete.useMutation({ onSuccess: onDelete });
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown";

  return (
    <div className="flex items-start gap-3 p-3 bg-secondary/40 rounded-xl border border-border hover:border-primary/30 transition-all">
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-primary">
          {(contact.firstName ?? "?").charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground">{fullName}</span>
          {contact.isPrimary && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Star className="h-2.5 w-2.5" /> Primary
            </span>
          )}
        </div>
        {contact.title && (
          <p className="text-xs text-muted-foreground mt-0.5">{contact.title}</p>
        )}
        {contact.fitReason && (
          <p className="text-xs text-muted-foreground mt-1 italic leading-relaxed">
            "{contact.fitReason}"
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {contact.phone}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => deleteContact.mutate({ id: contact.id })}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Add Contact Form ─────────────────────────────────────────────────────────

function AddContactForm({ leadId, onSuccess }: { leadId: number; onSuccess: () => void }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    title: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    fitReason: "",
    isPrimary: false,
  });
  const utils = trpc.useUtils();
  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      // If server will auto-enrich (no linkedinUrl provided), show enrichment toast
      if (data.enriched) {
        toast.info("Contact saved — looking up LinkedIn profile...", { duration: 3000 });
        // Refresh contacts after a short delay to pick up enriched data
        setTimeout(() => {
          utils.contacts.listByLead.invalidate({ leadId });
        }, 4000);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createMutation.mutate({ leadId, ...form });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">First Name</Label>
          <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="mt-1 bg-secondary border-border" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Last Name</Label>
          <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="mt-1 bg-secondary border-border" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Title / Role</Label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. CEO & Co-Founder" className="mt-1 bg-secondary border-border" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">LinkedIn URL</Label>
        <Input value={form.linkedinUrl} onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." className="mt-1 bg-secondary border-border" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Email</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 bg-secondary border-border" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Why a good fit for Lektra outreach</Label>
        <Textarea value={form.fitReason} onChange={(e) => setForm((f) => ({ ...f, fitReason: e.target.value }))} placeholder="e.g. Decision-maker for infrastructure spend, previously worked at NVIDIA..." className="mt-1 bg-secondary border-border resize-none" rows={2} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPrimary"
          checked={form.isPrimary}
          onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
          className="rounded border-border"
        />
        <Label htmlFor="isPrimary" className="text-xs text-muted-foreground cursor-pointer">Primary contact</Label>
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Adding..." : "Add Contact"}
      </Button>
    </form>
  );
}

// ─── Email Draft Modal ───────────────────────────────────────────────────────

type DraftResult = {
  subject: string;
  body: string;
  contactEmail: string;
  linkedinUrl: string;
  isLinkedIn: boolean;
  charCount: number | null;
};

const LI_MAX = 300;

function EmailDraftButton({ leadId, contacts }: { leadId: number; contacts: any[] }) {
  const [open, setOpen] = useState(false);
  // "email" tab or "linkedin" tab
  const [activeTab, setActiveTab] = useState<"email" | "linkedin">("email");
  const [emailType, setEmailType] = useState<"cold_intro" | "follow_up" | "demo_request">("cold_intro");
  const [selectedContactId, setSelectedContactId] = useState<string>("primary");
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Derive char count live as user edits the LinkedIn note
  const liCharCount = draft?.isLinkedIn ? draft.body.length : 0;
  const liOver = liCharCount > LI_MAX;
  const liNearLimit = liCharCount >= 260 && !liOver;

  const draftMutation = trpc.leads.draftEmail.useMutation({
    onSuccess: (data) => {
      setDraft({
        subject: data.subject,
        body: data.body,
        contactEmail: data.contactEmail,
        linkedinUrl: data.linkedinUrl,
        isLinkedIn: data.isLinkedIn,
        charCount: data.charCount,
      });
    },
    onError: (err) => {
      toast.error("Failed to generate draft: " + err.message);
    },
  });

  const sendGmailMutation = trpc.leads.sendGmail.useMutation({
    onSuccess: () => {
      toast.success("Email saved as Gmail draft! Check your Gmail Drafts folder.");
    },
    onError: (err: { message: string }) => {
      toast.error("Gmail send failed: " + err.message);
    },
  });

  const handleGenerate = () => {
    const contactId = selectedContactId !== "primary" ? parseInt(selectedContactId, 10) : undefined;
    const type = activeTab === "linkedin" ? "linkedin_connect" : emailType;
    draftMutation.mutate({ leadId, contactId, emailType: type });
  };

  const handleCopy = () => {
    if (!draft) return;
    const text = draft.isLinkedIn ? draft.body : `Subject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(draft.isLinkedIn ? "LinkedIn note copied!" : "Email copied to clipboard");
  };

  const handleSendGmail = () => {
    if (!draft) return;
    sendGmailMutation.mutate({ to: draft.contactEmail || "", subject: draft.subject, body: draft.body });
  };

  const EMAIL_TYPE_LABELS: Record<string, string> = {
    cold_intro: "Cold Intro",
    follow_up: "Follow-up",
    demo_request: "Demo Request",
  };

  // Build Sales Navigator search URL for the contact
  const getLinkedInUrl = () => {
    if (draft?.linkedinUrl) return draft.linkedinUrl;
    // Fall back to Sales Navigator people search
    const selectedContact = contacts.find((c) => String(c.id) === selectedContactId);
    if (selectedContact?.linkedinUrl) return selectedContact.linkedinUrl;
    return "https://www.linkedin.com/sales/search/people";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setDraft(null); setActiveTab("email"); } }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-xs mt-1"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Draft Outreach
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            AI Outreach Draft Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-secondary rounded-xl">
            <button
              onClick={() => { setActiveTab("email"); setDraft(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              Email Draft
            </button>
            <button
              onClick={() => { setActiveTab("linkedin"); setDraft(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "linkedin"
                  ? "bg-[#0077B5]/20 text-[#0ea5e9] shadow-sm border border-[#0077B5]/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn Connect
              <span className="text-[10px] bg-[#0077B5]/20 text-[#0ea5e9] px-1.5 py-0.5 rounded-full font-semibold">300 chars</span>
            </button>
          </div>

          {/* Contact selector — shared */}
          <div className="grid grid-cols-2 gap-3">
            {activeTab === "email" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Email Type</Label>
                <Select value={emailType} onValueChange={(v) => setEmailType(v as any)}>
                  <SelectTrigger className="bg-secondary border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="cold_intro">Cold Introduction</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="demo_request">Demo Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeTab === "linkedin" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Message Style</Label>
                <div className="flex items-center h-10 px-3 bg-secondary border border-border rounded-md text-sm text-muted-foreground">
                  Connection Request Note
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Contact</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger className="bg-secondary border-border text-sm">
                  <SelectValue placeholder="Primary contact" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="primary">Primary Contact</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}
                      {c.title ? ` · ${c.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* LinkedIn info banner */}
          {activeTab === "linkedin" && (
            <div className="flex items-start gap-2 p-3 bg-[#0077B5]/10 border border-[#0077B5]/20 rounded-xl">
              <Linkedin className="h-4 w-4 text-[#0ea5e9] mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-[#0ea5e9] font-semibold">Sales Navigator connection notes are limited to 300 characters.</span>{" "}
                The AI will write a punchy, personalized message referencing their specific GPU use case and Lektra's cost advantage — tailored to fit exactly within the limit.
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={draftMutation.isPending}
            className={`w-full gap-2 ${
              activeTab === "linkedin"
                ? "bg-[#0077B5] hover:bg-[#0077B5]/90 text-white"
                : ""
            }`}
          >
            {draftMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating with AI...</>
            ) : activeTab === "linkedin" ? (
              <><Linkedin className="h-4 w-4" /> Generate LinkedIn Note</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate {EMAIL_TYPE_LABELS[emailType]} Email</>
            )}
          </Button>

          {/* Draft Output */}
          {draft && (
            <div className="space-y-3">
              {/* Email: show subject */}
              {!draft.isLinkedIn && (
                <div className="p-3 bg-secondary/50 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Subject Line</p>
                  <p className="text-sm font-semibold text-foreground">{draft.subject}</p>
                </div>
              )}

              {/* LinkedIn: char counter */}
              {draft.isLinkedIn && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Connection Note (editable)</Label>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                    liOver
                      ? "bg-red-500/20 text-red-400"
                      : liNearLimit
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-green-500/20 text-green-400"
                  }`}>
                    {liCharCount} / {LI_MAX}
                    {liOver && " ⚠ Over limit!"}
                  </span>
                </div>
              )}

              {!draft.isLinkedIn && (
                <Label className="text-xs text-muted-foreground block">Email Body (editable)</Label>
              )}

              <Textarea
                value={draft.body}
                onChange={(e) => {
                  const val = draft.isLinkedIn ? e.target.value.slice(0, 300) : e.target.value;
                  setDraft((d) => d ? { ...d, body: val } : null);
                }}
                className={`bg-secondary border-border text-sm font-mono leading-relaxed resize-none ${
                  liOver ? "border-red-500/50" : ""
                }`}
                rows={draft.isLinkedIn ? 5 : 12}
                maxLength={draft.isLinkedIn ? 300 : undefined}
              />

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-border flex-1"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>

                {draft.isLinkedIn ? (
                  <a
                    href={getLinkedInUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 w-full bg-[#0077B5]/10 border-[#0077B5]/30 text-[#0ea5e9] hover:bg-[#0077B5]/20"
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                      Open in Sales Navigator
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Button>
                  </a>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 flex-1"
                    onClick={handleSendGmail}
                    disabled={sendGmailMutation.isPending || !draft.contactEmail}
                    title={!draft.contactEmail ? "No email address on file for this contact" : ""}
                  >
                    {sendGmailMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Save to Gmail Drafts
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={handleGenerate}
                  disabled={draftMutation.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${draftMutation.isPending ? "animate-spin" : ""}`} />
                  Retry
                </Button>
              </div>

              {/* Hints */}
              {!draft.isLinkedIn && !draft.contactEmail && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  No email address on file for this contact. Add one to enable Gmail send.
                </p>
              )}
              {draft.isLinkedIn && (
                <p className="text-xs text-muted-foreground bg-secondary/50 border border-border rounded-lg px-3 py-2">
                  <span className="font-semibold text-[#0ea5e9]">How to use:</span> Copy the note above, click "Open in Sales Navigator", find the contact, click Connect, paste the note into the message field, and send.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Note Card (edit / delete / word-wrap) ───────────────────────────────────

function NoteCard({ note, onUpdated, onDeleted }: { note: any; onUpdated: () => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content as string);
  const [editType, setEditType] = useState<string>(note.noteType ?? "Note");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMutation = trpc.notes.update.useMutation({
    onSuccess: () => { setEditing(false); onUpdated(); toast.success("Note updated"); },
    onError: () => toast.error("Failed to update note"),
  });
  const deleteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => { setConfirmDelete(false); onDeleted(); toast.success("Note deleted"); },
    onError: () => toast.error("Failed to delete note"),
  });

  return (
    <div className="p-3 bg-secondary/50 rounded-xl border border-border group">
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select value={editType} onValueChange={setEditType}>
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="text-sm min-h-[80px] resize-y"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: note.id, content: editContent, noteType: editType as any })}
            >
              {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(false); setEditContent(note.content); setEditType(note.noteType ?? "Note"); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {note.noteType}
              </span>
              <span className="text-xs text-muted-foreground">{note.authorName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</span>
              <button
                onClick={() => setEditing(true)}
                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                title="Edit note"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-red-400">Delete?</span>
                  <button onClick={() => deleteMutation.mutate({ id: note.id })} className="text-xs text-red-400 hover:text-red-300 font-semibold px-1">
                    {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground px-1">No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{note.content}</p>
        </>
      )}
    </div>
  );
}

// ─── Add Note Form ────────────────────────────────────────────────────────────

function AddNoteForm({ leadId, onSuccess, onNoteAdded }: { leadId: number; onSuccess: () => void; onNoteAdded?: () => void }) {
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<string>("Note");
  const [showTemplates, setShowTemplates] = useState(false);
  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => { setContent(""); onSuccess(); onNoteAdded?.(); },
  });

  const applyTemplate = (tpl: typeof NOTE_TEMPLATES[0]) => {
    setContent(tpl.text);
    setNoteType(tpl.type);
    setShowTemplates(false);
  };

  return (
    <div className="space-y-2">
      {/* Template picker */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded border border-border bg-secondary"
        >
          <Wand2 className="h-3 w-3" />
          Quick Templates
          <ChevronDown className={`h-3 w-3 transition-transform ${showTemplates ? "rotate-180" : ""}`} />
        </button>
      </div>
      {showTemplates && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2 bg-secondary rounded-lg border border-border">
          {NOTE_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
            >
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide w-12 shrink-0">{tpl.type}</span>
              <span>{tpl.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Select value={noteType} onValueChange={setNoteType}>
          <SelectTrigger className="w-32 bg-secondary border-border text-xs h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {NOTE_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note, call log, or follow-up... (Shift+Enter for new line, Enter to save)"
          className="flex-1 bg-secondary border-border text-sm min-h-[72px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && content.trim()) {
              e.preventDefault();
              createMutation.mutate({ leadId, content, noteType: noteType as any });
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => {
            if (content.trim()) createMutation.mutate({ leadId, content, noteType: noteType as any });
          }}
          disabled={!content.trim() || createMutation.isPending}
          className="h-9 self-end"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── AI Strategy Advisor ─────────────────────────────────────────────────────

function StrategyAdvisorCard({ leadId, refreshKey }: { leadId: number; refreshKey?: number }) {
  const [strategy, setStrategy] = useState<string | null>(null);
  const [lastRefreshKey, setLastRefreshKey] = useState<number | undefined>(undefined);
  const analyzeMutation = trpc.notes.analyzeStrategy.useMutation({
    onSuccess: (data) => { setStrategy(data.strategy); toast.success("Strategy updated based on latest notes"); },
    onError: () => toast.error("Strategy analysis failed. Please try again."),
  });

  // Auto-refresh strategy when a new note is saved (if strategy was already generated)
  if (refreshKey !== undefined && refreshKey !== lastRefreshKey && strategy !== null && !analyzeMutation.isPending) {
    setLastRefreshKey(refreshKey);
    analyzeMutation.mutate({ leadId });
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Strategy Advisor
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-border text-xs"
            onClick={() => analyzeMutation.mutate({ leadId })}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</>
            ) : (
              <><Wand2 className="h-3 w-3" /> {strategy ? "Re-analyze" : "Analyze Strategy"}</>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Reads your activity notes and generates a tailored outreach strategy for this prospect.
        </p>
      </CardHeader>
      {strategy && (
        <CardContent>
          <div className="prose prose-sm prose-invert max-w-none text-foreground">
            {strategy.split("\n").map((line, i) => {
              if (line.startsWith("## ")) {
                return (
                  <h3 key={i} className="text-sm font-semibold text-primary mt-4 mb-1 first:mt-0">
                    {line.replace("## ", "")}
                  </h3>
                );
              }
              if (line.startsWith("- ") || line.startsWith("• ")) {
                return (
                  <p key={i} className="text-sm text-foreground flex gap-2 mb-1">
                    <span className="text-primary shrink-0">•</span>
                    <span>{line.replace(/^[-•]\s/, "")}</span>
                  </p>
                );
              }
              if (line.trim() === "") return <div key={i} className="h-1" />;
              return <p key={i} className="text-sm text-foreground mb-1 leading-relaxed">{line}</p>;
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-border text-xs"
              onClick={() => {
                navigator.clipboard.writeText(strategy);
                toast.success("Strategy copied to clipboard");
              }}
            >
              <Clipboard className="h-3 w-3" /> Copy
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Email Sequence Card ─────────────────────────────────────────────────────

function EmailSequenceCard({ leadId, contacts }: { leadId: number; contacts: any[] }) {
  const [open, setOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("none");
  const utils = trpc.useUtils();

  const { data: sequences, isLoading } = trpc.sequences.listByLead.useQuery({ leadId });

  const createMutation = trpc.sequences.create.useMutation({
    onSuccess: () => {
      utils.sequences.listByLead.invalidate({ leadId });
      toast.success("3-email sequence generated! Review and send when ready.");
      setOpen(false);
    },
    onError: () => toast.error("Failed to generate sequence. Please try again."),
  });

  const updateStatusMutation = trpc.sequences.updateStatus.useMutation({
    onSuccess: () => utils.sequences.listByLead.invalidate({ leadId }),
  });

  const updateBodyMutation = trpc.sequences.updateBody.useMutation({
    onSuccess: () => utils.sequences.listByLead.invalidate({ leadId }),
  });

  const deleteStepMutation = trpc.sequences.deleteStep.useMutation({
    onSuccess: () => { utils.sequences.listByLead.invalidate({ leadId }); toast.success("Step deleted"); },
    onError: () => toast.error("Failed to delete step"),
  });

  const deleteAllMutation = trpc.sequences.deleteAll.useMutation({
    onSuccess: () => { utils.sequences.listByLead.invalidate({ leadId }); toast.success("Sequence deleted"); },
    onError: () => toast.error("Failed to delete sequence"),
  });

  const selectedContact = contacts.find((c) => String(c.id) === selectedContactId);

  const stepLabels: Record<number, string> = {
    1: "Day 1 — Initial Outreach",
    2: "Day 4 — Follow-up #1",
    3: "Day 10 — Follow-up #2",
  };

  const statusColors: Record<string, string> = {
    Draft: "bg-secondary text-muted-foreground",
    Scheduled: "bg-blue-500/20 text-blue-400",
    Sent: "bg-green-500/20 text-green-400",
    Skipped: "bg-secondary/50 text-muted-foreground line-through",
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Email Sequence (3-Step)
          </CardTitle>
          <div className="flex items-center gap-2">
            {sequences && sequences.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => { if (confirm("Delete the entire sequence for this lead?")) deleteAllMutation.mutate({ leadId }); }}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete All
              </Button>
            )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 border-border text-xs">
                <Sparkles className="h-3 w-3" />
                {sequences && sequences.length > 0 ? "Regenerate" : "Start Sequence"}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Generate Email Sequence</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  The AI will draft 3 personalized emails (Day 1, Day 4, Day 10) in Jerry's writing style, tailored to this company's GPU use case and Lektra's value proposition.
                </p>
                <div>
                  <Label className="text-xs text-muted-foreground">Target Contact (optional)</Label>
                  <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                    <SelectTrigger className="mt-1 bg-secondary border-border">
                      <SelectValue placeholder="Select a contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific contact (generic)</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {[c.firstName, c.lastName].filter(Boolean).join(" ")} — {c.title ?? "Contact"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    createMutation.mutate({
                      leadId,
                      contactId: selectedContact?.id,
                      contactName: selectedContact
                        ? [selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(" ")
                        : undefined,
                      contactEmail: selectedContact?.email ?? undefined,
                    })
                  }
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating 3 emails...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Generate Sequence</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          AI-drafted 3-step outreach sequence in Jerry's writing style. Review, edit, and mark as sent.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : !sequences || sequences.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No sequence yet. Click "Start Sequence" to generate 3 AI-drafted emails.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sequences.sort((a, b) => a.stepNumber - b.stepNumber).map((seq) => (
              <SequenceStepCard
                key={seq.id}
                seq={seq}
                label={stepLabels[seq.stepNumber] ?? `Step ${seq.stepNumber}`}
                statusColors={statusColors}
                onStatusChange={(status) => updateStatusMutation.mutate({ id: seq.id, status })}
                onBodyChange={(subject, body) => updateBodyMutation.mutate({ id: seq.id, subject, body })}
                onDelete={() => deleteStepMutation.mutate({ id: seq.id })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SequenceStepCard({
  seq,
  label,
  statusColors,
  onStatusChange,
  onBodyChange,
  onDelete,
}: {
  seq: any;
  label: string;
  statusColors: Record<string, string>;
  onStatusChange: (status: "Draft" | "Scheduled" | "Sent" | "Skipped") => void;
  onBodyChange: (subject: string, body: string) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editSubject, setEditSubject] = useState(seq.subject);
  const [editBody, setEditBody] = useState(seq.body);
  const [editing, setEditing] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-primary shrink-0">{label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColors[seq.status] ?? ""}`}>
            {seq.status}
          </span>
          <span className="text-xs text-muted-foreground truncate hidden sm:block">{seq.subject}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
      {expanded && (
        <div className="p-3 border-t border-border space-y-3 bg-secondary/20">
          {editing ? (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="mt-1 bg-secondary border-border text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="mt-1 bg-secondary border-border text-sm resize-none" rows={8} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { onBodyChange(editSubject, editBody); setEditing(false); toast.success("Email updated"); }}>
                  <Check className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" className="border-border" onClick={() => { setEditSubject(seq.subject); setEditBody(seq.body); setEditing(false); }}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Subject</p>
                <p className="text-sm font-semibold text-foreground">{seq.subject}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Body</p>
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{seq.body}</pre>
              </div>
              {seq.scheduledAt && (
                <p className="text-xs text-muted-foreground">
                  Scheduled: {new Date(seq.scheduledAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" className="border-border text-xs gap-1" onClick={() => setEditing(true)}>
                  <Wand2 className="h-3 w-3" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="border-border text-xs gap-1" onClick={() => { navigator.clipboard.writeText(`Subject: ${seq.subject}\n\n${seq.body}`); toast.success("Copied to clipboard"); }}>
                  <Clipboard className="h-3 w-3" /> Copy
                </Button>
                {seq.status !== "Sent" && (
                  <Button size="sm" className="text-xs gap-1 bg-green-600 hover:bg-green-700" onClick={() => onStatusChange("Sent")}>
                    <Check className="h-3 w-3" /> Mark Sent
                  </Button>
                )}
                {seq.status !== "Skipped" && seq.status !== "Sent" && (
                  <Button size="sm" variant="outline" className="border-border text-xs gap-1 text-muted-foreground" onClick={() => onStatusChange("Skipped")}>
                    Skip
                  </Button>
                )}
                {confirmDelete ? (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-xs text-red-400">Delete this step?</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:text-red-300 px-2" onClick={() => { onDelete(); setConfirmDelete(false); }}>
                      Yes
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground px-2" onClick={() => setConfirmDelete(false)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="text-xs gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
