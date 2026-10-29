'use client'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const MAX = 50 * 1024 * 1024
const ROOM = 'main'
const REACTS = ['💙', '❤️', '😂', '😮', '😢', '🙏', '👍']
const POP_W = 296

async function post(url, data) {
  const { data: s } = await sb.auth.getSession()
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s.session?.access_token || '') },
    body: JSON.stringify(data),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'Алдаа гарлаа')
  return j
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/* --- SVG icons --- */
const PATHS = {
  chat: <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.4A8.5 8.5 0 1 1 21 12Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  bellOn: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /><path d="M2 8a10 10 0 0 1 2-5M22 8a10 10 0 0 0-2-5" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  clip: <path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
  smile: <><circle cx="12" cy="12" r="9.5" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" strokeWidth="3" /></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" /></>,
  send: <path d="M4.5 12 3 4.2a.8.8 0 0 1 1.1-.9l16.5 8a.8.8 0 0 1 0 1.4l-16.5 8a.8.8 0 0 1-1.1-.9L4.5 12Zm0 0H12" />,
  reply: <><path d="M9 17 4 12l5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  checks: <path d="m2 12 5 5L18 6M13 15.5l1.5 1.5L22 7" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />,
}

function Icon({ name, ...rest }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {PATHS[name]}
    </svg>
  )
}

function dayLabel(d) {
  const dt = new Date(d), n = new Date()
  const y = new Date(n); y.setDate(n.getDate() - 1)
  if (dt.toDateString() === n.toDateString()) return 'Өнөөдөр'
  if (dt.toDateString() === y.toDateString()) return 'Өчигдөр'
  return dt.getFullYear() + ' оны ' + (dt.getMonth() + 1) + '-р сарын ' + dt.getDate()
}

export default function Home() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(null)
  const [uname, setUname] = useState('')
  const [pw, setPw] = useState('')
  const [msgs, setMsgs] = useState([])
  const [reads, setReads] = useState({})
  const [reactions, setReactions] = useState({}) // { message_id: [rows] }
  const [profiles, setProfiles] = useState({})
  const [typing, setTyping] = useState({})
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const [pushOn, setPushOn] = useState(false)
  const [picker, setPicker] = useState(null) // { id, isMe, top, bottom, left, right }

  const listRef = useRef(null)
  const fileRef = useRef(null)
  const typingChannelRef = useRef(null)
  const recorderRef = useRef(null)
  const recTimerRef = useRef(null)
  const pressRef = useRef(null)
  const lastTypingRef = useRef(0)
  const firstLoadRef = useRef(true)
  const stickRef = useRef(true)

  const me = session ? (session.user.email || '').split('@')[0] : ''

  /* --- Auth --- */
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  /* --- Profile upsert + presence --- */
  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    sb.from('profiles').upsert({ id: uid, username: me, online: true, last_seen: new Date().toISOString() })

    const ch = sb.channel('presence', { config: { presence: { key: uid } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const map = {}
      Object.values(state).flat().forEach(p => {
        map[p.user_id] = { username: p.username, online: true }
      })
      setProfiles(prev => ({ ...prev, ...map }))
    })
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ user_id: uid, username: me })
    })

    const onBeforeUnload = () => {
      sb.from('profiles').update({ online: false, last_seen: new Date().toISOString() }).eq('id', uid)
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      onBeforeUnload()
      sb.removeChannel(ch)
    }
  }, [session?.user?.id])

  /* --- Messages + reads + reactions --- */
  useEffect(() => {
    if (!session) { setMsgs([]); firstLoadRef.current = true; return }
    let ch, chR, chRd
    const addMsg = m => setMsgs(p => (p.some(x => x.id === m.id) ? p : [...p, m]))

    ;(async () => {
      const { data, error } = await sb.from('messages').select('*').eq('room', ROOM).order('created_at').limit(200)
      if (error) setErr(error.message); else setMsgs(data || [])

      const { data: rd } = await sb.from('message_reads').select('*')
      if (rd) {
        const map = {}
        rd.forEach(r => { map[r.message_id] = (map[r.message_id] || 0) + 1 })
        setReads(map)
      }

      const { data: rx } = await sb.from('reactions').select('*')
      if (rx) {
        const map = {}
        rx.forEach(r => { (map[r.message_id] ||= []).push(r) })
        setReactions(map)
      }

      const { data: pr } = await sb.from('profiles').select('*')
      if (pr) {
        const map = {}
        pr.forEach(p => { map[p.id] = p })
        setProfiles(prev => ({ ...map, ...prev }))
      }

      ch = sb.channel('room-' + ROOM)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room=eq.' + ROOM }, p => addMsg(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, p => {
          setMsgs(prev => prev.map(x => x.id === p.new.id ? p.new : x))
        })
        .subscribe(s => setLive(s === 'SUBSCRIBED'))

      chR = sb.channel('reactions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, p => {
          if (p.eventType === 'INSERT') {
            const mid = p.new.message_id
            setReactions(prev => {
              const list = prev[mid] || []
              if (list.some(x => x.id === p.new.id)) return prev
              return { ...prev, [mid]: [...list, p.new] }
            })
          } else if (p.eventType === 'UPDATE') {
            const mid = p.new.message_id
            setReactions(prev => ({
              ...prev,
              [mid]: (prev[mid] || []).map(x => x.id === p.new.id ? p.new : x),
            }))
          } else if (p.eventType === 'DELETE') {
            const id = p.old?.id
            if (!id) return
            setReactions(prev => {
              const next = {}
              for (const k in prev) next[k] = prev[k].filter(x => x.id !== id)
              return next
            })
          }
        })
        .subscribe()

      chRd = sb.channel('reads')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads' }, p => {
          const mid = p.new.message_id
          setReads(prev => ({ ...prev, [mid]: (prev[mid] || 0) + 1 }))
        })
        .subscribe()
    })()

    return () => {
      [ch, chR, chRd].forEach(c => c && sb.removeChannel(c))
      setLive(false)
    }
  }, [session?.user?.id])

  /* --- Typing indicator --- */
  useEffect(() => {
    if (!session) return
    const ch = sb.channel('typing-' + ROOM, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload?.username || payload.username === me) return
      setTyping(prev => ({ ...prev, [payload.username]: Date.now() }))
    })
    ch.subscribe()
    typingChannelRef.current = ch
    return () => { sb.removeChannel(ch); typingChannelRef.current = null }
  }, [session?.user?.id, me])

  useEffect(() => {
    const t = setInterval(() => {
      setTyping(prev => {
        const now = Date.now()
        const next = {}
        for (const k in prev) if (now - prev[k] < 3000) next[k] = prev[k]
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  /* --- Auto-scroll --- */
  const scrollBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el || !msgs.length) return
    // Эхний ачаалал: шууд хамгийн сүүлийн мессеж дээр, animation-гүй
    if (firstLoadRef.current) {
      el.scrollTop = el.scrollHeight
      firstLoadRef.current = false
      stickRef.current = true
      return
    }
    // Дараагийн мессеж: доод талд байсан эсвэл өөрөө илгээсэн бол доошилно
    const last = msgs[msgs.length - 1]
    if (stickRef.current || last.sender === me) scrollBottom(true)
  }, [msgs])

  /* --- Read receipts --- */
  useEffect(() => {
    if (!session || !msgs.length) return
    const uid = session.user.id
    const toMark = msgs.filter(m => m.sender !== me).map(m => m.id)
    if (!toMark.length) return
    sb.from('message_reads').upsert(
      toMark.map(id => ({ message_id: id, user_id: uid })),
      { onConflict: 'message_id,user_id', ignoreDuplicates: true }
    )
  }, [msgs.length, session?.user?.id])

  /* --- Reaction popup: гадна дарахад / Esc үед хаах --- */
  useEffect(() => {
    if (!picker) return
    const onDown = (e) => { if (!e.target.closest?.('.rx-pop')) setPicker(null) }
    const onKey = (e) => { if (e.key === 'Escape') setPicker(null) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [picker])

  /* --- Push --- */
  const enablePush = useCallback(async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setErr('Энэ төхөөрөмж push дэмжихгүй'); return
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setErr('Мэдэгдэл зөвшөөрөгдөөгүй'); return }
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
      await post('/api/push/subscribe', sub.toJSON())
      setPushOn(true)
    } catch (e) {
      setErr(e.message || 'Push алдаа')
    }
  }, [])

  useEffect(() => {
    if (!session || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) setPushOn(true)
    })
  }, [session])

  /* --- Login --- */
  async function login(e) {
    e.preventDefault()
    setErr('')
    const u = uname.trim().toLowerCase()
    const email = u.includes('@') ? u : u + '@chat.mn'
    const { error } = await sb.auth.signInWithPassword({ email, password: pw })
    if (error) setErr(error.message + ' (' + email + ')')
    else setPw('')
  }

  /* --- Send text --- */
  async function sendText(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    const rep = replyTo?.id || null
    const prevReply = replyTo
    setText(''); setReplyTo(null)
    try { await post('/api/messages', { kind: 'text', body, reply_to: rep }) }
    catch (x) { setText(body); setReplyTo(prevReply); setErr(x.message) }
  }

  /* --- Send file --- */
  async function sendFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/^(image|video)\//.test(f.type)) { setErr('Зөвхөн зураг эсвэл видео'); return }
    if (f.size > MAX) { setErr('50MB-аас бага байх ёстой'); return }
    setBusy(true); setErr('')
    try {
      const ext = f.name.split('.').pop() || 'bin'
      const up = await post('/api/upload', { type: f.type, size: f.size, ext })
      const { error } = await sb.storage.from('media').uploadToSignedUrl(up.path, up.token, f)
      if (error) throw error
      await post('/api/messages', {
        kind: f.type.startsWith('image') ? 'image' : 'video',
        media_url: up.url,
        reply_to: replyTo?.id || null,
      })
      setReplyTo(null)
    } catch (x) { setErr(x.message || 'Илгээж чадсангүй') }
    setBusy(false)
  }

  /* --- Voice --- */
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '' })
      const chunks = []
      rec.ondataavailable = e => e.data.size && chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (blob.size < 1000) return
        setBusy(true)
        try {
          const up = await post('/api/upload', { type: 'audio/webm', size: blob.size, ext: 'webm' })
          const { error } = await sb.storage.from('voice').uploadToSignedUrl(up.path, up.token, blob)
          if (error) throw error
          await post('/api/messages', { kind: 'voice', media_url: up.url, reply_to: replyTo?.id || null })
          setReplyTo(null)
        } catch (x) { setErr(x.message || 'Дуу илгээж чадсангүй') }
        setBusy(false)
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setRecSec(0)
      recTimerRef.current = setInterval(() => setRecSec(s => s + 1), 1000)
    } catch (e) {
      setErr('Микрофон зөвшөөрөгдөөгүй')
    }
  }

  function stopRecording(send = true) {
    clearInterval(recTimerRef.current)
    const rec = recorderRef.current
    recorderRef.current = null
    setRecording(false)
    if (rec && rec.state !== 'inactive') {
      if (!send) { rec.ondataavailable = null; rec.onstop = null }
      rec.stop()
    }
  }

  /* ============ REACTIONS ============ */
  // Нэг хүн нэг мессежид нэг reaction. Ижил emoji дахин дарвал арилна, өөр emoji бол солигдоно.
  async function react(msgId, emoji) {
    const uid = session.user.id
    const mine = (reactions[msgId] || []).find(r => r.user_id === uid)
    setPicker(null)

    const removeLocal = (id) => setReactions(p => ({
      ...p, [msgId]: (p[msgId] || []).filter(x => x.id !== id),
    }))

    try {
      if (mine) {
        removeLocal(mine.id)
        const { error } = await sb.from('reactions').delete().eq('id', mine.id)
        if (error) throw error
        if (mine.emoji === emoji) return
      }
      const { data, error } = await sb.from('reactions')
        .insert({ message_id: msgId, user_id: uid, sender: me, emoji })
        .select().single()
      if (error) throw error
      setReactions(p => {
        const list = p[msgId] || []
        if (list.some(x => x.id === data.id)) return p
        return { ...p, [msgId]: [...list, data] }
      })
    } catch (x) {
      setErr(x.message || 'Reaction алдаа')
      const { data } = await sb.from('reactions').select('*').eq('message_id', msgId)
      setReactions(p => ({ ...p, [msgId]: data || [] }))
    }
  }

  function openPicker(bubbleEl, m, isMe) {
    if (!bubbleEl) return
    const r = bubbleEl.getBoundingClientRect()
    setPicker({ id: m.id, isMe, top: r.top, bottom: r.bottom, left: r.left, right: r.right })
  }

  function pressStart(e, m, isMe) {
    const el = e.currentTarget
    clearTimeout(pressRef.current)
    pressRef.current = setTimeout(() => {
      openPicker(el, m, isMe)
      if (navigator.vibrate) navigator.vibrate(10)
    }, 420)
  }
  function pressCancel() { clearTimeout(pressRef.current) }

  /* --- Typing broadcast --- */
  function onTextChange(v) {
    setText(v)
    const now = Date.now()
    if (now - lastTypingRef.current > 1500 && v.trim()) {
      lastTypingRef.current = now
      typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { username: me } })
    }
  }

  /* --- helpers --- */
  // Огноо нь тусгаарлагч дээр харагдах тул энд зөвхөн цаг
  const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  const msgById = (id) => msgs.find(m => m.id === id)
  const typingNames = Object.keys(typing).filter(n => n !== me)

  if (!ready) return <div className="loading"><div className="spinner" /></div>

  if (!session) {
    return (
      <main className="join">
        <form className="card" onSubmit={login}>
          <div className="logo"><Icon name="chat" /></div>
          <h1>Зөвхөн Ариунгэрэлд</h1>
          <p className="sub">Нэр болон нууц үгээрээ нэвтэрнэ үү</p>
          <label className="field">
            <Icon name="user" />
            <input type="text" value={uname} onChange={e => setUname(e.target.value)} placeholder="Нэр" maxLength={60} autoCapitalize="none" autoComplete="username" required />
          </label>
          <label className="field">
            <Icon name="lock" />
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Нууц үг" autoComplete="current-password" required />
          </label>
          <button disabled={!uname.trim() || !pw}>Нэвтрэх</button>
          <div className="err">{err}</div>
        </form>
      </main>
    )
  }

  /* --- popup тооцоолол --- */
  let popMsg = null, popMine = null, popStyle = null, popBelow = false
  if (picker) {
    popMsg = msgById(picker.id)
    popMine = (reactions[picker.id] || []).find(r => r.user_id === session.user.id)
    const left = Math.max(8, Math.min(picker.isMe ? picker.right - POP_W : picker.left, window.innerWidth - POP_W - 8))
    popBelow = picker.top < 130
    popStyle = popBelow
      ? { left, top: picker.bottom + 8 }
      : { left, bottom: window.innerHeight - picker.top + 8 }
  }

  return (
    <div className="chat">
      <header className="top">
        <div className="who-me">
          <div className="avatar">
            {me.charAt(0).toUpperCase()}
            <span className={'presence' + (live ? ' on' : '')} />
          </div>
          <div className="who-me-text">
            <b>{me}</b>
            <small>
              <span className={'dot' + (live ? ' on' : '')} />
              {live ? 'Холбогдсон' : 'Холбогдож байна…'}
            </small>
          </div>
        </div>
        <div className="top-actions">
          {!pushOn && <button className="icon-btn" onClick={enablePush} title="Мэдэгдэл асаах" aria-label="Мэдэгдэл асаах"><Icon name="bell" /></button>}
          {pushOn && <span className="push-on" title="Мэдэгдэл асаалттай"><Icon name="bellOn" /></span>}
          <button className="logout" onClick={() => sb.auth.signOut()} title="Гарах" aria-label="Гарах"><Icon name="logout" /></button>
        </div>
      </header>

      <div
        className="list"
        ref={listRef}
        aria-live="polite"
        onScroll={e => {
          const el = e.currentTarget
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150
          if (picker) setPicker(null)
        }}
      >
        {msgs.length === 0 && (
          <div className="empty">
            <div className="empty-icon"><Icon name="chat" /></div>
            <p>Одоогоор мессеж байхгүй</p>
            <span>Эхний мессежээ илгээгээрэй</span>
          </div>
        )}
        {msgs.map((m, i) => {
          const isMe = m.sender === me
          const prev = msgs[i - 1]
          const next = msgs[i + 1]
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
          const showWho = !isMe && (newDay || prev?.sender !== m.sender)
          const lastOfGroup = !next || next.sender !== m.sender ||
            new Date(next.created_at).toDateString() !== new Date(m.created_at).toDateString()
          const quoted = m.reply_to ? msgById(m.reply_to) : null
          const rxs = reactions[m.id] || []
          const grouped = rxs.reduce((acc, r) => {
            (acc[r.emoji] ||= []).push(r)
            return acc
          }, {})
          const readCount = reads[m.id] || 0
          const senderProfile = Object.values(profiles).find(p => p.username === m.sender)
          const isOnline = senderProfile?.online || false
          const myR = rxs.find(r => r.user_id === session.user.id)

          return (
            <Fragment key={m.id}>
            {newDay && <div className="day">{dayLabel(m.created_at)}</div>}
            <div className={'m-row' + (isMe ? ' me' : '') + (rxs.length ? ' has-rx' : '') + (newDay || prev?.sender !== m.sender ? ' first' : '')}>
              {!isMe && (
                <div className={'m-avatar' + (lastOfGroup ? '' : ' ghost')}>
                  {m.sender.charAt(0).toUpperCase()}
                  {isOnline && <span className="presence on" />}
                </div>
              )}

              <div className="m-col">
                <div className="m-line">
                  <div
                    className={'m' + (isMe ? ' me' : '') + (m.kind !== 'text' ? ' media' : '')}
                    onTouchStart={e => pressStart(e, m, isMe)}
                    onTouchEnd={pressCancel}
                    onTouchMove={pressCancel}
                    onTouchCancel={pressCancel}
                    onContextMenu={e => { e.preventDefault(); openPicker(e.currentTarget, m, isMe) }}
                    onDoubleClick={() => react(m.id, '💙')}
                  >
                    {!isMe && showWho && <span className="who">{m.sender}</span>}

                    {quoted && (
                      <div className="quote">
                        <b>{quoted.sender}</b>
                        <span>{quoted.kind === 'text' ? quoted.body?.slice(0, 80) : '📎 Хавсралт'}</span>
                      </div>
                    )}

                    {m.kind === 'image' && (
                      <a href={m.media_url} target="_blank" rel="noreferrer">
                        <img
                          src={m.media_url}
                          alt="зураг"
                          loading="lazy"
                          draggable={false}
                          onLoad={() => stickRef.current && scrollBottom()}
                        />
                      </a>
                    )}
                    {m.kind === 'video' && (
                      <video
                        src={m.media_url}
                        controls
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={() => stickRef.current && scrollBottom()}
                      />
                    )}
                    {m.kind === 'voice' && <audio src={m.media_url} controls preload="metadata" className="voice-audio" />}
                    {m.kind === 'text' && <span className="body">{m.body}</span>}

                    <div className="m-meta">
                      <time>{fmtTime(m.created_at)}</time>
                      {isMe && (
                        <span className={'tick' + (readCount > 0 ? ' read' : '')} title={readCount > 0 ? 'Уншсан' : 'Илгээсэн'}>
                          <Icon name={readCount > 0 ? 'checks' : 'check'} />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desktop hover товчнууд */}
                  <div className="side-actions">
                    <button
                      type="button"
                      className="side-btn"
                      title="Reaction"
                      aria-label="Reaction"
                      onClick={e => openPicker(e.currentTarget.closest('.m-line').querySelector('.m'), m, isMe)}
                    ><Icon name="smile" /></button>
                    <button
                      type="button"
                      className="side-btn"
                      title="Хариулах"
                      aria-label="Хариулах"
                      onClick={() => setReplyTo(m)}
                    ><Icon name="reply" /></button>
                  </div>
                </div>                        

                {rxs.length > 0 && (
                  <div className="rx-bar">
                    {Object.entries(grouped).map(([emoji, list]) => {
                      const mine = myR?.emoji === emoji
                      return (
                        <button
                          type="button"
                          key={emoji}
                          className={'rx-pill' + (mine ? ' mine' : '')}
                          onClick={() => react(m.id, emoji)}
                          title={list.map(r => r.sender).join(', ')}
                        >
                          <span className="rx-e">{emoji}</span>
                          {list.length > 1 && <span className="rx-n">{list.length}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            </Fragment>
          )
        })}
      </div>

      {typingNames.length > 0 && (
        <div className="typing">
          {typingNames.join(', ')} бичиж байна
          <span className="typing-dots"><i /><i /><i /></span>
        </div>
      )}

      {(busy || err) && (
        <div className={'notice' + (err ? ' error' : '')}>
          <span>{busy ? 'Илгээж байна…' : err}</span>
          {err && !busy && <button className="notice-close" onClick={() => setErr('')} aria-label="Хаах"><Icon name="x" /></button>}
        </div>
      )}

      <div className="composer">
        {replyTo && (
          <div className="reply-bar">
            <Icon name="reply" />
            <div className="reply-info">
              <b>{replyTo.sender}</b>
              <span>{replyTo.kind === 'text' ? replyTo.body?.slice(0, 60) : '📎 Хавсралт'}</span>
            </div>
            <button onClick={() => setReplyTo(null)} aria-label="Цуцлах"><Icon name="x" /></button>
          </div>
        )}

        {showEmoji && (
          <div className="emoji-picker">
            {['😀','😂','🥰','😎','🤔','😢','😡','👍','👎','❤️','💙','🔥','🎉','🙏','👏','💪','✨','🌸','🍕','⚽','🎵','📷','🎬','💬','✅','❌','⭐','🌙'].map(e => (
              <button type="button" key={e} onClick={() => { setText(t => t + e); setShowEmoji(false) }}>{e}</button>
            ))}
          </div>
        )}

        <form className="bar" onSubmit={sendText}>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={sendFile} />
          <button type="button" className="clip" disabled={busy || recording} onClick={() => fileRef.current.click()} aria-label="Хавсаргах" title="Зураг / видео"><Icon name="clip" /></button>

          {recording ? (
            <div className="recording">
              <span className="rec-dot" />
              <span className="rec-time">{String(Math.floor(recSec / 60)).padStart(2, '0')}:{String(recSec % 60).padStart(2, '0')}</span>
              <button type="button" className="rec-cancel" onClick={() => stopRecording(false)} aria-label="Цуцлах"><Icon name="trash" /></button>
              <button type="button" className="rec-send" onClick={() => stopRecording(true)} aria-label="Илгээх"><Icon name="send" /></button>
            </div>
          ) : (
            <>
              <div className="input-wrap">
                <input
                  type="text"
                  value={text}
                  onChange={e => onTextChange(e.target.value)}
                  placeholder="Мессеж бичих…"
                  maxLength={2000}
                  autoComplete="off"
                />
                <button type="button" className={'emoji-btn' + (showEmoji ? ' on' : '')} disabled={busy} onClick={() => setShowEmoji(s => !s)} aria-label="Emoji"><Icon name="smile" /></button>
              </div>
              {text.trim() ? (
                <button className="send" disabled={busy} aria-label="Илгээх"><Icon name="send" /></button>
              ) : (
                <button type="button" className="mic" onClick={startRecording} disabled={busy} aria-label="Дуу бичих"><Icon name="mic" /></button>
              )}
            </>
          )}
        </form>
      </div>

      {/* Messenger маягийн reaction popup */}
      {picker && popMsg && (
        <div
          className={'rx-pop' + (picker.isMe ? ' me' : '') + (popBelow ? ' below' : '')}
          style={{ ...popStyle, width: POP_W }}
        >
          <div className="rx-emojis">
            {REACTS.map((e, idx) => (
              <button
                type="button"
                key={e}
                className={popMine?.emoji === e ? 'sel' : ''}
                style={{ '--i': idx }}
                onClick={() => react(popMsg.id, e)}
                aria-label={e}
              >{e}</button>
            ))}
          </div>
          <div className="rx-menu">
            <button type="button" onClick={() => { setReplyTo(popMsg); setPicker(null) }}><Icon name="reply" /> Хариулах</button>
          </div>
        </div>
      )}
    </div>
  )
}