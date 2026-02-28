import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

// Mock the stompService
vi.mock('./services/stompService', () => ({
  stompService: { connect: vi.fn(), subscribe: vi.fn(), publish: vi.fn(), disconnect: vi.fn() },
}));

// Mock useRoom to return controllable state
const mockUseRoom = vi.fn();
vi.mock('./hooks/useRoom', () => ({
  useRoom: (...args: unknown[]) => mockUseRoom(...args),
}));

const defaultRoomHook = {
  roomState: null,
  connected: false,
  connecting: false,
  clientId: 'test-client-id',
  removedFromRoom: false,
  joinRoom: vi.fn(),
  castVote: vi.fn(),
  revealCards: vi.fn(),
  resetRound: vi.fn(),
  setStoryTitle: vi.fn(),
  setAutoReveal: vi.fn(),
  removeParticipant: vi.fn(),
  claimHost: vi.fn(),
  leaveRoom: vi.fn(),
};

beforeEach(() => {
  mockUseRoom.mockReturnValue({ ...defaultRoomHook });
  localStorage.clear();
});

describe('App', () => {
  it('renders welcome screen when no room state', () => {
    render(<App />);
    expect(screen.getByText('🃏 Scrum Poker')).toBeInTheDocument();
  });

  it('renders voting room when room state exists', () => {
    mockUseRoom.mockReturnValue({
      ...defaultRoomHook,
      roomState: {
        roomId: 'room-1',
        users: [{ id: 'test-client-id', name: 'Alice', vote: null, isObserver: false }],
        revealed: false,
        stats: null,
        creatorId: 'test-client-id',
        cardSet: 'standard',
        storyTitle: '',
        autoReveal: false,
        specialEffects: true,
      },
    });
    render(<App />);
    expect(screen.getByText('room-1')).toBeInTheDocument();
  });

  it('applies theme from localStorage', () => {
    localStorage.setItem('scrumpoker_theme', 'dark');
    render(<App />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
