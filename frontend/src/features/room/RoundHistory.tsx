import { useState, useEffect, useRef } from 'react';
import type { RoomUpdate } from '../../types';

interface HistoryEntry {
  round: number;
  storyTitle: string;
  average: number;
  median: number;
  min: number;
  max: number;
}

interface RoundHistoryProps {
  roomState: RoomUpdate;
}

export function RoundHistory({ roomState }: RoundHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const prevRevealedRef = useRef<boolean>(false);
  const roundRef = useRef<number>(1);
  const prevRoomIdRef = useRef<string>(roomState.roomId);

  useEffect(() => {
    // Reset history and counter when the user joins a different room
    if (roomState.roomId !== prevRoomIdRef.current) {
      prevRoomIdRef.current = roomState.roomId;
      setHistory([]);
      roundRef.current = 1;
      prevRevealedRef.current = roomState.revealed;
      return;
    }

    const wasRevealed = prevRevealedRef.current;
    const isNowRevealed = roomState.revealed;

    if (isNowRevealed && !wasRevealed && roomState.stats) {
      setHistory(prev => [
        ...prev,
        {
          round: roundRef.current++,
          storyTitle: roomState.storyTitle,
          average: roomState.stats!.average,
          median: roomState.stats!.median,
          min: roomState.stats!.min,
          max: roomState.stats!.max,
        },
      ]);
    }
    prevRevealedRef.current = isNowRevealed;
  }, [roomState.roomId, roomState.revealed, roomState.stats, roomState.storyTitle]);

  if (history.length === 0) return null;

  return (
    <div className="round-history">
      <h3>History</h3>
      <div className="history-list">
        {history.map(entry => (
          <div key={entry.round} className="history-item">
            <span className="history-round-num">Round {entry.round}</span>
            {entry.storyTitle && (
              <span className="history-story" title={entry.storyTitle}>{entry.storyTitle}</span>
            )}
            <div className="history-stats">
              <div className="history-stat">
                <span className="history-stat-label">Avg</span>
                <span className="history-stat-value">{entry.average.toFixed(1)}</span>
              </div>
              <div className="history-stat">
                <span className="history-stat-label">Med</span>
                <span className="history-stat-value">{entry.median}</span>
              </div>
              <div className="history-stat">
                <span className="history-stat-label">Min</span>
                <span className="history-stat-value">{entry.min}</span>
              </div>
              <div className="history-stat">
                <span className="history-stat-label">Max</span>
                <span className="history-stat-value">{entry.max}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
