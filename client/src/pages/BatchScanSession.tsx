import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Camera,
  Check,
  ChevronRight,
  Layers,
  Loader2,
  ScanLine,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useOfflineQueue, type QueuedScan } from "@/hooks/useOfflineQueue";

type ScannedCard = {
  id: string;
  previewUrl: string;
  imageBlob: Blob;
  company: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  linkedin: string;
  locationVal: string;
  notes: string;
  status: "pending" | "saving" | "saved" | "discarded";
  leadId?: number;
};

export default function BatchScanSession() {
  const [, setLocation] = useLocation();
  const { isOnline, enqueue: enqueueOffline, queue: offlineQueue, remove: removeOffline } = useOfflineQueue();

  const [sessionActive, setSessionActive] = useState(false);
  const [cards, setCards] = useState<ScannedCard[]>([]);
  const [scanning, setScanning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const scanMutation = trpc.cardScanner.scan.useMutation();
  const createLeadMutation = trpc.leads.create.useMutation();
  const logScanMutation = trpc.cardScanner.logScan.useMutation();

  const uploadImage = useCallback(async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("file", blob, "business-card.jpg");
    const res = await fetch("/api/upload-card", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url;
  }, []);

  const handleScanBlob = useCallback(async (blob: Blob, previewUrl: string) => {
    setScanning(true);
    const id = `card-${Date.now()}`;

    if (!isOnline) {
      // Queue offline
      const reader = new FileReader();
      reader.onload = () => {
        enqueueOffline({
          imageDataUrl: reader.result as string,
          eventTag: "GTC-2026",
        });
        toast.info("Offline — card queued for upload when reconnected");
      };
      reader.readAsDataURL(blob);
      setScanning(false);
      return;
    }

    try {
      const imageUrl = await uploadImage(blob);
      const result = await scanMutation.mutateAsync({ imageUrl, eventTag: "GTC-2026" });
      const card: ScannedCard = {
        id,
        previewUrl,
        imageBlob: blob,
        company: result.company ?? "",
        contactName: result.name ?? "",
        contactTitle: result.title ?? "",
        contactEmail: result.email ?? "",
        contactPhone: result.phone ?? "",
        website: result.website ?? "",
        linkedin: result.linkedin ?? "",
        locationVal: result.location ?? "",
        notes: result.notes ?? "",
        status: "pending",
      };
      setCards((prev) => [card, ...prev]);
      toast.success(`Card ${cards.length + 1} scanned: ${card.company || card.contactName || "Unknown"} — tap Scan Another to continue`, {
        action: {
          label: "Scan Another",
          onClick: () => handleStartCamera(),
        },
        duration: 6000,
      });
    } catch (e: any) {
      toast.error("Scan failed: " + e.message);
    } finally {
      setScanning(false);
    }
  }, [isOnline, uploadImage, scanMutation, enqueueOffline, cards.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    handleScanBlob(file, url);
    e.target.value = "";
  };

  const handleStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      toast.error("Camera access denied. Use file upload.");
    }
  };

  const handleStopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      handleScanBlob(blob, url);
      handleStopCamera();
    }, "image/jpeg", 0.92);
  };

  const updateCard = (id: string, updates: Partial<ScannedCard>) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
  };

  const handleSaveCard = async (card: ScannedCard) => {
    if (!card.company && !card.contactName) {
      toast.error("Company or contact name required");
      return;
    }
    updateCard(card.id, { status: "saving" });
    try {
      const lead = await createLeadMutation.mutateAsync({
        companyName: card.company || card.contactName || "Unknown",
        website: card.website || undefined,
        linkedinUrl: card.linkedin || undefined,
        location: card.locationVal || undefined,
        tags: ["GTC-2026"],
        source: "GTC-2026 Card Scan",
        contacts: card.contactName ? [{
          name: card.contactName,
          title: card.contactTitle || undefined,
          email: card.contactEmail || undefined,
          phone: card.contactPhone || undefined,
          isPrimary: true,
        }] : undefined,
      } as any);
      const leadId = (lead as any)?.id;
      await logScanMutation.mutateAsync({
        company: card.company || undefined,
        contactName: card.contactName || undefined,
        contactTitle: card.contactTitle || undefined,
        contactEmail: card.contactEmail || undefined,
        leadId: leadId ?? undefined,
        eventTag: "GTC-2026",
      });
      updateCard(card.id, { status: "saved", leadId });
      toast.success(`Saved: ${card.company || card.contactName}`);
    } catch {
      updateCard(card.id, { status: "pending" });
      toast.error("Failed to save lead");
    }
  };

  const handleSaveAll = async () => {
    const pending = cards.filter((c) => c.status === "pending");
    for (const card of pending) {
      await handleSaveCard(card);
    }
  };

  const handleDiscard = (id: string) => {
    updateCard(id, { status: "discarded" });
  };

  const savedCount = cards.filter((c) => c.status === "saved").length;
  const pendingCount = cards.filter((c) => c.status === "pending").length;
  const discardedCount = cards.filter((c) => c.status === "discarded").length;

  if (sessionDone) {
    return (
      <DashboardLayout>
        <div className="max-w-lg space-y-6 pb-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
            <Check className="h-14 w-14 text-emerald-400" />
            <h2 className="text-xl font-bold text-foreground">Session Complete!</h2>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{cards.length}</p>
                <p className="text-xs text-muted-foreground">Scanned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{savedCount}</p>
                <p className="text-xs text-muted-foreground">Saved</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{discardedCount}</p>
                <p className="text-xs text-muted-foreground">Discarded</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setLocation("/leads?filter=GTC-2026")} className="flex-1 gap-2">
              <Building2 className="h-4 w-4" />
              View GTC Leads
            </Button>
            <Button variant="outline" onClick={() => { setCards([]); setSessionDone(false); setSessionActive(false); }} className="gap-2">
              New Session
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Batch Scan Session</h1>
            <p className="text-sm text-muted-foreground">Scan multiple cards, review all, save at once</p>
          </div>
          {/* Online/offline indicator */}
          <div className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${isOnline ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"}`}>
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>

        {/* Offline queue notice */}
        {offlineQueue.length > 0 && isOnline && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
            <Wifi className="h-4 w-4 text-yellow-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-300">{offlineQueue.length} scan{offlineQueue.length !== 1 ? "s" : ""} queued offline</p>
              <p className="text-xs text-muted-foreground">These were captured while offline. Review them on the Scan Card page.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setLocation("/scan-card")} className="shrink-0 text-xs">
              Review
            </Button>
          </div>
        )}

        {/* Start session or camera controls */}
        {!sessionActive ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-card border border-border rounded-2xl">
            <Layers className="h-12 w-12 text-primary/40" />
            <div className="text-center">
              <p className="font-semibold text-foreground">Ready to start a batch session?</p>
              <p className="text-sm text-muted-foreground mt-1">Scan multiple business cards in a row, then review and save them all at once.</p>
            </div>
            <Button onClick={() => setSessionActive(true)} className="gap-2 px-8">
              <Layers className="h-4 w-4" />
              Start Session
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Camera */}
            <div className="relative bg-secondary rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-border">
              <video ref={videoRef} className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`} playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraActive && (
                <div className="text-center space-y-2 p-8">
                  <Camera className="h-10 w-10 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Camera preview</p>
                </div>
              )}
              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-primary/60 rounded-xl w-[85%] h-[70%] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              )}
            </div>

            {/* Scan controls */}
            <div className="flex gap-3 flex-wrap">
              {scanning ? (
                <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning...
                </div>
              ) : (
                <>
                  {!cameraActive ? (
                    <Button onClick={handleStartCamera} className="gap-2 flex-1">
                      <Camera className="h-4 w-4" /> Open Camera
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleCapture} className="gap-2 flex-1">
                        <Camera className="h-4 w-4" /> Capture
                      </Button>
                      <Button variant="outline" onClick={handleStopCamera} className="gap-2">
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2 flex-1">
                    <Upload className="h-4 w-4" /> Upload
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                </>
              )}
            </div>

            {/* Session stats bar */}
            {cards.length > 0 && (
              <div className="flex flex-col gap-2 bg-card border border-border rounded-xl px-4 py-2.5 text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{cards.length} scanned</span>
                  <span className="text-emerald-400">{savedCount} saved</span>
                  <span className="text-yellow-400">{pendingCount} pending</span>
                  {discardedCount > 0 && <span className="text-muted-foreground">{discardedCount} discarded</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {!cameraActive && !scanning && (
                    <Button size="sm" onClick={handleStartCamera} className="gap-1.5 text-xs h-7 bg-primary/90 hover:bg-primary">
                      <Camera className="h-3 w-3" />
                      Scan Another
                    </Button>
                  )}
                  {pendingCount > 0 && (
                    <Button size="sm" onClick={handleSaveAll} className="gap-1.5 text-xs h-7">
                      <Check className="h-3 w-3" />
                      Save All ({pendingCount})
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSessionDone(true)} className="gap-1.5 text-xs h-7 ml-auto">
                    End Session
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card queue */}
        {cards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Scanned Cards ({cards.length})</h2>
            {cards.map((card) => (
              <div key={card.id} className={`border rounded-xl overflow-hidden transition-colors ${
                card.status === "saved" ? "border-emerald-500/30 bg-emerald-500/5" :
                card.status === "discarded" ? "border-border opacity-50" :
                "border-border bg-card"
              }`}>
                {/* Card header */}
                <div className="flex items-center gap-3 p-3">
                  <div className="w-14 h-10 rounded-lg bg-secondary border border-border overflow-hidden shrink-0">
                    {card.previewUrl ? (
                      <img src={card.previewUrl} alt="Card" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{card.company || "Unknown company"}</p>
                    <p className="text-xs text-muted-foreground truncate">{card.contactName || "No contact"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {card.status === "saved" && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>
                    )}
                    {card.status === "saving" && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    )}
                    {card.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(editingId === card.id ? null : card.id)}>
                          <ScanLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => handleSaveCard(card)} className="h-7 px-2.5 text-xs gap-1">
                          <Check className="h-3 w-3" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDiscard(card.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {card.status === "discarded" && (
                      <span className="text-xs text-muted-foreground">Discarded</span>
                    )}
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === card.id && card.status === "pending" && (
                  <div className="border-t border-border p-4 grid grid-cols-2 gap-3 bg-secondary/50">
                    {[
                      { label: "Company", value: card.company, key: "company" },
                      { label: "Contact Name", value: card.contactName, key: "contactName" },
                      { label: "Title", value: card.contactTitle, key: "contactTitle" },
                      { label: "Email", value: card.contactEmail, key: "contactEmail" },
                      { label: "Phone", value: card.contactPhone, key: "contactPhone" },
                      { label: "Website", value: card.website, key: "website" },
                    ].map(({ label, value, key }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <Input
                          value={value}
                          onChange={(e) => updateCard(card.id, { [key]: e.target.value } as any)}
                          className="h-8 text-sm bg-card border-border"
                        />
                      </div>
                    ))}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <Textarea
                        value={card.notes}
                        onChange={(e) => updateCard(card.id, { notes: e.target.value })}
                        className="text-sm bg-card border-border resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
