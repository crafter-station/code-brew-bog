"use client";

import { Download, Share2, Printer } from "lucide-react";
import Image from "next/image";
import { useCallback } from "react";

interface BadgeClientProps {
  imageUrl: string;
  name: string;
  id: string;
  hasBadge: boolean;
}

export function BadgeClient({ imageUrl, name, id, hasBadge }: BadgeClientProps) {
  const download = useCallback(async () => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `v0-${id}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [imageUrl, id]);

  const share = useCallback(async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name}'s v0 Badge`, url: shareUrl });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    }
  }, [name]);

  const print = useCallback(async () => {
    const response = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeUrls: [imageUrl] }),
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "badge-print.jpg";
    a.click();
    URL.revokeObjectURL(url);
  }, [imageUrl]);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="flex items-center justify-center px-4 py-3 border-b border-accent/20">
        <div className="flex items-center gap-2">
          <Image
            src="/v0-logo-dark.svg"
            alt="v0"
            width={26}
            height={12}
            priority
          />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div
            className="border-2 border-accent/30 overflow-hidden"
            style={hasBadge ? {} : { aspectRatio: "1/1" }}
          >
            <img
              src={imageUrl}
              alt={`${name}'s v0 Badge`}
              className={`w-full ${hasBadge ? "h-auto" : "h-full object-contain p-4"}`}
            />
          </div>

          <p className="text-center text-xs uppercase tracking-wider text-muted-foreground mt-4">
            {name}&apos;s v0 Badge
          </p>
        </div>
      </div>

      <div className="p-4 pb-8 border-t border-accent/20">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={share}
            className="flex-1 max-w-[120px] h-12 border border-accent/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent hover:border-accent transition-colors"
          >
            <Share2 className="size-4" strokeWidth={1.5} />
            Share
          </button>

          <button
            onClick={print}
            className="flex-1 max-w-[120px] h-12 border border-accent/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent hover:border-accent transition-colors"
          >
            <Printer className="size-4" strokeWidth={1.5} />
            Print
          </button>

          <button
            onClick={download}
            className="flex-1 max-w-[160px] h-12 bg-accent-green text-background flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-bold hover:bg-accent-green/90 active:bg-accent-green/80 transition-colors"
          >
            <Download className="size-4" strokeWidth={2} />
            Download
          </button>
        </div>

        <a
          href="/"
          className="block text-center text-[10px] uppercase tracking-wider text-muted-foreground mt-4 hover:text-accent transition-colors"
        >
          Create your own v0 Badge →
        </a>
      </div>
    </div>
  );
}
