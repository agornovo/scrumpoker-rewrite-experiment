import { CARD_DECKS, CARD_DISPLAY } from '../../types';

interface CardSelectionProps {
  cardSet: string;
  selectedVote: string | number | null;
  revealed: boolean;
  onVote: (card: string | number) => void;
}

export function CardSelection({ cardSet, selectedVote, revealed, onVote }: CardSelectionProps) {
  const deck = CARD_DECKS.find(d => d.id === cardSet) ?? CARD_DECKS[0]!;

  return (
    <div className="card-selection">
      <h3>Your Vote</h3>
      <div className="card-grid" role="group" aria-label="Vote cards">
        {deck.cards.map(card => {
          const isSelected = selectedVote !== null && String(selectedVote) === String(card);
          return (
            <button
              key={String(card)}
              className={`card${isSelected ? ' selected' : ''}${revealed ? ' disabled' : ''}`}
              onClick={() => !revealed && onVote(card)}
              disabled={revealed}
              aria-pressed={isSelected}
              aria-label={`Vote ${CARD_DISPLAY(card)}`}
            >
              {CARD_DISPLAY(card)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
