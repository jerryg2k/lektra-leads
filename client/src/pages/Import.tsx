import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function Import() {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const importMutation = trpc.leads.importApollo.useMutation({
    onSuccess: ({ imported }) => {
      toast.success(`Successfully imported ${imported} leads with auto-scoring`);
      utils.leads.list.invalidate();
      utils.leads.pipelineStats.invalidate();
      setCsvText(null);
      setFileName(null);
      setPreviewRows([]);
      setPreviewHeaders([]);
    },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
  });

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      // Parse preview
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const parseCSVLine = (line: string): string[] => {
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
          } else current += ch;
        }
        result.push(current);
        return result;
      };
      if (lines.length > 0) {
        setPreviewHeaders(parseCSVLine(lines[0]));
        setPreviewRows(lines.slice(1, 4).map(parseCSVLine));
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Import from Apollo.io CSV export — leads are auto-scored on import
          </p>
        </div>

        {/* Instructions */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              How to Export from Apollo.io
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p>Go to <strong className="text-foreground">apollo.io</strong> → Search → Companies. Filter by: Industry = AI/ML, Location = United States, Funding Stage = Seed to Series C.</p>
            </div>
            <div className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p>Select companies and click <strong className="text-foreground">Export → Export to CSV</strong>. Include company fields: Name, Website, Industry, Location, Employees, LinkedIn URL, Funding Stage, Technologies.</p>
            </div>
            <div className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p>Upload the downloaded CSV below. Each company will be automatically scored for GPU spend likelihood.</p>
            </div>
          </CardContent>
        </Card>

        {/* Field Mapping Reference */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Supported Apollo.io CSV Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                ["Company / Account Name", "Company Name"],
                ["Website / Domain", "Website"],
                ["Industry", "Industry"],
                ["City + State + Country", "Location"],
                ["# Employees", "Headcount"],
                ["LinkedIn URL", "LinkedIn"],
                ["Funding Stage", "Funding Stage"],
                ["Total Funding", "Total Funding"],
                ["Technologies", "Tech Stack → Score"],
                ["Description", "AI Signal → Score"],
              ].map(([apollo, lektra]) => (
                <div key={apollo} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground truncate">{apollo}</span>
                  <span className="text-primary shrink-0">→</span>
                  <span className="text-foreground font-medium truncate">{lektra}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upload Zone */}
        {!csvText ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold text-foreground">Drop your Apollo.io CSV here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse files</p>
            <p className="text-xs text-muted-foreground mt-3 opacity-60">.csv files only</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {fileName}
                </CardTitle>
                <button
                  onClick={() => { setCsvText(null); setFileName(null); setPreviewRows([]); setPreviewHeaders([]); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview */}
              {previewHeaders.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Preview (first 3 rows)</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border">
                          {previewHeaders.slice(0, 8).map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-muted-foreground font-medium truncate max-w-[120px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewRows.map((row, ri) => (
                          <tr key={ri}>
                            {row.slice(0, 8).map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 text-foreground truncate max-w-[120px]">{cell || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="text-sm">
                  <p className="text-emerald-400 font-medium">Ready to import</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Each lead will be auto-scored for GPU spend likelihood and matched to Lektra's H200, RTX Pro 6000, or B200.
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => importMutation.mutate({ csvText: csvText! })}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? "Importing & Scoring..." : "Import & Auto-Score All Leads"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* HubSpot Export Info */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              HubSpot Export
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              To export leads to HubSpot, go to the <strong className="text-foreground">Leads</strong> page and click{" "}
              <strong className="text-foreground">Export HubSpot</strong>. The CSV uses HubSpot's standard field names
              (Company Name, Website, Industry, City, State/Region, Country, Number of Employees, LinkedIn Company Page, etc.)
              and can be imported directly via HubSpot's{" "}
              <strong className="text-foreground">Contacts → Import</strong> workflow.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
