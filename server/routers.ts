import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { callDataApi } from "./_core/dataApi";
import { z } from "zod";
import {
  bulkInsertContacts,
  bulkInsertLeads,
  createContact,
  createLead,
  createNote,
  deleteContact,
  deleteLead,
  getContactsByLeadId,
  getLeadById,
  getLeads,
  getNotesByLeadId,
  getPipelineStats,
  updateContact,
  updateLead,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  generateLektraFitReason,
  getRecommendedGpu,
  scoreLead,
} from "./scoring";
import { discoverRouter } from "./routers/discover";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { emailSequences } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const LeadFiltersSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  fundingStage: z.string().optional(),
  location: z.string().optional(),
  pipelineStage: z.string().optional(),
  minScore: z.number().optional(),
  maxScore: z.number().optional(),
  isArchived: z.boolean().optional(),
});

const LeadCreateSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  subIndustry: z.string().optional(),
  location: z.string().optional(),
  headcount: z.string().optional(),
  linkedinUrl: z.string().optional(),
  fundingStage: z
    .enum(["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Unknown"])
    .optional(),
  totalFunding: z.string().optional(),
  lastFundingDate: z.string().optional(),
  investors: z.string().optional(),
  gpuUseCases: z.array(z.string()).optional(),
  techStack: z.string().optional(),
  aiProducts: z.string().optional(),
  estimatedGpuSpend: z.string().optional(),
  pipelineStage: z
    .enum(["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"])
    .optional(),
  source: z.string().optional(),
  assignedTo: z.string().optional(),
});

const ContactCreateSchema = z.object({
  leadId: z.number(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  isPrimary: z.boolean().optional(),
  fitReason: z.string().optional(),
});

// ─── CSV Export Helpers ───────────────────────────────────────────────────────

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toHubSpotCSV(leadsData: any[]): string {
  // HubSpot standard field names
  const headers = [
    "Company Name",
    "Website",
    "Industry",
    "City",
    "State/Region",
    "Country",
    "Number of Employees",
    "LinkedIn Company Page",
    "Description",
    "Funding Stage",
    "Total Funding",
    "Last Funding Date",
    "Investors",
    "Lead Score",
    "Pipeline Stage",
    "GPU Use Cases",
    "Estimated GPU Spend",
    "Recommended GPU",
    "Lektra Fit Reason",
    "Tech Stack",
    "AI Products",
    "Lead Source",
    "Assigned To",
    "Create Date",
  ];

  const rows = leadsData.map((lead) => {
    const locationParts = (lead.location ?? "").split(",").map((s: string) => s.trim());
    const city = locationParts[0] ?? "";
    const stateOrCountry = locationParts[1] ?? "";
    const country = locationParts[2] ?? "United States";

    return [
      lead.companyName,
      lead.website,
      lead.industry,
      city,
      stateOrCountry,
      country,
      lead.headcount,
      lead.linkedinUrl,
      lead.description,
      lead.fundingStage,
      lead.totalFunding,
      lead.lastFundingDate,
      lead.investors,
      lead.score,
      lead.pipelineStage,
      Array.isArray(lead.gpuUseCases) ? lead.gpuUseCases.join("; ") : "",
      lead.estimatedGpuSpend,
      lead.recommendedGpu,
      lead.lektraFitReason,
      lead.techStack,
      lead.aiProducts,
      lead.source,
      lead.assignedTo,
      lead.createdAt ? new Date(lead.createdAt).toISOString().split("T")[0] : "",
    ]
      .map(escapeCSV)
      .join(",");
  });

  return [headers.map(escapeCSV).join(","), ...rows].join("\n");
}

// ─── Apollo CSV Field Mapping ─────────────────────────────────────────────────

function parseApolloRow(row: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
      if (val && val.trim()) return val.trim();
    }
    return undefined;
  };

  const gpuKeywords = ["gpu", "ai", "ml", "inference", "training", "cuda", "deep learning", "machine learning"];
  const desc = (get("Description", "Company Description", "About") ?? "").toLowerCase();
  const tech = (get("Technologies", "Tech Stack", "Technology") ?? "").toLowerCase();
  const useCases: string[] = [];
  if (desc.includes("inference") || tech.includes("inference")) useCases.push("inference");
  if (desc.includes("training") || tech.includes("training")) useCases.push("training");
  if (desc.includes("fine-tun") || tech.includes("fine-tun")) useCases.push("fine_tuning");
  if (desc.includes("visualiz") || tech.includes("visualiz")) useCases.push("remote_viz");
  if (desc.includes("edge") && gpuKeywords.some((k) => desc.includes(k))) useCases.push("edge_compute");

  return {
    companyName: get("Company", "Company Name", "Account Name", "Organization Name") ?? "Unknown",
    website: get("Website", "Company Website", "Domain"),
    description: get("Description", "Company Description", "About"),
    industry: get("Industry", "Primary Industry", "Sector"),
    location: [
      get("City"),
      get("State", "State/Region"),
      get("Country"),
    ]
      .filter(Boolean)
      .join(", ") || get("Location", "Headquarters"),
    headcount: get("Employees", "# Employees", "Employee Count", "Number of Employees"),
    linkedinUrl: get("LinkedIn URL", "Company LinkedIn URL", "LinkedIn"),
    fundingStage: mapFundingStage(get("Funding Stage", "Latest Funding Stage", "Last Funding Round Type")),
    totalFunding: get("Total Funding", "Funding Total", "Raised"),
    lastFundingDate: get("Last Funding Date", "Latest Funding Date"),
    investors: get("Investors", "Top Investors"),
    techStack: get("Technologies", "Tech Stack", "Technology"),
    gpuUseCases: useCases.length > 0 ? useCases : undefined,
    source: "Apollo Import",
  };
}

function mapFundingStage(raw: string | undefined): "Pre-Seed" | "Seed" | "Series A" | "Series B" | "Series C" | "Series D+" | "Unknown" {
  if (!raw) return "Unknown";
  const r = raw.toLowerCase();
  if (r.includes("pre-seed") || r.includes("pre seed")) return "Pre-Seed";
  if (r.includes("seed")) return "Seed";
  if (r.includes("series a")) return "Series A";
  if (r.includes("series b")) return "Series B";
  if (r.includes("series c")) return "Series C";
  if (r.includes("series d") || r.includes("series e") || r.includes("series f") || r.includes("growth") || r.includes("late")) return "Series D+";
  return "Unknown";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? "").trim(); });
    return row;
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  discover: discoverRouter,

  // ─── Leads ──────────────────────────────────────────────────────────────────

  leads: router({
    list: protectedProcedure
      .input(LeadFiltersSchema.optional())
      .query(({ input }) => getLeads(input ?? {})),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const lead = await getLeadById(input.id);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        return lead;
      }),

    create: protectedProcedure
      .input(LeadCreateSchema)
      .mutation(async ({ input, ctx }) => {
        const { score, breakdown } = scoreLead(input);
        const fitReason = generateLektraFitReason(input);
        const recommendedGpu = getRecommendedGpu(input.gpuUseCases);
        await createLead({
          ...input,
          score,
          scoreBreakdown: breakdown,
          lektraFitReason: fitReason,
          recommendedGpu: recommendedGpu as any,
          assignedTo: input.assignedTo ?? ctx.user.name ?? undefined,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: LeadCreateSchema.partial() }))
      .mutation(async ({ input }) => {
        const existing = await getLeadById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const merged = { ...existing, ...input.data };
        const { score, breakdown } = scoreLead(merged);
        const fitReason = generateLektraFitReason(merged);
        const recommendedGpu = getRecommendedGpu(merged.gpuUseCases ?? []);
        await updateLead(input.id, {
          ...input.data,
          score,
          scoreBreakdown: breakdown,
          lektraFitReason: fitReason,
          recommendedGpu: recommendedGpu as any,
        });
        return { success: true };
      }),

    updateStage: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          stage: z.enum(["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateLead(input.id, { pipelineStage: input.stage });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteLead(input.id);
        return { success: true };
      }),

    rescore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const lead = await getLeadById(input.id);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        const { score, breakdown } = scoreLead(lead);
        const fitReason = generateLektraFitReason(lead);
        const recommendedGpu = getRecommendedGpu(lead.gpuUseCases ?? []);
        await updateLead(input.id, {
          score,
          scoreBreakdown: breakdown,
          lektraFitReason: fitReason,
          recommendedGpu: recommendedGpu as any,
        });
        return { score, breakdown };
      }),

    pipelineStats: protectedProcedure.query(() => getPipelineStats()),

    sourceStats: protectedProcedure.query(async () => {
      const allLeads = await getLeads({});
      const sourceMap: Record<string, { count: number; totalScore: number }> = {};
      for (const lead of allLeads) {
        const src = lead.source ?? "Manual";
        if (!sourceMap[src]) sourceMap[src] = { count: 0, totalScore: 0 };
        sourceMap[src].count++;
        sourceMap[src].totalScore += lead.score ?? 0;
      }
      return Object.entries(sourceMap).map(([source, data]) => ({
        source,
        count: data.count,
        avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
      })).sort((a, b) => b.count - a.count);
    }),

    draftEmail: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          contactId: z.number().optional(),
          emailType: z.enum(["cold_intro", "follow_up", "demo_request", "linkedin_connect"]).default("cold_intro"),
        })
      )
      .mutation(async ({ input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

        const contacts = await getContactsByLeadId(input.leadId);
        const contact = input.contactId
          ? contacts.find((c) => c.id === input.contactId)
          : contacts.find((c) => c.isPrimary) ?? contacts[0];

        const contactName = contact
          ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
          : "there";
        const contactTitle = contact?.title ?? "";
        const contactLinkedIn = contact?.linkedinUrl ?? "";
        const contactFitReason = contact?.fitReason ?? "";

        // Handle LinkedIn connect separately
        if (input.emailType === "linkedin_connect") {
          const firstName = contact?.firstName ?? contactName.split(" ")[0] ?? "there";
          const linkedInSystemPrompt = `You are writing a LinkedIn Sales Navigator connection request note on behalf of Jerry Gutierrez, VP of Business Development at Lektra Cloud.

CRITICAL RULES:
- MAXIMUM 300 characters total (LinkedIn hard limit) — count every character including spaces
- Must be personal, warm, and specific to the person's role/company — NOT generic
- Reference their specific GPU use case or AI work at their company
- Mention Lektra's key differentiator: 30-50% cheaper GPU cloud, no egress fees
- End with a soft ask to connect — no hard sell
- NO sign-off needed (LinkedIn shows your name automatically)
- Sound like Jerry: conversational, first-name basis, genuine enthusiasm
- Do NOT start with "Hi" or "Hello" — LinkedIn connection notes work better starting with the value hook or their name directly

Examples of Jerry's style at 300 chars:
"[Name], saw what you're building at [Company] — impressive work on [specific thing]. At Lektra Cloud we're offering H200/RTX Pro 6000 at 30-50% below AWS with zero egress fees. Would love to connect and share more!"

Return JSON with field: note (string, max 300 chars)`;

          const linkedInUserPrompt = `Write a LinkedIn connection note to ${firstName}${contactTitle ? `, ${contactTitle}` : ""} at ${lead.companyName}.

Context:
- Their company: ${lead.companyName} (${lead.industry ?? "AI"})
- What they do: ${lead.description ?? lead.aiProducts ?? "AI/ML workloads"}
- GPU use cases: ${(lead.gpuUseCases ?? []).join(", ") || "AI inference/training"}
- Funding stage: ${lead.fundingStage ?? ""}
- Lektra fit: ${lead.lektraFitReason ?? ""}
${contactFitReason ? `- Why they're a fit: ${contactFitReason}` : ""}

Remember: MUST be under 300 characters total.`;

          const liResponse = await invokeLLM({
            messages: [
              { role: "system", content: linkedInSystemPrompt },
              { role: "user", content: linkedInUserPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "linkedin_note",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    note: { type: "string", description: "LinkedIn connection note, max 300 characters" },
                  },
                  required: ["note"],
                  additionalProperties: false,
                },
              },
            },
          });

          const liRaw = liResponse.choices[0]?.message?.content;
          const liContent = typeof liRaw === "string" ? liRaw : null;
          if (!liContent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned no content" });

          const liParsed = JSON.parse(liContent) as { note: string };
          // Hard-enforce 300 char limit
          const note = liParsed.note.slice(0, 300);

          await createNote({
            leadId: input.leadId,
            content: `LinkedIn connection note drafted:\n\n${note}`,
            noteType: "Note",
            authorName: "Jerry Gutierrez (AI Draft)",
          });

          return {
            subject: "LinkedIn Connection Note",
            body: note,
            contactName,
            contactEmail: contact?.email ?? "",
            linkedinUrl: contact?.linkedinUrl ?? lead.linkedinUrl ?? "",
            isLinkedIn: true,
            charCount: note.length,
          };
        }

        const emailTypeInstructions = {
          cold_intro: "This is a first-touch cold introduction email. The goal is to open a conversation and get a 15-minute call.",
          follow_up: "This is a follow-up email after no response to a previous outreach. Reference that you reached out before and keep it brief.",
          demo_request: "This is an email requesting a product demo of Lektra Cloud's GPU infrastructure. Emphasize the cost savings and quick deployment.",
          linkedin_connect: "", // handled above
        }[input.emailType] ?? "";

        const systemPrompt = `You are writing a cold outreach email on behalf of Jerry Gutierrez, VP of Business Development at Lektra Cloud.

Jerry's writing style (MUST follow exactly):
- Warm, friendly, conversational — NOT corporate or stiff
- Opens with "Hi [FirstName]!" (exclamation mark) for cold emails
- Gets to the point in 2-3 short sentences — NO filler like "I hope this email finds you well"
- References something specific about the person's company or role
- States Lektra's value prop concretely: 30-50% cheaper than AWS/Azure/GCP, no egress fees, faster deployments, solar-powered edge datacenters at the source of power
- One clear, low-friction CTA: "Would love to connect — do you have 15 minutes this week?"
- Signs off: "Best,\nJerry Gutierrez\nVP Business Development, Lektra Cloud\njerry@lektra.com"
- NO bullet points in the email body
- NO long paragraphs — 3-4 sentences total max
- Sounds human and genuine, not like a sales template

About Lektra Cloud:
- Edge-scale GPU cloud at 30-50% discount vs hyperscalers (AWS, Azure, GCP, CoreWeave)
- Current GPU fleet: NVIDIA H200, RTX Pro 6000 (B200 coming soon)
- Solar + battery powered datacenters placed at commercial/industrial power sources — no land acquisition, no building permits
- Lower latency, faster deployments, zero egress fees
- Ideal for: AI inference, model training, fine-tuning, edge compute, remote visualization, HPC
- Target: US AI startups Seed through Series C spending on GPU compute

Return ONLY the email text — no subject line prefix, no metadata, just the email body starting with the greeting.`;

        const userPrompt = `Write a ${input.emailType.replace("_", " ")} email to ${contactName}${contactTitle ? `, ${contactTitle}` : ""} at ${lead.companyName}.

${emailTypeInstructions}

Company context:
- Company: ${lead.companyName}
- Industry: ${lead.industry ?? "AI"}
- Description: ${lead.description ?? ""}
- Funding stage: ${lead.fundingStage ?? ""}
- GPU use cases: ${(lead.gpuUseCases ?? []).join(", ") || "AI/ML workloads"}
- Estimated GPU spend: ${lead.estimatedGpuSpend ?? "significant"}
- Recommended Lektra GPU: ${lead.recommendedGpu ?? "H200"}
- Lektra fit reason: ${lead.lektraFitReason ?? ""}
- Tech stack: ${lead.techStack ?? ""}
- AI products: ${lead.aiProducts ?? ""}
${contactFitReason ? `- Why ${contactName} is a good fit: ${contactFitReason}` : ""}
${contactLinkedIn ? `- Contact LinkedIn: ${contactLinkedIn}` : ""}

Also generate a compelling subject line (max 8 words, no clickbait, specific to their use case).`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "email_draft",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Full email body text" },
                },
                required: ["subject", "body"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : null;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned no content" });

        const parsed = JSON.parse(content) as { subject: string; body: string };

        // Log the email as a note
        await createNote({
          leadId: input.leadId,
          content: `AI email draft generated (${input.emailType.replace("_", " ")}):\n\nSubject: ${parsed.subject}\n\n${parsed.body}`,
          noteType: "Email",
          authorName: "Jerry Gutierrez (AI Draft)",
        });

        return {
          subject: parsed.subject,
          body: parsed.body,
          contactName,
          contactEmail: contact?.email ?? "",
          linkedinUrl: contact?.linkedinUrl ?? lead.linkedinUrl ?? "",
          isLinkedIn: false,
          charCount: null as number | null,
        };
      }),

    sendGmail: protectedProcedure
      .input(
        z.object({
          to: z.string(),
          subject: z.string(),
          body: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        // This procedure signals the frontend to use Gmail MCP
        // The actual send happens client-side via the Gmail MCP integration
        // We return the data for the frontend to use
        return {
          success: true,
          to: input.to,
          subject: input.subject,
          body: input.body,
        };
      }),

    exportHubspot: protectedProcedure
      .input(
        z.object({
          filters: LeadFiltersSchema.optional(),
          minCompleteness: z.number().min(0).max(10).optional(),
          previewOnly: z.boolean().optional(),
        }).optional()
      )
      .mutation(async ({ input }) => {
        let leadsData = await getLeads(input?.filters ?? {});
        // Apply completeness filter if requested
        if (input?.minCompleteness !== undefined && input.minCompleteness > 0) {
          leadsData = leadsData.filter((l: any) => (l.completenessScore ?? 0) >= input.minCompleteness!);
        }
        if (input?.previewOnly) {
          return { csv: "", count: leadsData.length, previewOnly: true };
        }
        const csv = toHubSpotCSV(leadsData);
        return { csv, count: leadsData.length, previewOnly: false };
      }),

    // ─── Auto-enrich a company by name or website ─────────────────────────────
    enrichLead: protectedProcedure
      .input(
        z.object({
          companyName: z.string().optional(),
          website: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { companyName, website } = input;
        if (!companyName && !website) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide a company name or website" });
        }

        // Derive a LinkedIn slug guess from company name or website
        const nameForSlug = companyName ?? website ?? "";
        const guessedSlug = nameForSlug
          .toLowerCase()
          .replace(/https?:\/\/(www\.)?/, "")
          .replace(/\.[a-z]{2,}.*$/, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        // ── Step 1: Try LinkedIn company details ──────────────────────────────
        let linkedinData: {
          description?: string;
          headcount?: string;
          specialities?: string[];
          website?: string;
          linkedinUrl?: string;
          crunchbaseUrl?: string;
          followerCount?: number;
          tagline?: string;
          industry?: string;
          name?: string;
          location?: string;
        } | null = null;

        try {
          const raw = await callDataApi("LinkedIn/get_company_details", {
            query: { username: guessedSlug },
          }) as any;
          if (raw?.success && raw?.data) {
            const d = raw.data;
            const staffRange = d.staffCountRange
              ? `${d.staffCountRange.start ?? "?"}-${d.staffCountRange.end ?? "?"}`
              : d.staffCount ? String(d.staffCount) : undefined;
            linkedinData = {
              description: d.description ?? undefined,
              headcount: staffRange,
              specialities: d.specialities ?? [],
              website: d.website ?? d.websiteUrl ?? undefined,
              linkedinUrl: d.linkedinUrl ?? `https://www.linkedin.com/company/${guessedSlug}`,
              crunchbaseUrl: d.crunchbaseUrl ?? undefined,
              followerCount: d.followerCount ?? undefined,
              tagline: d.tagline ?? undefined,
              industry: Array.isArray(d.industries) ? d.industries[0] : (d.industry ?? undefined),
              name: d.name ?? undefined,
              location: d.headquarter
                ? `${d.headquarter.city ?? ""}, ${d.headquarter.geographicArea ?? ""}, ${d.headquarter.country ?? ""}`.replace(/^,\s*|,\s*$/g, "")
                : undefined,
            };
          }
        } catch {
          // LinkedIn lookup failed — fall through to LLM
        }

        // ── Step 2: LLM enrichment (always runs to fill gaps + GPU analysis) ──
        const llmPrompt = `You are a business intelligence analyst. Given the following company info, return a structured JSON object with enriched data.

Company Name: ${companyName ?? "Unknown"}
Website: ${website ?? "Unknown"}
LinkedIn Description: ${linkedinData?.description ?? "Not available"}
LinkedIn Industry: ${linkedinData?.industry ?? "Not available"}
LinkedIn Specialities: ${(linkedinData?.specialities ?? []).join(", ") || "Not available"}
LinkedIn Headcount: ${linkedinData?.headcount ?? "Not available"}
LinkedIn Location: ${linkedinData?.location ?? "Not available"}

Based on all available information, return this exact JSON:
{
  "companyName": "<official company name>",
  "description": "<2-3 sentence company description>",
  "industry": "<primary industry: Artificial Intelligence | AI Infrastructure | Machine Learning | Edge AI | Generative AI | Computer Vision | Robotics | MLOps | Healthcare AI | Autonomous Vehicles | Other>",
  "subIndustry": "<more specific sub-industry>",
  "location": "<City, State, United States>",
  "headcount": "<headcount range like 11-50 or 51-200>",
  "fundingStage": "<Seed | Series A | Series B | Series C | Series D+ | Unknown>",
  "techStack": "<comma-separated tech stack if known, e.g. PyTorch, CUDA, Kubernetes>",
  "gpuUseCases": ["<one or more of: inference, training, fine_tuning, edge_compute, remote_viz, hpc>"],
  "aiProducts": "<brief description of their AI products or services>",
  "estimatedGpuSpend": "<low | medium | high | very_high>",
  "website": "<website URL>",
  "linkedinUrl": "<LinkedIn company URL>",
  "isGoodFitForLektra": <true|false>,
  "fitReason": "<1-2 sentence reason why this company is or isn't a good fit for Lektra Cloud GPU rentals>",
  "recommendedGpu": "<H200 | RTX Pro 6000 | B200 | Multiple | TBD>"
}

Lektra Cloud context: GPU cloud provider, 30-50% cheaper than AWS/Azure/GCP, H200/RTX Pro 6000/B200 GPUs, targets US AI startups Seed-Series C spending on GPU compute for inference, training, fine-tuning, edge compute, or remote visualization.`;

        let llmResult: {
          companyName?: string;
          description?: string;
          industry?: string;
          subIndustry?: string;
          location?: string;
          headcount?: string;
          fundingStage?: string;
          techStack?: string;
          gpuUseCases?: string[];
          aiProducts?: string;
          estimatedGpuSpend?: string;
          website?: string;
          linkedinUrl?: string;
          isGoodFitForLektra?: boolean;
          fitReason?: string;
          recommendedGpu?: string;
        } = {};

        try {
          const response = await invokeLLM({
            messages: [{ role: "user", content: llmPrompt }],
            response_format: { type: "json_object" },
          });
          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === "string" ? rawContent : null;
          if (content) llmResult = JSON.parse(content);
        } catch {
          // LLM failed — return partial data
        }

        // ── Step 3: Merge LinkedIn + LLM data, LinkedIn takes precedence for factual fields ──
        const merged = {
          companyName: linkedinData?.name ?? llmResult.companyName ?? companyName ?? "",
          description: linkedinData?.description ?? llmResult.description ?? "",
          industry: linkedinData?.industry ?? llmResult.industry ?? "",
          subIndustry: llmResult.subIndustry ?? "",
          location: linkedinData?.location ?? llmResult.location ?? "",
          headcount: linkedinData?.headcount ?? llmResult.headcount ?? "",
          fundingStage: llmResult.fundingStage ?? "Unknown",
          techStack: llmResult.techStack ?? "",
          gpuUseCases: llmResult.gpuUseCases ?? [],
          aiProducts: llmResult.aiProducts ?? "",
          estimatedGpuSpend: llmResult.estimatedGpuSpend ?? "medium",
          website: linkedinData?.website ?? llmResult.website ?? website ?? "",
          linkedinUrl: linkedinData?.linkedinUrl ?? llmResult.linkedinUrl ?? `https://www.linkedin.com/company/${guessedSlug}`,
          crunchbaseUrl: linkedinData?.crunchbaseUrl ?? "",
          fitReason: llmResult.fitReason ?? "",
          recommendedGpu: llmResult.recommendedGpu ?? "TBD",
          isGoodFitForLektra: llmResult.isGoodFitForLektra ?? true,
          // Metadata about enrichment quality
          enrichedFromLinkedIn: linkedinData !== null,
          enrichedFromLLM: Object.keys(llmResult).length > 0,
        };

        return merged;
      }),

    // ─── Re-enrich an existing lead with fresh LinkedIn + LLM data ─────────────
    reEnrich: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const lead = await getLeadById(input.id);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

        // Reuse the enrichLead logic inline
        const companyName = lead.companyName;
        const website = lead.website ?? undefined;

        const guessedSlug = companyName
          .toLowerCase()
          .replace(/https?:\/\/(www\.)?/, "")
          .replace(/\.[a-z]{2,}.*$/, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        let linkedinData: {
          description?: string; headcount?: string; specialities?: string[];
          website?: string; linkedinUrl?: string; industry?: string; name?: string; location?: string;
        } | null = null;

        try {
          const raw = await callDataApi("LinkedIn/get_company_details", { query: { username: guessedSlug } }) as any;
          if (raw?.success && raw?.data) {
            const d = raw.data;
            const staffRange = d.staffCountRange
              ? `${d.staffCountRange.start ?? "?"}-${d.staffCountRange.end ?? "?"}`
              : d.staffCount ? String(d.staffCount) : undefined;
            linkedinData = {
              description: d.description ?? undefined,
              headcount: staffRange,
              specialities: d.specialities ?? [],
              website: d.website ?? d.websiteUrl ?? undefined,
              linkedinUrl: d.linkedinUrl ?? `https://www.linkedin.com/company/${guessedSlug}`,
              industry: Array.isArray(d.industries) ? d.industries[0] : (d.industry ?? undefined),
              name: d.name ?? undefined,
              location: d.headquarter
                ? `${d.headquarter.city ?? ""}, ${d.headquarter.geographicArea ?? ""}, ${d.headquarter.country ?? ""}`.replace(/^,\s*|,\s*$/g, "")
                : undefined,
            };
          }
        } catch { /* ignore */ }

        const llmPrompt = `You are a business intelligence analyst. Given the following company info, return a structured JSON object.
Company Name: ${companyName}
Website: ${website ?? "Unknown"}
LinkedIn Description: ${linkedinData?.description ?? "Not available"}
LinkedIn Industry: ${linkedinData?.industry ?? "Not available"}
LinkedIn Specialities: ${(linkedinData?.specialities ?? []).join(", ") || "Not available"}
LinkedIn Headcount: ${linkedinData?.headcount ?? "Not available"}
LinkedIn Location: ${linkedinData?.location ?? "Not available"}

Return JSON: { "description": string, "industry": string, "subIndustry": string, "location": string, "headcount": string, "fundingStage": "Seed|Series A|Series B|Series C|Series D+|Unknown", "techStack": string, "gpuUseCases": string[], "aiProducts": string, "estimatedGpuSpend": "low|medium|high|very_high", "website": string, "linkedinUrl": string, "fitReason": string, "recommendedGpu": "H200|RTX Pro 6000|B200|Multiple|TBD" }`;

        let llmResult: Record<string, any> = {};
        try {
          const response = await invokeLLM({
            messages: [{ role: "user", content: llmPrompt }],
            response_format: { type: "json_object" },
          });
          const rawContent = response.choices[0]?.message?.content;
          if (typeof rawContent === "string") llmResult = JSON.parse(rawContent);
        } catch { /* ignore */ }

        // Build patch — only update blank/stale fields
        const patch: Record<string, any> = {};
        let updatedCount = 0;

        const maybeSet = (field: string, newVal: any) => {
          const existing = (lead as any)[field];
          const isEmpty = !existing || (Array.isArray(existing) && existing.length === 0);
          if (isEmpty && newVal && (Array.isArray(newVal) ? newVal.length > 0 : true)) {
            patch[field] = newVal;
            updatedCount++;
          }
        };

        maybeSet("description", linkedinData?.description ?? llmResult.description);
        maybeSet("industry", linkedinData?.industry ?? llmResult.industry);
        maybeSet("location", linkedinData?.location ?? llmResult.location);
        maybeSet("headcount", linkedinData?.headcount ?? llmResult.headcount);
        maybeSet("website", linkedinData?.website ?? llmResult.website ?? website);
        maybeSet("linkedinUrl", linkedinData?.linkedinUrl ?? llmResult.linkedinUrl);
        maybeSet("techStack", llmResult.techStack);
        maybeSet("aiProducts", llmResult.aiProducts);
        maybeSet("estimatedGpuSpend", llmResult.estimatedGpuSpend);
        if (llmResult.fundingStage && llmResult.fundingStage !== "Unknown") {
          maybeSet("fundingStage", llmResult.fundingStage);
        }
        if (llmResult.gpuUseCases && Array.isArray(llmResult.gpuUseCases) && llmResult.gpuUseCases.length > 0) {
          maybeSet("gpuUseCases", llmResult.gpuUseCases);
        }

        if (Object.keys(patch).length > 0) {
          // Re-score with merged data
          const merged = { ...lead, ...patch };
          const { score, breakdown } = scoreLead(merged);
          const fitReason = generateLektraFitReason(merged);
          const recommendedGpu = getRecommendedGpu(merged.gpuUseCases ?? []);
          patch.score = score;
          patch.scoreBreakdown = breakdown;
          patch.lektraFitReason = fitReason;
          patch.recommendedGpu = recommendedGpu;
          await updateLead(input.id, patch);
        }

        return { updatedCount, fieldsUpdated: Object.keys(patch).filter(f => !["score","scoreBreakdown","lektraFitReason","recommendedGpu"].includes(f)) };
      }),

    // ─── Follow-up scheduling ──────────────────────────────────────────────────
    setFollowUp: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          followUpAt: z.string().nullable(), // ISO date string or null to clear
          followUpNote: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const date = input.followUpAt ? new Date(input.followUpAt) : null;
        await updateLead(input.id, {
          followUpAt: date ?? undefined,
          followUpNote: input.followUpNote ?? undefined,
        } as any);
        return { success: true };
      }),

    overdueFollowUps: protectedProcedure.query(async () => {
      const now = new Date();
      const allLeads = await getLeads({ isArchived: false });
      return allLeads.filter((l: any) => {
        if (!l.followUpAt) return false;
        const due = new Date(l.followUpAt);
        // Due today or overdue
        return due <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      }).map((l: any) => ({
        id: l.id,
        companyName: l.companyName,
        followUpAt: l.followUpAt,
        followUpNote: l.followUpNote,
        pipelineStage: l.pipelineStage,
        score: l.score,
        recommendedGpu: l.recommendedGpu,
      }));
    }),

    // ─── Bulk re-enrich incomplete leads ─────────────────────────────────────
    bulkReEnrich: protectedProcedure
      .input(z.object({ minCompleteness: z.number().default(7) }))
      .mutation(async ({ input }) => {
        const allLeads = await getLeads({ isArchived: false });
        const incomplete = allLeads.filter((l: any) => (l.completenessScore ?? 0) < input.minCompleteness);
        let enrichedCount = 0;
        const results: Array<{ id: number; companyName: string; fieldsUpdated: number }> = [];

        for (const lead of incomplete) {
          try {
            const guessedSlug = lead.companyName
              .toLowerCase()
              .replace(/https?:\/\/(www\.)?/, "")
              .replace(/\.[a-z]{2,}.*$/, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");

            let linkedinData: Record<string, any> | null = null;
            try {
              const raw = await callDataApi("LinkedIn/get_company_details", { query: { username: guessedSlug } }) as any;
              if (raw?.success && raw?.data) {
                const d = raw.data;
                const staffRange = d.staffCountRange
                  ? `${d.staffCountRange.start ?? "?"}-${d.staffCountRange.end ?? "?"}`
                  : d.staffCount ? String(d.staffCount) : undefined;
                linkedinData = {
                  description: d.description ?? undefined,
                  headcount: staffRange,
                  specialities: d.specialities ?? [],
                  website: d.website ?? d.websiteUrl ?? undefined,
                  linkedinUrl: d.linkedinUrl ?? `https://www.linkedin.com/company/${guessedSlug}`,
                  industry: Array.isArray(d.industries) ? d.industries[0] : (d.industry ?? undefined),
                  name: d.name ?? undefined,
                  location: d.headquarter
                    ? `${d.headquarter.city ?? ""}, ${d.headquarter.geographicArea ?? ""}, ${d.headquarter.country ?? ""}`.replace(/^,\s*|,\s*$/g, "")
                    : undefined,
                };
              }
            } catch { /* ignore */ }

            const llmPrompt = `Company: ${lead.companyName}, Website: ${lead.website ?? ""}, LinkedIn desc: ${linkedinData?.description ?? ""}, Industry: ${linkedinData?.industry ?? ""}, Specialities: ${(linkedinData?.specialities ?? []).join(", ")}, Headcount: ${linkedinData?.headcount ?? ""}, Location: ${linkedinData?.location ?? ""}\n\nReturn JSON: { "description": string, "industry": string, "location": string, "headcount": string, "fundingStage": "Seed|Series A|Series B|Series C|Series D+|Unknown", "techStack": string, "gpuUseCases": string[], "aiProducts": string, "linkedinUrl": string, "fitReason": string, "recommendedGpu": "H200|RTX Pro 6000|B200|Multiple|TBD" }`;

            let llmResult: Record<string, any> = {};
            try {
              const response = await invokeLLM({
                messages: [{ role: "user", content: llmPrompt }],
                response_format: { type: "json_object" },
              });
              const rawContent = response.choices[0]?.message?.content;
              if (typeof rawContent === "string") llmResult = JSON.parse(rawContent);
            } catch { /* ignore */ }

            const patch: Record<string, any> = {};
            let updatedCount = 0;
            const maybeSet = (field: string, newVal: any) => {
              const existing = (lead as any)[field];
              const isEmpty = !existing || (Array.isArray(existing) && existing.length === 0);
              if (isEmpty && newVal && (Array.isArray(newVal) ? newVal.length > 0 : true)) {
                patch[field] = newVal;
                updatedCount++;
              }
            };
            maybeSet("description", linkedinData?.description ?? llmResult.description);
            maybeSet("industry", linkedinData?.industry ?? llmResult.industry);
            maybeSet("location", linkedinData?.location ?? llmResult.location);
            maybeSet("headcount", linkedinData?.headcount ?? llmResult.headcount);
            maybeSet("website", linkedinData?.website ?? llmResult.website);
            maybeSet("linkedinUrl", linkedinData?.linkedinUrl ?? llmResult.linkedinUrl);
            maybeSet("techStack", llmResult.techStack);
            maybeSet("aiProducts", llmResult.aiProducts);
            if (llmResult.fundingStage && llmResult.fundingStage !== "Unknown") maybeSet("fundingStage", llmResult.fundingStage);
            if (Array.isArray(llmResult.gpuUseCases) && llmResult.gpuUseCases.length > 0) maybeSet("gpuUseCases", llmResult.gpuUseCases);

            if (Object.keys(patch).length > 0) {
              const merged = { ...lead, ...patch };
              const { score, breakdown } = scoreLead(merged);
              const fitReason = generateLektraFitReason(merged);
              const recommendedGpu = getRecommendedGpu(merged.gpuUseCases ?? []);
              patch.score = score;
              patch.scoreBreakdown = breakdown;
              patch.lektraFitReason = fitReason;
              patch.recommendedGpu = recommendedGpu;
              await updateLead(lead.id, patch);
              enrichedCount++;
            }
            results.push({ id: lead.id, companyName: lead.companyName, fieldsUpdated: updatedCount });
          } catch { /* skip this lead */ }
        }
        return { total: incomplete.length, enriched: enrichedCount, results };
      }),

    importApollo: protectedProcedure
      .input(z.object({ csvText: z.string() }))
      .mutation(async ({ input }) => {
        const rows = parseCSV(input.csvText);
        if (rows.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No data rows found in CSV" });

        const leadsToInsert = rows.map((row) => {
          const parsed = parseApolloRow(row);
          const { score, breakdown } = scoreLead(parsed);
          const fitReason = generateLektraFitReason(parsed);
          const recommendedGpu = getRecommendedGpu(parsed.gpuUseCases);
          return {
            ...parsed,
            score,
            scoreBreakdown: breakdown,
            lektraFitReason: fitReason,
            recommendedGpu: recommendedGpu as any,
            pipelineStage: "New" as const,
          };
        });

        await bulkInsertLeads(leadsToInsert);
        return { imported: leadsToInsert.length };
      }),
  }),

  // ─── Contacts ───────────────────────────────────────────────────────────────

  contacts: router({
    listByLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(({ input }) => getContactsByLeadId(input.leadId)),

    create: protectedProcedure
      .input(ContactCreateSchema)
      .mutation(async ({ input }) => {
        await createContact(input);

        // Auto-enrich: search LinkedIn for the contact's profile if linkedinUrl is missing
        if (!input.linkedinUrl) {
          const lead = await getLeadById(input.leadId);
          const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ");
          if (fullName && lead) {
            try {
              const raw = await callDataApi("LinkedIn/search_people", {
                query: {
                  keywords: `${fullName} ${lead.companyName}`,
                  keywordTitle: input.title ?? "CEO Founder CTO President",
                  start: "0",
                },
              }) as any;
              if (raw?.success) {
                const items: any[] = raw?.data?.items ?? [];
                const nameLower = fullName.toLowerCase();
                const match = items.find((p: any) =>
                  (p.fullName ?? "").toLowerCase().includes(nameLower.split(" ")[0] ?? "")
                ) ?? items[0];
                if (match) {
                  // Find the contact we just created by leadId + name
                  const contacts = await getContactsByLeadId(input.leadId);
                  const created = contacts.find((c) =>
                    c.firstName === input.firstName && c.lastName === input.lastName
                  );
                  if (created) {
                    const enrichPatch: Record<string, any> = {};
                    if (match.profileURL) enrichPatch.linkedinUrl = match.profileURL;
                    if (match.headline && !input.title) enrichPatch.headline = match.headline;
                    if (Object.keys(enrichPatch).length > 0) {
                      await updateContact(created.id, enrichPatch);
                    }
                  }
                }
              }
            } catch { /* ignore enrichment errors */ }
          }
        }

        return { success: true, enriched: !input.linkedinUrl };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: ContactCreateSchema.partial() }))
      .mutation(async ({ input }) => {
        await updateContact(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteContact(input.id);
        return { success: true };
      }),
  }),

  // ─── Email Sequences ─────────────────────────────────────────────────────
  sequences: router({
    listByLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(emailSequences).where(eq(emailSequences.leadId, input.leadId));
      }),

    create: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        contactId: z.number().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Delete any existing sequence for this lead+contact combo
        await db.delete(emailSequences).where(
          and(
            eq(emailSequences.leadId, input.leadId),
            input.contactId ? eq(emailSequences.contactId, input.contactId) : eq(emailSequences.leadId, input.leadId)
          )
        );

        const steps = [
          { stepNumber: 1, dayOffset: 1, label: "Initial outreach" },
          { stepNumber: 2, dayOffset: 4, label: "Follow-up #1" },
          { stepNumber: 3, dayOffset: 10, label: "Follow-up #2 / value add" },
        ];

        const results = [];
        for (const step of steps) {
          const prompt = `You are Jerry Gutierrez, VP of Business Development at Lektra Cloud. Write a ${step.label} email to ${input.contactName ?? "the founder"} at ${lead.companyName}.

Lektra Cloud value proposition:
- 30-50% cheaper than AWS/Azure/GCP on GPU compute (H200, RTX Pro 6000, B200 coming soon)
- Solar-powered edge datacenters at commercial/industrial power sources — no land acquisition, no building permits
- Lower latency, faster deployments, zero egress fees
- Ideal for AI inference, model training, remote visualization, edge compute

Company context:
- Company: ${lead.companyName}
- Industry: ${lead.industry ?? "AI/ML"}
- GPU use cases: ${Array.isArray(lead.gpuUseCases) ? lead.gpuUseCases.join(", ") : "AI workloads"}
- Funding stage: ${lead.fundingStage ?? "Unknown"}
- Why they fit Lektra: ${lead.lektraFitReason ?? "Strong GPU spend signals"}
- Contact: ${input.contactName ?? "Founder"}

Step: ${step.label} (Day ${step.dayOffset} of a 3-email sequence)

Jerry's writing style rules:
- Start with "Hi [FirstName]," — always first name only
- Maximum 3 short paragraphs, each 1-2 sentences
- Be direct, warm, and conversational — never corporate
- Reference something specific about their company or GPU use case
- One clear CTA: ask for a 15-minute call
- Sign off: "Best, Jerry"
- For follow-ups: acknowledge it's a follow-up briefly, add new value or angle
- Never use buzzwords like "synergy", "leverage", "circle back"

Return JSON with exactly: { "subject": "...", "body": "..." }`;

          const response = await invokeLLM({
            messages: [{ role: "user", content: prompt }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "email_draft",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["subject", "body"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
          const scheduledAt = new Date(Date.now() + step.dayOffset * 86400000);

          await db.insert(emailSequences).values({
            leadId: input.leadId,
            contactId: input.contactId ?? null,
            contactName: input.contactName ?? null,
            contactEmail: input.contactEmail ?? null,
            stepNumber: step.stepNumber,
            dayOffset: step.dayOffset,
            subject: parsed.subject,
            body: parsed.body,
            status: "Draft",
            scheduledAt,
          });

          results.push({ step: step.stepNumber, subject: parsed.subject });
        }

        return { success: true, steps: results };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["Draft", "Scheduled", "Sent", "Skipped"]),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const updateData: Record<string, unknown> = { status: input.status };
        if (input.status === "Sent") updateData.sentAt = new Date();
        await db.update(emailSequences).set(updateData).where(eq(emailSequences.id, input.id));
        return { success: true };
      }),

    updateBody: protectedProcedure
      .input(z.object({
        id: z.number(),
        subject: z.string().optional(),
        body: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...rest } = input;
        await db.update(emailSequences).set(rest).where(eq(emailSequences.id, id));
        return { success: true };
      }),
  }),

  // ─── Notes ──────────────────────────────────────────────────────────────────
  notes: router({
    listByLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(({ input }) => getNotesByLeadId(input.leadId)),

     create: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          content: z.string().min(1),
          noteType: z.enum(["Note", "Call", "Email", "Meeting", "Follow-up"]).optional(),
          authorName: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await createNote({
          ...input,
          authorName: input.authorName ?? ctx.user.name ?? "Unknown",
        });
        return { success: true };
      }),

    analyzeStrategy: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        const notes = await getNotesByLeadId(input.leadId);

        const notesText = notes.length > 0
          ? notes.map((n) => `[${n.noteType} - ${new Date(n.createdAt).toLocaleDateString()}] ${n.content}`).join("\n")
          : "No notes yet.";

        const prompt = `You are a senior B2B sales strategy advisor helping Jerry Gutierrez, VP of Business Development at Lektra Cloud, develop an outreach strategy for a prospect.

Lektra Cloud value proposition:
- 30-50% cheaper than AWS/Azure/GCP on GPU compute (H200, RTX Pro 6000, B200 coming soon)
- Solar-powered edge datacenters — no land acquisition, no building permits, placed at power source
- Lower latency, faster deployments, zero egress fees
- Ideal for AI inference, model training, remote visualization, edge compute at scale

Prospect company: ${lead.companyName}
Industry: ${lead.industry ?? "AI/ML"}
Funding stage: ${lead.fundingStage ?? "Unknown"}
Headcount: ${lead.headcount ?? "Unknown"}
GPU use cases: ${Array.isArray(lead.gpuUseCases) ? lead.gpuUseCases.join(", ") : "Unknown"}
Pipeline stage: ${lead.pipelineStage}
Lektra fit reason: ${lead.lektraFitReason ?? "Strong GPU spend signals"}
Recommended GPU: ${lead.recommendedGpu ?? "TBD"}

Activity notes from Jerry:
${notesText}

Based on the notes and company context, provide a concise, actionable outreach strategy. Structure your response with these sections:

## Engagement Summary
Brief 2-3 sentence assessment of where this relationship stands and key signals from the notes.

## Recommended Next Action
One specific, concrete next step Jerry should take this week (be very specific — not generic advice).

## Key Talking Points
3-4 bullet points tailored to this company's specific GPU use case and pain points vs hyperscalers.

## Objection Handlers
2-3 likely objections from this prospect and how to address them given Lektra's positioning.

## Risk Flags
Any red flags or reasons this deal might stall, and how to mitigate them.

Keep the tone direct and practical. Jerry is a seasoned BD professional — skip the basics.`;

        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
        });

        const content = response.choices[0]?.message?.content;
        const strategy = typeof content === "string" ? content : JSON.stringify(content);
        return { strategy };
      }),
  }),
});
export type AppRouter = typeof appRouter;
