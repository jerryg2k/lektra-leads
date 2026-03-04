import cron from "node-cron";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { leads, contacts, notes } from "../drizzle/schema";
import { and, lt, gte, desc, sql } from "drizzle-orm";

/**
 * Compiles and sends the weekly BD digest to the app owner.
 * Covers: overdue follow-ups, top new leads this week, pipeline movement summary.
 */
export async function sendWeeklyDigest(): Promise<{ sent: boolean; summary: string }> {
  const db = await getDb();
  if (!db) return { sent: false, summary: "Database not available" };

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Overdue follow-ups (followUpAt < now and not Closed)
  const overdueRows = await db
    .select()
    .from(leads)
    .where(
      and(
        lt(leads.followUpAt, now),
        sql`${leads.pipelineStage} NOT IN ('Closed Won', 'Closed Lost')`
      )
    )
    .orderBy(leads.followUpAt)
    .limit(10);

  // 2. Top new leads added this week (by score)
  const newLeadsRows = await db
    .select()
    .from(leads)
    .where(gte(leads.createdAt, oneWeekAgo))
    .orderBy(desc(leads.score))
    .limit(5);

  // 3. Pipeline stats
  const allLeads = await db.select().from(leads);
  const stageCount: Record<string, number> = {};
  for (const lead of allLeads) {
    const stage = lead.pipelineStage ?? "New";
    stageCount[stage] = (stageCount[stage] ?? 0) + 1;
  }

  // 4. Leads moved to Qualified or Closed Won this week
  const recentNotes = await db
    .select()
    .from(notes)
    .where(gte(notes.createdAt, oneWeekAgo))
    .orderBy(desc(notes.createdAt))
    .limit(20);

  // Build digest content
  const lines: string[] = [];
  lines.push(`📊 **Lektra Cloud BD Weekly Digest — ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}**`);
  lines.push("");

  // ── Opening summary ──────────────────────────────────────────────────────────
  const overdueCount = overdueRows.length;
  const newCount = newLeadsRows.length;
  if (overdueCount > 0) {
    lines.push(`> ⚠️ **You have ${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"} requiring attention this week.**`);
  } else {
    lines.push(`> ✅ **No overdue follow-ups — your pipeline is up to date!**`);
  }
  if (newCount > 0) {
    lines.push(`> 🌟 **${newCount} new lead${newCount === 1 ? "" : "s"} added this week** — see highlights below.`);
  }
  lines.push("");

  // Overdue follow-ups
  lines.push("## 🔴 Overdue Follow-ups");
  if (overdueRows.length === 0) {
    lines.push("✅ No overdue follow-ups — great work!");
  } else {
    for (const lead of overdueRows) {
      const daysOverdue = Math.floor((now.getTime() - new Date(lead.followUpAt!).getTime()) / (1000 * 60 * 60 * 24));
      lines.push(`• **${lead.companyName}** — ${daysOverdue}d overdue | Stage: ${lead.pipelineStage} | Score: ${lead.score ?? "N/A"}`);
      if (lead.followUpNote) lines.push(`  Note: ${lead.followUpNote}`);
    }
  }
  lines.push("");

  // Top new leads this week
  lines.push("## 🌟 Top New Leads This Week");
  if (newLeadsRows.length === 0) {
    lines.push("No new leads added this week.");
  } else {
    for (const lead of newLeadsRows) {
      lines.push(`• **${lead.companyName}** — Score: ${lead.score ?? "N/A"} | ${lead.fundingStage ?? "Unknown stage"} | ${lead.industry ?? "AI"}`);
      if (lead.lektraFitReason) lines.push(`  Fit: ${lead.lektraFitReason.substring(0, 120)}...`);
    }
  }
  lines.push("");

  // Pipeline summary
  lines.push("## 📈 Pipeline Summary");
  const stageOrder = ["New", "Contacted", "Qualified", "Closed Won", "Closed Lost"];
  for (const stage of stageOrder) {
    const count = stageCount[stage] ?? 0;
    if (count > 0) {
      const emoji = stage === "Closed Won" ? "🏆" : stage === "Closed Lost" ? "❌" : stage === "Qualified" ? "✅" : stage === "Contacted" ? "📞" : "🆕";
      lines.push(`${emoji} ${stage}: **${count}** leads`);
    }
  }
  lines.push(`📋 Total: **${allLeads.length}** leads in database`);
  lines.push("");

  // Recent activity
  lines.push("## 📝 Recent Activity (Last 7 Days)");
  if (recentNotes.length === 0) {
    lines.push("No activity logged this week.");
  } else {
    lines.push(`${recentNotes.length} notes/activities logged across your pipeline.`);
    const emailCount = recentNotes.filter(n => n.noteType === "Email").length;
    const callCount = recentNotes.filter(n => n.noteType === "Call").length;
    const meetingCount = recentNotes.filter(n => n.noteType === "Meeting").length;
    if (emailCount > 0) lines.push(`• ${emailCount} emails sent`);
    if (callCount > 0) lines.push(`• ${callCount} calls logged`);
    if (meetingCount > 0) lines.push(`• ${meetingCount} meetings recorded`);
  }
  lines.push("");
  lines.push("---");
  lines.push("_Lektra Cloud Lead Intelligence — automated weekly digest_");

  const content = lines.join("\n");
  const title = `📊 BD Weekly Digest — ${overdueRows.length} overdue, ${newLeadsRows.length} new leads`;

  try {
    const sent = await notifyOwner({ title, content });
    return { sent, summary: content };
  } catch (e) {
    console.error("[WeeklyDigest] Failed to send:", e);
    return { sent: false, summary: content };
  }
}

/**
 * Starts the weekly digest cron job.
 * Fires every Monday at 7:00 AM (server timezone — UTC).
 * Users in US timezones will receive it Sunday evening or Monday morning.
 */
export function startWeeklyDigestCron(): void {
  // Cron: seconds minutes hours day-of-month month day-of-week
  // 0 0 7 * * 1 = Every Monday at 07:00 UTC
  cron.schedule("0 0 7 * * 1", async () => {
    console.log("[WeeklyDigest] Sending Monday morning BD digest...");
    const result = await sendWeeklyDigest();
    if (result.sent) {
      console.log("[WeeklyDigest] ✅ Digest sent successfully");
    } else {
      console.warn("[WeeklyDigest] ⚠️ Digest could not be delivered");
    }
  });
  console.log("[WeeklyDigest] Cron scheduled — every Monday at 07:00 UTC");
}
