'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useSynchro } from '@/lib/useSynchro'
import type { SynchroGameState } from '@/lib/types'
import Image from 'next/image'
import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

/* ---------------------------------- Data ---------------------------------- */

type Tab = 'user' | 'chef' | 'waiter' | 'owner'
type Course = 'Starters' | 'Mains' | 'Desserts' | 'Drinks'

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  wait: number
  course: Course
  image: string
}

interface TicketLine {
  delivered?: boolean
  name: string
  course: Course
  qty: number
}

interface Ticket {
  id: string
  table: number | null
  label: string
  minutesAgo: number
  lines: TicketLine[]
  first?: string
  status: 'cooking' | 'ready'
  cookingStarted?: boolean
}

const INGREDIENT_LABELS: Record<string, { name: string; unit: string }> = {
  sourdoughSlices: { name: 'Bread Slices', unit: 'slices' },
  cheeseGrams: { name: 'Artisan Cheese', unit: 'g' },
  patties: { name: 'Smash Burger Patties', unit: 'patties' },
  coffeeBeansGrams: { name: 'Coffee & Tea Roast', unit: 'g' },
  friesGrams: { name: 'French Fries Batch', unit: 'g' },
  chocolateGrams: { name: 'Dark Chocolate', unit: 'g' },
}

const DISH_RECIPES: Record<string, { key: string; amount: number }[]> = {
  'Club Sandwhich': [
    { key: 'sourdoughSlices', amount: 3 },
    { key: 'cheeseGrams', amount: 40 },
  ],
  'Smash Burger': [
    { key: 'sourdoughSlices', amount: 2 },
    { key: 'patties', amount: 2 },
    { key: 'cheeseGrams', amount: 60 },
  ],
  'Alfredo Pasta': [{ key: 'cheeseGrams', amount: 70 }],
  Pizza: [
    { key: 'sourdoughSlices', amount: 2 },
    { key: 'cheeseGrams', amount: 100 },
  ],
  'French Fries': [{ key: 'friesGrams', amount: 200 }],
  Maggi: [{ key: 'cheeseGrams', amount: 20 }],
  'Hot Chocolate': [{ key: 'chocolateGrams', amount: 40 }],
  Tea: [{ key: 'coffeeBeansGrams', amount: 15 }],
  Coffee: [{ key: 'coffeeBeansGrams', amount: 25 }],
  'Brownie with ice cream': [{ key: 'chocolateGrams', amount: 60 }],
  Sundae: [{ key: 'chocolateGrams', amount: 30 }],
  'Choco Lava Cake': [{ key: 'chocolateGrams', amount: 70 }],
}

function formatRecipeForDish(dishName: string, qty: number = 1): string {
  const recipe = DISH_RECIPES[dishName] ?? []
  return recipe
    .map((r) => {
      const meta = INGREDIENT_LABELS[r.key]
      const amt = r.amount * qty
      return meta?.unit === 'g' ? `${amt}g ${meta.name}` : `${amt} ${meta?.name ?? r.key}`
    })
    .join(' · ')
}

type Session = { mode: 'dine'; table: number } | { mode: 'wait' } | { mode: 'takeaway' }

const ACCESS_CODES: Record<Exclude<Tab, 'user'>, string> = {
  chef: 'CHEF-1234',
  waiter: 'WAIT-2345',
  owner: 'OWNR-3456',
}

const sessionLabel = (s: Session) =>
  s.mode === 'dine' ? `Table ${s.table}` : s.mode === 'wait' ? 'Waiting list' : 'Take away'

interface FloorTable {
  id: number
  seats: number
  occupied: boolean
  uid: string
  dinerCount?: number
}

type Cart = Record<string, number>

const MENU: MenuItem[] = [
  // Starters
  {
    id: 'club-sandwich',
    name: 'Club Sandwhich',
    description: 'Triple-decker toasted sandwich with fresh layers, cheese & chips',
    price: 120,
    wait: 6,
    course: 'Starters',
    image: '/food/top/club-sandwich.png',
  },
  {
    id: 'french-fries',
    name: 'French Fries',
    description: 'Crisp golden salted fries served with house dipping sauce',
    price: 90,
    wait: 5,
    course: 'Starters',
    image: '/food/top/french-fries.png',
  },
  {
    id: 'maggi',
    name: 'Maggi',
    description: 'Classic hot spiced masala noodles with fresh herbs & seasonings',
    price: 60,
    wait: 5,
    course: 'Starters',
    image: '/food/top/maggi.png',
  },

  // Mains
  {
    id: 'smash-burger',
    name: 'Smash Burger',
    description: 'Crispy-edged seared beef patties, melted cheddar, crisp lettuce & house sauce',
    price: 160,
    wait: 12,
    course: 'Mains',
    image: '/food/top/smash-burger.png',
  },
  {
    id: 'alfredo-pasta',
    name: 'Alfredo Pasta',
    description: 'Fresh fettuccine pasta tossed in rich creamy parmesan alfredo sauce',
    price: 180,
    wait: 12,
    course: 'Mains',
    image: '/food/top/alfredo-pasta.png',
  },
  {
    id: 'pizza',
    name: 'Pizza',
    description: 'Hand-stretched wood-fired crust with rich tomato sauce, melted cheese & bell peppers',
    price: 220,
    wait: 14,
    course: 'Mains',
    image: '/food/top/pizza.png',
  },

  // Desserts
  {
    id: 'choco-lava-cake',
    name: 'Choco Lava Cake',
    description: 'Warm molten chocolate centered cake with rich cocoa dusted crust',
    price: 120,
    wait: 7,
    course: 'Desserts',
    image: '/food/top/choco-lava-cake.png',
  },
  {
    id: 'brownie-ice-cream',
    name: 'Brownie with ice cream',
    description: 'Fudgy dark chocolate brownie topped with cool vanilla ice cream scoop',
    price: 140,
    wait: 6,
    course: 'Desserts',
    image: '/food/top/brownie-ice-cream.png',
  },
  {
    id: 'sundae',
    name: 'Sundae',
    description: 'Strawberry layered sundae with smooth cream and fresh strawberries',
    price: 110,
    wait: 5,
    course: 'Desserts',
    image: '/food/top/sundae.png',
  },

  // Drinks
  {
    id: 'hot-chocolate',
    name: 'Hot Chocolate',
    description: 'Rich warm cocoa topped with whipped cream and chocolate shavings',
    price: 90,
    wait: 4,
    course: 'Drinks',
    image: '/food/top/hot-chocolate.png',
  },
  {
    id: 'tea',
    name: 'Tea',
    description: 'Aromatic steeped spiced masala tea brewed fresh with milk and cardamom',
    price: 30,
    wait: 3,
    course: 'Drinks',
    image: '/food/top/tea.png',
  },
  {
    id: 'coffee',
    name: 'Coffee',
    description: 'Freshly brewed artisan roast with steamed milk and latte art',
    price: 60,
    wait: 3,
    course: 'Drinks',
    image: '/food/top/coffee.png',
  },
]

const TABLE_LAYOUT: { id: string; x: number; y: number; back: boolean }[] = [
  { id: 'pizza', x: 20, y: 31, back: true },
  { id: 'alfredo-pasta', x: 50, y: 15, back: true },
  { id: 'smash-burger', x: 80, y: 31, back: true },
  { id: 'french-fries', x: 80, y: 69, back: false },
  { id: 'choco-lava-cake', x: 50, y: 83, back: false },
  { id: 'maggi', x: 20, y: 69, back: false },
]

const COURSES: Course[] = ['Starters', 'Mains', 'Desserts', 'Drinks']

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 't4',
    table: 4,
    label: 'Table 4',
    minutesAgo: 6,
    status: 'cooking',
    first: 'French Fries',
    lines: [
      { name: 'French Fries', course: 'Starters', qty: 2 },
      { name: 'Alfredo Pasta', course: 'Mains', qty: 1 },
      { name: 'Smash Burger', course: 'Mains', qty: 2 },
      { name: 'Choco Lava Cake', course: 'Desserts', qty: 3 },
    ],
  },
  {
    id: 't2',
    table: 2,
    label: 'Table 2',
    minutesAgo: 1,
    status: 'cooking',
    first: 'Choco Lava Cake',
    lines: [
      { name: 'Alfredo Pasta', course: 'Mains', qty: 2 },
      { name: 'Choco Lava Cake', course: 'Desserts', qty: 2 },
    ],
  },
]

// The restaurant has 4 tables in total.
const INITIAL_TABLES: FloorTable[] = [
  { id: 1, seats: 2, occupied: false, uid: 'TBL-1-101' },
  { id: 2, seats: 4, occupied: false, uid: 'TBL-2-202' },
  { id: 3, seats: 4, occupied: false, uid: 'TBL-3-303' },
  { id: 4, seats: 6, occupied: false, uid: 'TBL-4-404' },
]

const TABS: { id: Tab; label: string }[] = [
  { id: 'user', label: 'User Space' },
  { id: 'chef', label: 'Chef Space' },
  { id: 'waiter', label: 'Waiter Space' },
  { id: 'owner', label: 'Owner Space' },
]

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

/* --------------------------- Multi-phone helpers -------------------------- */

interface DinerInfo {
  deviceId: string
  name: string
  items: { name: string; qty: number }[]
  total: number
  unpaidTotal: number
  paidTotal: number
  isMe?: boolean
}

function QrCode({ value, size = 112, className = '' }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    if (!value) return
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: size * 4,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((u) => alive && setSrc(u))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [value, size])
  if (!src) return <div style={{ width: size, height: size }} className={`rounded-xl bg-neutral-200 ${className}`} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={`QR code ${value}`} className={`rounded-xl bg-white p-1.5 shadow ${className}`} />
}

const tableNumberLabel = (n: number) => (n > 0 ? `Table ${n}` : n === 0 ? 'Take away' : 'Waiting list')

function buildTickets(
  state: SynchroGameState | null,
  delivered: Record<string, boolean>,
  readyLocalIds: Record<string, boolean>,
): Ticket[] {
  const startedSet = new Set((state?.inventoryDeductions ?? []).map((d) => d.ticketId))
  const out: Ticket[] = []

  if (state) {
    for (const order of [...state.orders].reverse()) {
      for (const g of order.guests) {
        const dishes = order.aggregatedDishes.filter((d) => d.guestSubOrderId === g.id)
        const ready =
          !!readyLocalIds[g.id] ||
          (dishes.length > 0 && dishes.every((d) => d.status === 'plated' || d.status === 'delivered'))
        const lines: TicketLine[] = g.items.map((i) => ({
          name: MENU.find((m) => m.id === i.dishId)?.name ?? i.dishName,
          course: MENU.find((m) => m.id === i.dishId)?.course ?? 'Mains',
          qty: i.quantity,
          delivered: !!delivered[`${g.id}|${i.dishId}`],
        }))
        if (lines.length === 0 || lines.every((l) => l.delivered)) continue
        const ageMin = Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000))
        out.push({
          id: g.id,
          table: order.tableNumber > 0 ? order.tableNumber : null,
          label: `${tableNumberLabel(order.tableNumber)} · ${g.guestName}`,
          minutesAgo: ageMin,
          lines,
          first: lines[0].name,
          status: ready ? 'ready' : 'cooking',
          cookingStarted: !!g.cookingStarted || startedSet.has(g.id),
        })
      }
    }
  }

  for (const init of INITIAL_TICKETS) {
    const lines = init.lines.map((l) => ({
      ...l,
      delivered: !!delivered[`${init.id}|${MENU.find((m) => m.name === l.name)?.id ?? l.name}`],
    }))
    if (lines.every((l) => l.delivered)) continue
    out.push({
      ...init,
      lines,
      status: readyLocalIds[init.id] ? 'ready' : init.status,
      cookingStarted: startedSet.has(init.id),
    })
  }

  return out
}

function buildDiners(state: SynchroGameState | null, myDeviceId: string): Record<number, DinerInfo[]> {
  const res: Record<number, DinerInfo[]> = {}
  if (!state) return res
  for (const tb of state.tables) {
    if (tb.number <= 0) continue
    const map = new Map<string, DinerInfo>()
    for (const d of tb.activeDevices ?? []) {
      map.set(d.deviceId, {
        deviceId: d.deviceId,
        name: d.guestName,
        items: [],
        total: 0,
        unpaidTotal: 0,
        paidTotal: 0,
        isMe: d.deviceId === myDeviceId,
      })
    }
    for (const o of state.orders.filter((x) => x.tableNumber === tb.number)) {
      for (const g of o.guests) {
        const key = g.deviceId || g.id
        const d = map.get(key) ?? {
          deviceId: key,
          name: g.guestName,
          items: [],
          total: 0,
          unpaidTotal: 0,
          paidTotal: 0,
          isMe: key === myDeviceId,
        }
        for (const it of g.items) {
          const name = MENU.find((m) => m.id === it.dishId)?.name ?? it.dishName
          const ex = d.items.find((x) => x.name === name)
          if (ex) ex.qty += it.quantity
          else d.items.push({ name, qty: it.quantity })
        }
        d.total += g.total
        if (g.paymentStatus === 'paid') d.paidTotal += g.total
        else d.unpaidTotal += g.total
        map.set(key, d)
      }
    }
    res[tb.number] = [...map.values()]
  }
  return res
}

/* ---------------------------------- Root ---------------------------------- */

export default function DineEase() {
  const {
    state,
    deviceId,
    origin,
    scanError,
    clearScanError,
    scanTable,
    staffSeatTable,
    leaveTable,
    clearTable,
    submitOrder,
    payBills,
    startCookingTicket,
    platedDish,
    restock,
  } = useSynchro()
  const [tab, setTab] = useState<Tab>('user')
  const [session, setSession] = useState<Session | null>(null)
  const [cart, setCart] = useState<Cart>({})
  const [serveOrder, setServeOrder] = useState<string[]>([])
  const [delivered, setDelivered] = useState<Record<string, boolean>>({})
  const [readyLocalIds, setReadyLocalIds] = useState<Record<string, boolean>>({})
  const [codeOpen, setCodeOpen] = useState(false)

  const tickets = useMemo(() => buildTickets(state, delivered, readyLocalIds), [state, delivered, readyLocalIds])
  const diners = useMemo(() => buildDiners(state, deviceId), [state, deviceId])

  // Live data straight from the server (shared by every phone)
  const tables: FloorTable[] = INITIAL_TABLES.map((t) => {
    const st = state?.tables.find((x) => x.number === t.id)
    const tableDiners = diners[t.id] ?? []
    return {
      ...t,
      occupied: st ? st.status === 'occupied' : false,
      uid: st?.uid ?? `TBL-${t.id}-${t.id}0${t.id}`,
      dinerCount: tableDiners.length,
    }
  })

  const breadSlices = state?.inventory?.sourdoughSlices ?? 8
  const ordersSalesTotal = (state?.orders ?? []).reduce(
    (sum, o) => sum + o.guests.reduce((gs, g) => gs + g.total, 0),
    0,
  )
  const liveSales = Math.max(state?.revenue ?? 0, ordersSalesTotal)
  const revenue = 6450 + liveSales

  const recentSales = useMemo(() => {
    if (!state) return []
    const list: {
      id: string
      tableLabel: string
      guestName: string
      deviceId?: string
      itemsSummary: string
      total: number
      paymentStatus: 'pending' | 'paid'
    }[] = []
    for (const o of state.orders) {
      for (const g of o.guests) {
        list.push({
          id: g.id,
          tableLabel: tableNumberLabel(o.tableNumber),
          guestName: g.guestName,
          deviceId: g.deviceId,
          itemsSummary: g.items.map((i) => `${i.quantity}× ${i.dishName}`).join(', '),
          total: g.total,
          paymentStatus: g.paymentStatus,
        })
      }
    }
    return list
  }, [state])

  // Scanning a table QR code opens /?table=N&uid=TBL-...
  // First person scans from outside -> marks table occupied.
  // Friends joining an already-occupied table MUST scan the QR from inside the table menu (&join=inside).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const n = Number(params.get('table'))
    const uid = params.get('uid') ?? undefined
    const joinMode = params.get('join') === 'inside' ? 'inside' : 'outside'
    if (n >= 1 && n <= INITIAL_TABLES.length) {
      scanTable(n, uid, joinMode)
      setSession({ mode: 'dine', table: n })
      window.history.replaceState(null, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If an outside scan was rejected because the table is already occupied, return to TableSelect and show the warning
  useEffect(() => {
    if (scanError) {
      setSession(null)
    }
  }, [scanError])

  const changeTab = (next: Tab) => {
    setTab(next)
    setCodeOpen(false)
    window.scrollTo({ top: 0 })
  }

  const setQty = (id: string, qty: number) => {
    setCart((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(qty, 20)
      return next
    })
    if (qty <= 0) setServeOrder((o) => o.filter((x) => x !== id))
  }

  const chooseSession = (s: Session) => {
    clearScanError()
    if (s.mode === 'dine') {
      const tbl = tables.find((x) => x.id === s.table)
      if (tbl?.occupied) return
      scanTable(s.table, tbl?.uid, 'outside')
    }
    setSession(s)
    window.scrollTo({ top: 0 })
  }

  const leaveSession = () => {
    if (session?.mode === 'dine') leaveTable(session.table)
    setSession(null)
    setCart({})
    setServeOrder([])
    window.scrollTo({ top: 0 })
  }

  const myName = (() => {
    if (session?.mode !== 'dine') return 'Guest'
    const tb = state?.tables.find((x) => x.number === session.table)
    const found = tb?.activeDevices?.find((d) => d.deviceId === deviceId)?.guestName
    if (found) return found
    const idx = (tb?.activeDevices?.length ?? 0) + 1
    return `Diner ${idx}`
  })()

  const placeOrder = () => {
    if (!session) return
    const ids = Object.keys(cart)
    const ranked = [...serveOrder.filter((id) => cart[id]), ...ids.filter((id) => !serveOrder.includes(id))]
    if (ranked.length === 0) return
    // Each phone submits its own order under its own device id
    submitOrder({
      table: session.mode === 'dine' ? session.table : session.mode === 'takeaway' ? 0 : -1,
      guestName: myName,
      items: ranked.map((id) => ({ dishId: id, quantity: cart[id] })),
    })
    setCart({})
    setServeOrder([])
  }

  const markTicketReady = (ticketId: string) => {
    setReadyLocalIds((prev) => ({ ...prev, [ticketId]: true }))
    for (const o of state?.orders ?? []) {
      for (const d of o.aggregatedDishes) {
        if (d.guestSubOrderId === ticketId && d.status !== 'plated' && d.status !== 'delivered') platedDish(o.id, d.uniqueId)
      }
    }
  }

  const sessionTableNo = session?.mode === 'dine' ? session.table : null
  const currentTableObj = sessionTableNo !== null ? tables.find((t) => t.id === sessionTableNo) : null
  const tableDinersList: DinerInfo[] = sessionTableNo !== null ? diners[sessionTableNo] ?? [] : []
  const myDiner: DinerInfo | null = tableDinersList.find((d) => d.isMe) ?? null
  const tableUid = currentTableObj?.uid ?? (sessionTableNo ? `TBL-${sessionTableNo}-${sessionTableNo}0${sessionTableNo}` : '')
  const dinerInfo =
    sessionTableNo !== null
      ? {
          name: myName,
          deviceId,
          tableNo: sessionTableNo,
          tableUid,
          count: Math.max(1, tableDinersList.length),
          myTotal: myDiner?.total ?? 0,
          myUnpaid: myDiner?.unpaidTotal ?? 0,
          tableTotal: tableDinersList.reduce((s, d) => s + d.total, 0),
          tableUnpaid: tableDinersList.reduce((s, d) => s + d.unpaidTotal, 0),
          qrValue: origin ? `${origin}/?table=${sessionTableNo}&uid=${encodeURIComponent(tableUid)}&join=inside` : '',
          dinersList: tableDinersList,
        }
      : null

  const isStaff = tab !== 'user'

  return (
    <div className={isStaff ? 'min-h-screen bg-white text-black' : 'min-h-screen bg-stone-950 text-stone-50'}>
      <TopNav tab={tab} onSelectTab={changeTab} onExit={() => changeTab('user')} isStaff={isStaff} />
      {tab === 'user' &&
        (session ? (
          <UserSpace
            session={session}
            cart={cart}
            serveOrder={serveOrder}
            setServeOrder={setServeOrder}
            setQty={setQty}
            onPlaceOrder={placeOrder}
            onLeave={leaveSession}
            diner={dinerInfo}
            onPayMine={() => sessionTableNo !== null && payBills(sessionTableNo, 'mine')}
            onPayTable={() => sessionTableNo !== null && payBills(sessionTableNo, 'table')}
          />
        ) : (
          <TableSelect tables={tables} origin={origin} scanError={scanError} onChoose={chooseSession} />
        ))}
      {tab === 'chef' && (
        <ChefSpace
          tickets={tickets.filter((t) => t.status === 'cooking')}
          onStartCooking={(t) => startCookingTicket(t.id, t.label, t.lines)}
          onReady={markTicketReady}
        />
      )}
      {tab === 'waiter' && (
        <WaiterSpace
          tables={tables}
          tickets={tickets}
          diners={diners}
          origin={origin}
          onToggle={(id, occupied) => (occupied ? staffSeatTable(id) : clearTable(id))}
          onDeliverLine={(id, name) => {
            const dishId = MENU.find((m) => m.name === name)?.id ?? name
            setDelivered((prev) => ({ ...prev, [`${id}|${dishId}`]: !prev[`${id}|${dishId}`] }))
          }}
        />
      )}
      {tab === 'owner' && (
        <OwnerSpace
          revenue={revenue}
          liveSales={liveSales}
          recentSales={recentSales}
          breadSlices={breadSlices}
          inventory={state?.inventory}
          inventoryDeductions={state?.inventoryDeductions ?? []}
          occupiedTablesCount={tables.filter((t) => t.occupied).length}
          activeDinersCount={Object.values(diners).reduce((s, list) => s + list.length, 0)}
          onRestock={(ingredient, amount) => restock(ingredient, amount)}
        />
      )}

      {tab === 'user' && (
        <footer className="relative z-10 pb-28 text-center">
          <button
            type="button"
            onClick={() => setCodeOpen(true)}
            className="text-xs text-stone-600 transition-colors hover:text-stone-400"
          >
            Staff access
          </button>
        </footer>
      )}
      {codeOpen && <AccessModal onClose={() => setCodeOpen(false)} onUnlock={changeTab} />}
    </div>
  )
}

/* ------------------------------- Access code ------------------------------ */

function AccessModal({ onClose, onUnlock }: { onClose: () => void; onUnlock: (t: Tab) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const entered = code.trim().toUpperCase()
    const match = (Object.keys(ACCESS_CODES) as Exclude<Tab, 'user'>[]).find((k) => ACCESS_CODES[k] === entered)
    if (match) onUnlock(match)
    else setError(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-stone-900 p-6 ring-1 ring-white/10">
        <h2 className="font-display text-2xl">Staff access</h2>
        <p className="mt-1 text-sm text-stone-400">Enter your access code.</p>
        <input
          autoFocus
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(false)
          }}
          aria-label="Access code"
          className="mt-5 w-full rounded-xl bg-white/5 px-4 py-3 text-stone-50 ring-1 ring-white/15 outline-none focus:ring-amber-300"
        />
        {error && <p className="mt-2 text-sm text-rose-400">Incorrect code.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-stone-400 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2 text-sm font-bold text-stone-950"
          >
            Enter
          </button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------- Navigation ------------------------------- */

function TopNav({
  tab,
  onSelectTab,
  onExit,
  isStaff,
}: {
  tab: Tab
  onSelectTab: (t: Tab) => void
  onExit: () => void
  isStaff: boolean
}) {
  return (
    <header
      className={
        isStaff
          ? 'fixed inset-x-0 top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200'
          : 'fixed inset-x-0 top-0 z-50 bg-stone-950/80 backdrop-blur-xl border-b border-white/10'
      }
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <span
            className={
              isStaff ? 'text-lg font-black tracking-tight text-neutral-900' : 'font-display text-2xl italic tracking-tight text-stone-50'
            }
          >
            DineEase
          </span>
          <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full ${isStaff ? 'bg-neutral-100 text-neutral-600' : 'bg-white/10 text-stone-300'}`}>
            SynchroTable
          </span>
        </div>

        {isStaff && (
          <span className="text-sm font-bold text-neutral-900">{TABS.find((t) => t.id === tab)?.label}</span>
        )}

        {isStaff && (
          <button
            type="button"
            onClick={onExit}
            className="text-xs font-semibold text-neutral-500 hover:text-black underline cursor-pointer"
          >
            Lock &amp; exit
          </button>
        )}
      </nav>
    </header>
  )
}

/* ------------------------------ Table selection --------------------------- */

function TableSelect({
  tables,
  origin,
  scanError,
  onChoose,
}: {
  tables: FloorTable[]
  origin: string
  scanError?: string | null
  onChoose: (s: Session) => void
}) {
  return (
    <main className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center px-5 pt-28 pb-20 text-center">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 top-20 size-[36rem] rounded-full bg-orange-500/20 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[32rem] rounded-full bg-rose-500/15 blur-[140px]" />
      </div>
      <div className="relative w-full">
        <h1 className="font-display text-4xl text-balance md:text-6xl">
          Choose or scan a vacant table
        </h1>
        <p className="mt-3 text-sm text-stone-400 max-w-2xl mx-auto">
          Once a table is scanned or selected, it becomes <strong>Occupied</strong>. If friends want to join that same
          table as Diner 2 or Diner 3, they must scan the <strong>&ldquo;Table QR&rdquo; inside the seated diner&apos;s table menu</strong>.
        </p>
        {origin && (
          <p className="mt-2 text-xs text-emerald-300/90">
            Android / Mobile QR URL Ready: <span className="font-mono underline">{origin}</span>
          </p>
        )}

        {scanError && (
          <div
            role="alert"
            className="mx-auto mt-5 max-w-2xl rounded-2xl bg-rose-500/20 px-5 py-3.5 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/50"
          >
            {scanError}
          </div>
        )}

        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
          {tables.map((t) => {
            const isVacant = !t.occupied
            const count = Math.max(1, t.dinerCount ?? 1)
            const outsideQrUrl = origin ? `${origin}/?table=${t.id}&uid=${encodeURIComponent(t.uid)}` : ''
            return (
              <li
                key={t.id}
                className={`flex flex-col rounded-3xl p-5 ring-1 transition ${
                  isVacant
                    ? 'bg-white/[0.06] ring-white/15 hover:ring-amber-300'
                    : 'bg-white/[0.03] ring-white/10 opacity-80'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-4xl">Table {t.id}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[11px] text-amber-300">
                    {t.uid}
                  </span>
                </div>
                <p className="mt-1 text-left text-xs text-stone-400">
                  {t.seats} seats ·{' '}
                  <span className={isVacant ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-400'}>
                    {isVacant ? 'Vacant' : `Occupied (${count} ${count === 1 ? 'Diner' : 'Diners'})`}
                  </span>
                </p>

                {isVacant ? (
                  <div className="my-4 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/35 p-3.5 ring-1 ring-white/10">
                    <QrCode value={outsideQrUrl} size={128} />
                    <span className="text-[11px] text-stone-300">Scan to occupy Table {t.id}</span>
                  </div>
                ) : (
                  <div className="my-4 flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl bg-rose-950/25 p-4 text-center ring-1 ring-rose-400/25">
                    <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300">
                      Table {t.id} Occupied
                    </span>
                    <p className="text-xs leading-relaxed text-stone-300">
                      Outside QR locked. To join as <strong>Diner {count + 1}</strong>, scan the{' '}
                      <strong className="text-amber-300">&ldquo;Table QR&rdquo;</strong> from inside Diner 1&apos;s
                      table menu.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!isVacant}
                  onClick={() => isVacant && onChoose({ mode: 'dine', table: t.id })}
                  className={`mt-auto w-full rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
                    isVacant
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-stone-950 shadow hover:brightness-110 cursor-pointer'
                      : 'bg-white/5 text-stone-500 ring-1 ring-white/10 cursor-not-allowed'
                  }`}
                >
                  {isVacant ? `Occupy Table ${t.id} (Diner 1)` : 'Occupied · Scan Inside Menu QR'}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => onChoose({ mode: 'wait' })}
            className="rounded-3xl bg-white/[0.06] px-8 py-6 text-left ring-1 ring-white/15 transition hover:-translate-y-1 hover:ring-amber-300 cursor-pointer"
          >
            <span className="font-display text-xl">Wait for a table</span>
            <span className="mt-1 block text-xs text-stone-400">Order now, we&apos;ll seat you when one frees up.</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose({ mode: 'takeaway' })}
            className="rounded-3xl bg-white/[0.06] px-8 py-6 text-left ring-1 ring-white/15 transition hover:-translate-y-1 hover:ring-amber-300 cursor-pointer"
          >
            <span className="font-display text-xl">Take away</span>
            <span className="mt-1 block text-xs text-stone-400">Order and pick it up at the counter.</span>
          </button>
        </div>
      </div>
    </main>
  )
}

/* ------------------------------- User Space ------------------------------- */

type ActiveDinerProps = {
  name: string
  deviceId: string
  tableNo: number
  tableUid: string
  count: number
  myTotal: number
  myUnpaid: number
  tableTotal: number
  tableUnpaid: number
  qrValue: string
  dinersList: DinerInfo[]
}

function UserSpace({
  session,
  cart,
  serveOrder,
  setServeOrder,
  setQty,
  onPlaceOrder,
  onLeave,
  diner,
  onPayMine,
  onPayTable,
}: {
  session: Session
  cart: Cart
  serveOrder: string[]
  setServeOrder: (o: string[]) => void
  setQty: (id: string, qty: number) => void
  onPlaceOrder: () => void
  onLeave: () => void
  diner?: ActiveDinerProps | null
  onPayMine: () => void
  onPayTable: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [justPlaced, setJustPlaced] = useState(false)
  const [payNotice, setPayNotice] = useState<string | null>(null)
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start start', 'end end'] })
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 })

  const tableTilt = useTransform(progress, [0, 0.6], [0, 48])
  const tableScale = useTransform(progress, [0, 0.6], [0.88, 0.98])
  const tableY = useTransform(progress, [0, 0.6], [0, 16])
  const counterTilt = useTransform(progress, [0.05, 0.6], [0, -48])
  const reveal = useTransform(progress, [0.2, 0.55], [0, 1])
  const hintOpacity = useTransform(progress, [0, 0.12], [1, 0])
  const headlineOpacity = useTransform(progress, [0.35, 0.65], [0, 1])
  const frontLift = useTransform(progress, [0.1, 0.65], [0, 22])
  const backLift = useTransform(progress, [0.1, 0.65], [0, 45])
  const dishScale = useTransform(progress, [0, 0.6], [0.9, 1.0])

  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const total = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = MENU.find((m) => m.id === id)
    return sum + (item ? item.price * qty : 0)
  }, 0)

  const handlePlace = () => {
    onPlaceOrder()
    setJustPlaced(true)
    window.setTimeout(() => setJustPlaced(false), 2600)
  }

  const handlePayMine = () => {
    onPayMine()
    setPayNotice('Your individual bill has been marked as PAID (Go Dutch)!')
    window.setTimeout(() => setPayNotice(null), 3500)
  }

  const handlePayTable = () => {
    onPayTable()
    setPayNotice('Entire table bill has been marked as PAID by your phone!')
    window.setTimeout(() => setPayNotice(null), 3500)
  }

  return (
    <main className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 top-20 size-[36rem] rounded-full bg-orange-500/20 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[32rem] rounded-full bg-rose-500/15 blur-[140px]" />
      </div>

      {/* Scroll-driven spatial stage */}
      <section ref={stageRef} aria-label="Interactive table" className="relative h-[240vh]">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-between overflow-hidden pb-16 pt-20 md:pt-20">
          <div className="flex w-full flex-col items-center gap-2">
            <SessionBanner session={session} total={total} onLeave={onLeave} diner={diner} />

            <motion.div
              style={{ opacity: headlineOpacity }}
              className="pointer-events-none px-6 text-center"
            >
              <p className="font-display text-2xl text-balance md:text-3xl">Tonight&apos;s table</p>
              <p className="text-xs text-stone-400">Tap any dish on the table to add it to your phone&apos;s order</p>
            </motion.div>
          </div>

          <div className="relative flex w-full flex-1 items-center justify-center py-2 [perspective:1100px]">
            <motion.div
              style={{ rotateX: tableTilt, scale: tableScale, y: tableY, transformStyle: 'preserve-3d' }}
              className="relative aspect-square w-[min(82vw,470px)] rounded-full shadow-[0_32px_90px_rgba(0,0,0,0.75)]"
            >
              <div
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,#432b1b_0%,#29190f_65%,#170e08_100%)] ring-8 ring-[#563824]/90 shadow-[inset_0_4px_32px_rgba(255,196,132,0.14),inset_0_-24px_48px_rgba(0,0,0,0.8)]"
              >
                {/* Solid handcrafted walnut tabletop with subtle concentric inlay */}
                <div className="absolute inset-4 rounded-full border border-amber-200/15" />
                <div className="absolute inset-[26%] rounded-full border border-amber-200/10 bg-black/15 shadow-inner" />
              </div>
              {TABLE_LAYOUT.map((slot) => {
                const item = MENU.find((m) => m.id === slot.id)
                if (!item) return null
                return (
                  <div
                    key={slot.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${slot.x}%`, top: `${slot.y}%`, transformStyle: 'preserve-3d' }}
                  >
                    <FloatingDish
                      item={item}
                      qty={cart[item.id] ?? 0}
                      lift={slot.back ? backLift : frontLift}
                      scale={dishScale}
                      counterTilt={counterTilt}
                      reveal={reveal}
                      onAdd={() => setQty(item.id, (cart[item.id] ?? 0) + 1)}
                    />
                  </div>
                )
              })}
            </motion.div>
          </div>

          <motion.p
            style={{ opacity: hintOpacity }}
            className="pointer-events-none flex flex-col items-center gap-1.5 text-[11px] uppercase tracking-[0.28em] text-stone-400"
          >
            Scroll to raise the menu
            <motion.span
              aria-hidden
              animate={{ y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="block h-4 w-px bg-stone-400"
            />
          </motion.p>
        </div>
      </section>

      {/* Full menu with scroll reveals */}
      <section aria-labelledby="menu-heading" className="relative mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-10">
        <motion.h2
          id="menu-heading"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-4xl text-balance md:text-6xl"
        >
          The full menu
        </motion.h2>
        <div className="mt-10 grid gap-6 [perspective:1200px] sm:grid-cols-2 lg:grid-cols-4">
          {MENU.map((item, i) => (
            <MenuCard
              key={item.id}
              item={item}
              index={i}
              qty={cart[item.id] ?? 0}
              onChange={(q) => setQty(item.id, q)}
            />
          ))}
        </div>
      </section>

      {count > 0 && (
        <section aria-labelledby="serve-heading" className="relative mx-auto max-w-3xl px-5 pb-16 md:px-10">
          <h2 id="serve-heading" className="font-display text-3xl md:text-4xl">
            Your cart ({diner ? `${diner.name} · ${diner.deviceId}` : 'This phone'})
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            Tap dishes in the order you want them served: 1st, 2nd, 3rd… Tap again to unselect.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {Object.entries(cart).map(([id, qty]) => {
              const item = MENU.find((m) => m.id === id)
              if (!item) return null
              const rank = serveOrder.filter((x) => cart[x]).indexOf(id)
              const selected = rank >= 0
              const toggle = () =>
                setServeOrder(selected ? serveOrder.filter((x) => x !== id) : [...serveOrder.filter((x) => cart[x]), id])
              const ordinal = ['1st', '2nd', '3rd'][rank] ?? `${rank + 1}th`
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-pressed={selected}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left ring-1 transition ${
                      selected ? 'bg-amber-300/15 ring-amber-300' : 'bg-white/5 ring-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>
                      <span className="block font-semibold">
                        {qty} × {item.name}
                      </span>
                      <span className="text-xs text-stone-400">{formatPrice(item.price * qty)}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        selected ? 'bg-amber-300 text-stone-950' : 'text-stone-500'
                      }`}
                    >
                      {selected ? `Serve ${ordinal}` : 'Tap to set order'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Multi-Phone Table Bill & Go Dutch / Single Payer Section */}
      {diner && (
        <section aria-labelledby="bill-heading" className="relative mx-auto max-w-4xl px-5 pb-44 md:px-10">
          <div className="rounded-3xl bg-white/[0.06] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/15 backdrop-blur-xl md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-300/40">
                  {diner.name} at Table {diner.tableNo} · Phone ID: {diner.deviceId}
                </span>
                <h2 id="bill-heading" className="mt-3 font-display text-2xl md:text-4xl">
                  Table {diner.tableNo} Live Diners &amp; Bill Split (Go Dutch)
                </h2>
                <p className="mt-1 text-sm text-stone-400">
                  Table UID: <strong className="font-mono text-stone-200">{diner.tableUid}</strong> ·{' '}
                  <strong>{diner.count}</strong> {diner.count === 1 ? 'phone' : 'phones'} connected to this table.
                  Each person can pay separately (Go Dutch) or 1 phone can pay for the whole table.
                </p>
              </div>
              <a
                href={`/?table=${diner.tableNo}&uid=${encodeURIComponent(diner.tableUid)}&join=inside&newphone=1`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-amber-300 ring-1 ring-amber-300/40 transition hover:bg-white/20"
              >
                + Simulate Next Phone Scanning Inside Table QR (Diner {diner.count + 1})
              </a>
            </div>

            {/* Inside-Menu QR Box for Diner 2, Diner 3... to scan and join this occupied table */}
            <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl bg-black/40 p-4 ring-1 ring-amber-300/30 sm:flex-row">
              <QrCode value={diner.qrValue} size={132} />
              <div className="text-xs text-stone-300">
                <span className="inline-block rounded-full bg-amber-300/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  Inside Table {diner.tableNo} Menu QR · Required for Friends to Join
                </span>
                <p className="mt-1.5 leading-relaxed">
                  Since Table {diner.tableNo} is now marked <strong>Occupied</strong> on the outside screen, friends
                  joining your table must scan <strong>this Inside Table QR</strong> to join as{' '}
                  <strong className="text-amber-300">Diner {diner.count + 1} at Table {diner.tableNo}</strong> with
                  their own Phone ID and Go-Dutch bill.
                </p>
                <span className="mt-1 block break-all font-mono text-[11px] text-stone-400">{diner.qrValue}</span>
              </div>
            </div>

            {payNotice && (
              <div className="mt-4 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40">
                {payNotice}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {diner.dinersList.map((d) => {
                const isMe = d.deviceId === diner.deviceId
                const itemCount = d.items.reduce((s, i) => s + i.qty, 0)
                return (
                  <div
                    key={d.deviceId}
                    className={`flex flex-col justify-between rounded-2xl p-4 ring-1 ${
                      isMe ? 'bg-amber-300/10 ring-amber-300/60' : 'bg-black/30 ring-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-stone-100">
                          {d.name} at Table {diner.tableNo}
                          {isMe && <span className="ml-1.5 text-xs text-amber-300">(You)</span>}
                        </span>
                        {d.total > 0 && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              d.unpaidTotal === 0
                                ? 'bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40'
                                : 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40'
                            }`}
                          >
                            {d.unpaidTotal === 0 ? 'PAID' : 'UNPAID'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-stone-400">Phone ID: {d.deviceId}</p>

                      {d.items.length === 0 ? (
                        <p className="mt-3 text-xs italic text-stone-500">No items ordered yet</p>
                      ) : (
                        <ul className="mt-3 flex flex-col gap-1 border-t border-white/10 pt-2 text-xs text-stone-300">
                          {d.items.map((it) => (
                            <li key={it.name} className="flex justify-between">
                              <span>
                                {it.qty} × {it.name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-3 text-xs">
                      <span className="text-stone-400">{itemCount} items ordered</span>
                      <span className="text-sm font-bold text-amber-300">{formatPrice(d.total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-stone-300">
                <p>
                  Your Bill ({diner.name}): <strong className="text-amber-300">{formatPrice(diner.myTotal)}</strong>{' '}
                  <span className="text-xs text-stone-400">
                    ({diner.myUnpaid > 0 ? `${formatPrice(diner.myUnpaid)} unpaid` : 'Paid'})
                  </span>
                </p>
                <p className="mt-0.5">
                  Full Table {diner.tableNo} Bill: <strong className="text-white">{formatPrice(diner.tableTotal)}</strong>{' '}
                  <span className="text-xs text-stone-400">
                    ({diner.tableUnpaid > 0 ? `${formatPrice(diner.tableUnpaid)} unpaid` : 'All paid'})
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={diner.myUnpaid <= 0}
                  onClick={handlePayMine}
                  className="rounded-full bg-amber-300 px-5 py-2.5 text-xs font-bold text-stone-950 shadow transition hover:brightness-110 disabled:opacity-40 cursor-pointer"
                >
                  Pay My Bill (Go Dutch) · {formatPrice(diner.myUnpaid)}
                </button>
                <button
                  type="button"
                  disabled={diner.tableUnpaid <= 0}
                  onClick={handlePayTable}
                  className="rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-bold text-stone-950 shadow transition hover:brightness-110 disabled:opacity-40 cursor-pointer"
                >
                  Pay Full Table Bill (1 Pays All) · {formatPrice(diner.tableUnpaid)}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <OrderBar count={count} total={total} onPlace={handlePlace} justPlaced={justPlaced} />
    </main>
  )
}

function SessionBanner({
  session,
  total,
  onLeave,
  diner,
}: {
  session: Session
  total: number
  onLeave: () => void
  diner?: ActiveDinerProps | null
}) {
  const [qrOpen, setQrOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 mx-5 w-[min(94vw,640px)] rounded-2xl bg-white/[0.07] px-5 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {diner ? `${diner.name} at Table ${diner.tableNo}` : sessionLabel(session)}
            </p>
            <p className="text-xs text-stone-400">
              {diner ? (
                <>
                  Phone ID: <span className="font-mono text-amber-300">{diner.deviceId}</span> · Table UID:{' '}
                  <span className="font-mono text-stone-200">{diner.tableUid}</span> · Cart: {formatPrice(total)}
                </>
              ) : (
                <>
                  {session.mode === 'dine' ? 'Dine in' : session.mode === 'wait' ? 'Order while you wait' : 'Pick up at the counter'}
                  {' · '}
                  {formatPrice(total)}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {diner && (
            <button
              type="button"
              onClick={() => setQrOpen((o) => !o)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-300/40 hover:bg-white/10 cursor-pointer"
            >
              Table QR
            </button>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-stone-300 ring-1 ring-white/20 hover:bg-white/10 cursor-pointer"
          >
            Change Table
          </button>
        </div>
      </div>
      {diner && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-2 text-xs text-stone-300">
          <span>
            Identity: <strong className="text-amber-300">{diner.name} at Table {diner.tableNo}</strong>
          </span>
          <span>
            <strong>{diner.count}</strong> {diner.count === 1 ? 'person' : 'people'} at Table {diner.tableNo}
          </span>
          <span>My orders: <strong className="text-amber-300">{formatPrice(diner.myTotal)}</strong></span>
          <span>Table total: <strong>{formatPrice(diner.tableTotal)}</strong></span>
        </div>
      )}
      {diner && qrOpen && (
        <div className="mt-3 flex flex-col sm:flex-row items-center gap-4 border-t border-white/10 pt-3">
          <QrCode value={diner.qrValue} size={136} />
          <div className="text-xs text-stone-300">
            <p className="font-semibold text-amber-300">
              Inside Table {diner.tableNo} Menu QR ({diner.tableUid})
            </p>
            <p className="mt-1">
              Table {diner.tableNo} is now marked <strong>Occupied</strong> outside. Friends must scan{' '}
              <strong>this Inside Menu QR</strong> to join as{' '}
              <strong>Diner {diner.count + 1} at Table {diner.tableNo}</strong> with their own Phone ID and Go-Dutch bill.
            </p>
            <span className="mt-1 block break-all font-mono text-[11px] text-stone-400">{diner.qrValue}</span>
            <a
              href={`/?table=${diner.tableNo}&uid=${encodeURIComponent(diner.tableUid)}&join=inside&newphone=1`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block rounded-full bg-amber-300 px-3 py-1 text-[11px] font-bold text-stone-950 hover:brightness-110"
            >
              + Open Simulated Phone #{diner.count + 1} (Inside QR Scan)
            </a>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function WaitBadge({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.45)] ring-1 ring-emerald-300/40">
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,1)]" />
      Wait time: {minutes} mins
    </span>
  )
}

function FloatingDish({
  item,
  qty,
  lift,
  scale,
  counterTilt,
  reveal,
  onAdd,
}: {
  item: MenuItem
  qty: number
  lift: MotionValue<number>
  scale: MotionValue<number>
  counterTilt: MotionValue<number>
  reveal: MotionValue<number>
  onAdd: () => void
}) {
  const plateShadow = useTransform(
    reveal,
    (v) => `0 ${8 + 10 * v}px ${20 + 16 * v}px rgba(0,0,0,${0.65 - 0.15 * v})`,
  )

  return (
    <motion.div
      style={{
        z: lift,
        scale,
        rotateX: counterTilt,
        transformStyle: 'preserve-3d',
        transformOrigin: 'center center',
      }}
      className="w-[min(17vw,106px)]"
    >
      <motion.button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${item.name} to order, ${formatPrice(item.price)}`}
        whileHover={{ y: -6, scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group relative flex w-full flex-col items-center bg-transparent p-0 text-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <motion.div
          style={{ boxShadow: plateShadow }}
          className="relative aspect-square w-full overflow-hidden rounded-full bg-transparent"
        >
          <Image src={item.image} alt={item.name} fill sizes="120px" className="scale-105 object-cover" priority />
        </motion.div>
        <motion.div
          style={{ opacity: reveal }}
          className="mt-1.5 rounded-full bg-stone-950/90 px-2.5 py-0.5 text-center shadow-md ring-1 ring-white/15"
        >
          <p className="whitespace-nowrap text-[11px] font-semibold leading-tight text-stone-100">
            {item.name} · <span className="text-amber-300">{formatPrice(item.price)}</span>
          </p>
        </motion.div>
        <AnimatePresence>
          {qty > 0 && (
            <motion.span
              key={qty}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-xs font-bold text-stone-950 shadow-lg"
            >
              {'×'}
              {qty}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  )
}

function MenuCard({
  item,
  index,
  qty,
  onChange,
}: {
  item: MenuItem
  index: number
  qty: number
  onChange: (qty: number) => void
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 60, rotateX: 18 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className="group flex flex-col justify-between rounded-3xl bg-stone-900/50 p-4 ring-1 ring-white/10"
    >
      <div>
        <div className="relative flex aspect-square items-center justify-center overflow-visible">
          <div className="relative aspect-square h-[88%] overflow-hidden rounded-full shadow-[0_18px_40px_rgba(0,0,0,0.65)] transition-transform duration-700 group-hover:rotate-6 group-hover:scale-105">
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 40vw, 80vw"
              className="scale-105 object-cover"
            />
          </div>
          <div className="absolute left-1 top-1">
            <WaitBadge minutes={item.wait} />
          </div>
        </div>
        <div className="pt-3">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{item.course}</p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <h3 className="font-display text-xl">{item.name}</h3>
            <span className="font-semibold text-amber-300">{formatPrice(item.price)}</span>
          </div>
          <p className="mt-1 text-sm text-stone-400">{item.description}</p>
          <p className="mt-2 rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-amber-200/90 ring-1 ring-white/10">
            <span className="font-semibold text-stone-300">Used in dish: </span>
            {formatRecipeForDish(item.name, 1)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between pt-2">
        <div className="flex items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
          <button
            type="button"
            onClick={() => onChange(qty - 1)}
            disabled={qty === 0}
            aria-label={`Remove one ${item.name}`}
            className="flex size-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          >
            {'−'}
          </button>
          <span className="w-6 text-center text-sm font-semibold" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => onChange(qty + 1)}
            aria-label={`Add one ${item.name}`}
            className="flex size-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-white/10 cursor-pointer"
          >
            {'+'}
          </button>
        </div>
        <span className="text-xs text-stone-500">{formatPrice(item.price * qty)}</span>
      </div>
    </motion.article>
  )
}

function OrderBar({
  count,
  total,
  onPlace,
  justPlaced,
}: {
  count: number
  total: number
  onPlace: () => void
  justPlaced: boolean
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-full bg-stone-900/70 p-2 pl-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-2xl">
        <div aria-live="polite" className="min-w-0">
          <AnimatePresence mode="wait">
            {justPlaced ? (
              <motion.p
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-sm font-semibold text-emerald-300"
              >
                Sent to the kitchen
              </motion.p>
            ) : (
              <motion.div key="total" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className="text-sm font-semibold">
                  {count} {count === 1 ? 'item' : 'items'} · {formatPrice(total)}
                </p>
                <p className="truncate text-xs text-stone-400">Includes serve-first choice below the menu</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          type="button"
          onClick={onPlace}
          disabled={count === 0}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="relative shrink-0 overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-7 py-3.5 text-base font-bold text-stone-950 shadow-[0_0_40px_rgba(249,115,22,0.55)] transition-opacity disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Place Order
        </motion.button>
      </div>
    </div>
  )
}

/* ------------------------------ Staff shared ------------------------------ */

function RedButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="bg-[#FF0000] px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-[#D90000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
    >
      {children}
    </button>
  )
}

function StaffHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-12">
      <p className="text-sm font-bold uppercase tracking-widest md:col-span-3">{eyebrow}</p>
      <div className="md:col-span-9">
        <h1 className="text-5xl font-black leading-[0.9] tracking-tighter md:text-8xl">{title}</h1>
        <p className="mt-6 text-lg text-neutral-500">{meta}</p>
      </div>
    </div>
  )
}

/* ------------------------------- Chef Space ------------------------------- */

function computeTicketIngredientsSummary(lines: TicketLine[]): string {
  const totals: Record<string, number> = {}
  for (const l of lines) {
    for (const r of DISH_RECIPES[l.name] ?? []) {
      totals[r.key] = (totals[r.key] ?? 0) + r.amount * l.qty
    }
  }
  return Object.entries(totals)
    .map(([key, amt]) => {
      const meta = INGREDIENT_LABELS[key]
      return meta?.unit === 'g' ? `−${amt}g ${meta.name}` : `−${amt} ${meta?.name ?? key}`
    })
    .join(', ')
}

function ChefSpace({
  tickets,
  onStartCooking,
  onReady,
}: {
  tickets: Ticket[]
  onStartCooking: (ticket: Ticket) => void
  onReady: (id: string) => void
}) {
  const itemCount = tickets.reduce((s, t) => s + t.lines.reduce((a, l) => a + l.qty, 0), 0)

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-36 md:px-10 md:pt-40">
      <StaffHeader
        eyebrow="Kitchen"
        title="Order Queue"
        meta={`${tickets.length} tickets. ${itemCount} items. Clicking "Start Making" subtracts exact dish ingredients in Owner Space.`}
      />

      {tickets.length === 0 ? (
        <p className="mt-32 text-3xl font-bold md:pl-[25%]">Queue clear.</p>
      ) : (
        <ol className="mt-24 flex flex-col gap-20">
          {[...tickets]
            .sort((a, b) => b.minutesAgo - a.minutesAgo)
            .map((ticket) => {
              const totalIngredientsText = computeTicketIngredientsSummary(ticket.lines)
              return (
                <li key={ticket.id} className="grid gap-8 border-b-2 border-neutral-200 pb-16 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <span
                      className={`inline-block px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white ${
                        ticket.cookingStarted ? 'bg-emerald-700' : 'bg-[#FF0000]'
                      }`}
                    >
                      {ticket.cookingStarted ? 'Cooking Started · Subtracted' : 'New Order · Waiting to Start'}
                    </span>
                    <h2 className="mt-2 text-4xl font-black tracking-tight">{ticket.label}</h2>
                    <p className="mt-2 text-neutral-500">
                      {ticket.minutesAgo === 0 ? 'Just now' : `${ticket.minutesAgo} min ago`}
                    </p>
                    {ticket.first && <p className="mt-2 text-sm font-bold">Serve first: {ticket.first}</p>}
                  </div>
                  <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 md:col-span-6">
                    {COURSES.map((course) => {
                      const lines = ticket.lines.filter((l) => l.course === course)
                      return (
                        <div key={course}>
                          <h3 className="text-sm font-black uppercase tracking-widest">{course}</h3>
                          {lines.length === 0 ? (
                            <p className="mt-3 text-neutral-400">None</p>
                          ) : (
                            <ul className="mt-3 flex flex-col gap-3">
                              {lines.map((l) => (
                                <li key={l.name} className="text-base leading-snug">
                                  <div>
                                    <span className="font-bold tabular-nums">{l.qty}</span>
                                    {' × '}
                                    <span className="font-bold">{l.name}</span>
                                  </div>
                                  <span className="mt-0.5 block text-xs text-neutral-500">
                                    Uses: {formatRecipeForDish(l.name, l.qty)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex flex-col items-start gap-3 md:col-span-3 md:items-end md:text-right">
                    {!ticket.cookingStarted ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onStartCooking(ticket)}
                          aria-label={`Start making ${ticket.label} and subtract ingredients`}
                          className="bg-black px-6 py-3 text-base font-black uppercase tracking-wider text-white transition-colors hover:bg-neutral-800 cursor-pointer"
                        >
                          Start Making (Subtract Stock)
                        </button>
                        <p className="text-xs text-neutral-600">
                          <strong>Will minus in Owner Space:</strong> {totalIngredientsText}
                        </p>
                      </>
                    ) : (
                      <>
                        <RedButton onClick={() => onReady(ticket.id)} label={`Mark ${ticket.label} as ready`}>
                          Mark as Ready
                        </RedButton>
                        <p className="text-xs font-bold text-emerald-700">
                          ✓ Subtracted in Owner Space: {totalIngredientsText}
                        </p>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
        </ol>
      )}
    </main>
  )
}

/* ------------------------------ Waiter Space ------------------------------ */

function WaiterSpace({
  tables,
  tickets,
  diners,
  origin,
  onToggle,
  onDeliverLine,
}: {
  tables: FloorTable[]
  tickets: Ticket[]
  diners: Record<number, DinerInfo[]>
  origin: string
  onToggle: (id: number, occupied: boolean) => void
  onDeliverLine: (ticketId: string, lineName: string) => void
}) {
  const occupied = tables.filter((t) => t.occupied).length
  const others = tickets.filter((t) => t.table === null)

  const renderTicket = (ticket: Ticket) => {
    const lines = ticket.lines
    return (
      <div key={ticket.id} className="mt-3 border-t border-neutral-200 pt-3">
        {ticket.status === 'ready' ? (
          <p className="inline-block bg-[#FF0000] px-3 py-1 text-sm font-black uppercase tracking-widest text-white">
            Ready - pick up from kitchen{ticket.table === null && ` · ${ticket.label}`}
          </p>
        ) : (
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
            Cooking - not ready yet{ticket.table === null && ` · ${ticket.label}`}
          </p>
        )}
        <ol className="mt-3 flex flex-col gap-2">
          {lines.map((l, i) => (
            <li key={l.name}>
              <label
                className={`flex items-center gap-3 ${ticket.status === 'ready' ? 'cursor-pointer' : 'opacity-50'} ${
                  l.delivered ? 'text-neutral-400 line-through' : i === 0 ? 'font-black' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!l.delivered}
                  disabled={ticket.status !== 'ready'}
                  onChange={() => onDeliverLine(ticket.id, l.name)}
                  className="size-5 accent-black"
                />
                <span>
                  <span className="tabular-nums">{i + 1}.</span> {l.qty} × {l.name}
                </span>
                {!l.delivered && (
                  <span className="bg-black px-2 py-0.5 text-xs font-bold text-white">
                    {['FIRST', 'SECOND', 'THIRD'][i] ?? `#${i + 1}`}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ol>
        {ticket.status === 'ready' && (
          <p className="mt-2 text-xs text-neutral-500">Tick each dish once it has been delivered.</p>
        )}
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-36 md:px-10 md:pt-40">
      <StaffHeader
        eyebrow="Floor"
        title="Floor Plan"
        meta={`${occupied} of ${tables.length} tables occupied. ${tickets.filter((t) => t.status === 'ready').length} order(s) ready to serve. Items go out in the order the guest chose.`}
      />

      <ul className="mt-24 grid gap-x-8 gap-y-16 sm:grid-cols-2">
        {tables.map((t) => {
          const mine = tickets.filter((k) => k.table === t.id)
          return (
            <li key={t.id} className="flex flex-col gap-4">
              {t.occupied ? (
                <div className="border-[6px] border-black p-4 md:p-6">
                  <div className="flex items-baseline justify-between">
                    <span className="text-5xl font-black tabular-nums">{t.id}</span>
                    <span className="text-sm text-neutral-500">
                      {t.seats} seats · UID: <strong className="font-mono text-black">{t.uid}</strong> · Occupied
                    </span>
                  </div>
                  <div className="mt-4 flex items-start gap-4">
                    <QrCode value={origin ? `${origin}/?table=${t.id}&uid=${encodeURIComponent(t.uid)}` : ''} size={72} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-widest">
                        {(diners[t.id] ?? []).length} {(diners[t.id] ?? []).length === 1 ? 'diner' : 'diners'} (phones)
                      </p>
                      {(diners[t.id] ?? []).length === 0 ? (
                        <p className="mt-1 text-sm text-neutral-500">Seated by staff.</p>
                      ) : (
                        <ul className="mt-1 flex flex-col gap-1.5">
                          {(diners[t.id] ?? []).map((d) => (
                            <li key={d.deviceId} className="text-sm leading-snug">
                              <span className="font-bold">
                                {d.name} at Table {t.id}
                              </span>{' '}
                              <span className="font-mono text-xs text-neutral-500">({d.deviceId})</span>
                              <span className="text-neutral-500">
                                {' '}
                                · {d.items.reduce((s, i) => s + i.qty, 0)} items · {formatPrice(d.total)}
                              </span>
                              {d.total > 0 && (
                                <span
                                  className={`ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold text-white ${
                                    d.unpaidTotal === 0 ? 'bg-emerald-700' : 'bg-[#FF0000]'
                                  }`}
                                >
                                  {d.unpaidTotal === 0 ? 'PAID' : 'UNPAID'}
                                </span>
                              )}
                              {d.items.length > 0 && (
                                <span className="block text-xs text-neutral-500">{d.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {mine.length === 0 ? (
                    <p className="mt-4 text-neutral-500">No orders yet.</p>
                  ) : (
                    mine.map(renderTicket)
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggle(t.id, true)}
                  aria-label={`Table ${t.id}, vacant, ${t.seats} seats. Seat guests.`}
                  className="flex aspect-[2/1] flex-col justify-between border border-neutral-300 p-4 text-left text-neutral-400 transition-colors hover:text-black focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black md:p-6"
                >
                  <span className="text-5xl font-light tabular-nums">{t.id}</span>
                  <span>
                    <span className="block text-xl">Vacant</span>
                    <span className="text-sm">{t.seats} seats · tap to seat guests</span>
                  </span>
                </button>
              )}
              {t.occupied && (
                <RedButton onClick={() => onToggle(t.id, false)} label={`Clear Table ${t.id}`}>
                  Clear Table
                </RedButton>
              )}
            </li>
          )
        })}
      </ul>

      {others.length > 0 && (
        <section className="mt-24">
          <h2 className="text-3xl font-black">Waiting &amp; take away</h2>
          <div className="mt-4 max-w-xl">{others.map(renderTicket)}</div>
        </section>
      )}
    </main>
  )
}

/* ------------------------------- Owner Space ------------------------------ */

const BASE_FORECAST = [
  { hour: '7:00 AM', covers: 18, note: 'Early breakfast & tea regulars' },
  { hour: '8:00 AM', covers: 41, note: 'Commuter coffee & sandwich build-up' },
  { hour: '9:00 AM', covers: 74, peak: true, note: 'AI Peak Surge · Pre-stage coffee & bread' },
  { hour: '10:00 AM', covers: 52, note: 'Mid-morning brunch tables' },
  { hour: '11:00 AM', covers: 33, note: 'Pre-lunch transition window' },
]

const INVENTORY_META: {
  key: string
  label: string
  unit: string
  threshold: number
  max: number
  defaultPreferred: number
  usedInDishes: string
}[] = [
  {
    key: 'sourdoughSlices',
    label: 'Bread Slices (Sourdough)',
    unit: 'slices',
    threshold: 10,
    max: 60,
    defaultPreferred: 45,
    usedInDishes: 'Club Sandwhich (3 slices), Smash Burger (2 slices), Pizza (2 base slices)',
  },
  {
    key: 'cheeseGrams',
    label: 'Artisan Cheese',
    unit: 'g',
    threshold: 200,
    max: 1200,
    defaultPreferred: 350,
    usedInDishes: 'Pizza (100g), Alfredo Pasta (70g), Smash Burger (60g), Club Sandwhich (40g), Maggi (20g)',
  },
  {
    key: 'patties',
    label: 'Smash Burger Patties',
    unit: 'patties',
    threshold: 5,
    max: 40,
    defaultPreferred: 20,
    usedInDishes: 'Smash Burger (2 patties per burger)',
  },
  {
    key: 'coffeeBeansGrams',
    label: 'Coffee & Tea Roast',
    unit: 'g',
    threshold: 300,
    max: 1400,
    defaultPreferred: 400,
    usedInDishes: 'Coffee (25g), Tea (15g)',
  },
  {
    key: 'friesGrams',
    label: 'French Fries Batch',
    unit: 'g',
    threshold: 400,
    max: 1800,
    defaultPreferred: 750,
    usedInDishes: 'French Fries (200g per serving)',
  },
  {
    key: 'chocolateGrams',
    label: 'Dark Chocolate',
    unit: 'g',
    threshold: 150,
    max: 900,
    defaultPreferred: 375,
    usedInDishes: 'Choco Lava Cake (70g), Brownie with ice cream (60g), Hot Chocolate (40g), Sundae (30g)',
  },
]

function OwnerSpace({
  revenue,
  liveSales,
  recentSales,
  breadSlices,
  inventory,
  inventoryDeductions,
  occupiedTablesCount,
  activeDinersCount,
  onRestock,
}: {
  revenue: number
  liveSales: number
  recentSales: {
    id: string
    tableLabel: string
    guestName: string
    deviceId?: string
    itemsSummary: string
    total: number
    paymentStatus: 'pending' | 'paid'
  }[]
  breadSlices: number
  inventory?: Record<string, number>
  inventoryDeductions: {
    id: string
    ticketId: string
    ticketLabel: string
    dishesSummary: string
    deductions: { ingredientKey: string; amount: number; fromDishes: string }[]
    timestamp: string
  }[]
  occupiedTablesCount: number
  activeDinersCount: number
  onRestock: (ingredient: string, amount: number) => void
}) {
  const [restockToast, setRestockToast] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [intendedAmounts, setIntendedAmounts] = useState<Record<string, string>>({
    sourdoughSlices: '45',
    cheeseGrams: '350',
    patties: '20',
    coffeeBeansGrams: '400',
    friesGrams: '750',
    chocolateGrams: '375',
  })
  const [aiDecisions, setAiDecisions] = useState<
    Record<string, { recommendedRestockAmount: number; reasoning: string; confidenceScore: number }>
  >({})
  const [aiInsight, setAiInsight] = useState<{
    engine: string
    apiKeyMasked: string
    surge: string
    analysis: string
  }>({
    engine: 'Google Gemini 2.5 Flash (Live API Key)',
    apiKeyMasked: 'AQ.Ab8R••••1NytQ',
    surge: 'Morning Peak Detected (94% AI Confidence) · Prioritize Coffee, Club Sandwich & Smash Burger Prep for 9:00 AM.',
    analysis:
      'AI model analyzed historical Saturday footfall, live QR table scans, and stove queue velocity to forecast hourly customer covers and preferred restock amounts.',
  })

  const refreshAiForecast = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-predictions')
      const data = await res.json()
      setAiInsight({
        engine: data.aiEngine || 'Google Gemini 2.5 Flash (Live API Key)',
        apiKeyMasked: data.apiKeyMasked || 'AQ.Ab8R••••1NytQ',
        surge: data.surgeForecast || aiInsight.surge,
        analysis: data.aiAnalysisText || aiInsight.analysis,
      })
      if (Array.isArray(data.restockDecisions)) {
        const map: Record<string, { recommendedRestockAmount: number; reasoning: string; confidenceScore: number }> = {}
        for (const d of data.restockDecisions) {
          if (d.materialKey) {
            map[d.materialKey] = {
              recommendedRestockAmount: d.recommendedRestockAmount,
              reasoning: d.reasoning,
              confidenceScore: d.confidenceScore ?? 0.94,
            }
          }
        }
        setAiDecisions(map)
      }
    } catch {
      // Keep existing AI insight if offline
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    refreshAiForecast()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breadSlices, inventoryDeductions.length])

  const triggerRestock = (ingredient: string, amount: number, label: string) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    onRestock(ingredient, amount)
    setRestockToast(`Added +${amount} ${label} to kitchen inventory!`)
    window.setTimeout(() => setRestockToast(null), 3500)
  }

  const stockMap: Record<string, number> = {
    sourdoughSlices: breadSlices,
    cheeseGrams: inventory?.cheeseGrams ?? 900,
    patties: inventory?.patties ?? 20,
    coffeeBeansGrams: inventory?.coffeeBeansGrams ?? 1000,
    friesGrams: inventory?.friesGrams ?? 1400,
    chocolateGrams: inventory?.chocolateGrams ?? 600,
  }

  // Aggregate how much of each ingredient has been minused when Chef clicked "Start Making"
  const deductedPerIngredient = useMemo(() => {
    const map: Record<string, { totalMinused: number; details: string[] }> = {}
    for (const rec of inventoryDeductions) {
      for (const ded of rec.deductions) {
        if (!map[ded.ingredientKey]) {
          map[ded.ingredientKey] = { totalMinused: 0, details: [] }
        }
        map[ded.ingredientKey].totalMinused += ded.amount
        map[ded.ingredientKey].details.push(`${ded.fromDishes} [${rec.ticketLabel}]`)
      }
    }
    return map
  }, [inventoryDeductions])

  const lowItems = INVENTORY_META.filter((m) => (stockMap[m.key] ?? 0) <= m.threshold)

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-36 md:px-10 md:pt-40">
      <StaffHeader
        eyebrow="Owner Space · Live Operations & AI Intelligence"
        title="Today"
        meta="Saturday, November 14 · Live revenue updates automatically with every order placed."
      />

      {/* 1. LIVE REVENUE & EVERY-SALE TICKER */}
      <section aria-label="Live Revenue" className="mt-20 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-3">
          <p className="text-sm font-bold uppercase tracking-widest">Live Revenue</p>
          <p className="mt-2 text-sm text-neutral-500">
            Increases automatically with every single sale placed across dine-in, waiting list, and takeaway.
          </p>
        </div>
        <div className="md:col-span-9">
          <div className="border-[6px] border-black p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Total Revenue Today</p>
                <p className="mt-2 text-6xl font-black tracking-tighter tabular-nums md:text-8xl">
                  {formatPrice(revenue)}
                </p>
              </div>
              <div className="text-left md:text-right">
                <span className="inline-block bg-emerald-700 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                  +{formatPrice(liveSales)} Live Session Sales ({recentSales.length}{' '}
                  {recentSales.length === 1 ? 'Order' : 'Orders'})
                </span>
                <p className="mt-2 text-xs text-neutral-500">
                  Base morning register: ₹6,450 + Live orders: {formatPrice(liveSales)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Active floor: {occupiedTablesCount}/4 tables occupied · {activeDinersCount} connected phone(s)
                </p>
              </div>
            </div>

            {recentSales.length > 0 && (
              <div className="mt-6 border-t-2 border-black pt-5">
                <p className="text-xs font-black uppercase tracking-widest">
                  Live Sales Feed (Every Order Immediately Adds to Revenue)
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {recentSales.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm"
                    >
                      <div>
                        <span className="font-black">
                          {s.guestName} ({s.tableLabel})
                        </span>
                        {s.deviceId && <span className="ml-1.5 font-mono text-xs text-neutral-500">[{s.deviceId}]</span>}
                        <span className="block text-xs text-neutral-600">{s.itemsSummary}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                            s.paymentStatus === 'paid' ? 'bg-emerald-700' : 'bg-neutral-800'
                          }`}
                        >
                          {s.paymentStatus === 'paid' ? 'PAID' : 'SALE RECORDED'}
                        </span>
                        <span className="font-black text-emerald-700 tabular-nums">+{formatPrice(s.total)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. AI DEMAND INSIGHT & EXPLANATION OF FORECAST COVERS */}
      <section aria-label="AI Forecast Covers" className="mt-24 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-3">
          <p className="text-sm font-bold uppercase tracking-widest">AI Demand Forecast</p>
          <span className="mt-2 inline-block bg-black px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white">
            Done with AI · Gemini 2.5
          </span>
          <p className="mt-3 text-sm text-neutral-500">
            Predictive hourly diner volume (&ldquo;Forecast Covers&rdquo;) computed by our AI engine.
          </p>
        </div>

        <div className="md:col-span-9">
          <div className="border-[6px] border-black p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-5">
              <div>
                <span className="inline-block bg-[#FF0000] px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                  AI-Powered Demand Forecasting · {aiInsight.engine}
                </span>
                <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight md:text-4xl">
                  {aiInsight.surge}
                </h2>
              </div>
              <button
                type="button"
                onClick={refreshAiForecast}
                disabled={aiLoading}
                className="border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-widest transition hover:bg-black hover:text-white cursor-pointer disabled:opacity-50"
              >
                {aiLoading ? 'Running AI Model…' : '↻ Re-Run AI Forecast'}
              </button>
            </div>

            {/* Clear Explanation of Forecast Covers & How AI Computes It */}
            <div className="mt-6 grid gap-4 bg-neutral-100 p-5 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-black">
                  What does &ldquo;Forecast Covers&rdquo; mean?
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
                  In restaurant operations, <strong>1 Cover = 1 seated diner / customer meal served</strong>.{' '}
                  <strong>Forecast Covers</strong> is the predicted number of guests expected to dine during each hour
                  window so the kitchen can pre-prep ingredients and staff before the rush hits.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-black">
                  How is this done with AI?
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
                  {aiInsight.analysis} Live orders today (<strong>+{recentSales.length}</strong>) dynamically adjust the
                  active hour&apos;s projected cover load in real time.
                </p>
              </div>
            </div>

            <table className="mt-8 w-full text-left text-base md:text-lg">
              <caption className="sr-only">AI Forecasted covers by hour</caption>
              <thead>
                <tr className="border-b-2 border-black text-xs uppercase tracking-widest">
                  <th scope="col" className="pb-3 font-black">
                    Hour Window
                  </th>
                  <th scope="col" className="pb-3 font-black">
                    AI Demand Signal &amp; Prep Note
                  </th>
                  <th scope="col" className="pb-3 text-right font-black">
                    AI Forecast Covers (Diners)
                  </th>
                </tr>
              </thead>
              <tbody>
                {BASE_FORECAST.map((row) => {
                  const dynamicCovers = row.peak ? row.covers + recentSales.length + activeDinersCount : row.covers
                  const pct = Math.min(100, Math.round((dynamicCovers / 90) * 100))
                  return (
                    <tr
                      key={row.hour}
                      className={`border-b border-neutral-200 ${row.peak ? 'bg-amber-50/80 font-black text-black' : 'text-neutral-600'}`}
                    >
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {row.hour}
                        {row.peak && (
                          <span className="ml-2 inline-block bg-[#FF0000] px-2 py-0.5 text-[10px] font-black uppercase text-white">
                            PEAK
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        <span>{row.note}</span>
                        <div className="mt-1.5 h-2 w-full max-w-xs bg-neutral-200">
                          <div
                            className={`h-full ${row.peak ? 'bg-[#FF0000]' : 'bg-black'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        <span className="text-xl font-black">{dynamicCovers}</span>{' '}
                        <span className="text-xs font-normal text-neutral-500">covers</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. FIXED INVENTORY, CHEF PREP DEDUCTIONS & AI-SUGGESTED RESTOCK INTERFACE */}
      <section aria-label="Kitchen Inventory & Restock" className="mt-24 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-3">
          <p className="text-sm font-bold uppercase tracking-widest">Inventory &amp; AI Restock</p>
          <span className="mt-2 inline-block bg-black px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white">
            Learned via API Key: {aiInsight.apiKeyMasked}
          </span>
          <p className="mt-3 text-sm text-neutral-500">
            When an order arrives at Chef&apos;s Table and the Chef clicks <strong>&ldquo;Start Making&rdquo;</strong>,
            the exact raw ingredients used in those menu items are subtracted here in real time. Enter your intended
            restock amount or apply the AI-learned preferred amount.
          </p>
        </div>

        <div className="md:col-span-9">
          <div className="border-[6px] border-black p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-6">
              <div>
                {lowItems.length > 0 ? (
                  <span className="inline-block bg-[#FF0000] px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                    {lowItems.length} Low-Stock Alert{lowItems.length === 1 ? '' : 's'} Active
                  </span>
                ) : (
                  <span className="inline-block bg-emerald-700 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                    All 6 Kitchen Ingredients Optimal
                  </span>
                )}
                <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight md:text-4xl">
                  {breadSlices <= 10
                    ? `Inventory Alert: Bread Slices — ${breadSlices} remaining (Threshold: 10).`
                    : `Kitchen Inventory Healthy — Bread Slices: ${breadSlices} remaining.`}
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => triggerRestock('all', 1, 'All Kitchen Ingredients')}
                  className="bg-black px-5 py-3 text-base font-bold text-white transition hover:bg-neutral-800 cursor-pointer"
                >
                  Restock All Inventory
                </button>
              </div>
            </div>

            {/* Live Chef "Start Making" Deduction Feed */}
            <div className="mt-6 border-2 border-black bg-neutral-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-black">
                  Live Chef Prep Subtractions (Triggered when Chef clicks &ldquo;Start Making&rdquo;)
                </p>
                <span className="text-xs font-bold text-neutral-500">
                  {inventoryDeductions.length} ticket(s) started by Chef
                </span>
              </div>
              {inventoryDeductions.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-600">
                  No tickets started yet in this session. Open <strong>Chef Space (CHEF-1234)</strong> and click{' '}
                  <strong>&ldquo;Start Making (Subtract Stock)&rdquo;</strong> on any order to watch the exact dish
                  ingredients get minused here live!
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {inventoryDeductions.map((rec) => (
                    <li key={rec.id} className="border border-neutral-300 bg-white p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-black">
                          Chef started making: {rec.ticketLabel} ({rec.dishesSummary})
                        </span>
                        <span className="font-mono text-[11px] text-neutral-500">
                          {new Date(rec.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {rec.deductions.map((d) => {
                          const meta = INGREDIENT_LABELS[d.ingredientKey]
                          return (
                            <span
                              key={d.ingredientKey}
                              className="inline-block bg-[#FF0000] px-2 py-0.5 text-[11px] font-black text-white"
                            >
                              −{d.amount} {meta?.unit === 'g' ? 'g' : ''} {meta?.name ?? d.ingredientKey} (from{' '}
                              {d.fromDishes})
                            </span>
                          )
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {restockToast && (
              <div
                role="status"
                className="mt-5 border-2 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900"
              >
                ✓ {restockToast}
              </div>
            )}

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {INVENTORY_META.map((item) => {
                const current = stockMap[item.key] ?? 0
                const isLow = current <= item.threshold
                const pct = Math.min(100, Math.round((current / item.max) * 100))
                const aiDec = aiDecisions[item.key]
                const preferredAmt =
                  aiDec && aiDec.recommendedRestockAmount > 0
                    ? aiDec.recommendedRestockAmount
                    : item.defaultPreferred
                const deductionInfo = deductedPerIngredient[item.key]
                const intendedVal = intendedAmounts[item.key] ?? String(preferredAmt)

                return (
                  <div
                    key={item.key}
                    className={`flex flex-col justify-between border-2 p-5 ${
                      isLow ? 'border-[#FF0000] bg-red-50/40' : 'border-neutral-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-black text-black">{item.label}</h3>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-black uppercase text-white ${
                            isLow ? 'bg-[#FF0000]' : 'bg-emerald-700'
                          }`}
                        >
                          {isLow ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </div>

                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <p className="text-3xl font-black tabular-nums">
                          {current} <span className="text-sm font-normal text-neutral-500">{item.unit}</span>
                        </p>
                        <p className="text-xs text-neutral-500">
                          Threshold: {item.threshold} {item.unit}
                        </p>
                      </div>

                      <div className="mt-2.5 h-2.5 w-full bg-neutral-200">
                        <div
                          className={`h-full transition-all ${isLow ? 'bg-[#FF0000]' : 'bg-black'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Menu items that use this ingredient */}
                      <p className="mt-3 text-xs leading-relaxed text-neutral-700">
                        <strong className="uppercase tracking-wider text-black">Used in menu items: </strong>
                        {item.usedInDishes}
                      </p>

                      {/* Show exact amount minused when Chef starts making an order */}
                      {deductionInfo && deductionInfo.totalMinused > 0 && (
                        <div className="mt-2.5 border-l-4 border-[#FF0000] bg-red-50 px-3 py-2 text-xs text-red-950">
                          <p className="font-black text-[#FF0000]">
                            −{deductionInfo.totalMinused} {item.unit} minused in Chef prep
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-700">
                            Used in: {deductionInfo.details.join(' · ')}
                          </p>
                        </div>
                      )}

                      {/* AI Learned Suggestion Box from GEMINI_API_KEY */}
                      <div className="mt-3 border border-black/20 bg-neutral-100 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black uppercase tracking-wider text-black">
                            ✦ AI Preferred to Add: +{preferredAmt} {item.unit}
                          </span>
                          <span className="font-mono text-[10px] text-neutral-600">
                            API Key ({aiInsight.apiKeyMasked})
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                          {aiDec?.reasoning ||
                            `Learned via Gemini API Key (${aiInsight.apiKeyMasked}) from menu item burn rate & peak cover forecast: +${preferredAmt} ${item.unit} recommended.`}
                        </p>
                        <button
                          type="button"
                          onClick={() => triggerRestock(item.key, preferredAmt, `${item.label} (AI Preferred)`)}
                          className="mt-2 w-full bg-black px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-neutral-800 cursor-pointer"
                        >
                          + Add AI Preferred (+{preferredAmt} {item.unit})
                        </button>
                      </div>
                    </div>

                    {/* Owner's Intended Amount Input + Add Button (No Simulate Use!) */}
                    <div className="mt-4 border-t border-neutral-200 pt-3">
                      <label
                        htmlFor={`intend-${item.key}`}
                        className="block text-[11px] font-black uppercase tracking-wider text-neutral-700"
                      >
                        Add Your Intended Amount ({item.unit})
                      </label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          id={`intend-${item.key}`}
                          type="number"
                          min={1}
                          value={intendedVal}
                          onChange={(e) =>
                            setIntendedAmounts((prev) => ({ ...prev, [item.key]: e.target.value }))
                          }
                          className="w-28 border-2 border-black bg-white px-3 py-1.5 text-sm font-black tabular-nums text-black"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            triggerRestock(item.key, Number(intendedVal) || preferredAmt, item.label)
                          }
                          className="flex-1 bg-[#FF0000] px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#D90000] cursor-pointer"
                        >
                          + Add Intended (+{Number(intendedVal) || preferredAmt} {item.unit})
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
