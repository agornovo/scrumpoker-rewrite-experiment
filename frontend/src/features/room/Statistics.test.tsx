import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Statistics } from './Statistics';

describe('Statistics', () => {
  it('renders nothing when stats is null', () => {
    const { container } = render(<Statistics stats={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders stats when provided', () => {
    render(<Statistics stats={{ average: 4.5, median: 5, min: 1, max: 8 }} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('shows stat labels', () => {
    render(<Statistics stats={{ average: 3, median: 3, min: 2, max: 5 }} />);
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('Median')).toBeInTheDocument();
    expect(screen.getByText('Min')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
  });

  it('formats average with one decimal place', () => {
    render(<Statistics stats={{ average: 4.666, median: 5, min: 3, max: 8 }} />);
    expect(screen.getByText('4.7')).toBeInTheDocument();
  });

  it('has region role for accessibility', () => {
    render(<Statistics stats={{ average: 3, median: 3, min: 2, max: 5 }} />);
    expect(screen.getByRole('region', { name: 'Voting statistics' })).toBeInTheDocument();
  });
});
