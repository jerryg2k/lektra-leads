import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Clock, Globe, Loader2, Mail, ScanLine, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Common IANA timezones grouped for usability
const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (ET) — New York" },
  { value: "America/Chicago", label: "Central Time (CT) — Chicago" },
  { value: "America/Denver", label: "Mountain Time (MT) — Denver" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) — Los Angeles" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris / Berlin (CET/CEST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const SCAN_FREQUENCIES = [
  { value: "daily", label: "Daily", description: "Every day at 6:00 AM UTC" },
  { value: "every3days", label: "Every 3 Days", description: "Every 3rd day at 6:00 AM UTC" },
  { value: "weekly", label: "Weekly", description: "Every Monday at 6:00 AM UTC" },
] as const;

function formatHour(h: number) {
  if (h === 0) return "12:00 AM (midnight)";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM (noon)";
  return `${h - 12}:00 PM`;
}

export default function Settings() {
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => toast.success("Settings saved"),
    onError: () => toast.error("Failed to save settings"),
  });

  const [digestHour, setDigestHour] = useState(7);
  const [digestTimezone, setDigestTimezone] = useState("UTC");
  const [digestDayOfWeek, setDigestDayOfWeek] = useState(1);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [scanKeywords, setScanKeywords] = useState("");
  const [scanFrequency, setScanFrequency] = useState<"daily" | "every3days" | "weekly">("daily");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setDigestHour(settings.digestHour ?? 7);
      setDigestTimezone(settings.digestTimezone ?? "UTC");
      setDigestDayOfWeek(settings.digestDayOfWeek ?? 1);
      setDigestEnabled(settings.digestEnabled ?? true);
      setScanKeywords((settings as any).scanKeywords ?? "");
      setScanFrequency(((settings as any).scanFrequency as any) ?? "daily");
      setDirty(false);
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({
      digestHour,
      digestTimezone,
      digestDayOfWeek,
      digestEnabled,
      scanKeywords,
      scanFrequency,
    } as any);
    setDirty(false);
  };

  const mark = (fn: () => void) => { fn(); setDirty(true); };

  // Compute a preview of next digest time in the chosen timezone
  const nextDigestPreview = (() => {
    try {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Every ${dayNames[digestDayOfWeek]} at ${formatHour(digestHour)} (${digestTimezone})`;
    } catch {
      return "";
    }
  })();

  // Parse keywords into chips for display
  const keywordChips = scanKeywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your digest delivery, auto-scan, and notification preferences.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading settings...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Weekly Digest Card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Weekly BD Digest</h2>
                  <p className="text-xs text-muted-foreground">Automated pipeline summary delivered to your inbox</p>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => mark(() => setDigestEnabled((v) => !v))}
                  className={`ml-auto relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    digestEnabled ? "bg-primary" : "bg-secondary"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      digestEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {digestEnabled && (
                <div className="space-y-4 border-t border-border/50 pt-4">
                  {/* Day of week */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      Delivery Day
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => mark(() => setDigestDayOfWeek(d.value))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            digestDayOfWeek === d.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hour slider */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Delivery Time
                      </span>
                      <span className="text-primary font-semibold tabular-nums">{formatHour(digestHour)}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={23}
                      step={1}
                      value={digestHour}
                      onChange={(e) => mark(() => setDigestHour(Number(e.target.value)))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>12 AM</span>
                      <span>6 AM</span>
                      <span>12 PM</span>
                      <span>6 PM</span>
                      <span>11 PM</span>
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      Timezone
                    </label>
                    <select
                      value={digestTimezone}
                      onChange={(e) => mark(() => setDigestTimezone(e.target.value))}
                      className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Preview */}
                  <div className="bg-secondary/60 rounded-lg px-4 py-3 flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Next digest: <span className="text-foreground font-medium">{nextDigestPreview}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-Scan Card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ScanLine className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Daily Auto-Scan</h2>
                  <p className="text-xs text-muted-foreground">AI-powered discovery of new GPU-hungry startups</p>
                </div>
              </div>

              <div className="space-y-4 border-t border-border/50 pt-4">
                {/* Scan Frequency */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Scan Frequency
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SCAN_FREQUENCIES.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => mark(() => setScanFrequency(f.value))}
                        className={`px-3 py-2.5 rounded-lg text-left border transition-colors ${
                          scanFrequency === f.value
                            ? "bg-primary/10 border-primary text-foreground"
                            : "bg-secondary border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <p className={`text-sm font-medium ${scanFrequency === f.value ? "text-primary" : ""}`}>{f.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyword Themes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    Custom Search Themes
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={scanKeywords}
                    onChange={(e) => mark(() => setScanKeywords(e.target.value))}
                    placeholder="e.g. robotics, drug discovery, video generation, autonomous vehicles"
                    className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated keywords. The scanner will prioritize startups matching these themes in addition to the default GPU/AI focus.
                  </p>
                  {keywordChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {keywordChips.map((chip) => (
                        <span
                          key={chip}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!dirty || updateMutation.isPending}
                className="gap-2"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
