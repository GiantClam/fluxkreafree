import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { z } from "zod";

import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { createBindingsFromRequest, isCloudflareRequest } from "../_cloudflare-adapter";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "5s"
});

function getKey(id: string) {
  return `download:${id}`;
}

const DownloadSchema = z.object({
  fluxId: z.string(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  // 使用 Cloudflare 绑定或回退到环境变量
  let rateLimiter = ratelimit;
  if (isCloudflareRequest(req)) {
    const { kv: cfKV } = createBindingsFromRequest(req);
    rateLimiter = new KVRateLimit(cfKV, {
      limit: 10,
      window: "5s"
    });
    console.log('🌐 API Route: 使用Cloudflare KV绑定进行速率限制');
  }

  const { success } = await rateLimiter.limit(
    getKey(userId) + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const url = new URL(req.url);
    const fluxId = url.searchParams.get("fluxId");
    
    if (!fluxId) {
      return NextResponse.json({ error: "Missing fluxId parameter" }, { status: 400 });
    }

    const [id] = FluxHashids.decode(fluxId);
    if (!id) {
      return new Response("Not found", { status: 404 });
    }

    const fluxData = await prisma.fluxData.findUnique({
      where: {
        id: id as number,
      },
    });

    if (!fluxData || !fluxData.imageUrl) {
      return new Response("Not found", { status: 404 });
    }

    // Check if user owns this flux or if it's public
    if (fluxData.userId !== userId && fluxData.isPrivate) {
      return new Response("Forbidden", { status: 403 });
    }

    // Fetch the image from the URL
    const imageResponse = await fetch(fluxData.imageUrl);
    if (!imageResponse.ok) {
      return new Response("Image not found", { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    
    // Return the image with appropriate headers
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="flux-${fluxId}.jpg"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.log("Download error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
} 