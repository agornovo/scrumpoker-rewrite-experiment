import { useState, useEffect, useCallback, useRef } from 'react';
import { RoomUpdate, AppSession } from '../types';
import { StompService } from '../services/stompService';

const CLIENT_ID_KEY = 'scrumpoker_clientId';
const SESSION_KEY = 'scrumpoker_session';

function generateId(): string {
  return crypto.randomUUID();
}

export interface UseRoomResult {
  roomState: RoomUpdate | null;
  connected: boolean;
  connecting: boolean;
  clientId: string;
  removedFromRoom: boolean;
  joinRoom: (params: {
    roomId: string;
    userName: string;
    isObserver: boolean;
    cardSet: string;
    specialEffects: boolean;
  }) => void;
  castVote: (vote: string | number) => void;
  revealCards: () => void;
  resetRound: () => void;
  setStoryTitle: (title: string) => void;
  setAutoReveal: (autoReveal: boolean) => void;
  removeParticipant: (participantId: string) => void;
  claimHost: () => void;
  leaveRoom: () => void;
}

export function useRoom(stompSvc: StompService): UseRoomResult {
  const [roomState, setRoomState] = useState<RoomUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [removedFromRoom, setRemovedFromRoom] = useState(false);
  const clientIdRef = useRef<string>(
    (() => {
      let id = localStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id = generateId();
        localStorage.setItem(CLIENT_ID_KEY, id);
      }
      return id;
    })()
  );
  const sessionRef = useRef<AppSession | null>(null);

  const doJoin = useCallback((session: AppSession) => {
    setConnecting(true);
    setRemovedFromRoom(false);
    stompSvc.connect(
      '/ws',
      () => {
        setConnected(true);
        setConnecting(false);
        stompSvc.subscribe(`/topic/room/${session.roomId}`, (msg) => {
          const update: RoomUpdate = JSON.parse(msg.body);
          // Detect removal: if the current user is no longer in the users list
          const stillInRoom = update.users.some(u => u.id === session.clientId);
          if (!stillInRoom) {
            sessionStorage.removeItem(SESSION_KEY);
            setRemovedFromRoom(true);
            setRoomState(null);
            setConnected(false);
            stompSvc.disconnect();
          } else {
            setRoomState(update);
          }
        });
        stompSvc.subscribe('/user/queue/events', (msg) => {
          const event = JSON.parse(msg.body) as { type: string };
          if (event.type === 'removed-from-room') {
            sessionStorage.removeItem(SESSION_KEY);
            setRemovedFromRoom(true);
            setRoomState(null);
            setConnected(false);
            stompSvc.disconnect();
          }
        });
        stompSvc.publish('/app/room/join', {
          roomId: session.roomId,
          userName: session.userName,
          isObserver: session.isObserver,
          cardSet: session.cardSet,
          specialEffects: session.specialEffects,
          clientId: session.clientId,
        });
      },
      () => {
        setConnected(false);
        setConnecting(false);
      }
    );
  }, [stompSvc]);

  useEffect(() => {
    // Run once on mount to attempt reconnection from a saved session.
    // doJoin is stable (useCallback with [stompSvc]), so including it is safe.
    const savedSession = sessionStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const session: AppSession = JSON.parse(savedSession);
        sessionRef.current = session;
        doJoin(session);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, [doJoin]);

  const joinRoom = useCallback((params: {
    roomId: string;
    userName: string;
    isObserver: boolean;
    cardSet: string;
    specialEffects: boolean;
  }) => {
    const session: AppSession = {
      ...params,
      clientId: clientIdRef.current,
    };
    sessionRef.current = session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    doJoin(session);
  }, [doJoin]);

  const castVote = useCallback((vote: string | number) => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/vote', { roomId: sessionRef.current.roomId, vote });
  }, [stompSvc]);

  const revealCards = useCallback(() => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/reveal', { roomId: sessionRef.current.roomId });
  }, [stompSvc]);

  const resetRound = useCallback(() => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/reset', { roomId: sessionRef.current.roomId });
  }, [stompSvc]);

  const setStoryTitle = useCallback((storyTitle: string) => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/story', { roomId: sessionRef.current.roomId, storyTitle });
  }, [stompSvc]);

  const setAutoReveal = useCallback((autoReveal: boolean) => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/auto-reveal', { roomId: sessionRef.current.roomId, autoReveal });
  }, [stompSvc]);

  const removeParticipant = useCallback((participantId: string) => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/remove', { roomId: sessionRef.current.roomId, participantId });
  }, [stompSvc]);

  const claimHost = useCallback(() => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/claim-host', { roomId: sessionRef.current.roomId });
  }, [stompSvc]);

  const leaveRoom = useCallback(() => {
    if (!sessionRef.current) return;
    stompSvc.publish('/app/room/leave', { roomId: sessionRef.current.roomId });
    sessionStorage.removeItem(SESSION_KEY);
    sessionRef.current = null;
    setRoomState(null);
    setConnected(false);
    stompSvc.disconnect();
  }, [stompSvc]);

  return {
    roomState,
    connected,
    connecting,
    clientId: clientIdRef.current,
    removedFromRoom,
    joinRoom,
    castVote,
    revealCards,
    resetRound,
    setStoryTitle,
    setAutoReveal,
    removeParticipant,
    claimHost,
    leaveRoom,
  };
}
