import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { admin } from '../../../../lib/supabaseAdmin'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,           // mailto:you@example.com
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(req) {
  const { sender, body, room = 'main' } = await req.json()

  const { data: subs } = await admin.from('push_subscriptions').select('*')
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = JSON.stringify({
    title: sender,
    body: body?.slice(0, 120) || 'Шинэ мессеж',
    room,
    url: '/',
  })

  let sent = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
      sent++
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
  }))

  return NextResponse.json({ sent })
}