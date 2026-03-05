"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, Download, Eye, EyeOff, ImageIcon, Printer, Trash2 } from "lucide-react";

export interface AvatarResult {
  id: string;
  originalUrl: string;
  avatarUrl: string;
  badgeUrl?: string | null;
  createdAt: number;
}

interface GalleryClientProps {
  initialGallery: AvatarResult[];
}

const PRINTED_PHOTOS_STORAGE_KEY = "codebrew.printedPhotos";
const HIDE_PRINTED_STORAGE_KEY = "codebrew.hidePrintedPhotos";

function getInitialPrintedIds() {
  if (typeof window === "undefined") return {} as Record<string, boolean>;

  try {
    const saved = localStorage.getItem(PRINTED_PHOTOS_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function getInitialHidePrinted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(HIDE_PRINTED_STORAGE_KEY) === "true";
}

export function GalleryClient({ initialGallery }: GalleryClientProps) {
  const [gallery, setGallery] = useState<AvatarResult[]>(initialGallery);
  const [printedPhotoIds, setPrintedPhotoIds] = useState<Record<string, boolean>>(getInitialPrintedIds);
  const [hidePrintedPhotos, setHidePrintedPhotos] = useState(getInitialHidePrinted);

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

  const deleteFromGallery = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/gallery?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        alert(data?.error || "Could not delete photo");
        return;
      }

      setGallery((prev) => prev.filter((item) => item.id !== id));
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

  const downloadPhoto = useCallback(async (item: AvatarResult) => {
    const url = item.badgeUrl || item.avatarUrl;
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `code-brew-${item.id}.png`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }, []);

  const printVisible = useCallback(async () => {
    const badges = visibleGallery.filter((g) => g.badgeUrl && !printedPhotoIds[g.id]);
    if (badges.length === 0) return;

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

      if (i < pairs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }, [printedPhotoIds, visibleGallery]);

  return (
    <div className="h-dvh flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-accent/20">
        <Link href="/" className="text-xs uppercase tracking-wider text-accent">
          &larr; Back
        </Link>
        <h1 className="text-xs uppercase tracking-widest font-bold">Saved Avatars</h1>
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
            onClick={printVisible}
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
                <button type="button" onClick={() => downloadPhoto(item)} className="w-full h-full">
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
