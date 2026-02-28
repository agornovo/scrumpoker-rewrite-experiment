import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VotingRoom } from './VotingRoom';
import type { RoomUpdate } from '../../types';

const mockActions = {
  castVote: vi.fn(),
  revealCards: vi.fn(),
  resetRound: vi.fn(),
  setStoryTitle: vi.fn(),
  setAutoReveal: vi.fn(),
  removeParticipant: vi.fn(),
  claimHost: vi.fn(),
  leaveRoom: vi.fn(),
};

beforeEach(() => Object.values(mockActions).forEach(fn => fn.mockClear()));

const baseRoomState: RoomUpdate = {
  roomId: 'room-1',
  users: [
    { id: 'client-1', name: 'Alice', vote: null, isObserver: false },
    { id: 'client-2', name: 'Bob', vote: 5, isObserver: false },
  ],
  revealed: false,
  stats: null,
  creatorId: 'client-1',
  cardSet: 'standard',
  storyTitle: 'Test Story',
  autoReveal: false,
  specialEffects: true,
};

const defaultProps = {
  roomState: baseRoomState,
  clientId: 'client-1',
  theme: 'light',
  palette: 'ocean',
  onThemeToggle: vi.fn(),
  onPaletteChange: vi.fn(),
  actions: mockActions,
};

describe('VotingRoom', () => {
  it('renders room ID', () => {
    render(<VotingRoom {...defaultProps} />);
    expect(screen.getByText('room-1')).toBeInTheDocument();
  });

  it('shows reveal button for host', () => {
    render(<VotingRoom {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Reveal Cards' })).toBeInTheDocument();
  });

  it('does not show reveal button for non-host', () => {
    render(<VotingRoom {...defaultProps} clientId="client-2" />);
    expect(screen.queryByRole('button', { name: 'Reveal Cards' })).not.toBeInTheDocument();
  });

  it('calls revealCards when reveal button clicked', () => {
    render(<VotingRoom {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Cards' }));
    expect(mockActions.revealCards).toHaveBeenCalled();
  });

  it('calls resetRound when reset button clicked', () => {
    render(<VotingRoom {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Round' }));
    expect(mockActions.resetRound).toHaveBeenCalled();
  });

  it('calls leaveRoom when leave button clicked', () => {
    render(<VotingRoom {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(mockActions.leaveRoom).toHaveBeenCalled();
  });

  it('shows story title input for host', () => {
    render(<VotingRoom {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: 'Story title' })).toBeInTheDocument();
  });

  it('shows story display (not input) for non-host', () => {
    render(<VotingRoom {...defaultProps} clientId="client-2" />);
    expect(screen.queryByRole('textbox', { name: 'Story title' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Story title')).toBeInTheDocument();
  });

  it('shows statistics when revealed and stats present', () => {
    render(<VotingRoom {...defaultProps} roomState={{
      ...baseRoomState,
      revealed: true,
      stats: { average: 5, median: 5, min: 3, max: 8 },
    }} />);
    expect(screen.getByRole('region', { name: 'Voting statistics' })).toBeInTheDocument();
  });

  it('hides reveal button when revealed', () => {
    render(<VotingRoom {...defaultProps} roomState={{ ...baseRoomState, revealed: true }} />);
    expect(screen.queryByRole('button', { name: 'Reveal Cards' })).not.toBeInTheDocument();
  });

  it('hides card selection for observer', () => {
    render(<VotingRoom {...defaultProps} roomState={{
      ...baseRoomState,
      users: [{ id: 'client-1', name: 'Alice', vote: null, isObserver: true }],
    }} />);
    expect(screen.queryByText('Your Vote')).not.toBeInTheDocument();
  });

  it('calls setAutoReveal when auto-reveal toggled', () => {
    render(<VotingRoom {...defaultProps} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /auto-reveal/i }));
    expect(mockActions.setAutoReveal).toHaveBeenCalledWith(true);
  });

  it('shows become-host banner when host is absent and not current host', () => {
    render(<VotingRoom {...defaultProps} clientId="client-2" roomState={{
      ...baseRoomState,
      creatorId: 'absent-host',
      users: [{ id: 'client-2', name: 'Bob', vote: null, isObserver: false }],
    }} />);
    expect(screen.getByText(/become the host/i)).toBeInTheDocument();
  });

  it('calls claimHost when become host clicked', () => {
    render(<VotingRoom {...defaultProps} clientId="client-2" roomState={{
      ...baseRoomState,
      creatorId: 'absent-host',
      users: [{ id: 'client-2', name: 'Bob', vote: null, isObserver: false }],
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Become Host' }));
    expect(mockActions.claimHost).toHaveBeenCalled();
  });

  it('toggles theme when theme button clicked', () => {
    const onThemeToggle = vi.fn();
    render(<VotingRoom {...defaultProps} onThemeToggle={onThemeToggle} />);
    fireEvent.click(screen.getByLabelText('Toggle theme'));
    expect(onThemeToggle).toHaveBeenCalled();
  });

  it('calls setStoryTitle when story input blurred', async () => {
    render(<VotingRoom {...defaultProps} />);
    const input = screen.getByRole('textbox', { name: 'Story title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'New Story');
    fireEvent.blur(input);
    expect(mockActions.setStoryTitle).toHaveBeenCalledWith('New Story');
  });
});
