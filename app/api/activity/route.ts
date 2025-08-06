
import { type NextRequest, NextResponse } from 'next/server'

import { kv, KVRateLimit } from '@/lib/kv'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const ratelimit = new KVRateLimit(kv, {
    limit: 5,
    window: '5s'
  })
  const { success } = await ratelimit.limit('activity:app' + `_${req.ip ?? ''}`)
  if (!success) {
    return new Response('Too Many Requests', {
      status: 429,
    })
  }

  const app = await kv.get('activity:app')

  return NextResponse.json({
    app,
  })
}
