import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RoundHistory } from './RoundHistory';
import type { RoomUpdate } from '../../types';

const baseRoomState: RoomUpdate = {
  roomId: 'room-1',
  users: [],
  revealed: false,
  stats: null,
  creatorId: 'u1',
  cardSet: 'standard',
  storyTitle: '',
  autoReveal: false,
  specialEffects: true,
};

describe('RoundHistory', () => {
  it('renders nothing when no history', () => {
    const { container } = render(<RoundHistory roomState={baseRoomState} />);
    expect(container.firstChild).toBeNull();
  });

  it('records history when cards are revealed', () => {
    const { rerender } = render(<RoundHistory roomState={baseRoomState} />);
    rerender(<RoundHistory roomState={{
      ...baseRoomState,
      revealed: true,
      storyTitle: 'User story 1',
      stats: { average: 5, median: 5, min: 3, max: 8 },
    }} />);
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('User story 1')).toBeInTheDocument();
    expect(screen.getByText('5.0')).toBeInTheDocument();
  });

  it('does not add duplicate history on re-render with same state', () => {
    const revealedState: RoomUpdate = {
      ...baseRoomState,
      revealed: true,
      stats: { average: 5, median: 5, min: 3, max: 8 },
    };
    const { rerender } = render(<RoundHistory roomState={revealedState} />);
    rerender(<RoundHistory roomState={revealedState} />);
    expect(screen.getAllByText(/Round/).length).toBe(1);
  });

  it('records multiple rounds', () => {
    const { rerender } = render(<RoundHistory roomState={baseRoomState} />);
    rerender(<RoundHistory roomState={{
      ...baseRoomState,
      revealed: true,
      stats: { average: 3, median: 3, min: 1, max: 5 },
    }} />);
    rerender(<RoundHistory roomState={baseRoomState} />);
    rerender(<RoundHistory roomState={{
      ...baseRoomState,
      revealed: true,
      stats: { average: 8, median: 8, min: 5, max: 13 },
    }} />);
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
  });
});
