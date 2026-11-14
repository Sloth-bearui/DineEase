'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { SynchroGameState } from './types'

const DEVICE_KEY = 'dineease_phone_id'

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
  const activeScanRef = useRef<{ table: number; uid?: string; joinMode?: 'inside' | 'outside' } | null>(null)

  const postAction = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/synchro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data?.state) {
        setState(data.state)
      }
      return data
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const devId = getDeviceId()
    setDeviceId(devId)

    // 1. Poll /api/synchro so Vercel serverless deployments AND multiple PCs/phones stay synced in real time
    let alive = true
    const fetchState = async () => {
      try {
        const res = await fetch('/api/synchro', { cache: 'no-store' })
        if (!res.ok) return
        const s: SynchroGameState = await res.json()
        if (alive && s && Array.isArray(s.tables)) {
          setState(s)
        }
      } catch {
        // Ignore transient network errors
      }
    }
    fetchState()
    const pollTimer = window.setInterval(fetchState, 1500)

    // 2. Also connect Socket.io when running locally via server.ts for instant sub-50ms updates
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
        if (alive) setState(s)
      })
    }

    // 3. Resolve the public URL phones should open when scanning QR codes
    const syncNetworkOrigin = () => {
      const here = window.location.hostname
      // When deployed on Vercel or any public domain, use window.location.origin directly
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
      window.clearInterval(pollTimer)
      window.clearInterval(netTimer)
      socket?.disconnect()
    }
  }, [])

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
