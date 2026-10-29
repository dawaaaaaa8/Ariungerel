import { NextResponse } from 'next/server'
import { admin, ROOM } from '../../../lib/supabaseAdmin'
import { authUser } from '../../../lib/auth'

export async function POST(req) {
  const u = await authUser(req)
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kind = 'text', body, media_url, reply_to } = await req.json()
  if (!['text', 'image', 'video', 'voice'].includes(kind))
    return NextResponse.json({ error: 'Bad kind' }, { status: 400 })
  if (kind === 'text' && (!body || !body.trim()))
    return NextResponse.json({ error: 'Хоосон' }, { status: 400 })

  const { data, error } = await admin.from('messages').insert({
    room: ROOM,
    sender: u.name,
    kind,
    body: kind === 'text' ? body.trim() : (body || null),
    media_url: media_url || null,
    reply_to: reply_to || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  
  const origin = new URL(req.url).origin
  fetch(origin + '/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: u.name, body: kind === 'text' ? body : '📎 Файл', room: ROOM }),
  }).catch(() => {})

  return NextResponse.json(data)
}