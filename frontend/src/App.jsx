import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Play from './pages/Play';
import Display from './pages/Display';
import { useSocket } from './context/SocketContext';
import { sounds } from './utils/sounds';

function AppShell() {
  const { socket } = useSocket();
  const location = useLocation();
  const isDisplayRoute = location.pathname === '/display' || location.pathname === '/admin';

  useEffect(() => {
    if (!socket) return;
    const playSound = ({ type }) => {
      const soundMap = {
        ROUND_START: sounds.playRoundComplete,
        CORRECT: sounds.playCorrect,
        WRONG: sounds.playWrong,
        BUZZ: sounds.playBuzz,
        COUNTDOWN: sounds.playCountdown,
        TIMER_END: sounds.playTimerEnd,
        ROUND_COMPLETE: sounds.playRoundComplete,
      };
      soundMap[type]?.();
    };
    socket.on('play_sound', playSound);
    return () => socket.off('play_sound', playSound);
  }, [socket]);

  return (
      <div className="relative min-h-screen overflow-hidden bg-darkBg">
        <div className="moxie-marquee" aria-label="Game information">
          <div className="moxie-marquee__track">
            <span>15 SECONDS PER TEAM</span><b>&bull;</b><span>THREE TURNS EACH</span><b>&bull;</b><span>NO BUZZER NEEDED</span><b>&bull;</b><span>PLAY FAIR. PLAY LOUD.</span><b>&bull;</b>
            <span>15 SECONDS PER TEAM</span><b>&bull;</b><span>THREE TURNS EACH</span><b>&bull;</b><span>NO BUZZER NEEDED</span><b>&bull;</b><span>PLAY FAIR. PLAY LOUD.</span><b>&bull;</b>
          </div>
        </div>
        {!isDisplayRoute && (
          <header className="moxie-header">
            <span className="moxie-header__mark" aria-hidden="true" />
            <span className="moxie-header__logo">AC FEUD</span>
            <span className="moxie-header__meta">LIVE<br />GAME</span>
          </header>
        )}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<Play />} />
          <Route path="/display" element={<Display />} />
          <Route path="/admin" element={<Display />} />
        </Routes>
      </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
