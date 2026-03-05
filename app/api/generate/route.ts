import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { avatars } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ratelimit } from "@/lib/ratelimit";

const MAX_GENERATIONS = 13;
const isDev = process.env.NODE_ENV === "development";

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      },
    );
  }

  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  console.log("[ai-avatar] FAL key present:", !!falKey, "length:", falKey?.length);
  fal.config({ credentials: falKey });

  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File;
    const fingerprint = formData.get("fingerprint") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    // Fingerprint rate limiting (skip in dev)
    if (!isDev && fingerprint) {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(avatars)
        .where(eq(avatars.fingerprint, fingerprint));

      if (Number(result.count) >= MAX_GENERATIONS) {
        return NextResponse.json(
          { error: "You've reached the maximum of 3 avatar generations" },
          { status: 429 },
        );
      }
    }

    const id = nanoid(10);

    // Compress the photo
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressedImage = await sharp(buffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();

    // Upload original photo to Vercel Blob
    const originalBlob = await put(
      `camera-photos/${id}-${Date.now()}.jpg`,
      compressedImage,
      { access: "public", contentType: "image/jpeg" },
    );

    console.log("[ai-avatar] Original photo uploaded:", originalBlob.url);

    // Step 1: Resize photo for optimal inference
    // (already compressed to 1024x1024 above, reuse originalBlob.url)

    // Step 2: Generate pixel art avatar with qwen-image-edit
    const prompt = `
      8-bit pixel-art portrait, chest-up view. Use a simple solid background for easy cutout.
      Apply flat grayscale shading with four tones. Style should be printed, cartoonish, anime inspired, and cute tender soft.
      Preserve the facial structure. The character should fit entirely within the frame, with no labels or text.
      IMPORTANT: Maintain proper proportions. If the image appears too large, zoom out to ensure the full figure fits.
    `.trim();

    // Submit to FAL queue API directly (faster than SDK)
    console.log("[ai-avatar] Submitting to FAL queue API");
    const queueRes = await fetch("https://queue.fal.run/fal-ai/qwen-image-edit", {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
        "X-Fal-Request-Timeout": "30"
      },
      body: JSON.stringify({
        prompt,
        num_inference_steps: 5,
        guidance_scale: 4,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "jpeg",
        image_url: originalBlob.url,
        negative_prompt: "blurry, ugly",
        acceleration: "regular",
      }),
    });

    if (!queueRes.ok) {
      const err = await queueRes.text();
      console.error("[ai-avatar] FAL queue submit failed:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const { request_id } = await queueRes.json();
    console.log("[ai-avatar] FAL request_id:", request_id);

    // Poll for completion (check abort signal to avoid orphan polling)
    const statusUrl = `https://queue.fal.run/fal-ai/qwen-image-edit/requests/${request_id}/status`;
    const resultUrl = `https://queue.fal.run/fal-ai/qwen-image-edit/requests/${request_id}`;
    const cancelUrl = `https://queue.fal.run/fal-ai/qwen-image-edit/requests/${request_id}/cancel`;
    const falHeaders: Record<string, string> = { Authorization: `Key ${falKey}` };

    const cancelFalJob = async () => {
      try {
        await fetch(cancelUrl, { method: "PUT", headers: falHeaders });
        console.log("[ai-avatar] FAL job cancelled:", request_id);
      } catch {}
    };

    let completed = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      // If client disconnected, cancel FAL job and stop polling
      if (request.signal.aborted) {
        console.log("[ai-avatar] Client disconnected, cancelling FAL job");
        await cancelFalJob();
        return NextResponse.json({ error: "Request cancelled" }, { status: 499 });
      }

      const statusRes = await fetch(statusUrl, { headers: falHeaders });
      const status = await statusRes.json();
      console.log(`[ai-avatar] qwen-image-edit poll ${i + 1}: ${status.status}`);
      if (status.status === "COMPLETED") { completed = true; break; }
      if (status.status === "FAILED") {
        console.error("[ai-avatar] FAL job failed:", status);
        return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
      }
    }

    if (!completed) {
      console.error("[ai-avatar] FAL job timed out after 120s");
      await cancelFalJob();
      return NextResponse.json({ error: "AI generation timed out" }, { status: 504 });
    }

    // Fetch result
    const resultRes = await fetch(resultUrl, { headers: falHeaders });
    if (!resultRes.ok) {
      console.error("[ai-avatar] FAL result fetch failed:", await resultRes.text());
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const data = await resultRes.json();
    const pixelArtImageUrl = data?.images?.[0]?.url ?? data?.image?.url;

    if (!pixelArtImageUrl) {
      console.error("[ai-avatar] Could not find image URL in result:", JSON.stringify(data));
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    console.log("[ai-avatar] Pixel art generated:", pixelArtImageUrl);

    // Step 3: Remove background using BiRefNet v2
    let finalImageUrl = pixelArtImageUrl;
    try {
      console.log("[ai-avatar] Removing background with birefnet/v2");
      const bgResult = await fal.subscribe("fal-ai/birefnet/v2", {
        input: {
          image_url: pixelArtImageUrl,
        },
        logs: true,
        pollInterval: 3000,
        onQueueUpdate: (update) => {
          console.log(`[ai-avatar] birefnet/v2 status: ${update.status}`);
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        },
      });

      const bgData = bgResult.data as { image?: { url: string } };
      if (bgData?.image?.url) {
        finalImageUrl = bgData.image.url;
        console.log("[ai-avatar] Background removed:", finalImageUrl);
      } else {
        console.warn("[ai-avatar] No image in birefnet result, using original");
      }
    } catch (err) {
      console.warn("[ai-avatar] Background removal failed, using original:", err);
    }

    // Step 4: Post-process with Sharp — resize and grayscale
    console.log("[ai-avatar] Post-processing avatar");
    let avatarBuffer: Buffer = null!;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const avatarResponse = await fetch(finalImageUrl, {
          signal: AbortSignal.timeout(30000),
        });
        avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
        break;
      } catch (err) {
        console.warn(`[ai-avatar] Fetch attempt ${attempt + 1} failed:`, err);
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const processedAvatar = await sharp(avatarBuffer)
      .resize(960, 960, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .grayscale()
      .png()
      .toBuffer();

    // Upload final avatar
    const avatarBlob = await put(
      `ai-avatars/${id}-${Date.now()}.png`,
      processedAvatar,
      { access: "public", contentType: "image/png" },
    );

    console.log("[ai-avatar] Avatar uploaded:", avatarBlob.url);

    // Save to database (badge generated separately after user fills form)
    await db.insert(avatars).values({
      id,
      originalUrl: originalBlob.url,
      avatarUrl: avatarBlob.url,
      fingerprint,
    });

    console.log("[ai-avatar] Saved to database");

    return NextResponse.json({
      id,
      originalUrl: originalBlob.url,
      avatarUrl: avatarBlob.url,
    });
  } catch (error) {
    console.error("[ai-avatar] Error:", error, "body:", (error as any)?.body);
    return NextResponse.json(
      { error: "Failed to generate avatar" },
      { status: 500 },
    );
  }
}
