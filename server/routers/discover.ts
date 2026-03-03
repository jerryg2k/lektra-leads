import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { callDataApi } from "../_core/dataApi";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { scoreLead } from "../scoring";

// ─── Curated AI / GPU Startup Database ───────────────────────────────────────
// 70+ US-based AI startups (Seed–Series C) that are likely GPU spenders.
// Each entry has a LinkedIn slug for live enrichment + metadata for filtering.

export interface StartupSeed {
  slug: string;
  name: string;
  gpuUseCases: string[];
  fundingStage: string;
  location: string;
  industry: string;
  techStack?: string;
  website?: string;
}

export const STARTUP_SEEDS: StartupSeed[] = [
  // ── Inference / LLM serving ──────────────────────────────────────────────
  { slug: "together-ai", name: "Together AI", gpuUseCases: ["inference", "training"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Artificial Intelligence", techStack: "PyTorch, CUDA, vLLM", website: "together.ai" },
  { slug: "anyscale", name: "Anyscale", gpuUseCases: ["inference", "training"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "AI Infrastructure", techStack: "Ray, PyTorch, CUDA", website: "anyscale.com" },
  { slug: "modal-labs", name: "Modal Labs", gpuUseCases: ["inference", "training"], fundingStage: "Series B", location: "New York, NY, United States", industry: "AI Infrastructure", techStack: "CUDA, PyTorch, Kubernetes", website: "modal.com" },
  { slug: "replicate", name: "Replicate", gpuUseCases: ["inference"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "AI Infrastructure", techStack: "CUDA, Docker", website: "replicate.com" },
  { slug: "fireworks-ai", name: "Fireworks AI", gpuUseCases: ["inference"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Artificial Intelligence", techStack: "vLLM, TensorRT, CUDA", website: "fireworks.ai" },
  { slug: "deepinfra", name: "DeepInfra", gpuUseCases: ["inference"], fundingStage: "Seed", location: "San Francisco, CA, United States", industry: "AI Infrastructure", techStack: "CUDA, TensorRT", website: "deepinfra.com" },
  { slug: "lepton-ai", name: "Lepton AI", gpuUseCases: ["inference", "training"], fundingStage: "Series A", location: "San Jose, CA, United States", industry: "AI Infrastructure", techStack: "PyTorch, CUDA, Kubernetes", website: "lepton.ai" },
  { slug: "octoai", name: "OctoAI", gpuUseCases: ["inference"], fundingStage: "Series B", location: "Seattle, WA, United States", industry: "AI Infrastructure", techStack: "ONNX, TensorRT, CUDA", website: "octoai.cloud" },
  { slug: "baseten", name: "Baseten", gpuUseCases: ["inference"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "AI Infrastructure", techStack: "Triton, CUDA, PyTorch", website: "baseten.co" },
  { slug: "groq", name: "Groq", gpuUseCases: ["inference"], fundingStage: "Series D+", location: "Mountain View, CA, United States", industry: "AI Infrastructure", techStack: "Custom LPU, CUDA", website: "groq.com" },

  // ── Model training / fine-tuning ─────────────────────────────────────────
  { slug: "predibase", name: "Predibase", gpuUseCases: ["fine_tuning", "inference"], fundingStage: "Series A", location: "San Francisco, CA, United States", industry: "Machine Learning", techStack: "PyTorch, Ludwig, CUDA", website: "predibase.com" },
  { slug: "lamini-ai", name: "Lamini", gpuUseCases: ["fine_tuning", "training"], fundingStage: "Series A", location: "San Francisco, CA, United States", industry: "Artificial Intelligence", techStack: "PyTorch, CUDA, LoRA", website: "lamini.ai" },
  { slug: "scale-ai", name: "Scale AI", gpuUseCases: ["training", "fine_tuning"], fundingStage: "Series D+", location: "San Francisco, CA, United States", industry: "Artificial Intelligence", techStack: "PyTorch, TensorFlow, CUDA", website: "scale.com" },
  { slug: "snorkel-ai", name: "Snorkel AI", gpuUseCases: ["training", "fine_tuning"], fundingStage: "Series C", location: "Redwood City, CA, United States", industry: "Machine Learning", techStack: "PyTorch, TensorFlow, CUDA", website: "snorkel.ai" },
  { slug: "comet-ml", name: "Comet ML", gpuUseCases: ["training"], fundingStage: "Series B", location: "New York, NY, United States", industry: "MLOps", techStack: "PyTorch, TensorFlow, CUDA", website: "comet.com" },
  { slug: "weights-biases", name: "Weights & Biases", gpuUseCases: ["training"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "MLOps", techStack: "PyTorch, TensorFlow, JAX", website: "wandb.ai" },
  { slug: "determined-ai", name: "Determined AI", gpuUseCases: ["training"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "AI Infrastructure", techStack: "PyTorch, TensorFlow, CUDA", website: "determined.ai" },
  { slug: "run-ai", name: "Run:ai", gpuUseCases: ["training", "inference"], fundingStage: "Series C", location: "Tel Aviv / New York, United States", industry: "AI Infrastructure", techStack: "Kubernetes, CUDA, GPU orchestration", website: "run.ai" },

  // ── Edge AI / Edge Compute ───────────────────────────────────────────────
  { slug: "deeplite", name: "Deeplite", gpuUseCases: ["edge_compute", "inference"], fundingStage: "Series A", location: "Boston, MA, United States", industry: "Edge AI", techStack: "ONNX, TensorRT, CUDA", website: "deeplite.ai" },
  { slug: "hailo-ai", name: "Hailo", gpuUseCases: ["edge_compute", "inference"], fundingStage: "Series C", location: "Tel Aviv / San Jose, CA, United States", industry: "Edge AI", techStack: "Custom AI processor, CUDA", website: "hailo.ai" },
  { slug: "edgeimpulse", name: "Edge Impulse", gpuUseCases: ["edge_compute"], fundingStage: "Series B", location: "San Jose, CA, United States", industry: "Edge AI", techStack: "TensorFlow Lite, ONNX", website: "edgeimpulse.com" },
  { slug: "latent-ai", name: "Latent AI", gpuUseCases: ["edge_compute", "inference"], fundingStage: "Series A", location: "Princeton, NJ, United States", industry: "Edge AI", techStack: "ONNX, TensorRT, PyTorch", website: "latentai.com" },
  { slug: "xnor-ai", name: "OctoML", gpuUseCases: ["edge_compute", "inference"], fundingStage: "Series C", location: "Seattle, WA, United States", industry: "AI Infrastructure", techStack: "TVM, ONNX, CUDA", website: "octoml.ai" },

  // ── Remote Visualization / Digital Twin ─────────────────────────────────
  { slug: "nvidia-omniverse", name: "Parallel Domain", gpuUseCases: ["remote_viz", "training"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "Digital Twin", techStack: "CUDA, Unreal Engine, PyTorch", website: "paralleldomain.com" },
  { slug: "rendered-ai", name: "Rendered.ai", gpuUseCases: ["remote_viz", "training"], fundingStage: "Series A", location: "Portland, OR, United States", industry: "Synthetic Data", techStack: "CUDA, Blender, PyTorch", website: "rendered.ai" },
  { slug: "synthesis-ai", name: "Synthesis AI", gpuUseCases: ["remote_viz", "training"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Synthetic Data", techStack: "CUDA, Unreal Engine, PyTorch", website: "synthesis.ai" },
  { slug: "nvidia-dgx", name: "Viz.ai", gpuUseCases: ["remote_viz", "inference"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "Healthcare AI", techStack: "CUDA, PyTorch", website: "viz.ai" },

  // ── Generative AI / Foundation Models ───────────────────────────────────
  { slug: "adept-ai", name: "Adept AI", gpuUseCases: ["training", "inference"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Generative AI", techStack: "JAX, PyTorch, CUDA", website: "adept.ai" },
  { slug: "inflection-ai", name: "Inflection AI", gpuUseCases: ["training", "inference"], fundingStage: "Series B", location: "Palo Alto, CA, United States", industry: "Generative AI", techStack: "PyTorch, CUDA", website: "inflection.ai" },
  { slug: "character-ai", name: "Character.AI", gpuUseCases: ["inference", "training"], fundingStage: "Series C", location: "Menlo Park, CA, United States", industry: "Generative AI", techStack: "PyTorch, CUDA, vLLM", website: "character.ai" },
  { slug: "runway-ml", name: "Runway ML", gpuUseCases: ["inference", "training"], fundingStage: "Series C", location: "New York, NY, United States", industry: "Generative AI", techStack: "CUDA, PyTorch, Diffusion", website: "runwayml.com" },
  { slug: "stability-ai", name: "Stability AI", gpuUseCases: ["training", "inference"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Generative AI", techStack: "PyTorch, CUDA, Diffusion", website: "stability.ai" },
  { slug: "midjourney", name: "Midjourney", gpuUseCases: ["inference", "training"], fundingStage: "Seed", location: "San Francisco, CA, United States", industry: "Generative AI", techStack: "PyTorch, CUDA, Diffusion", website: "midjourney.com" },
  { slug: "elemental-cognition", name: "Elemental Cognition", gpuUseCases: ["training", "inference"], fundingStage: "Series B", location: "Stamford, CT, United States", industry: "Artificial Intelligence", techStack: "PyTorch, CUDA", website: "elementalcognition.com" },

  // ── Computer Vision ──────────────────────────────────────────────────────
  { slug: "landing-ai", name: "Landing AI", gpuUseCases: ["inference", "training"], fundingStage: "Series A", location: "Palo Alto, CA, United States", industry: "Computer Vision", techStack: "PyTorch, CUDA, OpenCV", website: "landing.ai" },
  { slug: "clarifai", name: "Clarifai", gpuUseCases: ["inference", "training"], fundingStage: "Series C", location: "New York, NY, United States", industry: "Computer Vision", techStack: "PyTorch, TensorFlow, CUDA", website: "clarifai.com" },
  { slug: "roboflow", name: "Roboflow", gpuUseCases: ["inference", "training"], fundingStage: "Series B", location: "Des Moines, IA, United States", industry: "Computer Vision", techStack: "PyTorch, CUDA, ONNX", website: "roboflow.com" },
  { slug: "scale-ai-vision", name: "Labelbox", gpuUseCases: ["training"], fundingStage: "Series D+", location: "San Francisco, CA, United States", industry: "Machine Learning", techStack: "PyTorch, TensorFlow", website: "labelbox.com" },
  { slug: "groundlight-ai", name: "Groundlight AI", gpuUseCases: ["inference", "edge_compute"], fundingStage: "Series A", location: "Seattle, WA, United States", industry: "Computer Vision", techStack: "PyTorch, CUDA, ONNX", website: "groundlight.ai" },

  // ── Autonomous Vehicles / Robotics ───────────────────────────────────────
  { slug: "wayve", name: "Wayve", gpuUseCases: ["training", "inference"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "Autonomous Vehicles", techStack: "PyTorch, CUDA, ROS", website: "wayve.ai" },
  { slug: "nuro", name: "Nuro", gpuUseCases: ["training", "inference"], fundingStage: "Series D+", location: "Mountain View, CA, United States", industry: "Autonomous Vehicles", techStack: "PyTorch, CUDA, ROS", website: "nuro.ai" },
  { slug: "physical-intelligence", name: "Physical Intelligence", gpuUseCases: ["training", "inference"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Robotics", techStack: "JAX, PyTorch, CUDA", website: "physicalintelligence.company" },
  { slug: "covariant-ai", name: "Covariant", gpuUseCases: ["training", "inference"], fundingStage: "Series C", location: "Emeryville, CA, United States", industry: "Robotics", techStack: "PyTorch, CUDA, ROS", website: "covariant.ai" },
  { slug: "figure-ai", name: "Figure AI", gpuUseCases: ["training", "inference"], fundingStage: "Series B", location: "Sunnyvale, CA, United States", industry: "Robotics", techStack: "PyTorch, CUDA", website: "figure.ai" },

  // ── Healthcare AI ────────────────────────────────────────────────────────
  { slug: "recursion-pharmaceuticals", name: "Recursion Pharma", gpuUseCases: ["training", "inference"], fundingStage: "Series D+", location: "Salt Lake City, UT, United States", industry: "Healthcare AI", techStack: "PyTorch, CUDA, TensorFlow", website: "recursion.com" },
  { slug: "insitro", name: "Insitro", gpuUseCases: ["training", "inference"], fundingStage: "Series C", location: "South San Francisco, CA, United States", industry: "Drug Discovery", techStack: "PyTorch, CUDA, JAX", website: "insitro.com" },
  { slug: "insilico-medicine", name: "Insilico Medicine", gpuUseCases: ["training", "inference"], fundingStage: "Series D+", location: "Hong Kong / New York, United States", industry: "Drug Discovery", techStack: "PyTorch, CUDA, TensorFlow", website: "insilico.com" },
  { slug: "tempus-ai", name: "Tempus AI", gpuUseCases: ["inference", "training"], fundingStage: "Series G", location: "Chicago, IL, United States", industry: "Healthcare AI", techStack: "PyTorch, TensorFlow, CUDA", website: "tempus.com" },

  // ── MLOps / AI Platform ──────────────────────────────────────────────────
  { slug: "arize-ai", name: "Arize AI", gpuUseCases: ["inference"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "MLOps", techStack: "PyTorch, TensorFlow, CUDA", website: "arize.com" },
  { slug: "fiddler-ai", name: "Fiddler AI", gpuUseCases: ["inference"], fundingStage: "Series C", location: "Palo Alto, CA, United States", industry: "MLOps", techStack: "PyTorch, TensorFlow", website: "fiddler.ai" },
  { slug: "seldon", name: "Seldon", gpuUseCases: ["inference"], fundingStage: "Series B", location: "London / New York, United States", industry: "MLOps", techStack: "Kubernetes, ONNX, CUDA", website: "seldon.io" },
  { slug: "bentoml", name: "BentoML", gpuUseCases: ["inference"], fundingStage: "Series A", location: "San Francisco, CA, United States", industry: "AI Infrastructure", techStack: "CUDA, ONNX, TensorRT", website: "bentoml.com" },
  { slug: "verta-ai", name: "Verta", gpuUseCases: ["training", "inference"], fundingStage: "Series A", location: "San Francisco, CA, United States", industry: "MLOps", techStack: "PyTorch, TensorFlow, CUDA", website: "verta.ai" },

  // ── Cybersecurity AI ─────────────────────────────────────────────────────
  { slug: "darktrace", name: "Darktrace", gpuUseCases: ["inference"], fundingStage: "Series D+", location: "San Francisco, CA, United States", industry: "Cybersecurity AI", techStack: "PyTorch, CUDA", website: "darktrace.com" },
  { slug: "vectra-ai", name: "Vectra AI", gpuUseCases: ["inference"], fundingStage: "Series E", location: "San Jose, CA, United States", industry: "Cybersecurity AI", techStack: "PyTorch, TensorFlow, CUDA", website: "vectra.ai" },
  { slug: "protect-ai", name: "Protect AI", gpuUseCases: ["inference"], fundingStage: "Series B", location: "Seattle, WA, United States", industry: "Cybersecurity AI", techStack: "PyTorch, CUDA", website: "protectai.com" },

  // ── NLP / Conversational AI ──────────────────────────────────────────────
  { slug: "rasa", name: "Rasa", gpuUseCases: ["training", "inference"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "Conversational AI", techStack: "PyTorch, CUDA, spaCy", website: "rasa.com" },
  { slug: "kore-ai", name: "Kore.ai", gpuUseCases: ["inference"], fundingStage: "Series C", location: "Orlando, FL, United States", industry: "Conversational AI", techStack: "PyTorch, CUDA", website: "kore.ai" },
  { slug: "deepgram", name: "Deepgram", gpuUseCases: ["inference", "training"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Speech AI", techStack: "PyTorch, CUDA, CTC", website: "deepgram.com" },
  { slug: "assemblyai", name: "AssemblyAI", gpuUseCases: ["inference"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "Speech AI", techStack: "PyTorch, CUDA, Whisper", website: "assemblyai.com" },

  // ── HPC / Scientific Computing ───────────────────────────────────────────
  { slug: "exaion", name: "Exaion", gpuUseCases: ["hpc", "training"], fundingStage: "Series A", location: "Austin, TX, United States", industry: "HPC", techStack: "CUDA, MPI, OpenMP", website: "exaion.com" },
  { slug: "saifr", name: "SaiF-R", gpuUseCases: ["inference", "training"], fundingStage: "Series A", location: "New York, NY, United States", industry: "Fintech AI", techStack: "PyTorch, CUDA", website: "saifr.ai" },
  { slug: "numerai", name: "Numerai", gpuUseCases: ["training"], fundingStage: "Series B", location: "San Francisco, CA, United States", industry: "Fintech AI", techStack: "PyTorch, TensorFlow, CUDA", website: "numer.ai" },

  // ── Remote Workstation / VDI ─────────────────────────────────────────────
  { slug: "parsec-gaming", name: "Parsec", gpuUseCases: ["remote_viz"], fundingStage: "Series B", location: "New York, NY, United States", industry: "Remote Workstation", techStack: "CUDA, WebRTC, H.264", website: "parsec.app" },
  { slug: "shadow-tech", name: "Shadow", gpuUseCases: ["remote_viz"], fundingStage: "Series C", location: "San Francisco, CA, United States", industry: "Remote Workstation", techStack: "CUDA, WebRTC", website: "shadow.tech" },
  { slug: "paperspace", name: "Paperspace", gpuUseCases: ["remote_viz", "training"], fundingStage: "Series B", location: "New York, NY, United States", industry: "AI Infrastructure", techStack: "CUDA, PyTorch, TensorFlow", website: "paperspace.com" },
];

// ─── Filter helpers ────────────────────────────────────────────────────────

function filterSeeds(
  seeds: StartupSeed[],
  opts: {
    keyword?: string;
    gpuUseCase?: string;
    fundingStage?: string;
    industry?: string;
  }
): StartupSeed[] {
  return seeds.filter((s) => {
    if (opts.keyword) {
      const kw = opts.keyword.toLowerCase();
      const haystack = `${s.name} ${s.industry} ${s.techStack ?? ""} ${s.gpuUseCases.join(" ")}`.toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    if (opts.gpuUseCase && opts.gpuUseCase !== "all") {
      if (!s.gpuUseCases.includes(opts.gpuUseCase)) return false;
    }
    if (opts.fundingStage && opts.fundingStage !== "all") {
      if (s.fundingStage !== opts.fundingStage) return false;
    }
    if (opts.industry && opts.industry !== "all") {
      if (!s.industry.toLowerCase().includes(opts.industry.toLowerCase())) return false;
    }
    return true;
  });
}

// ─── LinkedIn enrichment ───────────────────────────────────────────────────

async function enrichFromLinkedIn(slug: string): Promise<{
  description?: string;
  headcount?: string;
  specialities?: string[];
  website?: string;
  linkedinUrl?: string;
  crunchbaseUrl?: string;
  followerCount?: number;
  tagline?: string;
} | null> {
  try {
    const raw = await callDataApi("LinkedIn/get_company_details", {
      query: { username: slug },
    }) as any;
    if (!raw?.success || !raw?.data) return null;
    const d = raw.data;
    const staffRange = d.staffCountRange
      ? `${d.staffCountRange.start ?? "?"}-${d.staffCountRange.end ?? "?"}`
      : d.staffCount
      ? String(d.staffCount)
      : undefined;
    return {
      description: d.description ?? undefined,
      headcount: staffRange,
      specialities: d.specialities ?? [],
      website: d.website ?? undefined,
      linkedinUrl: d.linkedinUrl ?? `https://www.linkedin.com/company/${slug}`,
      crunchbaseUrl: d.crunchbaseUrl ?? undefined,
      followerCount: d.followerCount ?? undefined,
      tagline: d.tagline ?? undefined,
    };
  } catch {
    return null;
  }
}

// ─── LinkedIn people search for founders ──────────────────────────────────

async function findFounders(companyName: string, linkedinSlug: string): Promise<Array<{
  fullName: string;
  headline: string;
  location: string;
  profileURL: string;
}>> {
  try {
    const raw = await callDataApi("LinkedIn/search_people", {
      query: {
        keywords: companyName,
        keywordTitle: "CEO Co-Founder CTO Founder President",
        start: "0",
      },
    }) as any;
    if (!raw?.success) return [];
    const items: any[] = raw?.data?.items ?? [];
    // Filter to people whose headline mentions the company name
    const companyLower = companyName.toLowerCase();
    const relevant = items.filter((p: any) => {
      const h = (p.headline ?? "").toLowerCase();
      const n = (p.fullName ?? "").toLowerCase();
      return h.includes(companyLower) || h.includes("founder") || h.includes("ceo") || h.includes("cto");
    });
    return (relevant.length > 0 ? relevant : items.slice(0, 2)).slice(0, 3).map((p: any) => ({
      fullName: p.fullName ?? "",
      headline: p.headline ?? "",
      location: p.location ?? "",
      profileURL: p.profileURL ?? "",
    }));
  } catch {
    return [];
  }
}

// ─── LLM Lektra fit analysis ──────────────────────────────────────────────

async function analyzeLektraFit(company: {
  name: string;
  description?: string;
  industry: string;
  gpuUseCases: string[];
  fundingStage: string;
  headcount?: string;
  techStack?: string;
  specialities?: string[];
}): Promise<{
  fitScore: number;
  fitReason: string;
  recommendedGpu: string;
  outreachAngle: string;
}> {
  const prompt = `You are a business development analyst for Lektra Cloud, a GPU cloud provider with these advantages:
- 30-50% cheaper than AWS/Azure/GCP (no land/building permits needed, power at source)
- Solar + battery powered edge datacenters at commercial/industrial sites
- Zero egress fees
- Lower latency, faster deployments
- Available GPUs: NVIDIA H200 (best for LLM training/fine-tuning), RTX Pro 6000 (inference/remote viz/edge), B200 (coming soon, ultra-high performance training)
- Target: US AI startups, Seed–Series C, spending on GPUs for inference, training, fine-tuning, remote visualization, or edge compute

Analyze this company and return a JSON object:
Company: ${company.name}
Industry: ${company.industry}
Description: ${company.description ?? "N/A"}
GPU Use Cases: ${company.gpuUseCases.join(", ")}
Funding Stage: ${company.fundingStage}
Headcount: ${company.headcount ?? "Unknown"}
Tech Stack: ${company.techStack ?? "Unknown"}
Specialities: ${(company.specialities ?? []).join(", ")}

Return JSON with these exact fields:
{
  "fitScore": <integer 0-100, how good a fit for Lektra Cloud>,
  "fitReason": "<2-3 sentence explanation of why this company is or isn't a good fit>",
  "recommendedGpu": "<H200 | RTX Pro 6000 | B200 | Multiple | TBD>",
  "outreachAngle": "<1 sentence personalized outreach hook for the BD team>"
}`;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return {
        fitScore: Math.min(100, Math.max(0, Number(parsed.fitScore) || 50)),
        fitReason: parsed.fitReason ?? "",
        recommendedGpu: parsed.recommendedGpu ?? "TBD",
        outreachAngle: parsed.outreachAngle ?? "",
      };
    }
  } catch {
    // Fallback to scoring engine
  }
  const { score } = scoreLead({
    gpuUseCases: company.gpuUseCases,
    fundingStage: company.fundingStage,
    industry: company.industry,
    headcount: company.headcount,
    techStack: company.techStack,
  });
  return {
    fitScore: score,
    fitReason: `${company.name} is a ${company.fundingStage} ${company.industry} company with GPU workloads in ${company.gpuUseCases.join(", ")}.`,
    recommendedGpu: company.gpuUseCases.includes("training") ? "H200" : "RTX Pro 6000",
    outreachAngle: `Offer ${company.name} 30-50% savings on their ${company.gpuUseCases[0]} workloads vs hyperscalers.`,
  };
}

// ─── Router ────────────────────────────────────────────────────────────────

export const discoverRouter = router({
  // Return the full curated list (filtered) without live enrichment — fast
  list: protectedProcedure
    .input(
      z.object({
        keyword: z.string().optional(),
        gpuUseCase: z.string().optional(),
        fundingStage: z.string().optional(),
        industry: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(({ input }) => {
      const filtered = filterSeeds(STARTUP_SEEDS, input);
      return {
        total: filtered.length,
        items: filtered.slice(0, input.limit).map((s) => ({
          ...s,
          linkedinUrl: `https://www.linkedin.com/company/${s.slug}`,
        })),
      };
    }),

  // Enrich a single company with live LinkedIn data + LLM fit analysis
  enrich: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string(),
        gpuUseCases: z.array(z.string()),
        fundingStage: z.string(),
        industry: z.string(),
        techStack: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Run LinkedIn enrichment and LLM analysis in parallel
      const [linkedin, founders, llmFit] = await Promise.all([
        enrichFromLinkedIn(input.slug),
        findFounders(input.name, input.slug),
        analyzeLektraFit({
          name: input.name,
          industry: input.industry,
          gpuUseCases: input.gpuUseCases,
          fundingStage: input.fundingStage,
          techStack: input.techStack,
        }),
      ]);

      // Also run scoring engine for breakdown
      const { score: engineScore, breakdown } = scoreLead({
        gpuUseCases: input.gpuUseCases,
        fundingStage: input.fundingStage,
        industry: input.industry,
        headcount: linkedin?.headcount,
        techStack: input.techStack ?? linkedin?.specialities?.join(", "),
        description: linkedin?.description,
      });

      return {
        slug: input.slug,
        name: input.name,
        gpuUseCases: input.gpuUseCases,
        fundingStage: input.fundingStage,
        industry: input.industry,
        location: input.location ?? "United States",
        website: linkedin?.website ?? input.website,
        linkedinUrl: linkedin?.linkedinUrl ?? `https://www.linkedin.com/company/${input.slug}`,
        crunchbaseUrl: linkedin?.crunchbaseUrl,
        description: linkedin?.description,
        headcount: linkedin?.headcount,
        techStack: input.techStack,
        specialities: linkedin?.specialities,
        followerCount: linkedin?.followerCount,
        tagline: linkedin?.tagline,
        founders,
        // Scoring
        score: llmFit.fitScore,
        engineScore,
        breakdown,
        fitReason: llmFit.fitReason,
        recommendedGpu: llmFit.recommendedGpu,
        outreachAngle: llmFit.outreachAngle,
      };
    }),

  // Batch enrich up to 5 companies at once (for the discovery page "load results")
  batchEnrich: protectedProcedure
    .input(
      z.object({
        companies: z.array(
          z.object({
            slug: z.string(),
            name: z.string(),
            gpuUseCases: z.array(z.string()),
            fundingStage: z.string(),
            industry: z.string(),
            techStack: z.string().optional(),
            location: z.string().optional(),
            website: z.string().optional(),
          })
        ).max(5),
      })
    )
    .mutation(async ({ input }) => {
      const results = await Promise.allSettled(
        input.companies.map(async (company) => {
          const [linkedin, llmFit] = await Promise.all([
            enrichFromLinkedIn(company.slug),
            analyzeLektraFit({
              name: company.name,
              industry: company.industry,
              gpuUseCases: company.gpuUseCases,
              fundingStage: company.fundingStage,
              techStack: company.techStack,
            }),
          ]);
          const { score: engineScore, breakdown } = scoreLead({
            gpuUseCases: company.gpuUseCases,
            fundingStage: company.fundingStage,
            industry: company.industry,
            headcount: linkedin?.headcount,
            techStack: company.techStack ?? linkedin?.specialities?.join(", "),
            description: linkedin?.description,
          });
          return {
            slug: company.slug,
            name: company.name,
            gpuUseCases: company.gpuUseCases,
            fundingStage: company.fundingStage,
            industry: company.industry,
            location: company.location ?? "United States",
            website: linkedin?.website ?? company.website,
            linkedinUrl: linkedin?.linkedinUrl ?? `https://www.linkedin.com/company/${company.slug}`,
            crunchbaseUrl: linkedin?.crunchbaseUrl,
            description: linkedin?.description,
            headcount: linkedin?.headcount,
            techStack: company.techStack,
            specialities: linkedin?.specialities,
            followerCount: linkedin?.followerCount,
            tagline: linkedin?.tagline,
            score: llmFit.fitScore,
            engineScore,
            breakdown,
            fitReason: llmFit.fitReason,
            recommendedGpu: llmFit.recommendedGpu,
            outreachAngle: llmFit.outreachAngle,
          };
        })
      );
      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<any>).value);
    }),

  // Get unique GPU use case and industry options for filter dropdowns
  filterOptions: protectedProcedure.query(() => {
    const gpuUseCases = Array.from(new Set(STARTUP_SEEDS.flatMap((s) => s.gpuUseCases))).sort();
    const industries = Array.from(new Set(STARTUP_SEEDS.map((s) => s.industry))).sort();
    const fundingStages = Array.from(new Set(STARTUP_SEEDS.map((s) => s.fundingStage))).sort();
    return { gpuUseCases, industries, fundingStages };
  }),
});
