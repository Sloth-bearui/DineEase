'use client';

import React from 'react';
import { useSynchroSocket } from '@/lib/useSynchroSocket';
import { Bell, CheckCheck, Sparkles, RefreshCw, AlertTriangle, UtensilsCrossed } from 'lucide-react';

export default function WaiterPage() {
  const { gameState, emit } = useSynchroSocket();

  const notifications = gameState?.waiterNotifications || [];
  const tables = gameState?.tables || [];

  const handleClearTable = (tableId: string) => {
    emit('clear_table', { tableId });
  };

  const handleMarkDelivered = (orderId: string, course: any) => {
    emit('update_course_status', { orderId, course, status: 'delivered' });
  };

  const platedNotifications = notifications.filter((n) => n.type === 'course_plated');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div>
          <span className="text-red-500 text-xs font-mono font-bold tracking-wider uppercase">Staff Handheld Terminal</span>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Waiter Command Space
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-400 font-mono">Live WebSocket</span>
        </div>
      </div>

      {/* Urgent Course Delivery Flash Alerts */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-red-500" />
          Urgent: Plated Courses Ready for Delivery
        </h2>

        {platedNotifications.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 text-center text-xs text-slate-500">
            No courses waiting on pass. Kitchen is cooking smoothly.
          </div>
        ) : (
          platedNotifications.slice(0, 4).map((notif) => (
            <div
              key={notif.id}
              className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-red-500/10 animate-pulse"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-500 text-white font-bold text-xs px-2 py-0.5 rounded">
                    TABLE {notif.tableNumber}
                  </span>
                  <span className="text-xs font-bold text-white uppercase">{notif.course} PLATED</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{notif.message}</p>
              </div>

              <button
                onClick={() => {
                  const order = gameState?.orders.find((o) => o.tableId === notif.tableId && !o.isCompleted);
                  if (order && notif.course) {
                    handleMarkDelivered(order.id, notif.course);
                  }
                  emit('dismiss_notification', { notificationId: notif.id });
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-3 py-2 rounded-lg transition-all"
              >
                Mark Delivered
              </button>
            </div>
          ))
        )}
      </div>

      {/* 2D Table Clearance Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Table Status & Instant Clearance Override
          </h2>
          <span className="text-[11px] text-slate-500">Tap table to clear & reset to green</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tables.map((table) => {
            const isOccupied = table.status === 'occupied';
            const masterOrder = gameState?.orders.find((o) => o.tableId === table.id && !o.isCompleted);

            return (
              <div
                key={table.id}
                className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                  isOccupied
                    ? 'bg-red-500/10 border-red-500/40 text-slate-200'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">Table {table.number}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isOccupied ? 'bg-red-500 text-white' : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {table.status}
                    </span>
                  </div>

                  {isOccupied && (
                    <div className="mt-2 text-xs text-slate-300 space-y-0.5">
                      <div>Guests: <strong>{table.guestCount}</strong></div>
                      {masterOrder && (
                        <div className="text-[11px] text-slate-400">
                          Paid: <strong>{masterOrder.guests.length} friends</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isOccupied && (
                  <button
                    onClick={() => handleClearTable(table.id)}
                    className="mt-3 w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Clear Table</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Waiter Activity</h3>
        <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-xs text-slate-400">
          {notifications.map((n) => (
            <div key={n.id} className="flex gap-2">
              <span className="text-slate-600">[{new Date(n.timestamp).toLocaleTimeString()}]</span>
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

