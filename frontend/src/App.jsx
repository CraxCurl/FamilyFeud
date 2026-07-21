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
  const isDisplayRoute = location.pathname === '/display/admin';
  const isPlayRoute = location.pathname === '/play';
  const showGlobalHeader = !isDisplayRoute && !isPlayRoute;

  useEffect(() => {
    if (!socket) return;
    const playSound = ({ type }) => {
      if (type === 'BUZZ' && isDisplayRoute) return;
      
      const soundMap = {
        ROUND_START: sounds.playRoundComplete,
        CORRECT: sounds.playCorrect,
        WRONG: sounds.playWrong,
        BUZZ: sounds.playBuzz,
        COUNTDOWN: sounds.playCountdown,
        TIMER_END: sounds.playTimerEnd,
        ROUND_COMPLETE: sounds.playRoundComplete,
        POINTS_SCORED: sounds.playPointsScored,
      };
      soundMap[type]?.();
    };
    socket.on('play_sound', playSound);

    const onGameOver = ({ winner }) => {
      if (winner === 'DRAW') {
        sounds.playRoundComplete();
      } else {
        sounds.playWinner();
      }
    };
    socket.on('game_over_trigger', onGameOver);

    return () => {
      socket.off('play_sound', playSound);
      socket.off('game_over_trigger', onGameOver);
    };
  }, [socket, isDisplayRoute]);

  return (
      <div className="relative min-h-screen overflow-hidden bg-darkBg">
        {showGlobalHeader && (
          <div className="moxie-marquee" aria-label="Game information">
            <div className="moxie-marquee__track">
              <span>CLUB EXPO 2026</span><b>&bull;</b><span>ANDROID CLUB VITC</span><b>&bull;</b><span>11 GLORIOUS YEARS</span><b>&bull;</b><span>11.11 MANIFESTING BUGS TO FEATURES</span><b>&bull;</b><span>ESTD 2015</span><b>&bull;</b><span>FEUD MODE ACTIVATED</span><b>&bull;</b>
              <span>CLUB EXPO 2026</span><b>&bull;</b><span>ANDROID CLUB VITC</span><b>&bull;</b><span>11 GLORIOUS YEARS</span><b>&bull;</b><span>11.11 MANIFESTING BUGS TO FEATURES</span><b>&bull;</b><span>ESTD 2015</span><b>&bull;</b><span>FEUD MODE ACTIVATED</span><b>&bull;</b>
            </div>
          </div>
        )}
        {showGlobalHeader && (
          <header className="moxie-header">
            <span className="moxie-header__mark" aria-hidden="true" />
            <span className="moxie-header__logo">AC FEUD</span>
            <span className="moxie-header__meta">LIVE<br />GAME</span>
          </header>
        )}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<Play />} />
          <Route path="/display/admin" element={<Display />} />
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
