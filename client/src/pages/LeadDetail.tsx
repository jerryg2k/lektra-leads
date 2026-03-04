import DashboardLayout from "@/components/DashboardLayout";
import { FundingBadge, GpuRecommendBadge, GpuUseCaseTag, ScoreBadge, StageBadge } from "@/components/LeadBadges";
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
  Building2,
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

export default function LeadDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: lead, isLoading } = trpc.leads.get.useQuery({ id });
  const { data: contacts } = trpc.contacts.listByLead.useQuery({ leadId: id });
  const { data: notes } = trpc.notes.listByLead.useQuery({ leadId: id });

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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border text-xs flex-1"
                    onClick={() => rescoreMutation.mutate({ id })}
                    disabled={rescoreMutation.isPending}
                  >
                    <RefreshCw className={`h-3 w-3 ${rescoreMutation.isPending ? "animate-spin" : ""}`} />
                    Re-score
                  </Button>
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
            />
            {notes && notes.length > 0 && (
              <div className="space-y-2 mt-2">
                {notes.map((note) => (
                  <div key={note.id} className="p-3 bg-secondary/50 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {note.noteType}
                        </span>
                        <span className="text-xs text-muted-foreground">{note.authorName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
  const createMutation = trpc.contacts.create.useMutation({ onSuccess });

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

function EmailDraftButton({ leadId, contacts }: { leadId: number; contacts: any[] }) {
  const [open, setOpen] = useState(false);
  const [emailType, setEmailType] = useState<"cold_intro" | "follow_up" | "demo_request">("cold_intro");
  const [selectedContactId, setSelectedContactId] = useState<string>("primary");
  const [draft, setDraft] = useState<{ subject: string; body: string; contactEmail: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const draftMutation = trpc.leads.draftEmail.useMutation({
    onSuccess: (data) => {
      setDraft({ subject: data.subject, body: data.body, contactEmail: data.contactEmail });
    },
    onError: (err) => {
      toast.error("Failed to generate email: " + err.message);
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
    draftMutation.mutate({ leadId, contactId, emailType });
  };

  const handleCopy = () => {
    if (!draft) return;
    const full = `Subject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Email copied to clipboard");
  };

  const handleSendGmail = () => {
    if (!draft) return;
    sendGmailMutation.mutate({
      to: draft.contactEmail || "",
      subject: draft.subject,
      body: draft.body,
    });
  };

  const EMAIL_TYPE_LABELS = {
    cold_intro: "Cold Intro",
    follow_up: "Follow-up",
    demo_request: "Demo Request",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDraft(null); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-xs mt-1"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Draft Outreach Email
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            AI Email Draft Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
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

          <Button
            onClick={handleGenerate}
            disabled={draftMutation.isPending}
            className="w-full gap-2"
          >
            {draftMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating with AI...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate {EMAIL_TYPE_LABELS[emailType]} Email</>
            )}
          </Button>

          {/* Draft Output */}
          {draft && (
            <div className="space-y-3">
              <div className="p-3 bg-secondary/50 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground font-medium mb-1">Subject Line</p>
                <p className="text-sm font-semibold text-foreground">{draft.subject}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Email Body (editable)</Label>
                <Textarea
                  value={draft.body}
                  onChange={(e) => setDraft((d) => d ? { ...d, body: e.target.value } : null)}
                  className="bg-secondary border-border text-sm font-mono leading-relaxed resize-none"
                  rows={12}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-border flex-1"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={handleGenerate}
                  disabled={draftMutation.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${draftMutation.isPending ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
              </div>

              {!draft.contactEmail && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  No email address on file for this contact. Add one to enable Gmail send.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Note Form ────────────────────────────────────────────────────────────

function AddNoteForm({ leadId, onSuccess }: { leadId: number; onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<string>("Note");
  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => { setContent(""); onSuccess(); },
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={noteType} onValueChange={setNoteType}>
          <SelectTrigger className="w-32 bg-secondary border-border text-xs h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {NOTE_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note, call log, or follow-up..."
          className="flex-1 bg-secondary border-border text-sm h-9"
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
          className="h-9"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
