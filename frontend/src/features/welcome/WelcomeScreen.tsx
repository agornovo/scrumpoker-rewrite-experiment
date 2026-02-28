import { useState } from 'react';
import { CARD_DECKS } from '../../types';
import type { UseRoomResult } from '../../hooks/useRoom';

interface WelcomeScreenProps {
  onJoin: UseRoomResult['joinRoom'];
  connecting: boolean;
  removedFromRoom: boolean;
  initialRoomId?: string;
}

export function WelcomeScreen({ onJoin, connecting, removedFromRoom, initialRoomId }: WelcomeScreenProps) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId ?? '');
  const [isObserver, setIsObserver] = useState(false);
  const [cardSet, setCardSet] = useState('standard');
  const [specialEffects, setSpecialEffects] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!roomId.trim()) { setError('Please enter a room ID'); return; }
    setError('');
    onJoin({ roomId: roomId.trim(), userName: name.trim(), isObserver, cardSet, specialEffects });
  };

  return (
    <div className="welcome-container">
      <div className="welcome-card">
        <div className="welcome-header">
          <h1>🃏 Scrum Poker</h1>
          <p>Plan your sprint together</p>
        </div>
        {removedFromRoom && (
          <div className="removed-notice" role="alert">
            You were removed from the room.
          </div>
        )}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="name">Your Name</label>
            <input
              id="name"
              type="text"
              className="form-control"
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="roomId">Room ID</label>
            <input
              id="roomId"
              type="text"
              className="form-control"
              placeholder="Enter or create room ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              required
            />
          </div>
          <div className="checkbox-group">
            <input
              id="observer"
              type="checkbox"
              checked={isObserver}
              onChange={e => setIsObserver(e.target.checked)}
            />
            <label htmlFor="observer">Join as observer</label>
          </div>
          {!isObserver && (
            <div className="form-group">
              <label htmlFor="cardSet">Card Set</label>
              <select
                id="cardSet"
                className="form-control"
                value={cardSet}
                onChange={e => setCardSet(e.target.value)}
              >
                {CARD_DECKS.map(deck => (
                  <option key={deck.id} value={deck.id}>{deck.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="checkbox-group">
            <input
              id="specialEffects"
              type="checkbox"
              checked={specialEffects}
              onChange={e => setSpecialEffects(e.target.checked)}
            />
            <label htmlFor="specialEffects">Enable special effects</label>
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={connecting}>
            {connecting ? 'Connecting…' : 'Join Room'}
          </button>
        </form>
        <div className="help-accordion">
          <button
            type="button"
            className="help-accordion-btn"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen(o => !o)}
          >
            <span>ℹ️ How to use</span>
            <span>{helpOpen ? '▲' : '▼'}</span>
          </button>
          {helpOpen && (
            <div className="help-accordion-content">
              <p><strong>Creating a room:</strong> Enter any room ID. If it doesn't exist, it will be created.</p>
              <p><strong>Voting:</strong> Select a card to cast your vote. The host can reveal all votes.</p>
              <p><strong>Observer mode:</strong> Watch the session without voting.</p>
              <p><strong>Card sets:</strong> Choose the estimation scale that suits your team.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
