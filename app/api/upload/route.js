import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { admin } from '../../../lib/supabaseAdmin'
import { authUser } from '../../../lib/auth'

const EXT = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  video: ['mp4', 'webm', 'mov'],
  audio: ['webm', 'ogg', 'mp3', 'm4a', 'wav'],
}
const BUCKET = { image: 'media', video: 'media', audio: 'voice' }
const MAX = { image: 50 * 1024 * 1024, video: 50 * 1024 * 1024, audio: 10 * 1024 * 1024 }

export async function POST(req) {
  const u = await authUser(req)
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Буруу хүсэлт' }, { status: 400 })
  }

  const { type, size, ext } = body
  const kind = typeof type === 'string' ? type.split('/')[0] : null
  const cleanExt = typeof ext === 'string' ? ext.toLowerCase().replace(/[^a-z0-9]/g, '') : ''

  if (!BUCKET[kind] || !EXT[kind].includes(cleanExt))
    return NextResponse.json({ error: 'Төрөл буруу' }, { status: 400 })

  if (!Number.isFinite(size) || size <= 0 || size > MAX[kind])
    return NextResponse.json({ error: 'Хэт том' }, { status: 400 })

  const bucket = BUCKET[kind]
  const path = `${u.id}/${randomUUID()}.${cleanExt}`

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
  if (error) {
    console.error('signed upload error:', error)
    return NextResponse.json({ error: 'Upload үүсгэж чадсангүй' }, { status: 500 })
  }

  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ path: data.path, token: data.token, url: pub.publicUrl })
}