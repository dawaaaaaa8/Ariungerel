import { NextResponse } from 'next/server'
import { admin } from '@/lib/supabaseAdmin'
import { authUser } from '@/lib/auth'

const BUCKETS = { image: 'media', video: 'media', voice: 'voice' }

export async function POST(req) {
  const u = await authUser(req)
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, size, ext } = await req.json()
  const bucket = type?.startsWith('audio') ? 'voice'
    : type?.startsWith('image') ? 'media'
    : type?.startsWith('video') ? 'media' : null

  if (!bucket) return NextResponse.json({ error: 'Төрөл буруу' }, { status: 400 })

  const max = bucket === 'voice' ? 10 * 1024 * 1024 : 50 * 1024 * 1024
  if (size > max) return NextResponse.json({ error: 'Хэт том' }, { status: 400 })

  const path = `${u.id}/${Date.now()}.${ext || 'bin'}`
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path)

  return NextResponse.json({ path: data.path, token: data.token, url: pub.publicUrl })
}