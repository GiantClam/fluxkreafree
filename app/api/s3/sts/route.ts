import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { generatePresignedPutUrl, generatePresignedGetUrl } from "@/modules/cloudflare-storage";
import { env } from "@/env.mjs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const fileType = searchParams.get("fileType") || "application/octet-stream";

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // 生成预签名 PUT URL（用于上传）
    const putUrl = await generatePresignedPutUrl(key, fileType);
    
    // 生成预签名 GET URL（用于下载）
    const getUrl = await generatePresignedGetUrl(`uploads/${key}`);

    // 构建完整 URL
    const completedUrl = `${env.R2_URL_BASE.replace(/\/$/, "")}/uploads/${key}`;

    return NextResponse.json({
      data: {
        putUrl,
        url: getUrl,
        key: `uploads/${key}`,
        completedUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { key, fileType = "application/octet-stream" } = body;

    if (!key) {
      return NextResponse.json({ error: "Missing key in request body" }, { status: 400 });
    }

    // 生成预签名 PUT URL（用于上传）
    const putUrl = await generatePresignedPutUrl(key, fileType);
    
    // 生成预签名 GET URL（用于下载）
    const getUrl = await generatePresignedGetUrl(`uploads/${key}`);

    // 构建完整 URL
    const completedUrl = `${env.R2_URL_BASE.replace(/\/$/, "")}/uploads/${key}`;

    return NextResponse.json({
      data: {
        putUrl,
        url: getUrl,
        key: `uploads/${key}`,
        completedUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
} 