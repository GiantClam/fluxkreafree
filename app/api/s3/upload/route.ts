import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { uploadBufferToR2 } from "@/modules/cloudflare-storage";

/**
 * 服务器端代理上传 API
 * 用于解决 CORS 问题，当 R2 存储桶未配置 CORS 时使用
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const key = formData.get("key") as string;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // 将 File 转换为 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上传到 R2
    const publicUrl = await uploadBufferToR2(
      buffer,
      `uploads/${key}`,
      file.type
    );

    // 构建响应
    const completedUrl = publicUrl;
    const getUrl = publicUrl; // R2 公共 URL 可以直接访问

    return NextResponse.json({
      data: {
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

