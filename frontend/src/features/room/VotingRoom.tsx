import { useState, useCallback } from 'react';
import type { RoomUpdate } from '../../types';
import type { UseRoomResult } from '../../hooks/useRoom';
import { ParticipantList } from './ParticipantList';
import { CardSelection } from './CardSelection';
import { Statistics } from './Statistics';
import { RoundHistory } from './RoundHistory';

const PALETTES = [
  { id: 'ocean', color: '#0ea5e9', label: 'Ocean' },
  { id: 'forest', color: '#22c55e', label: 'Forest' },
  { id: 'sunset', color: '#f97316', label: 'Sunset' },
  { id: 'violet', color: '#8b5cf6', label: 'Violet' },
  { id: 'rose', color: '#f43f5e', label: 'Rose' },
  { id: 'teal', color: '#14b8a6', label: 'Teal' },
  { id: 'crimson', color: '#dc2626', label: 'Crimson' },
  { id: 'slate', color: '#64748b', label: 'Slate' },
];

interface VotingRoomProps {
  roomState: RoomUpdate;
  clientId: string;
  theme: string;
  palette: string;
  onThemeToggle: () => void;
  onPaletteChange: (palette: string) => void;
  actions: Pick<UseRoomResult, 'castVote' | 'revealCards' | 'resetRound' | 'setStoryTitle' | 'setAutoReveal' | 'removeParticipant' | 'claimHost' | 'leaveRoom'>;
}

export function VotingRoom({ roomState, clientId, theme, palette, onThemeToggle, onPaletteChange, actions }: VotingRoomProps) {
  const [storyInput, setStoryInput] = useState(roomState.storyTitle);
  const [copied, setCopied] = useState(false);

  const isHost = roomState.creatorId === clientId;
  const currentUser = roomState.users.find(u => u.id === clientId);
  const myVote = currentUser?.vote ?? null;
  const isObserver = currentUser?.isObserver ?? false;

  const handleStoryBlur = useCallback(() => {
    actions.setStoryTitle(storyInput);
  }, [storyInput, actions]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: no-op
    }
  }, []);

  const handleCopy = useCallback(() => copyToClipboard(roomState.roomId), [copyToClipboard, roomState.roomId]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomState.roomId)}`;
    return copyToClipboard(url);
  }, [copyToClipboard, roomState.roomId]);

  const hostPresent = roomState.users.some(u => u.id === roomState.creatorId);

  return (
    <div className="room-container">
      <div className="room-header">
        <div className="room-header-left">
          <div className="room-id-display">
            <span className="room-label">Room</span>
            <span className="room-value">{roomState.roomId}</span>
          </div>
          <button className="btn btn-icon" onClick={handleCopy} aria-label="Copy room ID" title="Copy room ID">
            {copied ? '✓' : '📋'}
          </button>
          <button className="btn btn-icon" onClick={handleCopyLink} aria-label="Copy room link" title="Copy room link">
            🔗
          </button>
        </div>
        <div className="room-header-right">
          <button className="btn btn-icon theme-btn" onClick={onThemeToggle} aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-danger" onClick={actions.leaveRoom}>
            Leave
          </button>
        </div>
      </div>

      <div className="palette-selector" role="group" aria-label="Color palette">
        {PALETTES.map(p => (
          <button
            key={p.id}
            className={`palette-swatch${palette === p.id ? ' active' : ''}`}
            style={{ background: p.color }}
            onClick={() => onPaletteChange(p.id)}
            aria-label={p.label}
            aria-pressed={palette === p.id}
            title={p.label}
          />
        ))}
      </div>

      {!isHost && !hostPresent && (
        <div className="become-host-banner" role="status">
          <p>The host has left. Would you like to become the host?</p>
          <button className="btn btn-secondary" onClick={actions.claimHost}>
            Become Host
          </button>
        </div>
      )}

      <div className="story-section">
        {isHost ? (
          <input
            type="text"
            className="form-control story-input"
            placeholder="Enter story title…"
            value={storyInput}
            onChange={e => setStoryInput(e.target.value)}
            onBlur={handleStoryBlur}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            aria-label="Story title"
          />
        ) : (
          <div className="story-display" aria-label="Story title">
            {roomState.storyTitle
              ? roomState.storyTitle
              : <span className="story-placeholder">No story title set</span>}
          </div>
        )}
      </div>

      <ParticipantList
        users={roomState.users}
        revealed={roomState.revealed}
        currentUserId={clientId}
        isHost={isHost}
        onRemove={actions.removeParticipant}
      />

      {!isObserver && (
        <CardSelection
          cardSet={roomState.cardSet}
          selectedVote={myVote}
          revealed={roomState.revealed}
          onVote={actions.castVote}
        />
      )}

      {roomState.revealed && <Statistics stats={roomState.stats} />}

      {isHost && (
        <div className="room-actions">
          {!roomState.revealed && (
            <button className="btn btn-primary" onClick={actions.revealCards}>
              Reveal Cards
            </button>
          )}
          <button className="btn btn-secondary" onClick={actions.resetRound}>
            Reset Round
          </button>
          <label className="auto-reveal-toggle">
            <input
              type="checkbox"
              checked={roomState.autoReveal}
              onChange={e => actions.setAutoReveal(e.target.checked)}
            />
            Auto-reveal
          </label>
        </div>
      )}

      <RoundHistory roomState={roomState} />
    </div>
  );
}
