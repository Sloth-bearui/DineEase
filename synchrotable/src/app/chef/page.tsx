'use client';

import React from 'react';
import { useSynchroSocket } from '@/lib/useSynchroSocket';
import { Flame, Clock, Cpu, CheckCircle, FastForward } from 'lucide-react';
import { CourseType } from '@/lib/types';

export default function ChefPage() {
  const { gameState, emit } = useSynchroSocket();

  const stoves = gameState?.stoves || [];
  const orders = gameState?.orders || [];
  const activeOrders = orders.filter((o) => !o.isCompleted);

  const handleAdvanceTimers = () => {
    emit('advance_cook_timers', { seconds: 10 });
  };

  const handleManualPlate = (orderId: string, course: CourseType) => {
    emit('update_course_status', { orderId, course, status: 'plated' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div>
          <span className="text-red-500 text-xs font-mono font-bold tracking-wider uppercase">Kitchen Display System (KDS)</span>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Chef Command & Virtual Stove Threads
          </h1>
        </div>

        <button
          onClick={handleAdvanceTimers}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-lg shadow-red-500/20 transition-all"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Advance Cook Clock (+10s)</span>
        </button>
      </div>

      {/* 3 Virtual Stove CPU Threads */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-red-500" />
            Virtual Stove Execution Cores (Least-Busy Dispatcher)
          </h2>
          <span className="text-xs text-slate-500 font-mono">1s Hardware Clock Active</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stoves.map((stove) => {
            const active = stove.activeDish;
            const progress = active
              ? Math.round(((stove.totalDurationSeconds - stove.remainingSeconds) / stove.totalDurationSeconds) * 100)
              : 0;

            return (
              <div
                key={stove.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="font-mono text-xs font-bold text-slate-300">{stove.name}</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                        active ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {active ? 'FIRING' : 'IDLE'}
                    </span>
                  </div>

                  {active ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">{active.dishName}</div>
                          <div className="text-xs text-slate-400">
                            Guest: <strong className="text-slate-200">{active.guestName}</strong>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-red-400">{stove.remainingSeconds}s left</span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-red-500 h-full transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 text-center text-xs text-slate-600 font-mono">Core idle. Ready for next order.</div>
                  )}
                </div>

                {/* Queue depth */}
                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Queued tasks:</span>
                  <span className="font-mono font-bold text-white">{stove.queue.length} dish(es)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified Table Master Tickets */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Unified Table Master Tickets (Go Dutch Merged)
        </h2>

        {activeOrders.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-6 text-center text-xs text-slate-500">
            No active kitchen tickets. Waiting for guests to scan table QR.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((order) => (
              <div key={order.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-red-500 text-white font-bold text-xs px-2 py-0.5 rounded">
                      TABLE {order.tableNumber}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{order.id}</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-bold">{order.guests.length} Friend(s) Paid</span>
                </div>

                {/* Course Sequences */}
                <div className="space-y-2">
                  {(['Starter', 'Main', 'Dessert'] as const).map((course) => {
                    const status = order.courseStatuses[course];
                    const dishesOfCourse = order.aggregatedDishes.filter((d) => d.course === course);
                    if (dishesOfCourse.length === 0) return null;

                    return (
                      <div
                        key={course}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white uppercase">{course}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                                status === 'plated'
                                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                                  : status === 'delivered'
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {dishesOfCourse.map((d) => `${d.dishName} (${d.guestName})`).join(', ')}
                          </div>
                        </div>

                        {status !== 'plated' && status !== 'delivered' && (
                          <button
                            onClick={() => handleManualPlate(order.id, course)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded font-medium transition-all"
                          >
                            Mark Plated
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

