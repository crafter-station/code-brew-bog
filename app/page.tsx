"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera,
  SwitchCamera,
  Download,
  Loader2,
  ImageIcon,
  Upload,
  Share2,
  Printer,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getFingerprint } from "@/lib/fingerprint";

type AppState = "form" | "camera" | "generating" | "result";

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

  const [state, setState] = useState<AppState>("form");
  const [result, setResult] = useState<AvatarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [gallery, setGallery] = useState<AvatarResult[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [fingerprint, setFingerprint] = useState<string | null>(null);

  // Generation state
  const [aiResult, setAiResult] = useState<{ id: string; avatarUrl: string } | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [badgeGenerating, setBadgeGenerating] = useState(false);

  // Editable badge fields
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState("");
  const badgeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (state === "camera") {
      startCamera();
    }
    return () => {
      if (streamRef.current && state !== "camera") {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [state, startCamera]);

  // Start AI generation immediately after capture
  const abortRef = useRef<AbortController | null>(null);
  const startGeneration = useCallback(
    async (blob: Blob) => {
      // Abort any in-flight generation
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

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

        // Auto-generate badge immediately with user's name/role
        setBadgeGenerating(true);
        try {
          const badgeRes = await fetch("/api/generate-badge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              avatarId: ai.id,
              firstName: firstName.trim() || "ATTENDEE",
              role: role.trim() || "CREATOR",
            }),
          });

          if (!badgeRes.ok) {
            const badgeData = await badgeRes.json();
            throw new Error(badgeData.error || "Badge generation failed");
          }

          const badgeData = await badgeRes.json();
          const avatarResult: AvatarResult = {
            id: ai.id,
            originalUrl: "",
            avatarUrl: ai.avatarUrl,
            badgeUrl: badgeData.badgeUrl,
            createdAt: Date.now(),
          };

          setResult(avatarResult);
          saveToGallery(avatarResult);
          setState("result");
        } catch (badgeErr) {
          console.error("Badge generation error:", badgeErr);
          // Still show result with just the avatar
          const avatarResult: AvatarResult = {
            id: ai.id,
            originalUrl: "",
            avatarUrl: ai.avatarUrl,
            createdAt: Date.now(),
          };
          setResult(avatarResult);
          saveToGallery(avatarResult);
          setState("result");
        } finally {
          setBadgeGenerating(false);
        }
      } catch (err) {
        console.error("Generation error:", err);
        setError(err instanceof Error ? err.message : "Something went wrong");
        setState("camera");
      }
    },
    [fingerprint, firstName, role, saveToGallery],
  );

  // Auto-save: regenerate badge when name/role changes
  const updateBadge = useCallback(
    async (name: string, userRole: string) => {
      if (!result?.id) return;
      setBadgeGenerating(true);
      try {
        const res = await fetch("/api/generate-badge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarId: result.id,
            firstName: name.trim() || "ATTENDEE",
            role: userRole.trim() || "CREATOR",
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setResult((prev) =>
          prev ? { ...prev, badgeUrl: data.badgeUrl } : prev,
        );
        setGallery((prev) =>
          prev.map((item) =>
            item.id === result.id ? { ...item, badgeUrl: data.badgeUrl } : item,
          ),
        );
      } catch (err) {
        console.error("Badge update error:", err);
      } finally {
        setBadgeGenerating(false);
      }
    },
    [result?.id],
  );

  const handleNameChange = useCallback(
    (value: string) => {
      setFirstName(value);
      if (badgeSaveTimer.current) clearTimeout(badgeSaveTimer.current);
      badgeSaveTimer.current = setTimeout(() => updateBadge(value, role), 800);
    },
    [updateBadge, role],
  );

  const handleRoleChange = useCallback(
    (value: string) => {
      setRole(value);
      if (badgeSaveTimer.current) clearTimeout(badgeSaveTimer.current);
      badgeSaveTimer.current = setTimeout(() => updateBadge(firstName, value), 800);
    },
    [updateBadge, firstName],
  );

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
          startGeneration(blob);
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

      startGeneration(file);
      e.target.value = "";
    },
    [startGeneration],
  );

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  const retake = useCallback(() => {
    setResult(null);
    setError(null);
    setCameraReady(false);
    setAiResult(null);
    setAiDone(false);
    setFirstName("");
    setRole("");
    if (badgeSaveTimer.current) clearTimeout(badgeSaveTimer.current);
    setState("form");
  }, []);

  const downloadBadge = useCallback(async () => {
    if (!result) return;
    const url = result.badgeUrl || result.avatarUrl;
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `v0-${result.id}.png`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }, [result]);

  const shareBadge = useCallback(async () => {
    if (!result) return;
    const shareUrl = `${window.location.origin}/b/${result.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "My v0 Badge", url: shareUrl });
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
          <Image
            src="/v0-logo-dark.svg"
            alt="v0"
            width={26}
            height={12}
            priority
          />
        </div>
        <Link
          href="/gallery"
          className="relative flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
        >
          <ImageIcon className="size-3.5" strokeWidth={1.5} />
          <span>Gallery</span>
          {gallery.length > 0 && (
            <span className="absolute -top-1 -right-3 w-4 h-4 bg-accent text-background text-[8px] flex items-center justify-center font-bold">
              {gallery.length}
            </span>
          )}
        </Link>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center relative overflow-y-auto">
        {/* Form: name + role */}
        {state === "form" && (
          <div className="flex-1 flex flex-col items-center justify-center w-full px-4">
            <div className="w-full max-w-md space-y-6">
              <div className="text-center">
                <h2 className="text-sm uppercase tracking-widest font-bold">Create Your Badge</h2>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                  Enter your details to get started
                </p>
              </div>

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
                    className="w-full h-12 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
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
                    className="w-full h-12 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Generating state: auto-generating avatar + badge */}
        {state === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center w-full p-4 fade-in">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-10 text-accent animate-spin" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider font-bold">
                  {!aiDone ? "Generating avatar..." : "Creating badge..."}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  This will take a few seconds
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {state === "result" && result && (
          <div className="w-full max-w-md mx-auto p-4 fade-in space-y-3">
            <div className="relative">
              {result.badgeUrl ? (
                <div className="border-2 border-accent/30 overflow-hidden">
                  <img
                    src={result.badgeUrl}
                    alt="v0 Badge"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="relative aspect-square border-2 border-accent/30 bg-muted flex items-center justify-center">
                  <img
                    src={result.avatarUrl}
                    alt="v0 Badge"
                    className="w-full h-full object-contain p-4"
                  />
                </div>
              )}
              {badgeGenerating && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <Loader2 className="size-6 text-accent animate-spin" />
                </div>
              )}
            </div>

            {/* Editable name & role */}
            <div className="flex gap-2">
              <input
                type="text"
                value={firstName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Your name"
                className="flex-1 h-9 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                placeholder="Role"
                className="flex-1 h-9 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="p-4 pb-8 border-t border-accent/20 z-10 shrink-0">
        {state === "form" && (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setState("camera")}
              disabled={!firstName.trim()}
              className="w-full max-w-md h-12 bg-accent text-background flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-bold hover:bg-accent/90 active:bg-accent/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Camera className="size-4" strokeWidth={2} />
              Take Photo
            </button>
          </div>
        )}

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
          <div className="flex items-center justify-center">
            <button
              onClick={retake}
              className="h-12 px-6 border border-accent/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              <Camera className="size-4" strokeWidth={1.5} />
              Cancel
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
