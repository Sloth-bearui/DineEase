import { NextRequest, NextResponse } from 'next/server';
import { getSynchroManager } from '@/lib/stateManager';
import { generateRestockAndPeakPredictions } from '@/lib/geminiService';

export async function GET(req: NextRequest) {
  const manager = getSynchroManager();
  const state = manager.getState();

  const aiResult = await generateRestockAndPeakPredictions(
    state.inventory,
    state.lowStockAlerts,
    state.orders.length
  );

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    aiEngine: aiResult.provider === 'gemini-live' ? 'Google Gemini 2.5 Flash (Live API Key)' : 'SynchroTable Local Intelligence Engine',
    apiKeyMasked: aiResult.apiKeyMasked,
    provider: aiResult.provider,
    surgeForecast: aiResult.surgeForecast,
    expectedVolume: aiResult.expectedVolume,
    recommendations: aiResult.recommendations,
    aiAnalysisText: aiResult.aiAnalysisText,
    restockDecisions: aiResult.restockDecisions,
    inventoryRiskAssessment: state.lowStockAlerts.length > 0 ? state.lowStockAlerts : 'All stock levels currently nominal.',
    hourlyDistribution: state.aiPrediction.peakHourGraph,
  });
}

