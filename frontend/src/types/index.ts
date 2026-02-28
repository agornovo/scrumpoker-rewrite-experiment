export interface User {
  id: string;
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}

export interface Stats {
  average: number;
  median: number;
  min: number;
  max: number;
}

export interface RoomUpdate {
  roomId: string;
  users: User[];
  revealed: boolean;
  stats: Stats | null;
  creatorId: string;
  cardSet: string;
  storyTitle: string;
  autoReveal: boolean;
  specialEffects: boolean;
}

export interface CardDeck {
  id: string;
  name: string;
  cards: (number | string)[];
}

export interface AppSession {
  roomId: string;
  userName: string;
  isObserver: boolean;
  cardSet: string;
  specialEffects: boolean;
  clientId: string;
}

export const CARD_DECKS: CardDeck[] = [
  { id: 'standard', name: 'Standard', cards: [1, 2, 3, 5, 8, 13, 20, 40, 100, '?'] },
  { id: 'fibonacci', name: 'Fibonacci', cards: [0, 0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, '?', '☕'] },
  { id: 'tshirt', name: 'T-Shirt', cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?'] },
  { id: 'powers2', name: 'Powers of 2', cards: [1, 2, 4, 8, 16, 32, 64, '?'] },
];

export function cardDisplay(card: number | string): string {
  if (card === 0.5) return '½';
  return String(card);
}
