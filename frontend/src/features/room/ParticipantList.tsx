import type { User } from '../../types';

interface ParticipantListProps {
  users: User[];
  revealed: boolean;
  currentUserId: string;
  isHost: boolean;
  onRemove: (id: string) => void;
}

export function ParticipantList({ users, revealed, currentUserId, isHost, onRemove }: ParticipantListProps) {
  return (
    <div className="participant-list">
      <h3>Participants ({users.length})</h3>
      <div className="participant-grid">
        {users.map(user => (
          <div key={user.id} className="participant-card">
            <div className="participant-info">
              {user.isObserver && <span className="observer-badge">OBS</span>}
              <span className="participant-name">
                {user.name}
                {user.id === currentUserId && <span className="you-suffix"> (you)</span>}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {!user.isObserver && (
                <span
                  className={`vote-indicator ${
                    revealed ? 'revealed' : user.vote !== null ? 'voted' : 'not-voted'
                  }`}
                  aria-label={revealed ? `voted ${user.vote}` : user.vote !== null ? 'voted' : 'not voted'}
                >
                  {revealed
                    ? (user.vote !== null ? String(user.vote) : '—')
                    : user.vote !== null
                    ? '✓'
                    : '?'}
                </span>
              )}
              {isHost && user.id !== currentUserId && (
                <button
                  className="btn-remove"
                  onClick={() => onRemove(user.id)}
                  aria-label={`Remove ${user.name}`}
                  title={`Remove ${user.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
