"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera,
  SwitchCamera,
  Download,
  Loader2,
  ImageIcon,
  Zap,
  Upload,
  Share2,
  Printer,
} from "lucide-react";
import { getFingerprint } from "@/lib/fingerprint";
import { BadgePreview } from "@/components/badge-preview";

type AppState = "camera" | "generating" | "result";

interface AvatarResult {
  id: string;
  originalUrl: string;
  avatarUrl: string;
  badgeUrl?: string | null;
  createdAt: number;
}

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<AppState>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<AvatarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [gallery, setGallery] = useState<AvatarResult[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Form fields (filled during generation)
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState("");
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  // Parallel state: AI generation runs while user fills form
  const [aiResult, setAiResult] = useState<{ id: string; avatarUrl: string } | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [badgeGenerating, setBadgeGenerating] = useState(false);

  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery");
      if (res.ok) {
        const data = await res.json();
        setGallery(
          data.map((item: { id: string; originalUrl: string; avatarUrl: string; badgeUrl?: string; createdAt: string }) => ({
            ...item,
            createdAt: new Date(item.createdAt).getTime(),
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load gallery:", err);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  useEffect(() => {
    getFingerprint().then(setFingerprint).catch(console.error);
  }, []);

  // Restore pending avatar from localStorage (survives page refresh)
  useEffect(() => {
    try {
      const pending = localStorage.getItem("pendingAvatar");
      if (pending) {
        const ai = JSON.parse(pending) as { id: string; avatarUrl: string };
        setAiResult(ai);
        setAiDone(true);
        setState("generating"); // Show form to complete badge
      }
    } catch {}
  }, []);

  const saveToGallery = useCallback((avatar: AvatarResult) => {
    setGallery((prev) => [avatar, ...prev]);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please allow camera permissions.");
    }
  }, [facingMode]);

  useEffect(() => {
    if (state === "camera" && !showGallery) {
      startCamera();
    }
    return () => {
      if (streamRef.current && state !== "camera") {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [state, startCamera, showGallery]);

  // Start AI generation immediately after capture
  const abortRef = useRef<AbortController | null>(null);
  const startGeneration = useCallback(
    async (blob: Blob, dataUrl: string) => {
      // Abort any in-flight generation
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCapturedImage(dataUrl);
      setAiResult(null);
      setAiDone(false);
      setError(null);
      setState("generating");

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      try {
        const formData = new FormData();
        formData.append("photo", blob, "camera-capture.jpg");
        if (fingerprint) formData.append("fingerprint", fingerprint);

        const response = await fetch("/api/generate", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Generation failed");
        }

        const data = await response.json();
        const ai = { id: data.id, avatarUrl: data.avatarUrl };
        setAiResult(ai);
        setAiDone(true);
        // Persist so badge can be completed after refresh
        localStorage.setItem("pendingAvatar", JSON.stringify(ai));
      } catch (err) {
        console.error("Generation error:", err);
        setError(err instanceof Error ? err.message : "Something went wrong");
        setState("camera");
      }
    },
    [fingerprint],
  );

  // Generate badge once AI is done and user has filled firstName
  const generateBadge = useCallback(async () => {
    if (!aiResult || !firstName.trim()) return;

    setBadgeGenerating(true);
    try {
      const response = await fetch("/api/generate-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: aiResult.id,
          firstName: firstName.trim(),
          role: role.trim() || "CREATOR",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Badge generation failed");
      }

      const data = await response.json();
      const avatarResult: AvatarResult = {
        id: aiResult.id,
        originalUrl: "",
        avatarUrl: aiResult.avatarUrl,
        badgeUrl: data.badgeUrl,
        createdAt: Date.now(),
      };

      setResult(avatarResult);
      saveToGallery(avatarResult);
      setState("result");
      localStorage.removeItem("pendingAvatar");
    } catch (err) {
      console.error("Badge generation error:", err);
      setError(err instanceof Error ? err.message : "Badge generation failed");
    } finally {
      setBadgeGenerating(false);
    }
  }, [aiResult, firstName, role, saveToGallery]);

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;

    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          startGeneration(blob, dataUrl);
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [facingMode, startGeneration]);

  const capturePhoto = useCallback(() => {
    if (countdown !== null) return; // already counting
    setCountdown(3);
    let n = 3;
    const interval = setInterval(() => {
      n--;
      if (n > 0) {
        setCountdown(n);
      } else {
        clearInterval(interval);
        doCapture();
        // Flash stays briefly after capture then clears
        setTimeout(() => setCountdown(null), 400);
      }
    }, 1000);
  }, [countdown, doCapture]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File must be less than 10MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        startGeneration(file, dataUrl);
      };
      reader.readAsDataURL(file);

      e.target.value = "";
    },
    [startGeneration],
  );

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setResult(null);
    setError(null);
    setCameraReady(false);
    setFirstName("");
    setRole("");
    setAiResult(null);
    setAiDone(false);
    setState("camera");
  }, []);

  const downloadBadge = useCallback(async () => {
    if (!result) return;
    const url = result.badgeUrl || result.avatarUrl;
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `code-brew-${result.id}.png`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }, [result]);

  const shareBadge = useCallback(async () => {
    if (!result) return;
    const shareUrl = `${window.location.origin}/b/${result.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "My Code Brew Badge", url: shareUrl });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    }
  }, [result]);

  const printBadge = useCallback(async () => {
    if (!result) return;
    const currentUrl = result.badgeUrl || result.avatarUrl;

    // Pair with a different badge from gallery
    const other = gallery.find((item) => item.id !== result.id && item.badgeUrl);
    const secondUrl = other ? (other.badgeUrl || other.avatarUrl) : currentUrl;

    const response = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeUrls: [currentUrl, secondUrl] }),
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "badge-print.jpg";
    a.click();
    URL.revokeObjectURL(url);
  }, [result, gallery]);

  // Gallery view
  if (showGallery) {
    return (
      <div className="h-dvh flex flex-col bg-background">
        <header className="flex items-center justify-between p-4 border-b border-accent/20">
          <button
            onClick={() => setShowGallery(false)}
            className="text-xs uppercase tracking-wider text-accent"
          >
            &larr; Back
          </button>
          <h1 className="text-xs uppercase tracking-widest font-bold">
            Saved Avatars
          </h1>
          <button
            onClick={async () => {
              const badges = gallery.filter((g) => g.badgeUrl);
              if (badges.length === 0) return;
              // Pair badges: [0,1], [2,3], etc. Odd last one gets duplicated
              const pairs: [string, string][] = [];
              for (let i = 0; i < badges.length; i += 2) {
                const a = badges[i].badgeUrl!;
                const b = badges[i + 1]?.badgeUrl ?? a;
                pairs.push([a, b]);
              }
              for (let i = 0; i < pairs.length; i++) {
                const res = await fetch("/api/print", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ badgeUrls: pairs[i] }),
                });
                if (!res.ok) continue;
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `badge-print-${i + 1}.jpg`;
                link.click();
                URL.revokeObjectURL(url);
                // Delay between downloads so browser doesn't block them
                if (i < pairs.length - 1) await new Promise((r) => setTimeout(r, 500));
              }
            }}
            className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
          >
            <Printer className="size-3.5" strokeWidth={1.5} />
            Print
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {gallery.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="size-12 mb-4" strokeWidth={1} />
              <p className="text-xs uppercase tracking-wider">No avatars yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {gallery.map((item) => (
                <button
                  key={item.id}
                  onClick={async () => {
                    const url = item.badgeUrl || item.avatarUrl;
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = `code-brew-${item.id}.png`;
                    a.click();
                    URL.revokeObjectURL(blobUrl);
                  }}
                  className="relative border border-accent/20 bg-muted overflow-hidden group"
                  style={{ aspectRatio: item.badgeUrl ? "1080/1600" : "1/1" }}
                >
                  <img
                    src={item.badgeUrl || item.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
                    <Download className="size-6 text-white" />
                  </div>
                  <span className="absolute bottom-1 right-1 text-[8px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-background relative">
      {countdown !== null && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center pointer-events-none">
          {countdown > 0 ? (
            <span key={countdown} className="text-[12rem] font-black text-black/20 animate-countdown">
              {countdown}
            </span>
          ) : (
            <div className="animate-flash-out absolute inset-0 bg-white" />
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-accent/20 z-10">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-accent" strokeWidth={2} />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
            Code Brew
          </span>
        </div>
        <button
          onClick={() => setShowGallery(true)}
          className="relative flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
        >
          <ImageIcon className="size-3.5" strokeWidth={1.5} />
          <span>Gallery</span>
          {gallery.length > 0 && (
            <span className="absolute -top-1 -right-3 w-4 h-4 bg-accent text-background text-[8px] flex items-center justify-center font-bold">
              {gallery.length}
            </span>
          )}
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center relative overflow-y-auto">
        {/* Camera view */}
        {state === "camera" && (
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="relative w-full max-w-md aspect-square mx-auto">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-accent/60" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-accent/60" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-accent/60" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-accent/60" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-6 h-[1px] bg-accent/40" />
                  <div className="w-[1px] h-6 bg-accent/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
              {!cameraReady && (
                <div className="absolute inset-0 bg-background flex items-center justify-center">
                  <Loader2 className="size-8 text-accent animate-spin" />
                </div>
              )}
            </div>

            {error && (
              <div className="mx-4 mt-4 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Generating state: AI runs in background + user fills form */}
        {state === "generating" && (
          <div className="w-full max-w-md mx-auto p-4 fade-in space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3 p-3 border border-accent/20 bg-muted">
              {!aiDone ? (
                <>
                  <Loader2 className="size-5 text-accent animate-spin shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold">Generating avatar...</p>
                    <p className="text-[10px] text-muted-foreground">Fill in your details while we work</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="size-5 bg-accent-green flex items-center justify-center shrink-0">
                    <Zap className="size-3 text-background" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold text-accent-green">Avatar ready!</p>
                    <p className="text-[10px] text-muted-foreground">Fill your name to create badge</p>
                  </div>
                </>
              )}
            </div>

            {/* Form fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  autoFocus
                  className="w-full h-10 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Role / Company
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Designer, Acme Inc."
                  className="w-full h-10 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Live badge preview */}
            <BadgePreview
              avatarUrl={aiDone && aiResult ? aiResult.avatarUrl : capturedImage}
              firstName={firstName || "YOUR NAME"}
              role={role || "CREATOR"}
              avatarId={aiResult?.id}
              className="w-full"
            />

            {error && (
              <div className="p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {state === "result" && result && (
          <div className="w-full max-w-md mx-auto p-4 fade-in">
            {result.badgeUrl ? (
              <div className="border-2 border-accent/30 overflow-hidden">
                <img
                  src={result.badgeUrl}
                  alt="Code Brew Badge"
                  className="w-full h-auto"
                />
              </div>
            ) : (
              <div className="relative aspect-square border-2 border-accent/30 bg-muted flex items-center justify-center">
                <img
                  src={result.avatarUrl}
                  alt="Code Brew Badge"
                  className="w-full h-full object-contain p-4"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="p-4 pb-8 border-t border-accent/20 z-10 shrink-0">
        {state === "camera" && (
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={switchCamera}
              className="w-12 h-12 border border-accent/30 flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              <SwitchCamera className="size-5" strokeWidth={1.5} />
            </button>

            <button
              onClick={capturePhoto}
              disabled={!cameraReady || countdown !== null}
              className="w-16 h-16 border-2 border-accent bg-accent/10 flex items-center justify-center hover:bg-accent/20 active:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Camera className="size-7 text-accent" strokeWidth={1.5} />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 border border-accent/30 flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              <Upload className="size-5" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {state === "generating" && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={retake}
              className="flex-1 max-w-[120px] h-12 border border-accent/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              <Camera className="size-4" strokeWidth={1.5} />
              Retake
            </button>

            <button
              onClick={generateBadge}
              disabled={!aiDone || !firstName.trim() || badgeGenerating}
              className="flex-1 max-w-[200px] h-12 bg-accent-green text-background flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-bold hover:bg-accent-green/90 active:bg-accent-green/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {badgeGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating Badge...
                </>
              ) : !aiDone ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="size-4" strokeWidth={2} />
                  Create Badge
                </>
              )}
            </button>
          </div>
        )}

        {state === "result" && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={retake}
              className="flex-1 max-w-[120px] h-12 border border-accent/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              <Camera className="size-4" strokeWidth={1.5} />
              New
            </button>

            <button
              onClick={shareBadge}
              className="flex-1 max-w-[100px] h-12 border border-accent/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              <Share2 className="size-4" strokeWidth={1.5} />
              Share
            </button>

            <button
              onClick={printBadge}
              className="flex-1 max-w-[100px] h-12 border border-accent/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              <Printer className="size-4" strokeWidth={1.5} />
              Print
            </button>

            <button
              onClick={downloadBadge}
              className="flex-1 max-w-[140px] h-12 bg-accent-green text-background flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-bold hover:bg-accent-green/90 active:bg-accent-green/80 transition-colors"
            >
              <Download className="size-4" strokeWidth={2} />
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
