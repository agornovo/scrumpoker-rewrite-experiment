import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticipantList } from './ParticipantList';
import type { User } from '../../types';

const mockRemove = vi.fn();
beforeEach(() => mockRemove.mockClear());

const users: User[] = [
  { id: 'u1', name: 'Alice', vote: 5, isObserver: false },
  { id: 'u2', name: 'Bob', vote: null, isObserver: false },
  { id: 'u3', name: 'Charlie', vote: '?', isObserver: true },
];

describe('ParticipantList', () => {
  it('renders all participants', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={false} onRemove={mockRemove} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows (you) suffix for current user', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={false} onRemove={mockRemove} />);
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('shows voted checkmark for voted user (not revealed)', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={false} onRemove={mockRemove} />);
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows vote value when revealed', () => {
    render(<ParticipantList users={users} revealed={true} currentUserId="u1" isHost={false} onRemove={mockRemove} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows OBS badge for observers', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={false} onRemove={mockRemove} />);
    expect(screen.getByText('OBS')).toBeInTheDocument();
  });

  it('shows remove buttons for host (not for self)', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={true} onRemove={mockRemove} />);
    const removeBtns = screen.getAllByRole('button');
    expect(removeBtns.length).toBe(2); // Bob and Charlie, not Alice (self)
  });

  it('calls onRemove when remove button clicked', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={true} onRemove={mockRemove} />);
    fireEvent.click(screen.getByLabelText('Remove Bob'));
    expect(mockRemove).toHaveBeenCalledWith('u2');
  });

  it('does not show remove buttons for non-host', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={false} onRemove={mockRemove} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows participant count', () => {
    render(<ParticipantList users={users} revealed={false} currentUserId="u1" isHost={false} onRemove={mockRemove} />);
    expect(screen.getByText('Participants (3)')).toBeInTheDocument();
  });
});
