import { useEffect, useState } from 'react';
import { useRoom } from './hooks/useRoom';
import { stompService } from './services/stompService';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { VotingRoom } from './features/room/VotingRoom';
import './styles/index.css';

const THEME_KEY = 'scrumpoker_theme';
const PALETTE_KEY = 'scrumpoker_palette';

function getInitialRoomId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? '';
}

export default function App() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem(THEME_KEY) ?? 'light');
  const [palette, setPalette] = useState<string>(() => localStorage.getItem(PALETTE_KEY) ?? 'ocean');

  const room = useRoom(stompService);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem(PALETTE_KEY, palette);
  }, [palette]);

  useEffect(() => {
    if (room.roomState) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', room.roomState.roomId);
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
  }, [room.roomState]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const handlePaletteChange = (p: string) => setPalette(p);

  return (
    <div className="app" data-testid="app">
      {room.roomState ? (
        <VotingRoom
          roomState={room.roomState}
          clientId={room.clientId}
          theme={theme}
          palette={palette}
          onThemeToggle={toggleTheme}
          onPaletteChange={handlePaletteChange}
          actions={{
            castVote: room.castVote,
            revealCards: room.revealCards,
            resetRound: room.resetRound,
            setStoryTitle: room.setStoryTitle,
            setAutoReveal: room.setAutoReveal,
            removeParticipant: room.removeParticipant,
            claimHost: room.claimHost,
            leaveRoom: room.leaveRoom,
          }}
        />
      ) : (
        <WelcomeScreen
          onJoin={room.joinRoom}
          connecting={room.connecting}
          removedFromRoom={room.removedFromRoom}
          initialRoomId={getInitialRoomId()}
        />
      )}
    </div>
  );
}
