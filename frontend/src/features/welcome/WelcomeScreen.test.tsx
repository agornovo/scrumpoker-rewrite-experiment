import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WelcomeScreen } from './WelcomeScreen';

const mockJoin = vi.fn();

beforeEach(() => { mockJoin.mockClear(); });

describe('WelcomeScreen', () => {
  it('renders all form elements', () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Room ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Join as observer')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable special effects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Room' })).toBeInTheDocument();
  });

  it('shows error if name is empty', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your name');
    expect(mockJoin).not.toHaveBeenCalled();
  });

  it('shows error if room ID is empty', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    await userEvent.type(screen.getByLabelText('Your Name'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a room ID');
  });

  it('calls onJoin with correct params', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    await userEvent.type(screen.getByLabelText('Your Name'), 'Alice');
    await userEvent.type(screen.getByLabelText('Room ID'), 'room-42');
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(mockJoin).toHaveBeenCalledWith({
      roomId: 'room-42',
      userName: 'Alice',
      isObserver: false,
      cardSet: 'standard',
      specialEffects: true,
    });
  });

  it('hides card set when observer is checked', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    expect(screen.getByLabelText('Card Set')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Join as observer'));
    expect(screen.queryByLabelText('Card Set')).not.toBeInTheDocument();
  });

  it('shows connecting state on button', () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={true} removedFromRoom={false} />);
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
  });

  it('shows removed from room notice', () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={true} />);
    expect(screen.getByRole('alert')).toHaveTextContent('You were removed from the room');
  });

  it('pre-fills room ID from initialRoomId', () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} initialRoomId="pre-filled-room" />);
    expect(screen.getByLabelText('Room ID')).toHaveValue('pre-filled-room');
  });

  it('toggles help accordion', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    const btn = screen.getByRole('button', { name: /How to use/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Creating a room/i)).toBeInTheDocument();
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('calls onJoin with isObserver true when checked', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    await userEvent.type(screen.getByLabelText('Your Name'), 'Bob');
    await userEvent.type(screen.getByLabelText('Room ID'), 'obs-room');
    await userEvent.click(screen.getByLabelText('Join as observer'));
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(mockJoin).toHaveBeenCalledWith(expect.objectContaining({ isObserver: true }));
  });

  it('trims whitespace from name and room', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    await userEvent.type(screen.getByLabelText('Your Name'), '  Alice  ');
    await userEvent.type(screen.getByLabelText('Room ID'), '  room-1  ');
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(mockJoin).toHaveBeenCalledWith(expect.objectContaining({ userName: 'Alice', roomId: 'room-1' }));
  });

  it('can select fibonacci card set', async () => {
    render(<WelcomeScreen onJoin={mockJoin} connecting={false} removedFromRoom={false} />);
    await userEvent.selectOptions(screen.getByLabelText('Card Set'), 'fibonacci');
    await userEvent.type(screen.getByLabelText('Your Name'), 'Alice');
    await userEvent.type(screen.getByLabelText('Room ID'), 'room-1');
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(mockJoin).toHaveBeenCalledWith(expect.objectContaining({ cardSet: 'fibonacci' }));
  });
});
