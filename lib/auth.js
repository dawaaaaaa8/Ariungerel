import { admin } from './supabaseAdmin'

export async function authUser(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return {
    id: data.user.id,
    name: (data.user.email || '').split('@')[0],
  }
}