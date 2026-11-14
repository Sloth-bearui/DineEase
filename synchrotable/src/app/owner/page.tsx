'use client';

import React, { useState, useEffect } from 'react';
import { useSynchroSocket } from '@/lib/useSynchroSocket';
import { 
  BarChart3, 
  Bot, 
  AlertTriangle, 
  CheckCircle, 
  Sparkles, 
  RefreshCcw, 
  Package, 
  Users,
  Zap,
  TrendingUp,
  Plus
} from 'lucide-react';

export default function OwnerPage() {
  const { gameState, emit } = useSynchroSocket();
  const [aiData, setAiData] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const fetchAiPredictions = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai-predictions');
      const data = await res.json();
      setAiData(data);
    } catch (err) {}
    setLoadingAi(false);
  };

  useEffect(() => {
    fetchAiPredictions();
  }, []);

  const tables = gameState?.tables || [];
  const inventory = gameState?.inventory || {};
  const alerts = gameState?.lowStockAlerts || [];

  const handleRestock = (ingredient: string, amount: number) => {
    emit('restock_inventory', { ingredient, amount });
    setTimeout(fetchAiPredictions, 500);
  };

  const handleSimulateFriends = () => {
    emit('simulate_friends_ordering', { tableId: 'T-04' });
    setTimeout(fetchAiPredictions, 500);
  };

  const handleReset = () => {
    emit('reset_demo_state');
    setTimeout(fetchAiPredictions, 500);
  };

  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-4">
        <div>
          <span className="text-red-500 text-xs font-mono font-bold tracking-wider uppercase">Executive Oversight</span>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Owner Command & AI Operations Hub
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateFriends}
            className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-lg shadow-red-500/20 transition-all flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Simulate 3 Friends (T-04)</span>
          </button>
          <button
            onClick={handleReset}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg transition-all"
          >
            Reset Demo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 font-medium">Table Occupancy</div>
          <div className="text-xl font-bold text-white mt-1">{occupiedCount} / 6 Tables</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{Math.round((occupiedCount / 6) * 100)}% active floor load</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 font-medium">Active Kitchen Tickets</div>
          <div className="text-xl font-bold text-white mt-1">{gameState?.orders.filter((o) => !o.isCompleted).length || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Unified master orders</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 font-medium">Critical Stock Alerts</div>
          <div className={`text-xl font-bold mt-1 ${alerts.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {alerts.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{alerts.length > 0 ? 'Action required' : 'All nominal'}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
          <div className="text-xs text-slate-400 font-medium">AI Restock Copilot</div>
          <div className="text-xl font-bold text-white mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm">{aiData?.provider === 'gemini-live' ? 'Gemini 2.5 Live' : 'Algorithmic'}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Continuous telemetry stream</div>
        </div>
      </div>

      {/* 2D Restaurant Floor Plan & Gemini AI Intelligence Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2D Floor Plan */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              2D Restaurant Floor Plan (Real-Time Synchronized)
            </h2>
            <div className="flex gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Vacant
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Occupied
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {tables.map((t) => {
              const isOcc = t.status === 'occupied';
              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    isOcc
                      ? 'bg-red-500/10 border-red-500/50 text-red-400 font-bold shadow-lg shadow-red-500/10'
                      : 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  <div className="text-base font-bold text-white">T-0{t.number}</div>
                  <div className="text-[10px] uppercase font-mono mt-0.5">{t.status}</div>
                  {isOcc && (
                    <div className="mt-2 text-[11px] text-slate-300 font-normal">
                      👥 {t.guestCount} guests
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gemini AI Intelligence Briefing */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-red-500" />
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Google Gemini AI Restock & Peak Rush Briefing
                </h2>
              </div>
              <button
                onClick={fetchAiPredictions}
                disabled={loadingAi}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCcw className={`w-3 h-3 ${loadingAi ? 'animate-spin' : ''}`} />
                <span>Re-Analyze</span>
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                <div className="text-[10px] text-slate-500 font-mono uppercase">Current Window Surge</div>
                <div className="text-sm font-bold text-white mt-0.5">{aiData?.surgeForecast || 'Analyzing rush window...'}</div>
                <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">{aiData?.aiAnalysisText}</p>
              </div>

              {aiData?.recommendations && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Strategic Staff Directives:</div>
                  {aiData.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                      <span className="text-red-500 font-bold">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/80 flex justify-between">
            <span>Model: {aiData?.aiEngine || 'Gemini 2.5 Flash'}</span>
            <span>Zero-shot reasoning on live BOM</span>
          </div>
        </div>
      </div>

      {/* Raw Material Inventory & 1-Tap Refills */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-red-500" />
          Real-Time Recipe-Mapped Raw Materials (Automatic BOM Depletion)
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(inventory).map(([mat, count]) => {
            const numCount = Number(count);
            const isLow = numCount < 15;
            return (
              <div
                key={mat}
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLow ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-slate-950 border-slate-800 text-slate-200'
                }`}
              >
                <div>
                  <div className="text-[11px] text-slate-400 truncate">{mat}</div>
                  <div className="text-lg font-bold text-white mt-1">{numCount}</div>
                  <div className="text-[10px] text-slate-500">{isLow ? '⚠️ Critical' : 'Healthy'}</div>
                </div>

                <button
                  onClick={() => handleRestock(mat, 20)}
                  className="mt-2 w-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[10px] py-1 rounded font-medium flex items-center justify-center gap-1 transition-all"
                >
                  <Plus className="w-2.5 h-2.5" /> +20
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

