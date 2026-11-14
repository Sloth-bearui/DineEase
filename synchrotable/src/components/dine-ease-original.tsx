'use client'

import { useRef, useState } from 'react'
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
type Course = 'Starters' | 'Mains' | 'Desserts'

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
}

type Cart = Record<string, number>

const MENU: MenuItem[] = [
  {
    id: 'burrata',
    name: 'Burrata & Heirloom',
    description: 'Tomato, basil oil, flaked sea salt',
    price: 14,
    wait: 5,
    course: 'Starters',
    image: '/food/top/burrata.png',
  },
  {
    id: 'tagliatelle',
    name: 'Truffle Tagliatelle',
    description: 'Hand-cut pasta, aged parmesan',
    price: 24,
    wait: 12,
    course: 'Mains',
    image: '/food/top/pasta.png',
  },
  {
    id: 'calamari',
    name: 'Crispy Calamari',
    description: 'Lemon, saffron aioli',
    price: 13,
    wait: 6,
    course: 'Starters',
    image: '/food/top/calamari.png',
  },
  {
    id: 'salmon',
    name: 'Seared Salmon',
    description: 'Grilled asparagus, salsa verde',
    price: 29,
    wait: 14,
    course: 'Mains',
    image: '/food/top/salmon.png',
  },
  {
    id: 'lava',
    name: 'Chocolate Lava Cake',
    description: 'Raspberry, vanilla bean gelato',
    price: 11,
    wait: 8,
    course: 'Desserts',
    image: '/food/top/dessert.png',
  },
  {
    id: 'margherita',
    name: 'Wood-fired Margherita',
    description: 'San Marzano, fior di latte, basil',
    price: 19,
    wait: 10,
    course: 'Mains',
    image: '/food/top/pizza.png',
  },
  {
    id: 'ribeye',
    name: 'Ribeye, Herb Butter',
    description: 'Dry-aged, charred greens',
    price: 38,
    wait: 18,
    course: 'Mains',
    image: '/food/top/steak.png',
  },
]

const TABLE_LAYOUT: { id: string; x: number; y: number; back: boolean }[] = [
  { id: 'burrata', x: 19, y: 33, back: true },
  { id: 'tagliatelle', x: 50, y: 16, back: true },
  { id: 'calamari', x: 81, y: 33, back: true },
  { id: 'salmon', x: 81, y: 67, back: false },
  { id: 'lava', x: 50, y: 84, back: false },
  { id: 'margherita', x: 19, y: 67, back: false },
]

const COURSES: Course[] = ['Starters', 'Mains', 'Desserts']

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 't4',
    table: 4,
    label: 'Table 4',
    minutesAgo: 6,
    status: 'cooking',
    first: 'Burrata & Heirloom',
    lines: [
      { name: 'Burrata & Heirloom', course: 'Starters', qty: 2 },
      { name: 'Truffle Tagliatelle', course: 'Mains', qty: 1 },
      { name: 'Ribeye, Herb Butter', course: 'Mains', qty: 2 },
      { name: 'Chocolate Lava Cake', course: 'Desserts', qty: 3 },
    ],
  },
  {
    id: 't2',
    table: 2,
    label: 'Table 2',
    minutesAgo: 1,
    status: 'cooking',
    first: 'Chocolate Lava Cake',
    lines: [
      { name: 'Truffle Tagliatelle', course: 'Mains', qty: 2 },
      { name: 'Chocolate Lava Cake', course: 'Desserts', qty: 2 },
    ],
  },
]

// The restaurant has 4 tables in total.
const INITIAL_TABLES: FloorTable[] = [
  { id: 1, seats: 2, occupied: false },
  { id: 2, seats: 4, occupied: true },
  { id: 3, seats: 4, occupied: false },
  { id: 4, seats: 6, occupied: true },
]

const TABS: { id: Tab; label: string }[] = [
  { id: 'user', label: 'User Space' },
  { id: 'chef', label: 'Chef Space' },
  { id: 'waiter', label: 'Waiter Space' },
  { id: 'owner', label: 'Owner Space' },
]

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

/* ---------------------------------- Root ---------------------------------- */

export default function DineEase() {
  const [tab, setTab] = useState<Tab>('user')
  const [session, setSession] = useState<Session | null>(null)
  const [cart, setCart] = useState<Cart>({})
  const [serveOrder, setServeOrder] = useState<string[]>([])
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS)
  const [tables, setTables] = useState<FloorTable[]>(INITIAL_TABLES)
  const [breadSlices, setBreadSlices] = useState(10)
  const [revenue, setRevenue] = useState(4218)
  const [codeOpen, setCodeOpen] = useState(false)

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
    if (s.mode === 'dine') {
      setTables((prev) => prev.map((t) => (t.id === s.table ? { ...t, occupied: true } : t)))
    }
    setSession(s)
    window.scrollTo({ top: 0 })
  }

  const leaveSession = () => {
    if (session?.mode === 'dine') {
      const id = session.table
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, occupied: false } : t)))
    }
    setSession(null)
    setCart({})
    setServeOrder([])
    window.scrollTo({ top: 0 })
  }

  const placeOrder = () => {
    if (!session) return
    const ids = Object.keys(cart)
    const ranked = [...serveOrder.filter((id) => cart[id]), ...ids.filter((id) => !serveOrder.includes(id))]
    const newLines: TicketLine[] = ranked.flatMap((id) => {
      const item = MENU.find((m) => m.id === id)
      return item ? [{ name: item.name, course: item.course, qty: cart[id] }] : []
    })
    if (newLines.length === 0) return
    const first = newLines[0].name
    const table = session.mode === 'dine' ? session.table : null
    const label = sessionLabel(session)

    setTickets((prev) => [
      ...prev,
      { id: `${label}-${Date.now()}`, table, label, minutesAgo: 0, lines: newLines, first, status: 'cooking' },
    ])
    setRevenue((r) =>
      r + Object.entries(cart).reduce((sum, [id, qty]) => sum + (MENU.find((m) => m.id === id)?.price ?? 0) * qty, 0),
    )
    setCart({})
    setServeOrder([])
  }

  const isStaff = tab !== 'user'

  return (
    <div className={isStaff ? 'min-h-screen bg-white text-black' : 'min-h-screen bg-stone-950 text-stone-50'}>
      <TopNav tab={tab} onExit={() => changeTab('user')} isStaff={isStaff} />
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
          />
        ) : (
          <TableSelect tables={tables} onChoose={chooseSession} />
        ))}
      {tab === 'chef' && (
        <ChefSpace
          tickets={tickets.filter((t) => t.status === 'cooking')}
          onReady={(id) => setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'ready' } : t)))}
        />
      )}
      {tab === 'waiter' && (
        <WaiterSpace
          tables={tables}
          tickets={tickets}
          onToggle={(id, occupied) =>
            setTables((prev) => prev.map((t) => (t.id === id ? { ...t, occupied } : t)))
          }
          onDeliverLine={(id, name) =>
            setTickets((prev) =>
              prev.flatMap((t) => {
                if (t.id !== id) return [t]
                const lines = t.lines.map((l) => (l.name === name ? { ...l, delivered: !l.delivered } : l))
                return lines.every((l) => l.delivered) ? [] : [{ ...t, lines }]
              }),
            )
          }
        />
      )}
      {tab === 'owner' && <OwnerSpace revenue={revenue} breadSlices={breadSlices} onRestock={() => setBreadSlices(60)} />}

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

function TopNav({ tab, onExit, isStaff }: { tab: Tab; onExit: () => void; isStaff: boolean }) {
  const label = TABS.find((t) => t.id === tab)?.label
  return (
    <header
      className={
        isStaff ? 'fixed inset-x-0 top-0 z-50 bg-white' : 'fixed inset-x-0 top-0 z-50 bg-stone-950/40 backdrop-blur-xl'
      }
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">
        <span
          className={
            isStaff ? 'text-lg font-black tracking-tight' : 'font-display text-2xl italic tracking-tight text-stone-50'
          }
        >
          DineEase
        </span>
        {isStaff && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold">{label}</span>
            <button
              type="button"
              onClick={onExit}
              className="text-sm font-medium text-neutral-500 hover:text-black focus-visible:outline-2 focus-visible:outline-black"
            >
              Lock &amp; exit
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}

/* ------------------------------ Table selection --------------------------- */

function TableSelect({ tables, onChoose }: { tables: FloorTable[]; onChoose: (s: Session) => void }) {
  const vacant = tables.filter((t) => !t.occupied)

  return (
    <main className="relative mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center px-5 pt-32 text-center">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 top-20 size-[36rem] rounded-full bg-orange-500/20 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[32rem] rounded-full bg-rose-500/15 blur-[140px]" />
      </div>
      <div className="relative">
        <h1 className="font-display text-4xl text-balance md:text-6xl">
          {vacant.length > 0 ? 'Choose your table' : 'All tables are taken'}
        </h1>
        <p className="mt-3 text-stone-400">
          {vacant.length > 0
            ? 'Only vacant tables are shown.'
            : 'Join the waiting list, or order for take away.'}
        </p>

        {vacant.length > 0 ? (
          <ul className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {vacant.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onChoose({ mode: 'dine', table: t.id })}
                  className="flex aspect-square w-40 flex-col items-center justify-center rounded-3xl bg-white/[0.06] ring-1 ring-white/15 transition hover:-translate-y-1 hover:bg-white/10 hover:ring-amber-300 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <span className="font-display text-5xl">{t.id}</span>
                  <span className="mt-1 text-sm text-stone-400">{t.seats} seats</span>
                  <span className="mt-2 text-xs font-semibold text-emerald-300">Vacant</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => onChoose({ mode: 'wait' })}
              className="rounded-3xl bg-white/[0.06] px-10 py-8 text-left ring-1 ring-white/15 transition hover:-translate-y-1 hover:ring-amber-300"
            >
              <span className="font-display text-2xl">Wait for a table</span>
              <span className="mt-1 block text-sm text-stone-400">Order now, we&apos;ll seat you when one frees up.</span>
            </button>
            <button
              type="button"
              onClick={() => onChoose({ mode: 'takeaway' })}
              className="rounded-3xl bg-white/[0.06] px-10 py-8 text-left ring-1 ring-white/15 transition hover:-translate-y-1 hover:ring-amber-300"
            >
              <span className="font-display text-2xl">Take away</span>
              <span className="mt-1 block text-sm text-stone-400">Order and pick it up at the counter.</span>
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

/* ------------------------------- User Space ------------------------------- */

function UserSpace({
  session,
  cart,
  serveOrder,
  setServeOrder,
  setQty,
  onPlaceOrder,
  onLeave,
}: {
  session: Session
  cart: Cart
  serveOrder: string[]
  setServeOrder: (o: string[]) => void
  setQty: (id: string, qty: number) => void
  onPlaceOrder: () => void
  onLeave: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [justPlaced, setJustPlaced] = useState(false)
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start start', 'end end'] })
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 })

  const tableTilt = useTransform(progress, [0, 0.6], [0, 60])
  const tableScale = useTransform(progress, [0, 0.6], [0.86, 1.05])
  const tableY = useTransform(progress, [0, 0.6], [0, 90])
  const counterTilt = useTransform(progress, [0.05, 0.6], [0, -60])
  const reveal = useTransform(progress, [0.3, 0.65], [0, 1])
  const hintOpacity = useTransform(progress, [0, 0.12], [1, 0])
  const headlineOpacity = useTransform(progress, [0.45, 0.7], [0, 1])
  const frontLift = useTransform(progress, [0.1, 0.65], [0, 70])
  const backLift = useTransform(progress, [0.1, 0.65], [0, 230])
  const dishScale = useTransform(progress, [0, 0.6], [0.8, 1.15])

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

  return (
    <main className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 top-20 size-[36rem] rounded-full bg-orange-500/20 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[32rem] rounded-full bg-rose-500/15 blur-[140px]" />
      </div>

      {/* Scroll-driven spatial stage */}
      <section ref={stageRef} aria-label="Interactive table" className="relative h-[280vh]">
        <div className="sticky top-0 flex h-screen flex-col items-center overflow-hidden pt-32 md:pt-24">
          <SessionBanner session={session} total={total} onLeave={onLeave} />

          <motion.div
            style={{ opacity: headlineOpacity }}
            className="pointer-events-none mt-4 px-6 text-center"
          >
            <p className="font-display text-3xl text-balance md:text-4xl">Tonight&apos;s table</p>
            <p className="mt-1 text-sm text-stone-400">Tap a dish to add it to the shared order</p>
          </motion.div>

          <div className="relative flex w-full flex-1 items-center justify-center [perspective:1100px]">
            <motion.div
              style={{ rotateX: tableTilt, scale: tableScale, y: tableY, transformStyle: 'preserve-3d' }}
              className="relative aspect-square w-[min(92vw,640px)] rounded-full shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
            >
              <div aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
                <Image src="/food/table-top.png" alt="" fill sizes="640px" className="object-cover" priority />
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
            className="pointer-events-none absolute bottom-28 flex flex-col items-center gap-2 text-xs uppercase tracking-[0.3em] text-stone-400"
          >
            Scroll to raise the menu
            <motion.span
              aria-hidden
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="block h-6 w-px bg-stone-400"
            />
          </motion.p>
        </div>
      </section>

      {/* Full menu with scroll reveals */}
      <section aria-labelledby="menu-heading" className="relative mx-auto max-w-6xl px-5 pb-48 pt-10 md:px-10">
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
        <section aria-labelledby="serve-heading" className="relative mx-auto max-w-2xl px-5 pb-40 md:px-10">
          <h2 id="serve-heading" className="font-display text-3xl md:text-4xl">
            Your order
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
      <OrderBar count={count} total={total} onPlace={handlePlace} justPlaced={justPlaced} />
    </main>
  )
}

function SessionBanner({ session, total, onLeave }: { session: Session; total: number; onLeave: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 mx-5 flex w-[min(92vw,560px)] items-center justify-between gap-4 rounded-2xl bg-white/[0.07] px-5 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-2xl"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
        </span>
        <div>
          <p className="text-sm font-semibold">{sessionLabel(session)}</p>
          <p className="text-xs text-stone-400">
            {session.mode === 'dine' ? 'Dine in' : session.mode === 'wait' ? 'Order while you wait' : 'Pick up at the counter'}
            {' · '}
            {formatPrice(total)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-300 ring-1 ring-white/20 hover:bg-white/10"
      >
        Change
      </button>
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
  const cardBg = useTransform(reveal, (v) => `rgba(28, 25, 23, ${v * 0.75})`)
  const cardShadow = useTransform(
    reveal,
    (v) => `0 ${30 * v}px ${60 * v}px rgba(0,0,0,${0.55 * v}), 0 0 0 1px rgba(255,255,255,${0.1 * v})`,
  )
  const plateShadow = useTransform(
    reveal,
    (v) => `0 ${6 + 10 * v}px ${18 + 20 * v}px rgba(0,0,0,${0.6 - 0.2 * v})`,
  )

  return (
    <motion.div
      style={{
        z: lift,
        scale,
        rotateX: counterTilt,
        transformStyle: 'preserve-3d',
        transformOrigin: 'bottom center',
      }}
      className="w-[min(21vw,136px)]"
    >
      <motion.button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${item.name} to order, ${formatPrice(item.price)}`}
        whileHover={{ y: -12, scale: 1.06 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ backgroundColor: cardBg, boxShadow: cardShadow }}
        className="relative block w-full rounded-3xl p-1.5 text-left backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <motion.div
          style={{ boxShadow: plateShadow }}
          className="relative aspect-square overflow-hidden rounded-full"
        >
          <Image src={item.image} alt="" fill sizes="160px" className="scale-110 object-cover" priority />
        </motion.div>
        <motion.div style={{ opacity: reveal }} className="px-1 pb-1 pt-2">
          <p className="text-xs font-semibold leading-tight text-stone-50 text-pretty">{item.name}</p>
          <p className="mt-0.5 text-xs font-semibold text-amber-300">{formatPrice(item.price)}</p>
          <div className="mt-1.5 origin-left scale-90">
            <WaitBadge minutes={item.wait} />
          </div>
        </motion.div>
        <AnimatePresence>
          {qty > 0 && (
            <motion.span
              key={qty}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-xs font-bold text-stone-950 shadow-lg"
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
      whileHover={{ y: -10 }}
      className="group rounded-3xl bg-stone-900/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_45%,#4a2f1c,#1c1410_75%)]">
        <div className="relative aspect-square h-[86%] overflow-hidden rounded-full shadow-[0_18px_40px_rgba(0,0,0,0.6)] transition-transform duration-700 group-hover:rotate-12 group-hover:scale-105">
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 640px) 40vw, 80vw"
            className="scale-110 object-cover"
          />
        </div>
        <div className="absolute left-3 top-3">
          <WaitBadge minutes={item.wait} />
        </div>
      </div>
      <div className="p-2 pt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{item.course}</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-xl">{item.name}</h3>
          <span className="font-semibold text-amber-300">{formatPrice(item.price)}</span>
        </div>
        <p className="mt-1 text-sm text-stone-400">{item.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => onChange(qty - 1)}
              disabled={qty === 0}
              aria-label={`Remove one ${item.name}`}
              className="flex size-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-white/10 disabled:opacity-30"
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
              className="flex size-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-white/10"
            >
              {'+'}
            </button>
          </div>
          <span className="text-xs text-stone-500">{formatPrice(item.price * qty)}</span>
        </div>
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

function ChefSpace({ tickets, onReady }: { tickets: Ticket[]; onReady: (id: string) => void }) {
  const itemCount = tickets.reduce((s, t) => s + t.lines.reduce((a, l) => a + l.qty, 0), 0)

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-36 md:px-10 md:pt-40">
      <StaffHeader
        eyebrow="Kitchen"
        title="Order Queue"
        meta={`${tickets.length} tickets. ${itemCount} items. Oldest first.`}
      />

      {tickets.length === 0 ? (
        <p className="mt-32 text-3xl font-bold md:pl-[25%]">Queue clear.</p>
      ) : (
        <ol className="mt-24 flex flex-col gap-28">
          {[...tickets]
            .sort((a, b) => b.minutesAgo - a.minutesAgo)
            .map((ticket) => (
              <li key={ticket.id} className="grid gap-8 md:grid-cols-12">
                <div className="md:col-span-3">
                  <h2 className="text-4xl font-black tracking-tight">{ticket.label}</h2>
                  <p className="mt-2 text-neutral-500">
                    {ticket.minutesAgo === 0 ? 'Just now' : `${ticket.minutesAgo} min ago`}
                  </p>
                  {ticket.first && <p className="mt-2 text-sm font-bold">Serve first: {ticket.first}</p>}
                </div>
                <div className="grid gap-10 sm:grid-cols-3 md:col-span-6">
                  {COURSES.map((course) => {
                    const lines = ticket.lines.filter((l) => l.course === course)
                    return (
                      <div key={course}>
                        <h3 className="text-sm font-black uppercase tracking-widest">{course}</h3>
                        {lines.length === 0 ? (
                          <p className="mt-3 text-neutral-400">None</p>
                        ) : (
                          <ul className="mt-3 flex flex-col gap-2">
                            {lines.map((l) => (
                              <li key={l.name} className="text-lg leading-snug">
                                <span className="font-bold tabular-nums">{l.qty}</span>
                                {' × '}
                                {l.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="md:col-span-3 md:text-right">
                  <RedButton onClick={() => onReady(ticket.id)} label={`Mark ${ticket.label} as ready`}>
                    Mark as Ready
                  </RedButton>
                </div>
              </li>
            ))}
        </ol>
      )}
    </main>
  )
}

/* ------------------------------ Waiter Space ------------------------------ */

function WaiterSpace({
  tables,
  tickets,
  onToggle,
  onDeliverLine,
}: {
  tables: FloorTable[]
  tickets: Ticket[]
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
                    <span className="text-sm text-neutral-500">{t.seats} seats · Occupied</span>
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

const FORECAST = [
  { hour: '7:00 AM', covers: 18 },
  { hour: '8:00 AM', covers: 41 },
  { hour: '9:00 AM', covers: 74, peak: true },
  { hour: '10:00 AM', covers: 52 },
  { hour: '11:00 AM', covers: 33 },
]

function OwnerSpace({
  revenue,
  breadSlices,
  onRestock,
}: {
  revenue: number
  breadSlices: number
  onRestock: () => void
}) {
  const low = breadSlices <= 10

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-36 md:px-10 md:pt-40">
      <StaffHeader eyebrow="Owner" title="Today" meta="Saturday, November 14. Live since 6:30 AM." />

      <dl className="mt-24 md:pl-[25%]">
        <div>
          <dt className="text-sm font-bold uppercase tracking-widest">Revenue</dt>
          <dd className="mt-2 text-6xl font-black tracking-tighter tabular-nums md:text-7xl">
            {formatPrice(revenue)}
          </dd>
        </div>
      </dl>

      <section aria-label="Alerts" className="mt-32 grid gap-20 md:grid-cols-12">
        <p className="text-sm font-bold uppercase tracking-widest md:col-span-3">Alerts</p>
        <div className="flex flex-col gap-20 md:col-span-9">
          <div role="status">
            <p className="text-3xl font-black leading-tight tracking-tight text-balance md:text-5xl">
              AI Demand Insight: Morning peak detected. Prioritize coffee prep for 9:00 AM.
            </p>
            <table className="mt-10 w-full max-w-md text-left text-lg">
              <caption className="sr-only">Forecasted covers by hour</caption>
              <thead>
                <tr className="text-sm uppercase tracking-widest">
                  <th scope="col" className="pb-3 font-bold">
                    Hour
                  </th>
                  <th scope="col" className="pb-3 text-right font-bold">
                    Forecast covers
                  </th>
                </tr>
              </thead>
              <tbody>
                {FORECAST.map((row) => (
                  <tr key={row.hour} className={row.peak ? 'font-black' : 'text-neutral-500'}>
                    <td className="py-1.5">{row.hour}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.covers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div role="status" className="flex flex-col gap-8">
            <p className="text-3xl font-black leading-tight tracking-tight md:text-5xl">
              {low
                ? `Inventory Alert: Bread Slices - ${breadSlices} remaining.`
                : `Inventory: Bread Slices - ${breadSlices} remaining. Restock ordered.`}
            </p>
            {low && (
              <div>
                <RedButton onClick={onRestock}>Restock Inventory</RedButton>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
