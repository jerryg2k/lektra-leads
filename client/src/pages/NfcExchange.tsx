import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Check,
  Loader2,
  QrCode,
  Radio,
  Smartphone,
  UserPlus,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Web NFC API types (not in standard TS lib yet)
declare global {
  interface Window {
    NDEFReader?: any;
  }
}

function buildVCard(name: string, title: string, company: string, email: string, phone: string, website: string): string {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    title ? `TITLE:${title}` : "",
    company ? `ORG:${company}` : "",
    email ? `EMAIL:${email}` : "",
    phone ? `TEL:${phone}` : "",
    website ? `URL:${website}` : "",
    "END:VCARD",
  ].filter(Boolean).join("\n");
}

function parseVCard(text: string): { name?: string; title?: string; company?: string; email?: string; phone?: string; website?: string } {
  const get = (key: string) => {
    const match = text.match(new RegExp(`^${key}:(.+)$`, "im"));
    return match?.[1]?.trim() ?? undefined;
  };
  return {
    name: get("FN"),
    title: get("TITLE"),
    company: get("ORG"),
    email: get("EMAIL"),
    phone: get("TEL"),
    website: get("URL"),
  };
}

const nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

export default function NfcExchange() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // My card fields
  const [myName, setMyName] = useState(user?.name ?? "");
  const [myTitle, setMyTitle] = useState("");
  const [myCompany, setMyCompany] = useState("Lektra Cloud");
  const [myEmail, setMyEmail] = useState(user?.email ?? "");
  const [myPhone, setMyPhone] = useState("");
  const [myWebsite, setMyWebsite] = useState("https://lektracloud.com");

  // NFC state
  const [mode, setMode] = useState<"idle" | "writing" | "reading" | "success_write" | "success_read">("idle");
  const [receivedCard, setReceivedCard] = useState<ReturnType<typeof parseVCard> | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Update name/email when user loads
  useEffect(() => {
    if (user?.name && !myName) setMyName(user.name);
    if (user?.email && !myEmail) setMyEmail(user.email);
  }, [user]);

  // Generate QR code using a free API (no key needed)
  useEffect(() => {
    const vcard = buildVCard(myName, myTitle, myCompany, myEmail, myPhone, myWebsite);
    const encoded = encodeURIComponent(vcard);
    setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`);
  }, [myName, myTitle, myCompany, myEmail, myPhone, myWebsite]);

  const createLeadMutation = trpc.leads.create.useMutation({
    onSuccess: (lead) => {
      const leadId = (lead as any)?.id;
      toast.success(`Lead created from NFC tap!`);
      setLocation(`/leads/${leadId}`);
    },
    onError: () => toast.error("Failed to create lead"),
  });

  const handleWriteNfc = async () => {
    if (!nfcSupported) {
      toast.error("Web NFC requires Chrome on Android. Use the QR code below instead.");
      return;
    }
    if (!myName && !myCompany) {
      toast.error("Please enter at least your name or company before writing.");
      return;
    }
    setMode("writing");
    abortRef.current = new AbortController();
    try {
      const ndef = new window.NDEFReader!();
      // Request NFC permission first (required on some Android versions)
      await ndef.scan({ signal: abortRef.current.signal }).catch(() => {});
      abortRef.current = new AbortController();
      const vcard = buildVCard(myName, myTitle, myCompany, myEmail, myPhone, myWebsite);
      // Use plain "text" record type — most compatible across all NFC tag types and Android versions
      await ndef.write(
        { records: [{ recordType: "text", data: vcard }] },
        { signal: abortRef.current.signal, overwrite: true }
      );
      setMode("success_write");
      toast.success("NFC tag written! Others can tap to receive your contact.");
    } catch (e: any) {
      if (e.name === "AbortError") {
        setMode("idle");
        return;
      }
      // Provide specific guidance based on error type
      if (e.name === "NotAllowedError") {
        toast.error("NFC permission denied. Please allow NFC access in your browser settings.");
      } else if (e.name === "NotSupportedError") {
        toast.error("This NFC tag type is not writable. Try a different NTAG213/215/216 tag.");
      } else if (e.name === "NetworkError") {
        toast.error("No NFC tag detected. Hold the tag closer to the back of your phone.");
      } else {
        toast.error("NFC write failed: " + (e.message || "Unknown error. Ensure NFC is enabled in Android settings."));
      }
      setMode("idle");
    }
  };

  const handleReadNfc = async () => {
    if (!nfcSupported) {
      toast.error("Web NFC requires Chrome on Android. Use the QR code below instead.");
      return;
    }
    setMode("reading");
    abortRef.current = new AbortController();
    try {
      const ndef = new window.NDEFReader!();
      await ndef.scan({ signal: abortRef.current.signal });
      ndef.addEventListener("reading", ({ message }: any) => {
        for (const record of message.records) {
          let text = "";
          try {
            // Handle text records (may have language prefix byte)
            if (record.recordType === "text") {
              const data = new Uint8Array(record.data.buffer);
              const langLen = data[0] & 0x3f;
              text = new TextDecoder("utf-8").decode(data.slice(1 + langLen));
            } else {
              text = new TextDecoder().decode(record.data);
            }
          } catch {
            text = new TextDecoder().decode(record.data);
          }
          const parsed = parseVCard(text);
          if (parsed.name || parsed.company) {
            setReceivedCard(parsed);
            setMode("success_read");
            abortRef.current?.abort();
            return;
          }
          if (text.trim()) {
            setReceivedCard({ name: text.trim() });
            setMode("success_read");
            abortRef.current?.abort();
            return;
          }
        }
        toast.error("No readable contact data found on this tag.");
        setMode("idle");
      });
      ndef.addEventListener("readingerror", () => {
        toast.error("Could not read NFC tag. Try holding it closer to the back of your phone.");
        setMode("idle");
      });
    } catch (e: any) {
      if (e.name === "AbortError") {
        setMode("idle");
        return;
      }
      if (e.name === "NotAllowedError") {
        toast.error("NFC permission denied. Please allow NFC access in your browser settings.");
      } else {
        toast.error("NFC read failed: " + (e.message || "Ensure NFC is enabled in Android settings."));
      }
      setMode("idle");
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setMode("idle");
  };

  const handleSaveAsLead = () => {
    if (!receivedCard?.company && !receivedCard?.name) {
      toast.error("No company or name to save");
      return;
    }
    createLeadMutation.mutate({
      companyName: receivedCard.company ?? receivedCard.name ?? "Unknown",
      tags: ["GTC-2026"],
      contacts: receivedCard.name ? [{
        name: receivedCard.name,
        title: receivedCard.title || undefined,
        email: receivedCard.email || undefined,
        phone: receivedCard.phone || undefined,
        isPrimary: true,
      }] : undefined,
    } as any);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">NFC Contact Exchange</h1>
            <p className="text-sm text-muted-foreground">
              Tap phones to share your contact — or read someone else's NFC tag
            </p>
          </div>
        </div>

        {/* NFC support banner */}
        {!nfcSupported && (
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-300">NFC not available in this browser</p>
              <p className="text-xs text-muted-foreground mt-0.5">Web NFC requires Chrome on Android. Use the QR code below as a fallback — it encodes the same vCard data.</p>
            </div>
          </div>
        )}

        {/* My Card Setup */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            My Contact Card
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Your name" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={myTitle} onChange={(e) => setMyTitle(e.target.value)} placeholder="e.g. Head of BD" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Company</Label>
              <Input value={myCompany} onChange={(e) => setMyCompany(e.target.value)} placeholder="Company" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={myEmail} onChange={(e) => setMyEmail(e.target.value)} placeholder="you@company.com" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={myPhone} onChange={(e) => setMyPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input value={myWebsite} onChange={(e) => setMyWebsite(e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {mode === "idle" && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleWriteNfc}
              className="gap-2 h-14 flex-col text-sm"
              disabled={!myName && !myCompany}
            >
              <Wifi className="h-5 w-5" />
              Write to NFC Tag
              <span className="text-xs opacity-70 font-normal">Share my card</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleReadNfc}
              className="gap-2 h-14 flex-col text-sm border-border"
            >
              <Radio className="h-5 w-5 text-primary" />
              Read NFC Tag
              <span className="text-xs opacity-70 font-normal">Capture their card</span>
            </Button>
          </div>
        )}

        {/* Writing state */}
        {mode === "writing" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 bg-card border border-border rounded-xl">
            <div className="relative">
              <Wifi className="h-12 w-12 text-primary animate-pulse" />
              <Loader2 className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-spin" />
            </div>
            <p className="font-semibold text-foreground">Hold phone near NFC tag...</p>
            <p className="text-sm text-muted-foreground">Touch the back of your phone to the NFC tag</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">Tip: Use NTAG213, NTAG215, or NTAG216 tags. Keep the tag still until the write completes.</p>
            <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2 mt-2">
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        )}

        {/* Reading state */}
        {mode === "reading" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 bg-card border border-border rounded-xl">
            <div className="relative">
              <Radio className="h-12 w-12 text-primary animate-pulse" />
              <Loader2 className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-spin" />
            </div>
            <p className="font-semibold text-foreground">Tap their NFC tag or phone...</p>
            <p className="text-sm text-muted-foreground">Waiting for NFC contact data</p>
            <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2 mt-2">
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        )}

        {/* Write success */}
        {mode === "success_write" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <Check className="h-12 w-12 text-emerald-400" />
            <p className="font-semibold text-foreground">NFC tag written!</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">Others can tap this tag with their phone to receive your contact card.</p>
            <Button variant="outline" size="sm" onClick={() => setMode("idle")} className="gap-2 mt-2">
              Done
            </Button>
          </div>
        )}

        {/* Read success */}
        {mode === "success_read" && receivedCard && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-400" />
                <p className="font-semibold text-foreground">Contact received!</p>
              </div>
              <div className="space-y-1 text-sm">
                {receivedCard.name && <p><span className="text-muted-foreground">Name:</span> <span className="text-foreground font-medium">{receivedCard.name}</span></p>}
                {receivedCard.title && <p><span className="text-muted-foreground">Title:</span> <span className="text-foreground">{receivedCard.title}</span></p>}
                {receivedCard.company && <p><span className="text-muted-foreground">Company:</span> <span className="text-foreground">{receivedCard.company}</span></p>}
                {receivedCard.email && <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{receivedCard.email}</span></p>}
                {receivedCard.phone && <p><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{receivedCard.phone}</span></p>}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSaveAsLead}
                disabled={createLeadMutation.isPending}
                className="flex-1 gap-2"
              >
                {createLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Save as Lead
              </Button>
              <Button variant="outline" onClick={() => { setMode("idle"); setReceivedCard(null); }} className="gap-2">
                <X className="h-4 w-4" /> Discard
              </Button>
            </div>
          </div>
        )}

        {/* QR Code Fallback */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            QR Code Fallback
            <span className="text-xs text-muted-foreground font-normal ml-1">— works on any phone</span>
          </h2>
          <p className="text-xs text-muted-foreground">Show this QR code to anyone — scanning it adds your contact to their phone automatically.</p>
          {qrDataUrl && (
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-xl inline-block">
                <img src={qrDataUrl} alt="vCard QR code" className="w-48 h-48" />
              </div>
            </div>
          )}
          <p className="text-xs text-center text-muted-foreground">Updates live as you edit your card above</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
