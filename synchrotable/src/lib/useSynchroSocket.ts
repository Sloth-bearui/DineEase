'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { SynchroGameState } from '@/lib/types';

let socketInstance: Socket | null = null;

export function useSynchroSocket() {
  const [gameState, setGameState] = useState<SynchroGameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
    }

    socketRef.current = socketInstance;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onStateUpdate = (state: SynchroGameState) => setGameState(state);

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('synchro_state_updated', onStateUpdate);

    // Initial check
    if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      // Don't disconnect singleton so components don't re-handshake on mount
    };
  }, []);

  const emit = (event: string, data?: any) => {
    if (socketInstance) {
      socketInstance.emit(event, data);
    }
  };

  return {
    socket: socketInstance,
    gameState,
    isConnected,
    emit,
  };
}

