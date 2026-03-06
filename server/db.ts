import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { contacts, InsertContact, InsertLead, InsertNote, InsertUser, InsertUserSettings, leads, notes, userSettings, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Leads ─────────────────────────────────────────────────────────────────────────────────

/**
 * Computes a 0–10 data completeness score for a lead.
 * 1 point each for: companyName, description, industry, location, headcount,
 * fundingStage, techStack, gpuUseCases (non-empty), linkedinUrl, and at least one contact.
 */
export function computeCompletenessScore(
  lead: Record<string, any>,
  contactCount: number
): number {
  let score = 0;
  if (lead.companyName) score++;
  if (lead.description) score++;
  if (lead.industry) score++;
  if (lead.location) score++;
  if (lead.headcount) score++;
  if (lead.fundingStage && lead.fundingStage !== "Unknown") score++;
  if (lead.techStack) score++;
  const gpuArr = Array.isArray(lead.gpuUseCases) ? lead.gpuUseCases : [];
  if (gpuArr.length > 0) score++;
  if (lead.linkedinUrl) score++;
  if (contactCount > 0) score++;
  return score;
}

export type LeadFilters = {
  search?: string;
  industry?: string;
  fundingStage?: string;
  location?: string;
  pipelineStage?: string;
  leadType?: string;
  minScore?: number;
  maxScore?: number;
  isArchived?: boolean;
};

export async function getLeads(filters: LeadFilters = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(leads.isArchived, filters.isArchived ?? false)];

  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions.push(
      or(
        like(leads.companyName, q),
        like(leads.description, q),
        like(leads.industry, q),
        like(leads.location, q)
      )!
    );
  }
  if (filters.industry) conditions.push(like(leads.industry, `%${filters.industry}%`));
  if (filters.fundingStage) conditions.push(eq(leads.fundingStage, filters.fundingStage as any));
  if (filters.location) conditions.push(like(leads.location, `%${filters.location}%`));
  if (filters.pipelineStage) conditions.push(eq(leads.pipelineStage, filters.pipelineStage as any));
  if (filters.leadType) conditions.push(eq(leads.leadType, filters.leadType as any));
  if (filters.minScore !== undefined) conditions.push(sql`${leads.score} >= ${filters.minScore}`);
  if (filters.maxScore !== undefined) conditions.push(sql`${leads.score} <= ${filters.maxScore}`);

  const rows = await db
    .select()
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.score));

  // Attach contact counts for completeness scoring
  if (rows.length === 0) return [];
  const leadIds = rows.map((r) => r.id);
  const contactCounts = await db
    .select({ leadId: contacts.leadId, count: sql<number>`count(*)` })
    .from(contacts)
    .where(sql`${contacts.leadId} IN (${sql.join(leadIds.map((id) => sql`${id}`), sql`, `)})`)
    .groupBy(contacts.leadId);
  const countMap = new Map(contactCounts.map((c) => [c.leadId, Number(c.count)]));

  return rows.map((row) => ({
    ...row,
    completenessScore: computeCompletenessScore(row, countMap.get(row.id) ?? 0),
  }));
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!result[0]) return undefined;
  const contactCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.leadId, id));
  const count = Number(contactCount[0]?.count ?? 0);
  return { ...result[0], completenessScore: computeCompletenessScore(result[0], count) };
}

export async function createLead(data: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leads).values(data);
  return result[0];
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leads).set({ isArchived: true }).where(eq(leads.id, id));
}

export async function bulkInsertLeads(data: InsertLead[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  await db.insert(leads).values(data);
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContactsByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts).where(eq(contacts.leadId, leadId));
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(contacts).values(data);
}

export async function updateContact(id: number, data: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set(data).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contacts).where(eq(contacts.id, id));
}

export async function bulkInsertContacts(data: InsertContact[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  await db.insert(contacts).values(data);
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function getNotesByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt));
}

export async function createNote(data: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notes).values(data);
}

// ─── Pipeline Stats ───────────────────────────────────────────────────────────

export async function getPipelineStats() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      stage: leads.pipelineStage,
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(${leads.score})`,
    })
    .from(leads)
    .where(eq(leads.isArchived, false))
    .groupBy(leads.pipelineStage);
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getUserSettings(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertUserSettings(userId: string, data: Partial<InsertUserSettings>) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(userSettings)
    .values({ userId, digestHour: 7, digestTimezone: "UTC", digestDayOfWeek: 1, digestEnabled: true, ...data })
    .onDuplicateKeyUpdate({ set: data });
}
