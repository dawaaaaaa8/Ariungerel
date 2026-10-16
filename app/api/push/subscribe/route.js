import { NextResponse } from 'next/server'
import { admin } from '../../../../lib/supabaseAdmin'
import { authUser } from '../../../../lib/auth'

export async function POST(req) {
  const u = await authUser(req)
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sub = await req.json()
  if (!sub?.endpoint) return NextResponse.json({ error: 'Bad sub' }, { status: 400 })

  await admin.from('push_subscriptions').upsert({
    user_id: u.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ ok: true })
}