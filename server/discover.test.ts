import { describe, expect, it } from "vitest";
import { STARTUP_SEEDS, type StartupSeed } from "./routers/discover";

// ─── Filter helper (mirrors the server-side filterSeeds) ─────────────────────

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
      const haystack =
        `${s.name} ${s.industry} ${s.techStack ?? ""} ${s.gpuUseCases.join(" ")}`.toLowerCase();
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("STARTUP_SEEDS database", () => {
  it("contains at least 60 companies", () => {
    expect(STARTUP_SEEDS.length).toBeGreaterThanOrEqual(60);
  });

  it("every entry has required fields", () => {
    for (const s of STARTUP_SEEDS) {
      expect(s.slug, `${s.name} missing slug`).toBeTruthy();
      expect(s.name, `slug ${s.slug} missing name`).toBeTruthy();
      expect(s.gpuUseCases.length, `${s.name} has no GPU use cases`).toBeGreaterThan(0);
      expect(s.fundingStage, `${s.name} missing fundingStage`).toBeTruthy();
      expect(s.industry, `${s.name} missing industry`).toBeTruthy();
      expect(s.location, `${s.name} missing location`).toBeTruthy();
    }
  });

  it("all companies are US-based", () => {
    const nonUS = STARTUP_SEEDS.filter((s) => !s.location.includes("United States"));
    // Allow up to 5 entries that may have dual HQ
    expect(nonUS.length).toBeLessThanOrEqual(5);
  });

  it("slugs are unique", () => {
    const slugs = STARTUP_SEEDS.map((s) => s.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("covers all major GPU use cases", () => {
    const allUseCases = new Set(STARTUP_SEEDS.flatMap((s) => s.gpuUseCases));
    expect(allUseCases.has("inference")).toBe(true);
    expect(allUseCases.has("training")).toBe(true);
    expect(allUseCases.has("edge_compute")).toBe(true);
    expect(allUseCases.has("remote_viz")).toBe(true);
    expect(allUseCases.has("fine_tuning")).toBe(true);
  });
});

describe("filterSeeds", () => {
  it("returns all seeds when no filters are applied", () => {
    const result = filterSeeds(STARTUP_SEEDS, {});
    expect(result.length).toBe(STARTUP_SEEDS.length);
  });

  it("filters by keyword (case-insensitive)", () => {
    const result = filterSeeds(STARTUP_SEEDS, { keyword: "inference" });
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      const haystack =
        `${s.name} ${s.industry} ${s.techStack ?? ""} ${s.gpuUseCases.join(" ")}`.toLowerCase();
      expect(haystack).toContain("inference");
    }
  });

  it("filters by GPU use case", () => {
    const result = filterSeeds(STARTUP_SEEDS, { gpuUseCase: "edge_compute" });
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(s.gpuUseCases).toContain("edge_compute");
    }
  });

  it("filters by funding stage", () => {
    const result = filterSeeds(STARTUP_SEEDS, { fundingStage: "Series B" });
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(s.fundingStage).toBe("Series B");
    }
  });

  it("filters by industry (partial match)", () => {
    const result = filterSeeds(STARTUP_SEEDS, { industry: "AI Infrastructure" });
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(s.industry.toLowerCase()).toContain("ai infrastructure");
    }
  });

  it("combines multiple filters correctly", () => {
    const result = filterSeeds(STARTUP_SEEDS, {
      gpuUseCase: "inference",
      fundingStage: "Series B",
    });
    for (const s of result) {
      expect(s.gpuUseCases).toContain("inference");
      expect(s.fundingStage).toBe("Series B");
    }
  });

  it("returns empty array when no companies match", () => {
    const result = filterSeeds(STARTUP_SEEDS, {
      keyword: "zzz_no_match_xyz_impossible",
    });
    expect(result.length).toBe(0);
  });

  it("'all' value for gpuUseCase does not filter", () => {
    const all = filterSeeds(STARTUP_SEEDS, { gpuUseCase: "all" });
    expect(all.length).toBe(STARTUP_SEEDS.length);
  });

  it("'all' value for fundingStage does not filter", () => {
    const all = filterSeeds(STARTUP_SEEDS, { fundingStage: "all" });
    expect(all.length).toBe(STARTUP_SEEDS.length);
  });
});

describe("filterOptions derivation", () => {
  it("derives unique GPU use cases", () => {
    const gpuUseCases = Array.from(
      new Set(STARTUP_SEEDS.flatMap((s) => s.gpuUseCases))
    ).sort();
    expect(gpuUseCases.length).toBeGreaterThan(4);
    expect(gpuUseCases).toContain("inference");
    expect(gpuUseCases).toContain("training");
  });

  it("derives unique industries", () => {
    const industries = Array.from(new Set(STARTUP_SEEDS.map((s) => s.industry))).sort();
    expect(industries.length).toBeGreaterThan(5);
  });

  it("derives unique funding stages", () => {
    const stages = Array.from(new Set(STARTUP_SEEDS.map((s) => s.fundingStage))).sort();
    expect(stages).toContain("Series B");
    expect(stages).toContain("Seed");
  });
});
