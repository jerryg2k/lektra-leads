import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
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
      .input(LeadFiltersSchema.optional())
      .mutation(async ({ input }) => {
        const leadsData = await getLeads(input ?? {});
        const csv = toHubSpotCSV(leadsData);
        return { csv, count: leadsData.length };
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
        return { success: true };
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
  }),
});

export type AppRouter = typeof appRouter;
