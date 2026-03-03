import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),

  // Company basics
  companyName: varchar("companyName", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  description: text("description"),
  industry: varchar("industry", { length: 128 }),
  subIndustry: varchar("subIndustry", { length: 128 }),
  location: varchar("location", { length: 255 }),
  headcount: varchar("headcount", { length: 64 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),

  // Funding
  fundingStage: mysqlEnum("fundingStage", ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Unknown"]).default("Unknown"),
  totalFunding: varchar("totalFunding", { length: 64 }),
  lastFundingDate: varchar("lastFundingDate", { length: 64 }),
  investors: text("investors"),

  // GPU / AI signals
  gpuUseCases: json("gpuUseCases").$type<string[]>(),
  // e.g. ["inference", "training", "remote_viz", "edge_compute", "fine_tuning"]
  techStack: text("techStack"),
  aiProducts: text("aiProducts"),
  estimatedGpuSpend: varchar("estimatedGpuSpend", { length: 64 }),

  // Lead scoring (0–100)
  score: float("score").default(0),
  scoreBreakdown: json("scoreBreakdown").$type<Record<string, number>>(),
  // e.g. { fundingStage: 20, gpuUseCase: 30, headcount: 10, industry: 15, recentActivity: 25 }

  // Pipeline
  pipelineStage: mysqlEnum("pipelineStage", ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"]).default("New"),

  // Lektra fit
  lektraFitReason: text("lektraFitReason"),
  recommendedGpu: mysqlEnum("recommendedGpu", ["H200", "RTX Pro 6000", "B200", "Multiple", "TBD"]).default("TBD"),

  // Meta
  source: varchar("source", { length: 128 }),
  // e.g. "Apollo Import", "Manual", "LinkedIn"
  isArchived: boolean("isArchived").default(false),
  assignedTo: varchar("assignedTo", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),

  firstName: varchar("firstName", { length: 128 }),
  lastName: varchar("lastName", { length: 128 }),
  title: varchar("title", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  twitterUrl: varchar("twitterUrl", { length: 512 }),

  isPrimary: boolean("isPrimary").default(false),
  fitReason: text("fitReason"),
  // Why this person is a good contact for Lektra outreach

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─── Notes / Activity Log ─────────────────────────────────────────────────────

export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  authorName: varchar("authorName", { length: 255 }),
  content: text("content").notNull(),
  noteType: mysqlEnum("noteType", ["Note", "Call", "Email", "Meeting", "Follow-up"]).default("Note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;
