'use client';

import React, { useState, useEffect } from 'react';
import { useSynchroSocket } from '@/lib/useSynchroSocket';
import { MENU_ITEMS } from '@/lib/data';
import { VoiceOrderAssistant } from '@/components/VoiceOrderAssistant';
import { 
  ShoppingBag, 
  Clock, 
  GraduationCap, 
  CheckCircle, 
  ChevronRight, 
  Sparkles, 
  AlertCircle,
  Plus,
  Minus,
  Trash2,
  Utensils
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerTablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ tableId: string } | null>(null);

  useEffect(() => {
    params.then((p) => setResolvedParams(p));
  }, [params]);

  const tableId = resolvedParams?.tableId || 'T-04';
  const { gameState, isConnected, emit } = useSynchroSocket();

  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [guestName, setGuestName] = useState('Alex');
  const [email, setEmail] = useState('');
  const [studentDiscountVerified, setStudentDiscountVerified] = useState(false);
  const [studentDiscountMsg, setStudentDiscountMsg] = useState('');
  const [selectedCourseTab, setSelectedCourseTab] = useState<'All' | 'Starter' | 'Main' | 'Dessert'>('All');

  // Cart: dishId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [lastSubOrder, setLastSubOrder] = useState<any>(null);

  // Auto-scan table QR upon opening
  useEffect(() => {
    if (isConnected && tableId) {
      emit('table_scan', { tableId, guestCount: 1 });
    }
  }, [isConnected, tableId]);

  // Handle student verification response
  useEffect(() => {
    const checkEmail = async () => {
      if (!email || !email.includes('@')) {
        setStudentDiscountVerified(false);
        setStudentDiscountMsg('');
        return;
      }
      try {
        const res = await fetch('/api/synchro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'validate_student', email }),
        });
        const data = await res.json();
        setStudentDiscountVerified(data.isValid);
        setStudentDiscountMsg(data.message);
        if (data.isValid) {
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
        }
      } catch (err) {}
    };

    const timer = setTimeout(checkEmail, 400);
    return () => clearTimeout(timer);
  }, [email]);

  const addItemToCart = (dishId: string) => {
    setCart((prev) => ({ ...prev, [dishId]: (prev[dishId] || 0) + 1 }));
  };

  const removeItemFromCart = (dishId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (copy[dishId] > 1) {
        copy[dishId] -= 1;
      } else {
        delete copy[dishId];
      }
      return copy;
    });
  };

  const handleVoiceItems = (recognizedItems: any[]) => {
    setCart((prev) => {
      const copy = { ...prev };
      for (const item of recognizedItems) {
        copy[item.dishId] = (copy[item.dishId] || 0) + item.quantity;
      }
      return copy;
    });
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
  };

  // Calculations
  const cartEntries = Object.entries(cart);
  const cartItemCount = cartEntries.reduce((sum, [_, q]) => sum + q, 0);

  const subtotal = cartEntries.reduce((sum, [id, q]) => {
    const dish = MENU_ITEMS.find((d) => d.id === id);
    return sum + (dish?.price || 0) * q;
  }, 0);

  const discountAmount = studentDiscountVerified ? Number(((subtotal * 15) / 100).toFixed(2)) : 0;
  const finalTotal = Number((subtotal - discountAmount).toFixed(2));

  // Dynamic wait time estimation from virtual stoves
  const currentTable = gameState?.tables.find((t) => t.id === tableId || `T-0${t.number}` === tableId);
  const activeMasterOrder = gameState?.orders.find((o) => o.tableId === tableId && !o.isCompleted);

  // Compute live ETA based on busy stove threads
  const stoveLoads = gameState?.stoves.map((s) => s.remainingSeconds + s.queue.reduce((acc, q) => acc + q.cookTimeSeconds, 0)) || [0, 0, 0];
  const shortestStoveWait = Math.min(...stoveLoads);
  const estimatedOrderWaitSeconds = shortestStoveWait + 25; // Base cook time

  const handleSubmitOrder = () => {
    if (cartItemCount === 0) return;

    const payloadItems = Object.entries(cart).map(([dishId, quantity]) => ({
      dishId,
      quantity,
    }));

    emit('submit_guest_order', {
      tableId,
      orderType,
      guestName: guestName || 'Guest',
      email: studentDiscountVerified ? email : undefined,
      items: payloadItems,
    });

    setOrderSubmitted(true);
    setCart({});
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  const filteredMenu = MENU_ITEMS.filter((item) => {
    if (selectedCourseTab === 'All') return true;
    return item.course === selectedCourseTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm tracking-tight text-white">DineEase</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                  {tableId.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Go Dutch Multi-Guest Ordering</p>
            </div>
          </div>

          {/* Dine-in vs Takeaway Toggle */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setOrderType('dine-in')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                orderType === 'dine-in' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dine-In
            </button>
            <button
              onClick={() => setOrderType('takeaway')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                orderType === 'takeaway' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Takeaway
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Dynamic Wait Time Banner (CPU Thread Model) */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Stove CPU Wait Estimator</div>
              <div className="text-sm font-bold text-white">
                ~{Math.ceil(estimatedOrderWaitSeconds / 60)} - {Math.ceil(estimatedOrderWaitSeconds / 60) + 3} mins ETA
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
            3 Stove Threads Live
          </span>
        </div>

        {/* Voice Ordering Assistant */}
        <VoiceOrderAssistant onItemsRecognized={handleVoiceItems} />

        {/* Guest Name & Student Discount */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Your Name (for kitchen ticket)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <div className="relative w-1/2">
              <input
                type="email"
                placeholder="College Email (.edu / .ac.in)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <GraduationCap className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
            </div>
          </div>

          {studentDiscountMsg && (
            <div
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                studentDiscountVerified
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {studentDiscountVerified ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{studentDiscountMsg}</span>
            </div>
          )}
        </div>

        {/* Course Sequence Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {(['All', 'Starter', 'Main', 'Dessert'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedCourseTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCourseTab === tab
                  ? 'bg-red-500 text-white font-semibold'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              {tab === 'All' ? 'Full Menu' : `Course: ${tab}s`}
            </button>
          ))}
        </div>

        {/* Menu Cards */}
        <div className="space-y-2.5">
          {filteredMenu.map((dish) => {
            const qty = cart[dish.id] || 0;
            return (
              <div
                key={dish.id}
                className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        dish.course === 'Starter'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : dish.course === 'Main'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {dish.course}
                    </span>
                    <h3 className="text-xs font-semibold text-white">{dish.name}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{dish.description}</p>
                  <div className="mt-1 text-xs font-bold text-slate-200">${dish.price.toFixed(2)}</div>
                </div>

                {/* Counter buttons */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
                  {qty > 0 && (
                    <>
                      <button
                        onClick={() => removeItemFromCart(dish.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-white">{qty}</span>
                    </>
                  )}
                  <button
                    onClick={() => addItemToCart(dish.id)}
                    className="w-6 h-6 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center font-bold text-xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Table Order Status (if table already ordered) */}
        {activeMasterOrder && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Table {activeMasterOrder.tableNumber} Master Ticket:</span>
              <span className="font-mono text-red-400 font-bold">{activeMasterOrder.guests.length} Friend(s) Paid</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              {(['Starter', 'Main', 'Dessert'] as const).map((course) => {
                const status = activeMasterOrder.courseStatuses[course];
                return (
                  <div
                    key={course}
                    className={`p-2 rounded-lg border ${
                      status === 'plated'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold animate-pulse'
                        : status === 'delivered'
                        ? 'bg-slate-800/40 text-slate-500 border-slate-800'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <div>{course}</div>
                    <div className="uppercase font-semibold mt-0.5 text-[9px]">{status}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Floating Checkout Bottom Bar */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 z-40">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>{cartItemCount} items</span>
                {studentDiscountVerified && <span className="text-emerald-400 font-bold">(-15% Student Discount)</span>}
              </div>
              <div className="text-base font-bold text-white">${finalTotal.toFixed(2)}</div>
            </div>

            <button
              onClick={handleSubmitOrder}
              className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/30 transition-all"
            >
              <span>Pay & Fire Order (Go Dutch)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

