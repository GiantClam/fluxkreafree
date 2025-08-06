// 在 Cloudflare Workers 环境中，我们暂时禁用 OG 图像生成
// 因为 @vercel/og 不兼容 Cloudflare Workers
// TODO: 实现 Cloudflare 兼容的 OG 图像生成

import { ogImageSchema } from "@/lib/validations/og"

export const runtime = "edge"




export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const values = ogImageSchema.parse(Object.fromEntries(url.searchParams))
    
    // 在 Cloudflare Workers 环境中，暂时返回一个简单的 JSON 响应
    // 而不是生成图像，因为 @vercel/og 不兼容
    return new Response(
      JSON.stringify({
        message: "OG image generation is temporarily disabled in Cloudflare Workers",
        params: values,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return new Response(`Failed to process request`, {
      status: 500,
    })
  }
}
