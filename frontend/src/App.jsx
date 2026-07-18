import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Play from './pages/Play';
import Display from './pages/Display';
import { useSocket } from './context/SocketContext';
import { sounds } from './utils/sounds';

function App() {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Listen for global sounds sent from backend server
    socket.on('play_sound', ({ type }) => {
      console.log('Playing event sound:', type);
      switch (type) {
        case 'ROUND_START':
          sounds.playRoundComplete(); // Fanfare
          break;
        case 'CORRECT':
          sounds.playCorrect();
          break;
        case 'WRONG':
          sounds.playWrong();
          break;
        case 'BUZZ':
          sounds.playBuzz();
          break;
        case 'COUNTDOWN':
          sounds.playCountdown();
          break;
        case 'TIMER_END':
          sounds.playTimerEnd();
          break;
        case 'ROUND_COMPLETE':
          sounds.playRoundComplete();
          break;
        default:
          break;
      }
    });

    return () => {
      socket.off('play_sound');
    };
  }, [socket]);

  return (
    <Router>
      <div className="relative min-h-screen overflow-hidden bg-darkBg">
        <div className="moxie-marquee" aria-label="Game information">
          <div className="moxie-marquee__track">
            <span>15 SECONDS PER TEAM</span><b>•</b><span>THREE TURNS EACH</span><b>•</b><span>NO BUZZER NEEDED</span><b>•</b>
            <span>15 SECONDS PER TEAM</span><b>•</b><span>THREE TURNS EACH</span><b>•</b><span>NO BUZZER NEEDED</span><b>•</b>
          </div>
        </div>
        <header className="moxie-header">
          <span className="moxie-header__mark">≋</span>
          <span className="moxie-header__logo">SURVEY <i>SAYS</i></span>
          <span className="moxie-header__meta">FAMILY FEUD<br />VIT CHENNAI</span>
        </header>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<Play />} />
          <Route path="/display" element={<Display />} />
          <Route path="/admin" element={<Display />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
