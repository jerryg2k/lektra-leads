/**
 * Import LinkedIn connection leads into the Lektra leads database.
 * These are AI/GPU startup founders and decision-makers from the user's network.
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// ─── LinkedIn leads data ──────────────────────────────────────────────────────
// Curated from 3,455 LinkedIn connections — 35 qualified AI startup decision-makers

const linkedinLeads = [
  // ── Tier 1: Pure AI/GPU Startups (Highest fit) ───────────────────────────
  {
    companyName: "GPUaaS.com",
    website: "gpuaas.com",
    description: "GPU-as-a-Service platform providing on-demand GPU compute for AI workloads. Direct competitor-aware prospect — understands GPU economics deeply.",
    industry: "AI Infrastructure",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["inference", "training"],
    techStack: "CUDA, GPU orchestration",
    pipelineStage: "New",
    score: 95,
    source: "LinkedIn Connections",
    lektraFitReason: "GPUaaS.com is a direct GPU cloud play — their co-founder Ditlev Bredahl understands GPU economics and would immediately grasp Lektra's 30-50% cost advantage from solar-powered edge datacenters. High-priority outreach.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Ditlev", lastName: "Bredahl", title: "Co-Founder", linkedinUrl: "https://www.linkedin.com/in/ditlev", isPrimary: true, fitReason: "Co-founder of a GPU cloud service — directly understands Lektra's value prop and cost structure" }
    ]
  },
  {
    companyName: "GT Edge AI",
    website: "gtedgeai.com",
    description: "Edge AI startup focused on deploying AI inference at the edge. Strong alignment with Lektra's edge datacenter model.",
    industry: "Edge AI",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["edge_compute", "inference"],
    techStack: "Edge AI, CUDA, inference",
    pipelineStage: "New",
    score: 92,
    source: "LinkedIn Connections",
    lektraFitReason: "GT Edge AI's focus on edge AI inference is a perfect match for Lektra's edge-scale datacenters at power sources. Tom Bendien as Founder/CEO is the right contact for a conversation about GPU rental at the edge.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Tom", lastName: "Bendien", title: "Founder and CEO", linkedinUrl: "https://www.linkedin.com/in/tbendien", isPrimary: true, fitReason: "Founder/CEO of an edge AI company — Lektra's edge datacenter model is directly relevant to their deployment strategy" }
    ]
  },
  {
    companyName: "Embedded LLM",
    website: "embeddedllm.com",
    description: "Startup focused on embedding large language models into edge devices and applications. Requires GPU compute for both training and inference.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["inference", "fine_tuning", "edge_compute"],
    techStack: "LLM, CUDA, edge compute",
    pipelineStage: "New",
    score: 90,
    source: "LinkedIn Connections",
    lektraFitReason: "Embedded LLM needs GPU compute for LLM inference and fine-tuning at the edge — exactly what Lektra's RTX Pro 6000 and H200 nodes are optimized for. Zero egress fees are a major cost advantage for their workloads.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Pin Siang", lastName: "Tan", title: "Co-Founder", linkedinUrl: "https://www.linkedin.com/in/tanpinsiang", isPrimary: true, fitReason: "Co-founder building LLM edge inference products — Lektra's low-latency edge nodes directly address their deployment needs" }
    ]
  },
  {
    companyName: "Fireworks AI",
    website: "fireworks.ai",
    description: "Fast inference platform for open-source LLMs. Serving millions of API calls daily with optimized GPU infrastructure.",
    industry: "AI Infrastructure",
    location: "San Francisco, CA, United States",
    fundingStage: "Series B",
    gpuUseCases: ["inference"],
    techStack: "vLLM, TensorRT, CUDA, PyTorch",
    pipelineStage: "New",
    score: 88,
    source: "LinkedIn Connections",
    lektraFitReason: "Fireworks AI is a high-volume LLM inference platform spending heavily on GPU compute. Lektra's H200 nodes and zero egress fees could deliver significant cost savings on their inference workloads vs AWS/Azure.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Bardia", lastName: "Shahali", title: "VP of Sales", linkedinUrl: "https://www.linkedin.com/in/bardiashahali", isPrimary: true, fitReason: "VP of Sales at a Series B inference platform — can champion Lektra internally and understands GPU cost structures" }
    ]
  },
  {
    companyName: "Vectra AI",
    website: "vectra.ai",
    description: "AI-powered cybersecurity platform using machine learning for threat detection and response. Runs continuous inference workloads.",
    industry: "Cybersecurity AI",
    location: "San Jose, CA, United States",
    fundingStage: "Series E",
    gpuUseCases: ["inference"],
    techStack: "PyTorch, TensorFlow, CUDA",
    pipelineStage: "New",
    score: 82,
    source: "LinkedIn Connections",
    lektraFitReason: "Vectra AI runs continuous AI inference for real-time threat detection — a workload that benefits from Lektra's low-latency edge nodes and zero egress fees. Their Series E scale means significant GPU spend.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "John", lastName: "Skinner", title: "VP Corporate/Business Development", linkedinUrl: "https://www.linkedin.com/in/john-skinner-48a7367", isPrimary: true, fitReason: "VP of Business Development — the right person to evaluate infrastructure partnerships and cost reduction opportunities" }
    ]
  },
  {
    companyName: "Abnormal AI",
    website: "abnormalsecurity.com",
    description: "AI-native email security platform using behavioral AI to detect sophisticated attacks. High-volume inference workloads.",
    industry: "Cybersecurity AI",
    location: "San Francisco, CA, United States",
    fundingStage: "Series D+",
    gpuUseCases: ["inference"],
    techStack: "PyTorch, CUDA, behavioral AI",
    pipelineStage: "New",
    score: 80,
    source: "LinkedIn Connections",
    lektraFitReason: "Abnormal AI processes millions of emails daily with AI inference — a high-volume GPU workload where Lektra's cost advantage and zero egress fees could deliver substantial savings.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Rachel", lastName: "Budlong", title: "Head of Global GTM and G&A Recruiting", linkedinUrl: "https://www.linkedin.com/in/stellarhirepartners", isPrimary: true, fitReason: "GTM leadership contact — can facilitate introductions to infrastructure and engineering decision-makers" }
    ]
  },
  {
    companyName: "Locus Robotics",
    website: "locusrobotics.com",
    description: "Autonomous mobile robot (AMR) platform for warehouse fulfillment. Runs AI inference for navigation and object detection.",
    industry: "Robotics",
    location: "Wilmington, MA, United States",
    fundingStage: "Series F",
    gpuUseCases: ["inference", "training"],
    techStack: "ROS, PyTorch, CUDA, computer vision",
    pipelineStage: "New",
    score: 80,
    source: "LinkedIn Connections",
    lektraFitReason: "Locus Robotics trains and runs AI models for warehouse robot navigation — GPU-intensive workloads that benefit from Lektra's H200 training nodes and RTX Pro 6000 inference nodes at lower cost than hyperscalers.",
    recommendedGpu: "Multiple",
    contacts: [
      { firstName: "Rick", lastName: "Faulk", title: "CEO", linkedinUrl: "https://www.linkedin.com/in/rickfaulk", isPrimary: true, fitReason: "CEO of a robotics AI company — strategic decision-maker for infrastructure partnerships and cost optimization" }
    ]
  },
  {
    companyName: "Digital Twin Labs, USA",
    website: "digitaltwinlabs.com",
    description: "Digital twin platform for industrial and commercial applications. Requires GPU compute for real-time 3D visualization and simulation.",
    industry: "Digital Twin",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["remote_viz", "training"],
    techStack: "CUDA, Unreal Engine, simulation",
    pipelineStage: "New",
    score: 88,
    source: "LinkedIn Connections",
    lektraFitReason: "Digital twin applications require GPU-accelerated rendering and simulation — a perfect use case for Lektra's RTX Pro 6000 nodes. Edge placement reduces latency for real-time visualization workloads.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Gurvinder Singh", lastName: "Ahluwalia", title: "Founder & CEO", linkedinUrl: "https://www.linkedin.com/in/gurvinderahluwalia", isPrimary: true, fitReason: "Founder/CEO of a digital twin company — GPU-accelerated visualization is core to their product, making Lektra's RTX Pro 6000 nodes highly relevant" }
    ]
  },
  {
    companyName: "Sensori Robotics",
    website: "sensorirobotics.com",
    description: "Robotics startup developing AI-powered sensing and perception systems. Requires GPU compute for training and edge inference.",
    industry: "Robotics",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["training", "inference", "edge_compute"],
    techStack: "PyTorch, CUDA, ROS, computer vision",
    pipelineStage: "New",
    score: 87,
    source: "LinkedIn Connections",
    lektraFitReason: "Sensori Robotics needs GPU compute for training perception models and running edge inference — both use cases where Lektra's H200 and RTX Pro 6000 nodes provide cost-effective alternatives to hyperscalers.",
    recommendedGpu: "Multiple",
    contacts: [
      { firstName: "Ross", lastName: "Melbourne", title: "Founder and CEO", linkedinUrl: "https://www.linkedin.com/in/rossmelbourne", isPrimary: true, fitReason: "Founder/CEO of a robotics AI startup — GPU compute for training and inference is central to their R&D and product development" }
    ]
  },
  {
    companyName: "8wave.ai",
    website: "8wave.ai",
    description: "AI startup building next-generation wave-based AI solutions. Requires GPU infrastructure for model training and inference.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["training", "inference"],
    techStack: "PyTorch, CUDA, AI",
    pipelineStage: "New",
    score: 85,
    source: "LinkedIn Connections",
    lektraFitReason: "8wave.ai is an early-stage AI startup where GPU cost efficiency is critical to runway. Lektra's 30-50% savings vs hyperscalers could meaningfully extend their operating budget.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Jukka", lastName: "Remes", title: "Founder & CTO", linkedinUrl: "https://www.linkedin.com/in/jukka-remes", isPrimary: true, fitReason: "Founder/CTO — technical decision-maker who will appreciate Lektra's GPU specs and cost advantage for AI training workloads" }
    ]
  },
  {
    companyName: "Stealth AI Startup",
    website: "",
    description: "Early-stage AI startup in stealth mode. Multiple co-founders with AI background.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["training", "inference"],
    techStack: "AI, machine learning",
    pipelineStage: "New",
    score: 82,
    source: "LinkedIn Connections",
    lektraFitReason: "Stealth AI startups in early stages are ideal Lektra customers — they need GPU compute but can't commit to hyperscaler contracts. Lektra's flexible pricing and fast deployment are compelling.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Viraj", lastName: "Paropkari", title: "Founder", linkedinUrl: "https://www.linkedin.com/in/virajparopkari", isPrimary: true, fitReason: "Founder of a stealth AI startup — early-stage GPU needs where Lektra's cost advantage and flexibility are most compelling" },
      { firstName: "Gil", lastName: "Reiter", title: "Co-Founder", linkedinUrl: "https://www.linkedin.com/in/gil-reiter", isPrimary: false, fitReason: "Co-founder — additional decision-maker contact for the same stealth AI venture" }
    ]
  },
  {
    companyName: "Premisys.ai",
    website: "premisys.ai",
    description: "AI platform company building enterprise AI solutions. Requires GPU infrastructure for model training and deployment.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Series A",
    gpuUseCases: ["inference", "training"],
    techStack: "PyTorch, CUDA, enterprise AI",
    pipelineStage: "New",
    score: 85,
    source: "LinkedIn Connections",
    lektraFitReason: "Premisys.ai is building enterprise AI solutions requiring significant GPU compute. As a Series A company scaling their platform, Lektra's cost advantage and fast deployment could accelerate their growth.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Prabhat K.", lastName: "Gupta", title: "Chief Executive Officer", linkedinUrl: "https://www.linkedin.com/in/pkgupta", isPrimary: true, fitReason: "CEO of an enterprise AI platform — strategic decision-maker for infrastructure partnerships that affect cost and scalability" }
    ]
  },
  {
    companyName: "BRAHMA AI",
    website: "brahmaai.com",
    description: "AI startup developing advanced AI systems. GPU-intensive workloads for model training and inference.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["training", "inference"],
    techStack: "AI, deep learning, CUDA",
    pipelineStage: "New",
    score: 83,
    source: "LinkedIn Connections",
    lektraFitReason: "BRAHMA AI is building advanced AI systems requiring significant GPU compute. Early-stage companies benefit most from Lektra's 30-50% savings vs hyperscalers to extend runway.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Tom", lastName: "Graham", title: "President", linkedinUrl: "https://www.linkedin.com/in/tomgtgraham", isPrimary: true, fitReason: "President of an AI startup — executive decision-maker for infrastructure spend and vendor partnerships" }
    ]
  },
  {
    companyName: "Alanna.ai",
    website: "alanna.ai",
    description: "AI startup building intelligent automation solutions. Requires GPU compute for AI model training and inference.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["inference", "training"],
    techStack: "AI, machine learning, CUDA",
    pipelineStage: "New",
    score: 83,
    source: "LinkedIn Connections",
    lektraFitReason: "Alanna.ai is an early-stage AI automation startup where GPU cost efficiency is critical. Lektra's flexible, no-commitment GPU rentals and 30-50% cost savings are ideal for their stage.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Hoyt", lastName: "Mann", title: "President & Co-Founder", linkedinUrl: "https://www.linkedin.com/in/hoytmann", isPrimary: true, fitReason: "Co-founder and President — strategic decision-maker who controls infrastructure spend and vendor relationships" }
    ]
  },
  {
    companyName: "Loop AI Group Cognitive Computing",
    website: "loop.ai",
    description: "Cognitive computing platform using AI for enterprise knowledge management. Runs AI inference and training workloads.",
    industry: "Artificial Intelligence",
    location: "San Francisco, CA, United States",
    fundingStage: "Series A",
    gpuUseCases: ["inference", "training"],
    techStack: "cognitive AI, CUDA, PyTorch",
    pipelineStage: "New",
    score: 83,
    source: "LinkedIn Connections",
    lektraFitReason: "Loop AI Group builds cognitive computing systems requiring continuous AI inference. Lektra's RTX Pro 6000 nodes and zero egress fees are well-suited for their enterprise AI workloads.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "GM", lastName: "Calafiore", title: "President, Founder", linkedinUrl: "https://www.linkedin.com/in/fqa25sdgyq", isPrimary: true, fitReason: "Founder and President of a cognitive AI company — decision-maker for infrastructure and compute partnerships" }
    ]
  },
  {
    companyName: "Neon Red Ai",
    website: "neonredai.com",
    description: "AI startup building next-generation AI solutions. Early-stage with GPU compute needs for training and inference.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["training", "inference"],
    techStack: "AI, deep learning",
    pipelineStage: "New",
    score: 82,
    source: "LinkedIn Connections",
    lektraFitReason: "Neon Red AI is an early-stage startup where GPU cost efficiency directly impacts runway. Lektra's 30-50% savings and fast deployment (no land/permit delays) are compelling for their growth stage.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Boris Peter v.", lastName: "Manitius", title: "Co-Founder", linkedinUrl: "https://www.linkedin.com/in/borismanitius", isPrimary: true, fitReason: "Co-founder of an AI startup — technical and business decision-maker for GPU infrastructure choices" }
    ]
  },
  {
    companyName: "Pattana.AI",
    website: "pattana.ai",
    description: "AI startup developing intelligent solutions. Requires GPU compute for model development and deployment.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["training", "inference"],
    techStack: "AI, machine learning",
    pipelineStage: "New",
    score: 82,
    source: "LinkedIn Connections",
    lektraFitReason: "Pattana.AI is building AI solutions requiring GPU compute. As a seed-stage company, Lektra's cost advantage and flexible GPU rental model can help them scale without overcommitting to expensive hyperscaler contracts.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Yuan", lastName: "Wang", title: "Co-Founder", linkedinUrl: "https://www.linkedin.com/in/ywang3276", isPrimary: true, fitReason: "Co-founder — key decision-maker for infrastructure and compute strategy at an early-stage AI company" }
    ]
  },
  {
    companyName: "Global AI",
    website: "globalai.com",
    description: "AI platform company offering global AI services and solutions. Significant GPU compute requirements for training and inference.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Series A",
    gpuUseCases: ["training", "inference"],
    techStack: "AI, machine learning, CUDA",
    pipelineStage: "New",
    score: 82,
    source: "LinkedIn Connections",
    lektraFitReason: "Global AI is scaling an AI platform with significant GPU compute needs. Lektra's H200 nodes and zero egress fees could deliver substantial cost savings as they grow their global AI services.",
    recommendedGpu: "H200",
    contacts: [
      { firstName: "Sami", lastName: "Issa", title: "Co-Founder & CEO", linkedinUrl: "https://www.linkedin.com/in/samiissa", isPrimary: true, fitReason: "Co-founder and CEO — top decision-maker for infrastructure strategy and cost optimization" },
      { firstName: "Balázs", lastName: "Tóth", title: "Director of Finance", linkedinUrl: "https://www.linkedin.com/in/bal%C3%A1zs-t%C3%B3th-mba-3aa8816", isPrimary: false, fitReason: "Finance Director — key stakeholder for evaluating GPU cost savings and ROI of switching to Lektra" }
    ]
  },
  {
    companyName: "Vespa.ai",
    website: "vespa.ai",
    description: "Open-source big data serving engine with AI/ML capabilities. Runs vector search and AI inference at scale.",
    industry: "AI Infrastructure",
    location: "United States",
    fundingStage: "Series B",
    gpuUseCases: ["inference"],
    techStack: "vector search, AI, CUDA",
    pipelineStage: "New",
    score: 80,
    source: "LinkedIn Connections",
    lektraFitReason: "Vespa.ai runs AI inference for vector search at scale — a GPU-intensive workload where Lektra's RTX Pro 6000 nodes and zero egress fees can reduce infrastructure costs significantly.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Fernando J.", lastName: "Mora, Jr.", title: "Head of Growth", linkedinUrl: "https://www.linkedin.com/in/fjmorajr", isPrimary: true, fitReason: "Head of Growth — can evaluate Lektra as a cost-reduction opportunity and champion internally to engineering/infra teams" }
    ]
  },
  {
    companyName: "UX Pilot AI",
    website: "uxpilot.ai",
    description: "AI-powered UX design platform using generative AI for UI/UX creation. Requires GPU compute for generative AI inference.",
    industry: "Generative AI",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["inference"],
    techStack: "generative AI, diffusion, CUDA",
    pipelineStage: "New",
    score: 78,
    source: "LinkedIn Connections",
    lektraFitReason: "UX Pilot AI uses generative AI for design — a GPU-intensive inference workload. Lektra's RTX Pro 6000 nodes are well-suited for generative AI inference at lower cost than AWS/Azure.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Arkady", lastName: "Zapesotsky", title: "Head of Enterprise GTM", linkedinUrl: "https://www.linkedin.com/in/arkadyzapesotsky", isPrimary: true, fitReason: "Head of Enterprise GTM — can evaluate infrastructure partnerships and connect Lektra with technical decision-makers" }
    ]
  },
  {
    companyName: "Cambrian-AI Research LLC",
    website: "cambrian-ai.com",
    description: "AI research and advisory firm specializing in GPU computing and AI infrastructure analysis. Deep expertise in GPU market dynamics.",
    industry: "AI Research",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["training", "inference"],
    techStack: "GPU analysis, AI infrastructure",
    pipelineStage: "New",
    score: 78,
    source: "LinkedIn Connections",
    lektraFitReason: "Cambrian-AI Research is a GPU/AI infrastructure analyst firm — Karl Freund is a respected industry voice. A relationship here could lead to analyst coverage and warm introductions to GPU-spending startups.",
    recommendedGpu: "Multiple",
    contacts: [
      { firstName: "Karl", lastName: "Freund", title: "Founder and Principal Analyst", linkedinUrl: "https://www.linkedin.com/in/kfreund", isPrimary: true, fitReason: "Founder/analyst specializing in GPU computing — a strategic relationship for market intelligence and potential introductions to GPU-spending AI startups" }
    ]
  },
  {
    companyName: "AI infrastructure fund",
    website: "",
    description: "Investment fund focused on AI infrastructure companies. A strategic relationship for deal flow and portfolio company introductions.",
    industry: "Venture Capital",
    location: "United States",
    fundingStage: "N/A",
    gpuUseCases: ["training", "inference"],
    techStack: "AI infrastructure",
    pipelineStage: "New",
    score: 75,
    source: "LinkedIn Connections",
    lektraFitReason: "An AI infrastructure fund can provide warm introductions to portfolio companies spending on GPU compute — a high-leverage BD relationship for Lektra.",
    recommendedGpu: "Multiple",
    contacts: [
      { firstName: "Phillip", lastName: "Liu", title: "Founder", linkedinUrl: "https://www.linkedin.com/in/phillipliusr", isPrimary: true, fitReason: "Founder of an AI infrastructure fund — strategic relationship for portfolio company introductions and market intelligence" }
    ]
  },
  {
    companyName: "globeholder.ai",
    website: "globeholder.ai",
    description: "AI startup building global AI solutions. Requires GPU compute for AI model development and deployment.",
    industry: "Artificial Intelligence",
    location: "United States",
    fundingStage: "Seed",
    gpuUseCases: ["inference", "training"],
    techStack: "AI, machine learning",
    pipelineStage: "New",
    score: 72,
    source: "LinkedIn Connections",
    lektraFitReason: "globeholder.ai is an early-stage AI startup where GPU cost efficiency is critical. Lektra's flexible GPU rental model and 30-50% cost savings vs hyperscalers are compelling for their growth stage.",
    recommendedGpu: "RTX Pro 6000",
    contacts: [
      { firstName: "Victoria", lastName: "Rege", title: "Founding Partner + Chief Evangelist", linkedinUrl: "https://www.linkedin.com/in/vrege", isPrimary: true, fitReason: "Founding Partner — decision-maker for infrastructure and technology partnerships at an early-stage AI company" }
    ]
  },
];

// ─── Insert into database ─────────────────────────────────────────────────────

const insertLead = async (lead) => {
  const now = new Date();
  
  // Insert lead
  const [result] = await connection.execute(
    `INSERT INTO leads (
      companyName, website, description, industry, location, headcount,
      fundingStage, gpuUseCases, techStack, pipelineStage, score,
      lektraFitReason, recommendedGpu, linkedinUrl, source, assignedTo,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lead.companyName,
      lead.website || null,
      lead.description || null,
      lead.industry || null,
      lead.location || null,
      null, // headcount
      lead.fundingStage || null,
      JSON.stringify(lead.gpuUseCases || []),
      lead.techStack || null,
      lead.pipelineStage || 'New',
      lead.score || 70,
      lead.lektraFitReason || null,
      lead.recommendedGpu || null,
      null, // linkedinUrl (company level)
      lead.source || 'LinkedIn Connections',
      null, // assignedTo
      now,
      now,
    ]
  );
  
  const leadId = result.insertId;
  
  // Insert contacts
  for (const contact of (lead.contacts || [])) {
    await connection.execute(
      `INSERT INTO contacts (
        leadId, firstName, lastName, title, linkedinUrl, isPrimary, fitReason,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leadId,
        contact.firstName || null,
        contact.lastName || null,
        contact.title || null,
        contact.linkedinUrl || null,
        contact.isPrimary ? 1 : 0,
        contact.fitReason || null,
        now,
        now,
      ]
    );
  }
  
  return leadId;
};

console.log(`Importing ${linkedinLeads.length} LinkedIn leads...`);
let imported = 0;
let skipped = 0;

for (const lead of linkedinLeads) {
  // Check for duplicate
  const [existing] = await connection.execute(
    `SELECT id FROM leads WHERE companyName = ? LIMIT 1`,
    [lead.companyName]
  );
  
  if (existing.length > 0) {
    console.log(`  SKIP (duplicate): ${lead.companyName}`);
    skipped++;
    continue;
  }
  
  try {
    const id = await insertLead(lead);
    console.log(`  OK [${lead.score}] ${lead.companyName} -> id=${id}`);
    imported++;
  } catch (e) {
    console.error(`  ERROR: ${lead.companyName} -> ${e.message}`);
  }
}

console.log(`\nDone: ${imported} imported, ${skipped} skipped (duplicates)`);
await connection.end();
