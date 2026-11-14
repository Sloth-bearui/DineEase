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

  useEffect(() => {
    const devId = getDeviceId()
    setDeviceId(devId)

    const socket = io({ transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      if (activeScanRef.current) {
        socket.emit('table_scan', {
          tableId: String(activeScanRef.current.table),
          uid: activeScanRef.current.uid,
          joinMode: activeScanRef.current.joinMode,
          guestCount: 1,
          deviceId: devId,
        })
      }
    })

    socket.on('scan_result', (res: { success: boolean; error?: string }) => {
      if (!res.success && res.error) {
        setScanError(res.error)
        activeScanRef.current = null
      } else {
        setScanError(null)
      }
    })

    socket.on('synchro_state_updated', (s: SynchroGameState) => setState(s))

    // Resolve the public HTTPS tunnel URL (or LAN IP) phones should open when scanning QR codes
    const syncNetworkOrigin = () => {
      fetch('/api/network')
        .then((r) => r.json())
        .then((n) => {
          if (n.publicUrl && typeof n.publicUrl === 'string' && n.publicUrl.startsWith('http')) {
            setOrigin(n.publicUrl)
            return
          }
          const here = window.location.hostname
          const host = here === 'localhost' || here === '127.0.0.1' ? n.host : here
          setOrigin(`http://${host}:${window.location.port || n.port}`)
        })
        .catch(() => setOrigin(window.location.origin))
    }
    syncNetworkOrigin()
    const netTimer = window.setInterval(syncNetworkOrigin, 12000)

    return () => {
      window.clearInterval(netTimer)
      socket.disconnect()
    }
  }, [])

  const scanTable = useCallback((table: number, uid?: string, joinMode: 'inside' | 'outside' = 'outside') => {
    const devId = getDeviceId()
    setScanError(null)
    activeScanRef.current = { table, uid, joinMode }
    if (socketRef.current?.connected) {
      socketRef.current.emit('table_scan', {
        tableId: String(table),
        uid,
        joinMode,
        guestCount: 1,
        deviceId: devId,
      })
    }
  }, [])

  const staffSeatTable = useCallback((table: number) => {
    socketRef.current?.emit('table_scan', { tableId: String(table), guestCount: 1, staff: true })
  }, [])

  const leaveTable = useCallback((table: number) => {
    activeScanRef.current = null
    socketRef.current?.emit('leave_table', { tableId: String(table), deviceId: getDeviceId() })
  }, [])

  const clearTable = useCallback((table: number) => {
    socketRef.current?.emit('clear_table', { tableId: String(table) })
  }, [])

  const submitOrder = useCallback(
    (p: { table: number | null; guestName: string; items: { dishId: string; quantity: number }[] }) => {
      socketRef.current?.emit('submit_guest_order', {
        tableId: String(p.table ?? 0),
        orderType: p.table ? 'dine-in' : 'takeaway',
        guestName: p.guestName,
        deviceId: getDeviceId(),
        items: p.items,
      })
    },
    [],
  )

  const payBills = useCallback((table: number, scope: 'mine' | 'table') => {
    socketRef.current?.emit('pay_bills', {
      tableId: String(table),
      deviceId: getDeviceId(),
      scope,
    })
  }, [])

  const startCookingTicket = useCallback(
    (ticketId: string, ticketLabel: string, lines: { name: string; qty: number }[]) => {
      socketRef.current?.emit('start_cooking_ticket', { ticketId, ticketLabel, lines })
    },
    [],
  )

  const platedDish = useCallback((orderId: string, dishUniqueId: string) => {
    socketRef.current?.emit('mark_dish_plated', { orderId, dishUniqueId })
  }, [])

  const restock = useCallback((ingredient: string, amount: number) => {
    socketRef.current?.emit('restock_inventory', { ingredient, amount })
  }, [])

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
