import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CardSelection } from './CardSelection';

const mockVote = vi.fn();
beforeEach(() => mockVote.mockClear());

describe('CardSelection', () => {
  it('renders standard deck cards', () => {
    render(<CardSelection cardSet="standard" selectedVote={null} revealed={false} onVote={mockVote} />);
    expect(screen.getByLabelText('Vote 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Vote 100')).toBeInTheDocument();
    expect(screen.getByLabelText('Vote ?')).toBeInTheDocument();
  });

  it('renders fibonacci deck with ½', () => {
    render(<CardSelection cardSet="fibonacci" selectedVote={null} revealed={false} onVote={mockVote} />);
    expect(screen.getByLabelText('Vote ½')).toBeInTheDocument();
  });

  it('calls onVote when card clicked', () => {
    render(<CardSelection cardSet="standard" selectedVote={null} revealed={false} onVote={mockVote} />);
    fireEvent.click(screen.getByLabelText('Vote 5'));
    expect(mockVote).toHaveBeenCalledWith(5);
  });

  it('marks selected card', () => {
    render(<CardSelection cardSet="standard" selectedVote={5} revealed={false} onVote={mockVote} />);
    const card = screen.getByLabelText('Vote 5');
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables all cards when revealed', () => {
    render(<CardSelection cardSet="standard" selectedVote={null} revealed={true} onVote={mockVote} />);
    const cards = screen.getAllByRole('button');
    cards.forEach(card => expect(card).toBeDisabled());
  });

  it('does not call onVote when revealed', () => {
    render(<CardSelection cardSet="standard" selectedVote={null} revealed={true} onVote={mockVote} />);
    const card = screen.getAllByRole('button')[0]!;
    fireEvent.click(card);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it('renders tshirt deck', () => {
    render(<CardSelection cardSet="tshirt" selectedVote={null} revealed={false} onVote={mockVote} />);
    expect(screen.getByLabelText('Vote XS')).toBeInTheDocument();
    expect(screen.getByLabelText('Vote XXL')).toBeInTheDocument();
  });

  it('renders powers2 deck', () => {
    render(<CardSelection cardSet="powers2" selectedVote={null} revealed={false} onVote={mockVote} />);
    expect(screen.getByLabelText('Vote 64')).toBeInTheDocument();
  });

  it('falls back to standard deck for unknown cardSet', () => {
    render(<CardSelection cardSet="unknown" selectedVote={null} revealed={false} onVote={mockVote} />);
    expect(screen.getByLabelText('Vote 1')).toBeInTheDocument();
  });

  it('shows ☕ in fibonacci deck', () => {
    render(<CardSelection cardSet="fibonacci" selectedVote={null} revealed={false} onVote={mockVote} />);
    expect(screen.getByLabelText('Vote ☕')).toBeInTheDocument();
  });
});
