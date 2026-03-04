import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Clock, Globe, Loader2, Mail } from "lucide-react";
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
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setDigestHour(settings.digestHour ?? 7);
      setDigestTimezone(settings.digestTimezone ?? "UTC");
      setDigestDayOfWeek(settings.digestDayOfWeek ?? 1);
      setDigestEnabled(settings.digestEnabled ?? true);
      setDirty(false);
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({ digestHour, digestTimezone, digestDayOfWeek, digestEnabled });
    setDirty(false);
  };

  const mark = (fn: () => void) => { fn(); setDirty(true); };

  // Compute a preview of next digest time in the chosen timezone
  const nextDigestPreview = (() => {
    try {
      const now = new Date();
      // Find the next occurrence of digestDayOfWeek at digestHour in digestTimezone
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Every ${dayNames[digestDayOfWeek]} at ${formatHour(digestHour)} (${digestTimezone})`;
    } catch {
      return "";
    }
  })();

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your digest delivery and notification preferences.</p>
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
