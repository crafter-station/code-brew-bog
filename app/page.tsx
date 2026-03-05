"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  Trash2,
  CircleCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { getFingerprint } from "@/lib/fingerprint";

type AppState = "form" | "camera" | "generating" | "result";

interface AvatarResult {
  id: string;
  originalUrl: string;
  avatarUrl: string;
  badgeUrl?: string | null;
  createdAt: number;
}

const PRINTED_PHOTOS_STORAGE_KEY = "codebrew.printedPhotos";
const HIDE_PRINTED_STORAGE_KEY = "codebrew.hidePrintedPhotos";

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
  const [showGallery, setShowGallery] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [printedPhotoIds, setPrintedPhotoIds] = useState<Record<string, boolean>>({});
  const [hidePrintedPhotos, setHidePrintedPhotos] = useState(false);

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

  useEffect(() => {
    try {
      const savedPrinted = localStorage.getItem(PRINTED_PHOTOS_STORAGE_KEY);
      if (savedPrinted) {
        const parsed = JSON.parse(savedPrinted) as Record<string, boolean>;
        setPrintedPhotoIds(parsed);
      }

      if (localStorage.getItem(HIDE_PRINTED_STORAGE_KEY) === "true") {
        setHidePrintedPhotos(true);
      }
    } catch (err) {
      console.error("Failed to load local gallery state:", err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PRINTED_PHOTOS_STORAGE_KEY, JSON.stringify(printedPhotoIds));
  }, [printedPhotoIds]);

  useEffect(() => {
    localStorage.setItem(HIDE_PRINTED_STORAGE_KEY, hidePrintedPhotos ? "true" : "false");
  }, [hidePrintedPhotos]);

  const visibleGallery = useMemo(() => {
    if (!hidePrintedPhotos) return gallery;
    return gallery.filter((item) => !printedPhotoIds[item.id]);
  }, [gallery, hidePrintedPhotos, printedPhotoIds]);


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

  const deleteFromGallery = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/gallery?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.error || "Could not delete photo";
        alert(message);
        return;
      }

      setGallery((prev) => prev.filter((item) => item.id !== id));
      setResult((prev) => (prev?.id === id ? null : prev));
      setPrintedPhotoIds((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error("Delete error:", err);
      alert("Could not delete photo");
    }
  }, []);

  const togglePrintedPhoto = useCallback((id: string) => {
    setPrintedPhotoIds((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  }, []);

  // Gallery view
  if (showGallery) {
    return (
      <div className="h-dvh flex flex-col bg-background">
        <header className="flex items-center justify-between p-4 border-b border-accent/20">
          <button
            type="button"
            onClick={() => setShowGallery(false)}
            className="text-xs uppercase tracking-wider text-accent"
          >
            &larr; Back
          </button>
          <h1 className="text-xs uppercase tracking-widest font-bold">
            Saved Avatars
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHidePrintedPhotos((prev) => !prev)}
              className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
            >
              {hidePrintedPhotos ? (
                <>
                  <Eye className="size-3.5" strokeWidth={1.5} />
                  Show printed
                </>
              ) : (
                <>
                  <EyeOff className="size-3.5" strokeWidth={1.5} />
                  Hide printed
                </>
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                const badges = visibleGallery.filter(
                  (g) => g.badgeUrl && !printedPhotoIds[g.id],
                );
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
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {visibleGallery.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="size-12 mb-4" strokeWidth={1} />
              <p className="text-xs uppercase tracking-wider">
                {gallery.length === 0 ? "No avatars yet" : "No visible avatars"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibleGallery.map((item) => (
                <div
                  key={item.id}
                  className="relative border border-accent/20 bg-muted overflow-hidden group"
                  style={{ aspectRatio: item.badgeUrl ? "1080/1600" : "1/1" }}
                >
                  <button
                    type="button"
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
                    className="w-full h-full"
                  >
                    <img
                      src={item.badgeUrl || item.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <Download className="size-6 text-white" />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFromGallery(item.id)}
                    className="absolute top-1 right-1 w-7 h-7 bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity hover:bg-red-600"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePrintedPhoto(item.id)}
                    className={`absolute top-1 left-1 w-7 h-7 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity ${
                      printedPhotoIds[item.id]
                        ? "bg-accent-green hover:bg-accent-green/90"
                        : "bg-black/70 hover:bg-black/85"
                    }`}
                    aria-label={printedPhotoIds[item.id] ? "Mark as unprinted" : "Mark as printed"}
                  >
                    <CircleCheck className="size-3.5" strokeWidth={1.75} />
                  </button>
                  <span className="absolute bottom-1 right-1 text-[8px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
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
          type="button"
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
