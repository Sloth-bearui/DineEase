'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { CLOUD_SYNC_URL, mergeSynchroStates, toCompactSyncPayload } from './synchroMerge'
import type { SynchroGameState } from './types'

const DEVICE_KEY = 'dineease_phone_id'
const LOCAL_STATE_KEY = 'dineease_shared_state_v4'
const BC_NAME = 'dineease_bc_v4'

// Each phone (and each browser tab) gets its own unique Phone ID (e.g. PH-8A4F).
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  const params = new URLSearchParams(window.location.search)
  const forcedId = params.get('phoneId')
  if (forcedId) {
    window.sessionStorage.setItem(DEVICE_KEY, forcedId)
    return forcedId
  }
  let id = window.sessionStorage.getItem(DEVICE_KEY)
  if (!id || params.get('newphone') === '1') {
    id = 'PH-' + Math.random().toString(36).substring(2, 6).toUpperCase() + Math.floor(10 + Math.random() * 90)
    window.sessionStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function useSynchro() {
  const [state, setState] = useState<SynchroGameState | null>(null)
  const [deviceId, setDeviceId] = useState<string>(() => (typeof window !== 'undefined' ? getDeviceId() : ''))
  const [origin, setOrigin] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const stateRef = useRef<SynchroGameState | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const activeScanRef = useRef<{ table: number; uid?: string; joinMode?: 'inside' | 'outside' } | null>(null)

  const applyIncomingState = useCallback((incoming: Partial<SynchroGameState> | null, broadcast = false) => {
    if (!incoming || !Array.isArray(incoming.tables)) return
    setState((prev) => {
      const merged = mergeSynchroStates(prev, incoming)
      stateRef.current = merged
      if (merged && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(toCompactSyncPayload(merged)))
        } catch {
          // Ignore storage quota errors
        }
        if (broadcast && bcRef.current) {
          try {
            bcRef.current.postMessage(toCompactSyncPayload(merged))
          } catch {
            // Ignore BroadcastChannel errors
          }
        }
      }
      return merged
    })
  }, [])

  const postAction = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const clientState = stateRef.current ? toCompactSyncPayload(stateRef.current) : undefined
        const res = await fetch('/api/synchro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ ...payload, clientState }),
        })
        const data = await res.json()
        if (data?.state) {
          applyIncomingState(data.state, true)
          // Also broadcast compact state to the global cloud bus from the client for instant cross-PC/phone sync on Vercel
          try {
            const compactBody = JSON.stringify(toCompactSyncPayload(data.state))
            if (compactBody.length < 3900) {
              void fetch(CLOUD_SYNC_URL, { method: 'POST', body: compactBody }).catch(() => {})
            }
          } catch {
            // Ignore
          }
        }
        return data
      } catch {
        return null
      }
    },
    [applyIncomingState],
  )

  useEffect(() => {
    const devId = getDeviceId()
    setDeviceId(devId)

    // Load cached local state immediately so switching tabs/spaces never flickers or loses orders
    try {
      const cached = window.localStorage.getItem(LOCAL_STATE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && Array.isArray(parsed.tables)) {
          applyIncomingState(parsed, false)
        }
      }
    } catch {
      // Ignore corrupt cache
    }

    // Same-browser tab sync via BroadcastChannel + storage event
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BC_NAME)
      bcRef.current = bc
      bc.onmessage = (ev) => {
        if (ev?.data && Array.isArray(ev.data.tables)) {
          applyIncomingState(ev.data, false)
        }
      }
    }
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LOCAL_STATE_KEY && ev.newValue) {
        try {
          const parsed = JSON.parse(ev.newValue)
          applyIncomingState(parsed, false)
        } catch {
          // Ignore
        }
      }
    }
    window.addEventListener('storage', onStorage)

    // 1. Poll /api/synchro and merge state (safe against cold Vercel serverless instances)
    let alive = true
    const fetchState = async () => {
      try {
        const res = await fetch('/api/synchro', { cache: 'no-store' })
        if (!res.ok) return
        const s: SynchroGameState = await res.json()
        if (alive && s && Array.isArray(s.tables)) {
          applyIncomingState(s, false)
        }
      } catch {
        // Ignore transient network errors
      }
    }
    fetchState()
    const pollTimer = window.setInterval(fetchState, 1800)

    // 2. Real-time cross-PC / cross-phone cloud SSE stream + initial history pull (works on Vercel across all devices globally)
    const pullCloudHistory = async () => {
      try {
        const res = await fetch(`${CLOUD_SYNC_URL}/json?poll=1&since=30m`, { cache: 'no-store' })
        if (!res.ok) return
        const text = await res.text()
        const lines = text.trim().split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const evt = JSON.parse(line)
            if (evt?.event === 'message' && typeof evt.message === 'string') {
              const parsed = JSON.parse(evt.message)
              if (alive && parsed && Array.isArray(parsed.tables)) {
                applyIncomingState(parsed, false)
              }
            }
          } catch {
            // Ignore
          }
        }
      } catch {
        // Ignore
      }
    }
    void pullCloudHistory()

    let es: EventSource | null = null
    try {
      es = new EventSource(`${CLOUD_SYNC_URL}/sse`)
      es.onmessage = (ev) => {
        if (!alive || !ev.data) return
        try {
          const wrapper = JSON.parse(ev.data)
          const rawMsg = typeof wrapper?.message === 'string' ? wrapper.message : ev.data
          const parsed = JSON.parse(rawMsg)
          if (parsed && Array.isArray(parsed.tables)) {
            applyIncomingState(parsed, true)
          }
        } catch {
          // Ignore non-JSON keepalives
        }
      }
    } catch {
      // Ignore if EventSource blocked
    }

    // 3. Also connect Socket.io when running locally via server.ts for sub-50ms local updates
    const isLocalOrTunnel =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.lhr.life') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)

    let socket: Socket | null = null
    if (isLocalOrTunnel) {
      socket = io({ transports: ['websocket', 'polling'], reconnectionAttempts: 3 })
      socketRef.current = socket

      socket.on('scan_result', (res: { success: boolean; error?: string }) => {
        if (!res.success && res.error) {
          setScanError(res.error)
          activeScanRef.current = null
        } else {
          setScanError(null)
        }
      })

      socket.on('synchro_state_updated', (s: SynchroGameState) => {
        if (alive) applyIncomingState(s, true)
      })
    }

    // 4. Resolve the public URL phones should open when scanning QR codes
    const syncNetworkOrigin = () => {
      const here = window.location.hostname
      if (here !== 'localhost' && here !== '127.0.0.1' && !/^\d+\.\d+\.\d+\.\d+$/.test(here)) {
        setOrigin(window.location.origin)
        return
      }
      fetch('/api/network')
        .then((r) => r.json())
        .then((n) => {
          if (n.publicUrl && typeof n.publicUrl === 'string' && n.publicUrl.startsWith('http')) {
            setOrigin(n.publicUrl)
            return
          }
          const host = here === 'localhost' || here === '127.0.0.1' ? n.host : here
          setOrigin(`http://${host}:${window.location.port || n.port}`)
        })
        .catch(() => setOrigin(window.location.origin))
    }
    syncNetworkOrigin()
    const netTimer = window.setInterval(syncNetworkOrigin, 12000)

    return () => {
      alive = false
      window.removeEventListener('storage', onStorage)
      window.clearInterval(pollTimer)
      window.clearInterval(netTimer)
      bcRef.current?.close()
      es?.close()
      socket?.disconnect()
    }
  }, [applyIncomingState])

  const scanTable = useCallback(
    async (table: number, uid?: string, joinMode: 'inside' | 'outside' = 'outside') => {
      const devId = getDeviceId()
      setScanError(null)
      activeScanRef.current = { table, uid, joinMode }
      const data = await postAction({
        action: 'table_scan',
        tableId: String(table),
        uid,
        joinMode,
        guestCount: 1,
        deviceId: devId,
      })
      if (data && data.success === false && data.error) {
        setScanError(data.error)
        activeScanRef.current = null
      }
    },
    [postAction],
  )

  const staffSeatTable = useCallback(
    (table: number) => {
      void postAction({ action: 'table_scan', tableId: String(table), guestCount: 1, staff: true })
    },
    [postAction],
  )

  const leaveTable = useCallback(
    (table: number) => {
      activeScanRef.current = null
      void postAction({ action: 'leave_table', tableId: String(table), deviceId: getDeviceId() })
    },
    [postAction],
  )

  const clearTable = useCallback(
    (table: number) => {
      void postAction({ action: 'clear_table', tableId: String(table) })
    },
    [postAction],
  )

  const submitOrder = useCallback(
    (p: { table: number | null; guestName: string; items: { dishId: string; quantity: number }[] }) => {
      void postAction({
        action: 'submit_guest_order',
        tableId: String(p.table ?? 0),
        orderType: p.table ? 'dine-in' : 'takeaway',
        guestName: p.guestName,
        deviceId: getDeviceId(),
        items: p.items,
      })
    },
    [postAction],
  )

  const payBills = useCallback(
    (table: number, scope: 'mine' | 'table') => {
      void postAction({
        action: 'pay_bills',
        tableId: String(table),
        deviceId: getDeviceId(),
        scope,
      })
    },
    [postAction],
  )

  const startCookingTicket = useCallback(
    (ticketId: string, ticketLabel: string, lines: { name: string; qty: number }[]) => {
      void postAction({
        action: 'start_cooking_ticket',
        ticketId,
        ticketLabel,
        lines,
      })
    },
    [postAction],
  )

  const platedDish = useCallback(
    (orderId: string, dishUniqueId: string) => {
      void postAction({
        action: 'mark_dish_plated',
        orderId,
        dishUniqueId,
      })
    },
    [postAction],
  )

  const restock = useCallback(
    (ingredient: string, amount: number) => {
      void postAction({
        action: 'restock_inventory',
        ingredient,
        amount,
      })
    },
    [postAction],
  )

  return {
    state,
    deviceId,
    origin,
    scanError,
    clearScanError: () => setScanError(null),
    scanTable,
    staffSeatTable,
    leaveTable,
    clearTable,
    submitOrder,
    payBills,
    startCookingTicket,
    platedDish,
    restock,
  }
}
