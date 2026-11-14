'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

interface VoiceOrderAssistantProps {
  onItemsRecognized: (items: { dishId: string; dishName: string; course: string; quantity: number; price: number }[]) => void;
  accentColor?: string;
}

export function VoiceOrderAssistant({ onItemsRecognized, accentColor = '#ef4444' }: VoiceOrderAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchedSummary, setMatchedSummary] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setFeedback('Listening... Say e.g. "Two smash cheeseburgers and one flat white coffee"');
        };

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            setTranscript(finalTranscript);
            setInterimText('');
            processSpokenText(finalTranscript);
          } else {
            setInterimText(currentInterim);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('[WebSpeech Error]', event.error);
          setIsListening(false);
          setFeedback(`Microphone error: ${event.error}. Click mic to retry.`);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setFeedback('Web Speech API not supported in this browser. Please use Chrome, Safari or Edge.');
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setInterimText('');
      setMatchedSummary(null);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Recognition already started or restarting');
      }
    }
  };

  const processSpokenText = async (spokenText: string) => {
    setIsProcessing(true);
    setFeedback('Analyzing order with Voice NLP parser...');
    try {
      const res = await fetch('/api/voice-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: spokenText }),
      });
      const data = await res.json();
      setIsProcessing(false);

      if (data.success && data.matchedItems.length > 0) {
        setMatchedSummary(data.explanation);
        setFeedback('✅ Items added to your cart automatically!');
        onItemsRecognized(data.matchedItems);
      } else {
        setFeedback(data.explanation || 'No menu items recognized. Try again.');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setFeedback('Error processing speech.');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg text-slate-100">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
              Zero-UI Voice Ordering
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">Web Speech API</span>
            </h4>
            <p className="text-xs text-slate-400">Speak naturally to order dishes hands-free</p>
          </div>
        </div>

        <button
          onClick={toggleListening}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
            isListening
              ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-3.5 h-3.5" /> Stop
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-red-400" /> Tap to Speak
            </>
          )}
        </button>
      </div>

      {/* Voice Status & Live Transcription */}
      <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800/80 text-xs min-h-[50px] flex flex-col justify-center">
        {isListening && (
          <div className="flex items-center gap-2 text-red-400 mb-1 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            Listening to your microphone...
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Parsing speech with menu NLP...
          </div>
        )}

        {(transcript || interimText) ? (
          <p className="text-slate-200 italic font-mono">
            &ldquo;{transcript || interimText}&rdquo;
          </p>
        ) : (
          <p className="text-slate-500">
            {feedback || 'Say: "I want two smash cheeseburgers and one truffle fries"'}
          </p>
        )}

        {matchedSummary && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 text-emerald-400 flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{matchedSummary}</span>
          </div>
        )}
      </div>
    </div>
  );
}

