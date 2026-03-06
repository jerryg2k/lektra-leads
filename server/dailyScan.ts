import cron from "node-cron";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { leads, scanHistory } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoveredCompany {
  companyName: string;
  website?: string;
  description?: string;
  industry?: string;
  fundingStage?: string;
  totalFunding?: string;
  location?: string;
  headcount?: string;
  gpuUseCases?: string[];
  aiProducts?: string;
  techStack?: string;
  lektraFitReason?: string;
  recommendedGpu?: string;
  score?: number;
}

// ─── Search queries used to find new AI startups ──────────────────────────────

const SEARCH_QUERIES = [
  "new AI startup GPU inference 2025 2026 funding",
  "generative AI company raised seed series A 2025 2026",
  "AI model training startup funding announcement recent",
  "machine learning infrastructure startup new funding",
  "LLM fine-tuning startup 2025 2026 GPU compute",
  "AI video generation startup raised funding 2025",
  "robotics AI startup GPU workload funding 2025 2026",
  "AI drug discovery startup GPU compute 2025 2026",
];

// ─── Core scan function ───────────────────────────────────────────────────────

export async function runDailyScan(trigger: "cron" | "manual" = "cron"): Promise<{
  found: number;
  added: number;
  skipped: number;
  addedLeadIds: number[];
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { found: 0, added: 0, skipped: 0, addedLeadIds: [], error: "Database not available" };

  // Create a scan run record
  const [scanRow] = await db.insert(scanHistory).values({
    trigger,
    status: "running",
    found: 0,
    added: 0,
    skipped: 0,
  });
  const scanId = (scanRow as any).insertId as number;

  try {
    // Pick 3 random queries to keep variety
    const selectedQueries = SEARCH_QUERIES
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Ask LLM to discover companies based on the search queries
    const discoveryPrompt = `You are a business development researcher for Lektra Cloud, a GPU cloud provider.
Your task is to identify NEW AI startups that would be strong prospects for GPU rental services.

Search context — focus on companies matching these themes:
${selectedQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Based on your knowledge of the AI startup ecosystem (companies founded or that raised funding in 2024-2026), identify 8-12 AI startups that:
- Have significant GPU compute needs (inference, training, fine-tuning, video generation, robotics, drug discovery, etc.)
- Are at Seed, Series A, or Series B stage
- Have NOT yet established their own GPU infrastructure (likely renting or about to need cloud GPU)
- Are actively growing and would benefit from Lektra Cloud's H200/B200 GPU fleet

For each company, provide detailed information in the JSON schema below.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a GPU cloud business development researcher. Return only valid JSON." },
        { role: "user", content: discoveryPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "discovered_companies",
          strict: true,
          schema: {
            type: "object",
            properties: {
              companies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    companyName: { type: "string" },
                    website: { type: "string" },
                    description: { type: "string" },
                    industry: { type: "string" },
                    fundingStage: { type: "string", enum: ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Unknown"] },
                    totalFunding: { type: "string" },
                    location: { type: "string" },
                    headcount: { type: "string" },
                    gpuUseCases: { type: "array", items: { type: "string" } },
                    aiProducts: { type: "string" },
                    techStack: { type: "string" },
                    lektraFitReason: { type: "string" },
                    recommendedGpu: { type: "string", enum: ["H200", "RTX Pro 6000", "B200", "Multiple", "TBD"] },
                    score: { type: "number" },
                  },
                  required: ["companyName", "description", "fundingStage", "lektraFitReason", "recommendedGpu", "score"],
                  additionalProperties: false,
                },
              },
            },
            required: ["companies"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    const raw = typeof rawContent === "string" ? rawContent : null;
    if (!raw) throw new Error("LLM returned empty response");

    const parsed = JSON.parse(raw) as { companies: DiscoveredCompany[] };
    const discovered = parsed.companies ?? [];

    // Dedup: get existing company names (case-insensitive)
    const existingLeads = await db.select({ companyName: leads.companyName }).from(leads);
    const existingNames = new Set(existingLeads.map((l) => l.companyName.toLowerCase().trim()));

    let added = 0;
    let skipped = 0;
    const addedLeadIds: number[] = [];

    for (const company of discovered) {
      const normalizedName = company.companyName.toLowerCase().trim();
      if (existingNames.has(normalizedName)) {
        skipped++;
        continue;
      }

      // Validate score range
      const score = Math.min(100, Math.max(0, company.score ?? 50));

      // Only add if score >= 55 (decent fit threshold)
      if (score < 55) {
        skipped++;
        continue;
      }

      const [insertResult] = await db.insert(leads).values({
        companyName: company.companyName,
        website: company.website ?? null,
        description: company.description ?? null,
        industry: company.industry ?? "AI",
        location: company.location ?? null,
        headcount: company.headcount ?? null,
        fundingStage: (company.fundingStage as any) ?? "Unknown",
        totalFunding: company.totalFunding ?? null,
        gpuUseCases: company.gpuUseCases ?? [],
        aiProducts: company.aiProducts ?? null,
        techStack: company.techStack ?? null,
        lektraFitReason: company.lektraFitReason ?? null,
        recommendedGpu: (company.recommendedGpu as any) ?? "TBD",
        score,
        pipelineStage: "New",
        source: "Daily Auto-Scan",
        tags: ["auto-scan"],
      });

      const newLeadId = (insertResult as any).insertId as number;
      addedLeadIds.push(newLeadId);
      existingNames.add(normalizedName);
      added++;
    }

    // Update scan record
    await db.update(scanHistory)
      .set({
        status: "completed",
        found: discovered.length,
        added,
        skipped,
        addedLeadIds,
        completedAt: new Date(),
      })
      .where(eq(scanHistory.id, scanId));

    // Notify owner
    if (added > 0) {
      await notifyOwner({
        title: `🔍 Daily Scan: ${added} new AI startup${added === 1 ? "" : "s"} added`,
        content: `**Daily Auto-Scan completed** — ${discovered.length} companies evaluated, **${added} added** to pipeline, ${skipped} skipped (duplicates or low score).\n\nNew leads tagged \`auto-scan\` in your pipeline. Review them in the Leads page.`,
      });
    }

    return { found: discovered.length, added, skipped, addedLeadIds };
  } catch (err: any) {
    const errorMsg = err?.message ?? "Unknown error";
    console.error("[DailyScan] Error:", errorMsg);

    await db.update(scanHistory)
      .set({ status: "failed", errorMsg, completedAt: new Date() })
      .where(eq(scanHistory.id, scanId));

    return { found: 0, added: 0, skipped: 0, addedLeadIds: [], error: errorMsg };
  }
}

// ─── Cron job ─────────────────────────────────────────────────────────────────

export function startDailyScanCron(): void {
  // Every day at 6:00 AM UTC
  cron.schedule("0 0 6 * * *", async () => {
    console.log("[DailyScan] Starting daily AI startup scan...");
    const result = await runDailyScan("cron");
    if (result.error) {
      console.error(`[DailyScan] Failed: ${result.error}`);
    } else {
      console.log(`[DailyScan] ✅ Done — found: ${result.found}, added: ${result.added}, skipped: ${result.skipped}`);
    }
  });
  console.log("[DailyScan] Cron scheduled — every day at 06:00 UTC");
}
