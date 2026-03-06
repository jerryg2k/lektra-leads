import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Camera,
  Check,
  ChevronRight,
  Loader2,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ScanResult = {
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  location: string | null;
  notes: string | null;
  eventTag: string;
};

export default function BusinessCardScanner() {
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [step, setStep] = useState<"capture" | "scanning" | "review" | "saving">("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Editable form fields after scan
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [location, setLocation2] = useState("");
  const [notes, setNotes] = useState("");

  const scanMutation = trpc.cardScanner.scan.useMutation({
    onSuccess: (data) => {
      setScanResult(data);
      setCompanyName(data.company ?? "");
      setContactName(data.name ?? "");
      setContactTitle(data.title ?? "");
      setContactEmail(data.email ?? "");
      setContactPhone(data.phone ?? "");
      setWebsite(data.website ?? "");
      setLinkedin(data.linkedin ?? "");
      setLocation2(data.location ?? "");
      setNotes(data.notes ?? "");
      setStep("review");
    },
    onError: (err) => {
      toast.error("Scan failed: " + err.message);
      setStep("capture");
    },
  });

  const createLeadMutation = trpc.leads.create.useMutation({
    onSuccess: (lead) => {
      toast.success(`Lead created: ${companyName}`);
      setLocation(`/leads/${lead.id}`);
    },
    onError: () => toast.error("Failed to create lead"),
  });

  // Upload image to S3 via a server endpoint and get URL
  const uploadImage = useCallback(async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("file", blob, "business-card.jpg");
    const res = await fetch("/api/upload-card", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url;
  }, []);

  const handleScan = useCallback(async (blob: Blob) => {
    setStep("scanning");
    try {
      const url = await uploadImage(blob);
      await scanMutation.mutateAsync({ imageUrl: url, eventTag: "GTC-2026" });
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
      setStep("capture");
    }
  }, [uploadImage, scanMutation]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setImageBlob(file);
  };

  const handleStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      toast.error("Camera access denied. Please use file upload instead.");
    }
  };

  const handleStopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setImageBlob(blob);
      handleStopCamera();
    }, "image/jpeg", 0.92);
  };

  const handleSaveAsLead = () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setStep("saving");
    createLeadMutation.mutate({
      companyName: companyName.trim(),
      website: website || undefined,
      linkedinUrl: linkedin || undefined,
      location: location || undefined,
      tags: ["GTC-2026"],
      contacts: contactName ? [{
        name: contactName,
        title: contactTitle || undefined,
        email: contactEmail || undefined,
        phone: contactPhone || undefined,
        linkedinUrl: linkedin || undefined,
        isPrimary: true,
      }] : undefined,
    } as any);
  };

  const handleReset = () => {
    setStep("capture");
    setPreviewUrl(null);
    setImageBlob(null);
    setScanResult(null);
    handleStopCamera();
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Business Card Scanner</h1>
            <p className="text-sm text-muted-foreground">
              Capture cards at GTC 2026 — AI extracts contact info instantly
            </p>
          </div>
        </div>

        {/* GTC badge */}
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">GTC 2026</span>
          <span className="text-sm text-muted-foreground">All scanned cards will be tagged with <strong className="text-foreground">GTC-2026</strong> automatically</span>
        </div>

        {/* Step: Capture */}
        {step === "capture" && (
          <div className="space-y-4">
            {/* Camera viewfinder */}
            <div className="relative bg-secondary rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-border">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {!cameraActive && !previewUrl && (
                <div className="text-center space-y-2 p-8">
                  <Camera className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Camera preview will appear here</p>
                </div>
              )}

              {previewUrl && !cameraActive && (
                <img src={previewUrl} alt="Card preview" className="w-full h-full object-contain" />
              )}

              {/* Overlay guide for camera */}
              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-primary/60 rounded-xl w-[85%] h-[70%] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-3 flex-wrap">
              {!cameraActive ? (
                <Button onClick={handleStartCamera} className="gap-2 flex-1">
                  <Camera className="h-4 w-4" />
                  Open Camera
                </Button>
              ) : (
                <>
                  <Button onClick={handleCapture} className="gap-2 flex-1">
                    <Camera className="h-4 w-4" />
                    Capture
                  </Button>
                  <Button variant="outline" onClick={handleStopCamera} className="gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 flex-1"
              >
                <Upload className="h-4 w-4" />
                Upload Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Scan button */}
            {imageBlob && (
              <Button
                onClick={() => handleScan(imageBlob)}
                className="w-full gap-2 h-12 text-base"
              >
                <ScanLine className="h-5 w-5" />
                Scan Card with AI
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            )}
          </div>
        )}

        {/* Step: Scanning */}
        {step === "scanning" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ScanLine className="h-8 w-8 text-primary" />
              </div>
              <Loader2 className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Scanning business card...</p>
              <p className="text-sm text-muted-foreground mt-1">AI is extracting contact information</p>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && scanResult && (
          <div className="space-y-5">
            {/* Preview thumbnail */}
            {previewUrl && (
              <div className="flex gap-4 items-start">
                <img
                  src={previewUrl}
                  alt="Scanned card"
                  className="w-28 h-20 object-cover rounded-xl border border-border shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Card scanned successfully</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Review and edit the extracted info below before saving</p>
                  <button
                    onClick={handleReset}
                    className="text-xs text-primary hover:underline mt-1.5 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Scan another card
                  </button>
                </div>
              </div>
            )}

            {/* Extracted fields */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                Extracted Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Company Name *</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company name"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Contact Name</Label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full name"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    value={contactTitle}
                    onChange={(e) => setContactTitle(e.target.value)}
                    placeholder="Job title"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="email@company.com"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Website</Label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://company.com"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                  <Input
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/..."
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation2(e.target.value)}
                    placeholder="City, State"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Additional Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any other info from the card..."
                  className="bg-secondary border-border resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSaveAsLead}
                disabled={!companyName.trim() || createLeadMutation.isPending}
                className="flex-1 gap-2 h-12 text-base"
              >
                {createLeadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save as Lead
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <X className="h-4 w-4" />
                Discard
              </Button>
            </div>
          </div>
        )}

        {/* Step: Saving */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Creating lead...</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
