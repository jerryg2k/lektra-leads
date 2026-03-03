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
