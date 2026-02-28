import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRoom } from './useRoom';
import type { StompService } from '../services/stompService';
import type { IMessage } from '@stomp/stompjs';

const mockStompService = {
  connect: vi.fn(),
  subscribe: vi.fn(),
  publish: vi.fn(),
  disconnect: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

function getConnectCallback() {
  const calls = (mockStompService.connect as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1]?.[1] as () => void;
}

function getSubscribeCallback(index = 0) {
  const calls = (mockStompService.subscribe as ReturnType<typeof vi.fn>).mock.calls;
  return calls[index]?.[1] as (msg: IMessage) => void;
}

function makeMsg(body: object): IMessage {
  return { body: JSON.stringify(body) } as IMessage;
}

describe('useRoom', () => {
  it('initializes with null roomState', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    expect(result.current.roomState).toBeNull();
    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
  });

  it('generates and saves clientId to localStorage', () => {
    renderHook(() => useRoom(mockStompService as unknown as StompService));
    expect(localStorage.getItem('scrumpoker_clientId')).toBeTruthy();
  });

  it('reuses existing clientId from localStorage', () => {
    localStorage.setItem('scrumpoker_clientId', 'existing-id');
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    expect(result.current.clientId).toBe('existing-id');
  });

  it('sets connecting to true when joinRoom is called', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    expect(result.current.connecting).toBe(true);
    expect(mockStompService.connect).toHaveBeenCalled();
  });

  it('sets connected to true after connect callback', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    expect(result.current.connected).toBe(true);
    expect(result.current.connecting).toBe(false);
  });

  it('subscribes to room topic and user queue after connect', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    expect(mockStompService.subscribe).toHaveBeenCalledWith('/topic/room/r1', expect.any(Function));
    expect(mockStompService.subscribe).toHaveBeenCalledWith('/user/queue/events', expect.any(Function));
  });

  it('updates roomState when room message received', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    // Include the current user in the update so removal detection does not trigger
    const clientId = result.current.clientId;
    const roomUpdate = { roomId: 'r1', users: [{ id: clientId, name: 'Alice', vote: null, isObserver: false }], revealed: false, stats: null, creatorId: clientId, cardSet: 'standard', storyTitle: '', autoReveal: false, specialEffects: true };
    act(() => { getSubscribeCallback(0)(makeMsg(roomUpdate)); });
    expect(result.current.roomState).toEqual(roomUpdate);
  });

  it('saves session to sessionStorage on joinRoom', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    const session = sessionStorage.getItem('scrumpoker_session');
    expect(session).toBeTruthy();
    expect(JSON.parse(session!).roomId).toBe('r1');
  });

  it('clears roomState and disconnects when removed-from-room event received', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { getSubscribeCallback(1)(makeMsg({ type: 'removed-from-room' })); });
    expect(result.current.roomState).toBeNull();
    expect(result.current.removedFromRoom).toBe(true);
    expect(mockStompService.disconnect).toHaveBeenCalled();
  });

  it('castVote publishes to /app/room/vote', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.castVote(5); });
    expect(mockStompService.publish).toHaveBeenCalledWith('/app/room/vote', expect.objectContaining({ vote: 5, roomId: 'r1' }));
  });

  it('revealCards publishes to /app/room/reveal', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.revealCards(); });
    expect(mockStompService.publish).toHaveBeenCalledWith('/app/room/reveal', { roomId: 'r1' });
  });

  it('resetRound publishes to /app/room/reset', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.resetRound(); });
    expect(mockStompService.publish).toHaveBeenCalledWith('/app/room/reset', { roomId: 'r1' });
  });

  it('setStoryTitle publishes to /app/room/story', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.setStoryTitle('My Story'); });
    expect(mockStompService.publish).toHaveBeenCalledWith('/app/room/story', { roomId: 'r1', storyTitle: 'My Story' });
  });

  it('setAutoReveal publishes to /app/room/auto-reveal', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.setAutoReveal(true); });
    expect(mockStompService.publish).toHaveBeenCalledWith('/app/room/auto-reveal', { roomId: 'r1', autoReveal: true });
  });

  it('removeParticipant publishes to /app/room/remove', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.removeParticipant('u2'); });
    expect(mockStompService.publish).toHaveBeenCalledWith('/app/room/remove', { roomId: 'r1', participantId: 'u2' });
  });

  it('claimHost publishes to /app/room/claim-host', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.claimHost(); });
    expect(mockStompService.publish).toHaveBeenCalledWith('/app/room/claim-host', { roomId: 'r1' });
  });

  it('leaveRoom clears session and disconnects', () => {
    const { result } = renderHook(() => useRoom(mockStompService as unknown as StompService));
    act(() => {
      result.current.joinRoom({ roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true });
    });
    act(() => { getConnectCallback()(); });
    act(() => { result.current.leaveRoom(); });
    expect(mockStompService.disconnect).toHaveBeenCalled();
    expect(result.current.roomState).toBeNull();
    expect(sessionStorage.getItem('scrumpoker_session')).toBeNull();
  });

  it('auto-reconnects from sessionStorage on mount', () => {
    sessionStorage.setItem('scrumpoker_session', JSON.stringify({
      roomId: 'r1', userName: 'Alice', isObserver: false, cardSet: 'standard', specialEffects: true, clientId: 'saved-id',
    }));
    renderHook(() => useRoom(mockStompService as unknown as StompService));
    expect(mockStompService.connect).toHaveBeenCalled();
  });
});
