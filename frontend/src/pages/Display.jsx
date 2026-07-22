import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import confetti from 'canvas-confetti';
import { HelpCircle, Star, Settings, X, Play, RotateCcw, FastForward, ShieldAlert, Sparkles, FileCode, Plus, Trash2, Copy, Search, Eye, EyeOff, Key } from 'lucide-react';
import { sounds } from '../utils/sounds';

export default function Display() {
  const { socket, gameState, adminState } = useSocket();
  const fileInputRef = useRef(null);
  
  // Host Panel Auth & Visibility
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authError, setAuthError] = useState('');
  const isAuthenticated = !!adminState && !!adminKey;

  const [showStrikeOverlay, setShowStrikeOverlay] = useState(false);
  const [showLobbyQR, setShowLobbyQR] = useState(true);
  const [audioSuspended, setAudioSuspended] = useState(true);

  // Sync / check AudioContext state
  useEffect(() => {
    const checkAudio = () => {
      if (sounds.ctx && sounds.ctx.state === 'running') {
        setAudioSuspended(false);
      } else {
        setAudioSuspended(true);
      }
    };
    checkAudio();

    const resumeAudio = () => {
      sounds.init();
      setTimeout(checkAudio, 150);
    };

    window.addEventListener('click', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
    };
  }, []);

  // Question Builder/Management Tab States
  const [builderTab, setBuilderTab] = useState('controls'); // controls, builder
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState('Campus');
  const [newAnswers, setNewAnswers] = useState([
    { text: '', points: 0 },
    { text: '', points: 0 },
    { text: '', points: 0 },
    { text: '', points: 0 }
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  // Trigger admin registration on connect if we have saved key
  useEffect(() => {
    if (socket && adminKey) {
      socket.emit('admin_register', { key: adminKey });
    }
  }, [socket, adminKey]);

  // Auth response listeners
  useEffect(() => {
    if (!socket) return;

    const handleAuthFailed = () => {
      setAuthError('Invalid Access Key');
    };

    socket.on('admin_auth_failed', handleAuthFailed);

    return () => {
      socket.off('admin_auth_failed', handleAuthFailed);
    };
  }, [socket]);

  // Strike flash listener
  useEffect(() => {
    if (gameState.strikeFlash > 0) {
      setShowStrikeOverlay(true);
      const t = setTimeout(() => {
        setShowStrikeOverlay(false);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [gameState.strikeFlash]);

  // Fireworks on Game Over
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      const duration = 6 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3, y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.7, y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [gameState.status]);

  // Re-open QR popup whenever the game transitions back to LOBBY
  useEffect(() => {
    if (gameState.status === 'LOBBY') {
      setShowLobbyQR(true);
    }
  }, [gameState.status]);

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (!passcodeInput.trim()) return;

    const trimmedKey = passcodeInput.trim();
    setAdminKey(trimmedKey);
    if (socket) {
      socket.emit('admin_register', { key: trimmedKey });
    }
  };

  const handleLogout = () => {
    setAdminKey('');
    setPasscodeInput('');
    setShowHostPanel(false);
  };

  const sendControl = (action, payload = {}) => {
    if (socket) {
      socket.emit('admin_game_control', { action, payload, key: adminKey });
    }
  };

  // Add Answer Row helper
  const addAnswerRow = () => {
    setNewAnswers([...newAnswers, { text: '', points: 0 }]);
  };

  // Save Question helper
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    const filteredAnswers = newAnswers
      .filter(a => a.text.trim())
      .map(a => ({ text: a.text.trim(), points: parseInt(a.points) || 0 }))
      .sort((a, b) => b.points - a.points);

    if (filteredAnswers.length === 0) return alert("Add at least one answer.");

    const questionObj = {
      question: newQuestion,
      category: newCategory,
      answers: filteredAnswers
    };

    try {
      const response = await fetch(
        (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + '/api/questions',
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-key': adminKey
          },
          body: JSON.stringify(questionObj)
        }
      );
      if (response.ok) {
        setNewQuestion('');
        setNewAnswers([
          { text: '', points: 0 },
          { text: '', points: 0 },
          { text: '', points: 0 },
          { text: '', points: 0 }
        ]);
        alert("Question Saved!");
        sendControl('REFRESH_QUESTIONS');
      } else {
        alert("Save authorization failed.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving question.");
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id) => {
    if (!confirm("Delete this question?")) return;
    try {
      const response = await fetch(
        (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + `/api/questions/${id}`,
        { 
          method: 'DELETE',
          headers: { 'x-admin-key': adminKey }
        }
      );
      if (response.ok) {
        alert("Question deleted!");
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Clear All Questions
  const handleClearAllQuestions = async () => {
    if (!confirm("Are you sure you want to delete ALL questions? This action cannot be undone.")) return;
    try {
      const response = await fetch(
        (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + '/api/questions',
        { 
          method: 'DELETE',
          headers: { 'x-admin-key': adminKey }
        }
      );
      if (response.ok) {
        alert("All questions deleted!");
        window.location.reload();
      } else {
        alert("Authorization failed.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Duplicate Question Helper
  const handleDuplicate = (q) => {
    setNewQuestion(q.question);
    setNewCategory(q.category);
    setNewAnswers(q.answers.map(a => ({ text: a.text, points: a.points })));
    setBuilderTab('builder');
  };

  // Export JSON Questions
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminState?.allQuestions || [], null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "family_feud_questions.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON Questions
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          const response = await fetch(
            (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + '/api/questions',
            {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-admin-key': adminKey
              },
              body: JSON.stringify(parsed)
            }
          );
          if (response.ok) {
            alert("Import complete! Refreshing.");
            window.location.reload();
          } else {
            alert("Import failed.");
          }
        } else {
          alert("Invalid file format.");
        }
      } catch (err) {
        alert("Error parsing file.");
      }
    };
    reader.readAsText(file);
  };

  const playUrl = `${window.location.protocol}//${window.location.host}/`;
  const answers = gameState.currentQuestion?.answers || [];
  const cards = Array(8).fill(null).map((_, i) => answers[i] || null);

  // Filtered builder list
  const filteredQs = (adminState?.allQuestions || []).filter(q =>
    q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen px-6 py-6 relative justify-between select-none pb-24 game-display">
      
      {audioSuspended && (
        <div 
          onClick={() => sounds.init()}
          className="mb-4 bg-amber-500 text-darkBg text-xs font-black py-2.5 px-4 text-center cursor-pointer hover:bg-amber-400 transition animate-pulse uppercase tracking-wider rounded-xl border border-amber-600"
        >
          ⚠️ Browser blocked game sounds. Click anywhere on this screen to enable game sound effects!
        </div>
      )}
      
      {/* Top Banner / Round Status */}
      <div className="flex justify-between items-center mb-5 game-topbar">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-neonPurple/10 border border-neonPurple/30 rounded-xl flex items-center justify-center text-neonPurple text-xl font-black game-topbar__round">
            {gameState.currentRound || 1}
          </div>
          <div>
            <span className="text-xs text-[#0D483F]/60 font-semibold uppercase tracking-wider block">Round</span>
            <span className="text-sm text-neonPurple font-bold">Game in progress</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {gameState.timer > 0 && (
            <div className="px-4 py-2 bg-pink-500/10 border border-pink-500/30 rounded-xl flex items-center gap-2 text-pink-600 font-black animate-pulse">
              <ClockIcon className="w-4 h-4" />
              <span>{gameState.timer}s</span>
            </div>
          )}
          {gameState.status === 'PLAYING' && gameState.activeInputTeam && (
            <div className="hidden md:block text-right">
              <div className="text-[9px] font-bold tracking-[.16em] text-[#0D483F]/55">ACTIVE TURN</div>
              <div className="text-sm font-black text-[#0D483F]">{gameState.activeInputTeam}</div>
              <div className="text-[10px] text-[#0D483F]/60">{gameState.turnsTaken?.[gameState.activeInputTeam] || 0} / {gameState.turnsPerTeam || 3}</div>
            </div>
          )}
          
          <button
            onClick={() => setShowHostPanel(true)}
            className="p-3 bg-neonPurple/5 border border-neonPurple/15 rounded-xl hover:bg-neonPurple/10 text-[#0D483F] transition cursor-pointer"
            title="Host Controls Dashboard"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Game Interface */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-center">
        {/* Left Team Panel */}
        <div className="col-span-1 lg:col-span-3 flex flex-col items-center order-2 lg:order-1">
          {renderTeamPanel(gameState, 0)}
        </div>

        {/* Board Center Panel */}
        <div className="col-span-1 lg:col-span-6 flex flex-col gap-4 lg:gap-6 order-1 lg:order-2">
          <div className="glass-panel p-6 rounded-2xl border-[#0D483F]/15 text-center relative overflow-hidden flex flex-col items-center game-question">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neonPurple via-neonPink to-neonCyan" />
            
            {/* Round Pot */}
            <div className="flex flex-col items-center mb-4">
              <span className="text-[10px] text-[#0D483F]/60 font-bold uppercase tracking-widest">Round Pot</span>
              <div className="bg-[#0D483F] border-2 border-[#D2F128] text-[#D2F128] font-black text-4xl px-8 py-1.5 rounded-full mt-1 min-w-[110px] text-center shadow-[0_4px_16px_rgba(13,72,63,0.15)]">
                {String(answers.reduce((sum, ans, idx) => sum + (gameState.revealedAnswers && gameState.revealedAnswers[idx] ? ans.points : 0), 0)).padStart(3, '0')}
              </div>
            </div>


            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neonPurple/5 border border-neonPurple/10 rounded-full text-xs text-[#0D483F]/75 mb-3 font-semibold">
              <HelpCircle className="w-3.5 h-3.5 text-[#0D483F]/70" />
              {gameState.currentQuestion?.category || 'Survey Question'}
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-neonPurple leading-tight">
              {gameState.currentQuestion?.question || "Waiting for host to start the round..."}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 game-answer-grid">
            {cards.map((ans, idx) => {
              const isRevealed = gameState.revealedAnswers && gameState.revealedAnswers[idx];
              return (
                <div key={idx} className={`flip-card ${isRevealed ? 'is-flipped' : ''}`}>
                  <div className="flip-card-inner">
                    <div className="flip-card-front justify-center font-black text-2xl">
                      <span className="w-10 h-10 rounded-full bg-neonPurple/5 border border-neonPurple/15 flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flip-card-back justify-between px-6 font-bold text-lg">
                      <span className="uppercase tracking-wider">{ans ? ans.text : ''}</span>
                      <span className="px-3 py-1 bg-[#FAF6EE]/20 rounded-lg text-neonCyan font-extrabold">
                        {ans ? ans.points : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center h-12">
            {gameState.status === 'ROUND_END' && (
              <div className="px-6 py-2 bg-neonPurple/5 border border-neonPurple/15 rounded-xl text-neonPurple font-semibold text-sm">
                Both teams completed three turns. Host: start the next round.
              </div>
            )}
          </div>
        </div>

        {/* Right Team Panel */}
        <div className="col-span-1 lg:col-span-3 flex flex-col items-center order-3">
          {renderTeamPanel(gameState, 1)}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end mt-4 border-t border-[#0D483F]/10 pt-4">
        <div>
          <span className="text-xs text-[#0D483F]/60 font-semibold block uppercase">Android Club VITC</span>
          <span className="text-xs text-[#0D483F]/70">Join real-time events, build projects, master skills.</span>
        </div>
      </div>

      {/* STRIKE OVERLAY */}
      <AnimatePresence>
        {showStrikeOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="flex gap-8 strike-animate">
              <span className="text-9xl md:text-[14rem] font-black text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]">X</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GAME OVER OVERLAY (Android Club Expo Promotion) */}
      <AnimatePresence>
        {gameState.status === 'GAME_OVER' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-white border border-[#0D483F]/15 rounded-3xl p-10 text-center relative overflow-hidden shadow-2xl flex flex-col items-center"
            >
              <div className="absolute top-0 left-0 right-0 h-[6px] bg-gradient-to-r from-neonPurple via-neonPink to-neonCyan" />
              
              <div className="w-20 h-20 bg-neonPurple/10 border border-neonPurple/20 rounded-full flex items-center justify-center mb-6 text-4xl">
                🏆
              </div>

              <h2 className="text-4xl font-extrabold text-neonPurple mb-2 tracking-tight">Game Completed!</h2>
              <p className="text-sm text-neonPink font-black uppercase tracking-widest mb-8">The AC FEUD final score is in!</p>

              {/* Show Final Scores */}
              <div className="grid grid-cols-2 gap-8 w-full max-w-md bg-neonPurple/5 border border-neonPurple/10 rounded-2xl p-6 mb-8 text-neonPurple font-bold">
                <div>
                  <span className="text-xs text-[#0D483F]/60 block uppercase font-bold tracking-wider">Team Alpha</span>
                  <span className="text-4xl font-black">{gameState.finalScores?.['Team Alpha'] ?? gameState.teams['Team Alpha']?.score ?? 0} Pts</span>
                </div>
                <div className="border-l border-neonPurple/10">
                  <span className="text-xs text-[#0D483F]/60 block uppercase font-bold tracking-wider">Team Beta</span>
                  <span className="text-4xl font-black">{gameState.finalScores?.['Team Beta'] ?? gameState.teams['Team Beta']?.score ?? 0} Pts</span>
                </div>
              </div>

              {/* Instagram QR Code & Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full max-w-lg mb-6 text-left">
                <div className="space-y-4">
                  <h4 className="text-lg font-black text-neonPurple border-b border-[#0D483F]/10 pb-2">Android Club VITC</h4>
                  <p className="text-xs text-[#0D483F]/85 leading-relaxed font-semibold">
                    We are VIT Chennai's premier mobile & IoT development community. Meet our team at the Expo Booth to explore our workshops, hackathons, and projects!
                  </p>
                  <p className="text-xs font-bold text-[#0D483F] animate-pulse">
                    ✨ Scan the QR to follow us on Instagram.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-neonPurple/5 border border-neonPurple/10 rounded-2xl">
                  <div className="p-2 bg-white rounded-xl shadow-sm mb-2">
                    <img 
                      src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0d483f&data=https://www.instagram.com/androidvitc/" 
                      alt="Instagram QR Code" 
                      className="w-28 h-28 object-contain"
                    />
                  </div>
                  <span className="text-[10px] text-[#0D483F]/70 font-semibold tracking-wider uppercase">Scan to follow Instagram</span>
                  <span className="text-neonPink font-mono text-xs font-bold">@androidvitc</span>
                </div>
              </div>

              <div className="flex gap-4 mt-2">
                <a
                  href="https://www.instagram.com/androidvitc/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-[#0D483F] text-white font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
                >
                  Instagram Link
                </a>
                <button
                  onClick={() => setShowHostPanel(true)}
                  className="px-6 py-2.5 bg-[#D2F128] text-[#0D483F] border border-[#0D483F] font-bold text-xs rounded-xl hover:bg-[#0D483F] hover:text-white transition cursor-pointer"
                >
                  Host Panel Options
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* LOBBY JOIN QR POPUP */}
      <AnimatePresence>
        {gameState.status === 'LOBBY' && showLobbyQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#FAF6EE]/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="w-full max-w-lg bg-white border-4 border-[#0D483F] p-8 text-center relative shadow-[12px_12px_0_#0D483F] flex flex-col items-center"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowLobbyQR(false)}
                className="absolute top-4 right-4 p-1 hover:bg-[#0D483F]/10 rounded-lg text-[#0D483F]/70 hover:text-[#0D483F] transition cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-4xl font-condensed font-bold uppercase tracking-tight text-[#0D483F] mb-2">Join the Feud!</h2>
              <p className="text-xs font-condensed font-bold text-neonPink tracking-widest uppercase mb-6">Scan to join Team Alpha or Team Beta</p>
              
              <div className="p-4 bg-white border-2 border-[#0D483F] mb-6">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0d483f&data=${encodeURIComponent(playUrl)}`} 
                  alt="Join QR Code" 
                  className="w-56 h-56 object-contain"
                />
              </div>

              <span className="text-xs font-condensed font-bold text-[#0D483F]/75 uppercase tracking-wider mb-1">Or navigate on your phone to:</span>
              <span className="text-sm font-mono text-neonPink font-bold underline select-all">{playUrl}</span>
              
              <div className="mt-8 text-[10px] font-condensed font-bold tracking-widest text-[#0D483F]/50 uppercase">
                ANDROID CLUB VIT CHENNAI
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HOST DRAWER OVERLAY */}
      <AnimatePresence>
        {showHostPanel && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
            
            {/* Click outside to close helper */}
            <div className="absolute inset-0" onClick={() => setShowHostPanel(false)} />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-6xl h-[75vh] glass-panel bg-darkBg/95 border-t border-white/10 rounded-t-3xl p-6 relative overflow-hidden flex flex-col moxie-host-drawer"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neonPurple to-neonCyan" />

              {/* Drawer Header */}
              <div className="flex justify-between items-center border-b border-[#0D483F]/10 pb-4 mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold text-neonPurple flex items-center gap-2">
                    <Settings className="w-5 h-5 text-neonPurple animate-spin duration-10000" />
                    Host Administration Panel
                  </h3>

                  {isAuthenticated && (
                    <div className="flex gap-1 bg-[#FAF6EE] border border-neonPurple/10 p-1 rounded-lg">
                      <button
                        onClick={() => setBuilderTab('controls')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                          builderTab === 'controls' ? 'bg-neonPurple text-darkBg' : 'text-[#0D483F]/60 hover:text-[#0D483F]'
                        }`}
                      >
                        Controls
                      </button>
                      <button
                        onClick={() => setBuilderTab('builder')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                          builderTab === 'builder' ? 'bg-neonPurple text-darkBg' : 'text-[#0D483F]/60 hover:text-[#0D483F]'
                        }`}
                      >
                        Builder
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isAuthenticated && (
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 bg-neonPurple/5 border border-neonPurple/15 text-xs font-semibold text-[#0D483F]/70 hover:text-red-600 rounded-lg transition cursor-pointer"
                    >
                      Logout Lock
                    </button>
                  )}
                  <button
                    onClick={() => setShowHostPanel(false)}
                    className="p-1.5 hover:bg-neonPurple/10 rounded-lg text-[#0D483F]/70 hover:text-[#0D483F] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Authorization form if key matches */}
              {!isAuthenticated ? (
                <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-4">
                  <div className="w-10 h-10 bg-neonPurple/10 border border-neonPurple/20 rounded-xl flex items-center justify-center text-neonPurple">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-neonPurple text-lg">Enter Host Passkey</h4>
                    <p className="text-xs text-[#0D483F]/60">Access features like timer overrides and answer reveals.</p>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="w-full space-y-3">
                    <input
                      type="password"
                      value={passcodeInput}
                      onChange={(e) => setPasscodeInput(e.target.value)}
                      placeholder="Passkey"
                      required
                      className="w-full px-4 py-2.5 bg-[#FAF6EE] border border-neonPurple/15 rounded-xl text-[#0D483F] text-center focus:outline-none focus:border-[#0D483F]/50 placeholder-[#0D483F]/40"
                    />
                    {authError && <p className="text-xs text-red-600 font-semibold">{authError}</p>}
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-neonPurple text-darkBg font-bold rounded-xl hover:opacity-90 transition cursor-pointer"
                    >
                      Unlock Controls
                    </button>
                  </form>
                </div>
              ) : !adminState ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 border-2 border-dashed border-neonPurple animate-spin mx-auto mb-4" />
                  <p className="text-xs text-gray-500">Syncing Admin Game State...</p>
                </div>
              ) : (
                /* Authenticated Admin Control Panel */
                <div className="flex-1 overflow-y-auto pr-1">
                  {builderTab === 'controls' ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      
                      {/* Operational buttons */}
                      <div className="md:col-span-8 space-y-6">
                        <div className="glass-panel p-4 rounded-xl space-y-4 border-[#0D483F]/10">
                          <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1">Game States</span>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {adminState?.status === 'LOBBY' ? (
                              <button
                                onClick={() => sendControl('START_GAME')}
                                className="py-2.5 bg-emerald-600/10 border border-emerald-600/30 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-600/20 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Play className="w-4 h-4" /> Start Game
                              </button>
                            ) : (
                              <button
                                onClick={() => sendControl('RESET_GAME')}
                                className="py-2.5 bg-red-600/10 border border-red-600/30 text-red-700 text-xs font-bold rounded-lg hover:bg-red-600/20 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" /> Reset Game
                              </button>
                            )}

                            <button
                              onClick={() => sendControl('START_QUESTION')}
                              disabled={adminState?.status === 'LOBBY' || adminState?.status === 'GAME_OVER'}
                              className="py-2.5 bg-cyan-600/10 border border-cyan-600/30 text-cyan-700 text-xs font-bold rounded-lg hover:bg-cyan-600/20 transition disabled:opacity-40 cursor-pointer"
                            >
                              Restart Round
                            </button>
                            <button
                              onClick={() => sendControl('PREV_ROUND')}
                              disabled={adminState?.status === 'LOBBY' || adminState?.status === 'GAME_OVER'}
                              className="py-2.5 bg-neonPurple/5 border border-neonPurple/15 text-[#0D483F] text-xs font-bold rounded-lg hover:bg-neonPurple/10 transition disabled:opacity-40 cursor-pointer"
                            >
                              Prev Round
                            </button>
                            <button
                              onClick={() => sendControl('NEXT_ROUND')}
                              disabled={adminState?.status === 'LOBBY' || adminState?.status === 'GAME_OVER'}
                              className="py-2.5 bg-neonPurple/5 border border-neonPurple/15 text-[#0D483F] text-xs font-bold rounded-lg hover:bg-neonPurple/10 transition disabled:opacity-40 cursor-pointer"
                            >
                              Next / Finish
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <label className="text-xs text-[#0D483F]/70 font-semibold">
                              Number of rounds
                              <select
                                value={adminState?.maxRounds || 3}
                                disabled={adminState?.status !== 'LOBBY'}
                                onChange={(e) => sendControl('UPDATE_SETTINGS', { maxRounds: Number(e.target.value) })}
                                className="mt-1.5 w-full px-3 py-2 bg-[#FAF6EE] border border-neonPurple/15 rounded-lg text-[#0D483F] disabled:opacity-50"
                              >
                                <option value={1}>1 round</option>
                                <option value={2}>2 rounds</option>
                                <option value={3}>3 rounds</option>
                              </select>
                            </label>
                            <label className="text-xs text-[#0D483F]/70 font-semibold">
                              Seconds per turn
                              <select
                                value={adminState?.turnSeconds || 15}
                                disabled={adminState?.status !== 'LOBBY'}
                                onChange={(e) => sendControl('UPDATE_SETTINGS', { turnSeconds: Number(e.target.value) })}
                                className="mt-1.5 w-full px-3 py-2 bg-[#FAF6EE] border border-neonPurple/15 rounded-lg text-[#0D483F] disabled:opacity-50"
                              >
                                {[10, 15, 20, 30, 45, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
                              </select>
                            </label>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => sendControl('PAUSE_GAME')}
                              className="py-2 bg-neonPurple/5 border border-neonPurple/15 text-[10px] text-[#0D483F]/80 hover:text-[#0D483F] rounded cursor-pointer transition"
                            >
                              Pause Timer
                            </button>
                            <button
                              onClick={() => sendControl('RESET_BUZZ')}
                              className="py-2 bg-neonPurple/5 border border-neonPurple/15 text-[10px] text-[#0D483F]/80 hover:text-[#0D483F] rounded cursor-pointer transition"
                            >
                              Restart Turn Cycle
                            </button>
                            <button
                              onClick={() => sendControl('SKIP_QUESTION')}
                              className="py-2 bg-neonPurple/5 border border-neonPurple/15 text-[10px] text-[#0D483F]/80 hover:text-[#0D483F] rounded cursor-pointer transition"
                            >
                              Skip Question
                            </button>
                          </div>
                        </div>

                        {/* Answers controller */}
                        {adminState?.currentQuestion && (
                          <div className="space-y-6">
                            <div className="glass-panel p-4 rounded-xl space-y-2 border-[#0D483F]/10 bg-[#0D483F]/5">
                              <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1">Current Question</span>
                              <div className="text-lg font-black text-[#0D483F]">
                                “{adminState.currentQuestion.question}”
                              </div>
                            </div>

                            <div className="glass-panel p-4 rounded-xl space-y-4 border-[#0D483F]/10">
                              <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1">Reveals & Strikes</span>
                            
                            <div className="space-y-2">
                              {adminState?.currentQuestion?.answers?.map((ans, idx) => {
                                const isRevealed = adminState?.revealedAnswers?.[idx];
                                return (
                                  <div 
                                    key={idx} 
                                    onClick={() => {
                                      if (!isRevealed) {
                                        sendControl('REVEAL_ANSWER', { 
                                          index: idx, 
                                          awardToTeam: adminState?.activeInputTeam || undefined 
                                        });
                                      }
                                    }}
                                    className={`flex justify-between items-center px-3 py-2 rounded-lg border transition ${
                                      isRevealed 
                                        ? 'bg-neonPurple/5 border-neonPurple/10 cursor-default' 
                                        : 'bg-neonPurple/5 border-neonPurple/10 hover:border-emerald-500/40 cursor-pointer'
                                    }`}
                                  >
                                    <span className="text-xs font-bold text-neonPurple">{idx+1}. {ans.text} ({ans.points} Pts)</span>
                                    
                                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      {isRevealed ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            sendControl('HIDE_ANSWER', { index: idx });
                                          }}
                                          className="px-2 py-1 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded text-[10px] font-bold cursor-pointer"
                                        >
                                          Hide
                                        </button>
                                      ) : (
                                        <>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              sendControl('REVEAL_ANSWER', { index: idx });
                                            }}
                                            className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold cursor-pointer"
                                          >
                                            Reveal
                                          </button>
                                          {Object.keys(adminState?.teams || {}).map(tName => {
                                            const isInactiveTeam = adminState?.activeInputTeam && tName !== adminState.activeInputTeam;
                                            return (
                                              <button
                                                key={tName}
                                                disabled={isInactiveTeam}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (isInactiveTeam) return;
                                                  sendControl('REVEAL_ANSWER', { index: idx, awardToTeam: tName });
                                                }}
                                                className={`px-1.5 py-1 border rounded text-[9px] transition ${
                                                  isInactiveTeam
                                                    ? 'bg-gray-500/5 border-gray-500/10 text-gray-500 opacity-30 cursor-not-allowed'
                                                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 cursor-pointer'
                                                }`}
                                              >
                                                + {tName === 'Team Alpha' ? 'Alpha' : 'Beta'}
                                              </button>
                                            );
                                          })}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex justify-between items-center pt-2">
                              <div>
                                <span className="text-[10px] text-gray-500 uppercase block mb-0.5">Active Strikes</span>
                                <div className="text-red-500 font-bold flex gap-1">
                                  {Array(3).fill(null).map((_, i) => (
                                    <span key={i} className={i < (adminState?.strikes || 0) ? 'opacity-100' : 'opacity-25'}>X</span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => sendControl('ADD_STRIKE')}
                                  className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-600 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Trigger Strike
                                </button>
                                <button
                                  onClick={() => sendControl('RESET_STRIKES')}
                                  className="px-3 py-1.5 bg-neonPurple/5 border border-neonPurple/15 text-[#0D483F]/70 rounded text-[10px] cursor-pointer hover:text-[#0D483F]"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>

                      {/* Right Panel side: Teams and Buzzers */}
                      <div className="md:col-span-4 space-y-6">
                        
                        {/* Live team-turn panel */}
                        <div className="glass-panel p-4 rounded-xl border-[#0D483F]/10">
                          <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1 mb-3">Active Team Turn</span>
                          {adminState?.activeInputTeam ? (
                            <div className="text-center p-3 bg-neonPurple/5 border border-neonPurple/15 rounded-lg">
                              <span className="text-[10px] text-[#0D483F]/60 font-bold tracking-widest block">NOW PLAYING</span>
                              <strong className="text-sm text-neonPurple block my-1">{adminState.activeInputTeam}</strong>
                              <div className="text-[10px] text-[#0D483F]/70 mb-3.5"><b className="text-neonPink">{adminState.timer || 0}s</b> &middot; turn {adminState.turnsTaken?.[adminState.activeInputTeam] || 0} of {adminState.turnsPerTeam || 3}</div>
                              
                              <div className="flex justify-center gap-1.5 mt-2">
                                <button
                                  onClick={() => sendControl('AWARD_POINTS', { team: adminState.activeInputTeam, points: 10 })}
                                  className="px-2 py-1 bg-[#d2f128]/10 hover:bg-[#d2f128]/25 border border-[#d2f128]/35 text-[#0D483F] rounded text-[9px] font-bold cursor-pointer"
                                >
                                  +10 Pts
                                </button>
                                <button
                                  onClick={() => sendControl('AWARD_POINTS', { team: adminState.activeInputTeam, points: 50 })}
                                  className="px-2 py-1 bg-[#d2f128]/10 hover:bg-[#d2f128]/25 border border-[#d2f128]/35 text-[#0D483F] rounded text-[9px] font-bold cursor-pointer"
                                >
                                  +50 Pts
                                </button>
                                <button
                                  onClick={() => sendControl('AWARD_POINTS', { team: adminState.activeInputTeam, points: -10 })}
                                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 rounded text-[9px] font-bold cursor-pointer"
                                >
                                  -10 Pts
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 text-xs">Start a turn cycle to put a team on the clock.</div>
                          )}
                        </div>

                        {/* Scores override */}
                        <div className="glass-panel p-4 rounded-xl space-y-3 border-[#0D483F]/10">
                          <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1">Scores Override</span>
                          {Object.keys(adminState?.teams || {}).map(tName => {
                            const teamData = adminState?.teams?.[tName];
                            return (
                              <div key={tName} className="p-2 bg-neonPurple/5 border border-neonPurple/10 rounded-lg flex justify-between items-center">
                                <div className="truncate text-xs font-bold text-neonPurple pr-2">{tName}</div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => sendControl('AWARD_POINTS', { team: tName, points: 10 })}
                                    className="px-1.5 py-0.5 bg-neonPurple/10 text-[9px] text-[#0D483F] rounded hover:bg-neonPurple/20 cursor-pointer"
                                  >
                                    +10
                                  </button>
                                  <button
                                    onClick={() => sendControl('AWARD_POINTS', { team: tName, points: -10 })}
                                    className="px-1.5 py-0.5 bg-neonPurple/10 text-[9px] text-[#0D483F] rounded hover:bg-neonPurple/20 cursor-pointer"
                                  >
                                    -10
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Connected Members */}
                        <div className="glass-panel p-4 rounded-xl space-y-3 border-[#0D483F]/10">
                          <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1">Connected Members</span>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {Object.values(adminState?.players || {}).map((player) => (
                              <div key={player.socketId || player.id} className="flex justify-between items-center bg-[#FAF6EE] px-2.5 py-1.5 rounded-lg border border-[#0D483F]/10 text-xs">
                                <div className="truncate pr-2">
                                  <strong className="text-neonPurple block leading-tight">{player.name}</strong>
                                  <span className="text-[9px] text-gray-500 block uppercase font-bold">{player.team || 'Lobby'}</span>
                                </div>
                                <button
                                  onClick={() => sendControl('KICK_PLAYER', { playerId: player.id, socketId: player.socketId })}
                                  className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-500 rounded text-[10px] font-bold hover:bg-red-500 hover:text-white transition cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            {(!adminState?.players || adminState.players.length === 0) && (
                              <div className="text-center py-3 text-gray-500 text-xs">No active players connected.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* TAB: QUESTION BUILDER */
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      
                      {/* Question form */}
                      <form onSubmit={handleSaveQuestion} className="md:col-span-5 glass-panel p-4 rounded-xl space-y-4">
                        <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1">Create Question</span>
                        
                        <input
                          type="text"
                          value={newQuestion}
                          onChange={(e) => setNewQuestion(e.target.value)}
                          placeholder="Question Text"
                          required
                          className="w-full px-3 py-2 bg-[#FAF6EE] border border-neonPurple/15 rounded-xl text-[#0D483F] text-sm placeholder-[#0D483F]/40 focus:outline-none focus:border-[#0D483F]/50"
                        />

                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FAF6EE] border border-neonPurple/15 rounded-xl text-[#0D483F] text-sm focus:outline-none"
                        >
                          <option value="Campus">Campus</option>
                          <option value="Food">Food</option>
                          <option value="Academics">Academics</option>
                          <option value="Hostel">Hostel</option>
                          <option value="Events">Events</option>
                          <option value="Android Club">Android Club</option>
                          <option value="Funny">Funny</option>
                        </select>

                        <div className="space-y-2">
                          {newAnswers.map((ans, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="text"
                                value={ans.text}
                                onChange={(e) => {
                                  const updated = [...newAnswers];
                                  updated[idx].text = e.target.value;
                                  setNewAnswers(updated);
                                }}
                                placeholder={`Answer #${idx + 1}`}
                                className="flex-1 px-3 py-1.5 bg-[#FAF6EE] border border-neonPurple/15 rounded-xl text-[#0D483F] text-xs placeholder-[#0D483F]/40 focus:outline-none focus:border-[#0D483F]/50"
                              />
                              <input
                                type="number"
                                value={ans.points || ''}
                                onChange={(e) => {
                                  const updated = [...newAnswers];
                                  updated[idx].points = parseInt(e.target.value) || 0;
                                  setNewAnswers(updated);
                                }}
                                placeholder="Pts"
                                className="w-16 px-3 py-1.5 bg-[#FAF6EE] border border-neonPurple/15 rounded-xl text-[#0D483F] text-xs placeholder-[#0D483F]/40 focus:outline-none focus:border-[#0D483F]/50"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={addAnswerRow}
                            className="flex-1 py-1.5 bg-[#FAF6EE] border border-neonPurple/15 text-[#0D483F] hover:bg-[#FAF6EE]/80 text-[10px] rounded-lg cursor-pointer transition"
                          >
                            + Add Row
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-1.5 bg-neonPurple text-darkBg font-bold text-[10px] rounded-lg cursor-pointer hover:opacity-90 transition"
                          >
                            Save Question
                          </button>
                        </div>
                      </form>

                      {/* Bulk backup / Questions search */}
                      <div className="md:col-span-7 space-y-6">
                        <div className="glass-panel p-4 rounded-xl flex items-center justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Database Backup</span>
                            <p className="text-[10px] text-gray-500">Import/Export JSON survey lists</p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleExportJSON}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] flex items-center gap-1 text-gray-300 font-bold"
                            >
                              <FileCode className="w-3.5 h-3.5" /> Export
                            </button>
                            <input
                              type="file"
                              accept=".json"
                              ref={fileInputRef}
                              onChange={handleImportJSON}
                              className="hidden"
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-neonPurple/20 border border-neonPurple/30 text-neonPurple rounded text-[10px] font-bold"
                            >
                              Import
                            </button>
                            <button
                              onClick={handleClearAllQuestions}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-600 rounded text-[10px] font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Clear All
                            </button>
                          </div>
                        </div>

                        {/* Searchable Questions list */}
                        <div className="glass-panel p-4 rounded-xl space-y-3">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[#0D483F]/50 absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search..."
                              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF6EE] border border-neonPurple/15 rounded-xl text-[#0D483F] placeholder-[#0D483F]/40 text-xs focus:outline-none focus:border-[#0D483F]/50"
                            />
                          </div>

                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {filteredQs.map((q, idx) => (
                              <div key={q.id || idx} className="p-2.5 bg-neonPurple/5 border border-neonPurple/10 rounded-lg flex justify-between items-center text-xs">
                                <div>
                                  <span className="px-1.5 py-0.5 bg-neonPurple/15 text-neonPurple rounded text-[8px] font-bold uppercase">{q.category}</span>
                                  <div className="font-bold text-[#0D483F] mt-1">{q.question}</div>
                                </div>

                                <div className="flex gap-1 ml-4 shrink-0">
                                  <button
                                    onClick={() => handleDuplicate(q)}
                                    className="p-1 hover:bg-neonPurple/10 text-[#0D483F]/60 hover:text-[#0D483F] rounded cursor-pointer"
                                    title="Duplicate"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuestion(q.id)}
                                    className="p-1 hover:bg-red-500/15 text-[#0D483F]/60 hover:text-red-500 rounded cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function renderTeamPanel(gameState, index) {
  const teamNames = ['Team Alpha', 'Team Beta'];
  const teamName = teamNames[index];
  const teamData = gameState.teams[teamName] || { score: 0, members: [] };
  const isActive = gameState.activeInputTeam === teamName;

  return (
    <motion.div
      animate={{ scale: isActive ? 1.05 : 1 }}
      className={`w-full p-6 rounded-2xl glass-panel game-team-card text-center relative overflow-hidden transition-all duration-300 ${
        isActive ? 'border-neonCyan shadow-neonCyan bg-neonCyan/5' : ''
      }`}
    >
      {isActive && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-neonCyan" />
          <div className="bg-neonCyan text-white text-[10px] font-black py-1 px-2.5 uppercase tracking-widest animate-pulse inline-block rounded-full mb-2 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            ⚡ Now Playing
          </div>
        </>
      )}
      
      <span className="text-[10px] font-bold text-[#0D483F]/60 uppercase tracking-widest mb-1 block">Team {index === 0 ? 'Alpha' : 'Beta'}</span>
      <h4 className="text-xl font-bold text-neonPurple mb-4 truncate">{teamName}</h4>
      
      <div className="text-5xl font-black text-neonPurple mb-6">
        {teamData.score || 0}
      </div>

      <div className="text-left w-full">
        <span className="text-[10px] text-[#0D483F]/60 font-semibold uppercase block border-b border-neonPurple/10 pb-1 mb-2">Connected Players</span>
        <ul className="text-xs text-gray-700 space-y-1 max-h-32 overflow-y-auto pr-1">
          {teamData.members?.map((m, idx) => (
            <li key={idx} className="flex justify-between items-center bg-neonPurple/5 px-2 py-1 rounded">
              <span className="truncate">{m.name}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </li>
          ))}
          {teamData.members?.length === 0 && (
            <li className="text-[10px] text-gray-600 text-center py-2">Waiting for connection...</li>
          )}
        </ul>
      </div>
    </motion.div>
  );
}

function ClockIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
