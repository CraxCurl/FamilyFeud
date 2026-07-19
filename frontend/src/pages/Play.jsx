import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { Smartphone, Send, Clock, UserCheck, ShieldAlert, Award, Globe, Sparkles } from 'lucide-react';
import { sounds } from '../utils/sounds';
import confetti from 'canvas-confetti';

const InstagramIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

export default function Play() {
  const { socket, gameState } = useSocket();
  
  // Registration local state
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [registered, setRegistered] = useState(false);
  const [userId, setUserId] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [showStrikeOverlay, setShowStrikeOverlay] = useState(false);
  const [localGameOver, setLocalGameOver] = useState(false);
  const finalSoundPlayed = useRef(false);

  const prevScoreRef = useRef(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  const currentScore = (team && gameState.teams && gameState.teams[team]) ? (gameState.teams[team].score || 0) : 0;

  // Monitor score increases for team celebration confetti & pop-up
  useEffect(() => {
    if (!team) return;

    if (prevScoreRef.current === null) {
      prevScoreRef.current = currentScore;
      return;
    }

    if (currentScore > prevScoreRef.current) {
      const diff = currentScore - prevScoreRef.current;
      setPointsEarned(diff);
      setShowCelebration(true);

      // Trigger confetti on player's screen
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });

      const timer = setTimeout(() => {
        setShowCelebration(false);
      }, 1500);

      prevScoreRef.current = currentScore;
      return () => clearTimeout(timer);
    } else {
      prevScoreRef.current = currentScore;
    }
  }, [currentScore, team]);

  // Mobile Audio Unlocker for programmatic sounds (e.g. buzzer)
  useEffect(() => {
    const resumeAudio = () => {
      sounds.init();
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
  }, []);

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

  // Auto rejoin when status transitions back to LOBBY
  useEffect(() => {
    if (socket && userId && isBlocked && gameState.status === 'LOBBY') {
      socket.emit('join_game', { id: userId });
    }
  }, [gameState.status, isBlocked, socket, userId]);

  useEffect(() => {
    let savedId = localStorage.getItem('feud_user_id');
    if (!savedId) {
      savedId = 'player_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('feud_user_id', savedId);
    }
    setUserId(savedId);
  }, []);

  // Re-join and register details listener
  useEffect(() => {
    if (!socket || !userId) return;

    // Trigger auto-join
    socket.emit('join_game', { id: userId });

    socket.on('joined_details', (details) => {
      setName(details.name);
      setTeam(details.team);
      setRegistered(true);
      setIsBlocked(false);
      setQueuePosition(0);
    });

    socket.on('joined_queue', ({ position }) => {
      setQueuePosition(position);
      setRegistered(true);
      setIsBlocked(true);
    });

    socket.on('join_blocked', () => {
      setIsBlocked(true);
    });

    return () => {
      socket.off('joined_details');
      socket.off('joined_queue');
      socket.off('join_blocked');
    };
  }, [socket, userId]);

  const handleSubmitAnswer = (e) => {
    e.preventDefault();
    if (!answerInput.trim() || !socket) return;
    
    socket.emit('player_submit_answer', { answer: answerInput });
    setSubmitted(true);
    setTimeout(() => {
      setAnswerInput('');
      setSubmitted(false);
    }, 1500);
  };

  const handleBuzz = () => {
    if (socket && !gameState.buzzState.locked && !gameState.activeInputTeam) socket.emit('player_buzz');
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('draw_identity');
    }
  };

  const handleWalkOff = () => {
    if (socket) {
      socket.emit('walk_off');
    }
    localStorage.removeItem('feud_user_id');
    window.location.reload();
  };

  // Determine current play states
  const showBuzzer = gameState.status === 'PLAYING' && !gameState.activeInputTeam && !gameState.buzzState.locked;
  const showActiveTurn = gameState.status === 'PLAYING' && gameState.activeInputTeam;
  const isMyTeamActiveInput = gameState.activeInputTeam === team;
  const isDraw = gameState.winner === 'DRAW';
  const isWinner = isDraw || gameState.winner === team;

  useEffect(() => {
    if (gameState.status !== 'GAME_OVER') {
      finalSoundPlayed.current = false;
      return;
    }
    setLocalGameOver(true);
    if (finalSoundPlayed.current) return;
    finalSoundPlayed.current = true;
    localStorage.removeItem('feud_user_id');
    if (isDraw || isWinner) sounds.playWinner();
    else sounds.playLoser();
  }, [gameState.status, isDraw, isWinner]);

  // Render blocked screen if game is currently in progress
  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 text-center bg-darkBg">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 bg-white border-2 border-[#0D483F] shadow-[8px_8px_0_#0D483F] flex flex-col items-center relative"
        >
          <div className="w-16 h-16 bg-[#0D483F]/5 border-2 border-[#0D483F] rounded-none flex items-center justify-center mb-4 text-neonPink text-3xl">
            ⏳
          </div>

          <h2 className="text-3xl font-condensed font-bold uppercase tracking-tight text-neonPurple mb-2">
            {queuePosition > 0 ? "You are Queued" : "Game in Progress"}
          </h2>
          
          {queuePosition > 0 ? (
            <div className="bg-[#FAF6EE] border-2 border-[#0D483F] px-8 py-3 mb-6 rounded-none font-condensed font-black text-3xl text-[#0D483F]">
              Position: #{queuePosition}
            </div>
          ) : (
            <p className="text-xs text-neonPink font-extrabold uppercase tracking-widest mb-6">Wait in queue patiently</p>
          )}
          
          <div className="p-4 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none mb-6 text-sm text-[#0D483F] text-left">
            <p className="mb-2 font-condensed font-bold text-center text-neonPurple uppercase tracking-wider text-sm">About Android Club VIT Chennai</p>
            <p className="text-xs text-[#0D483F]/80 leading-relaxed">
              We are a community of passionate developers building future-ready mobile apps, organizing top-tier hackathons, and fostering innovation. Discover workshops, projects, and more at our booth!
            </p>
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-2 gap-4 w-full mb-6">
            <a
              href="https://www.instagram.com/androidvitc/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#0D483F] text-white border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider text-sm hover:opacity-90 transition cursor-pointer shadow-[3px_3px_0_#D2F128] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <InstagramIcon className="w-4 h-4" /> Instagram
            </a>
            <a
              href="https://www.androidclub.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#D2F128] text-[#0D483F] border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider text-sm hover:bg-[#0D483F] hover:text-white transition cursor-pointer shadow-[3px_3px_0_#0D483F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Globe className="w-4 h-4" /> Website
            </a>
          </div>

          <span className="text-[10px] font-condensed font-bold tracking-wider text-[#0D483F]/55 uppercase">11+ Years of Innovation</span>
        </motion.div>
      </div>
    );
  }

  // Render loading state while auto-registering
  if (!registered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#0D483F] animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-bold text-neonPurple mb-1">Connecting to Feud Arena...</h3>
        <p className="text-xs text-[#0D483F]/75">Assigning your random VIT alias and team...</p>
      </div>
    );
  }

  // Render Draw Identity Screen if not assigned to a team
  if (registered && !team && gameState.status !== 'GAME_OVER') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 text-center bg-darkBg">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 bg-white border-2 border-[#0D483F] shadow-[8px_8px_0_#0D483F] flex flex-col items-center relative"
        >
          <div className="w-16 h-16 bg-[#0D483F]/5 border-2 border-[#0D483F] rounded-none flex items-center justify-center mb-4 text-neonPurple text-3xl">
            🎭
          </div>

          <h2 className="text-3xl font-condensed font-bold uppercase tracking-tight text-[#0D483F] mb-1">Assign Team Identity</h2>
          <p className="text-xs font-condensed font-bold text-neonPink tracking-widest uppercase mb-6">VIT CHENNAI CLUB EXPO SPECIAL</p>
          
          <div className="p-5 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none mb-6 text-sm text-[#0D483F] text-left space-y-2">
            <p className="font-condensed font-bold text-center text-neonPurple uppercase tracking-widest text-xs">How it works</p>
            <p className="text-xs text-[#0D483F]/85 leading-relaxed text-center font-medium">
              Pick your player identity before the host starts. You’ll be placed in Team Alpha or Team Beta (up to 3 players per team).
            </p>
            <p className="text-xs text-[#0D483F]/60 text-center italic font-medium">
              Teams lock as soon as the game begins.
            </p>
          </div>

          <button
            onClick={() => socket.emit('draw_identity')}
            className="w-full py-3.5 bg-[#D2F128] text-[#0D483F] border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider rounded-none text-base hover:bg-[#0D483F] hover:text-white transition cursor-pointer shadow-[4px_4px_0_#0D483F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none mb-6"
          >
            Draw Alias & Join Team
          </button>

          <span className="text-[10px] font-condensed font-bold tracking-widest text-[#0D483F]/55 uppercase">Android Club VITC</span>
        </motion.div>
      </div>
    );
  }

  // Render Promotion Screen at GAME_OVER
  if (gameState.status === 'GAME_OVER' || localGameOver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 bg-white border-2 border-[#0D483F] shadow-[8px_8px_0_#0D483F] relative overflow-hidden flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-[#0D483F]/5 border-2 border-[#0D483F] rounded-none flex items-center justify-center mb-4 text-neonPurple text-3xl">
            🤖
          </div>

          <h2 className="text-3xl font-condensed font-bold uppercase tracking-tight text-[#0D483F] mb-1">
            {isDraw ? 'It’s a Draw!' : isWinner ? 'Congratulations!' : 'Great Game!'}
          </h2>
          <p className="text-xs font-condensed font-bold text-neonPink tracking-widest uppercase mb-6">
            {isDraw ? 'Both teams finished level.' : isWinner ? `${team} wins AC FEUD!` : "It's time for another team to play! Happy playing with you!"}
          </p>
          
          <div className="p-4 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none mb-6 text-sm text-[#0D483F] w-full">
            <p className="mb-2 font-condensed font-bold text-[#0D483F] uppercase tracking-wider text-sm">Stay in the Android Club loop</p>
            <p className="text-xs text-[#0D483F]/80">
              Follow Android Club VIT Chennai for projects, workshops, events, and the next chance to play.
            </p>
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-2 gap-4 w-full mb-6">
            <a
              href="https://www.instagram.com/androidvitc/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#0D483F] text-white border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider text-sm hover:opacity-90 transition cursor-pointer shadow-[3px_3px_0_#D2F128] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <InstagramIcon className="w-4 h-4" /> Instagram
            </a>
            <a
              href="https://www.androidclub.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#D2F128] border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider text-[#0D483F] hover:bg-[#0D483F] hover:text-white transition cursor-pointer shadow-[3px_3px_0_#0D483F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Globe className="w-4 h-4" /> Website
            </a>
          </div>

          <div className="text-[11px] font-condensed font-bold tracking-widest text-[#0D483F]/60 uppercase mb-4">
            FIND EVENTS, HACKATHONS & MORE AT OUR BOOTH!
          </div>

          <button
            onClick={handleWalkOff}
            className="text-xs font-condensed font-bold tracking-wide text-[#0D483F]/50 hover:text-neonPurple underline transition cursor-pointer uppercase"
          >
            Play again with a new team
          </button>
        </motion.div>
      </div>
    );
  }

  // Render Game Play Area
  return (
    <div className="flex flex-col min-h-screen px-4 py-6">
      {/* Player Header */}
      <div className="flex justify-between items-center mb-6 bg-white px-4 py-3 border-2 border-[#0D483F] shadow-[4px_4px_0_#0D483F]">
        <div>
          <span className="text-[10px] text-[#0D483F]/60 block font-bold">PLAYER</span>
          <span className="font-extrabold text-[#0D483F] text-sm">{name}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#0D483F]/60 block font-bold">TEAM</span>
          <span className="font-extrabold text-[#0D483F] text-sm">{team}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center">
        <AnimatePresence mode="wait">
          {/* LOBBY / WAITING FOR ROUND STATE */}
          {gameState.status === 'LOBBY' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center p-8 bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] max-w-sm w-full"
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#0D483F] animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-condensed font-bold uppercase tracking-wider text-[#0D483F] mb-2">Waiting for Host...</h3>
              <p className="text-xs text-[#0D483F]/70 mb-4">
                The game will start automatically when the host launches the first round. Get ready!
              </p>
              
              <div className="p-3 bg-[#FAF6EE] border-2 border-[#0D483F]/20 rounded-none mb-4 text-xs space-y-1 text-left">
                <div className="font-condensed uppercase tracking-wider"><span className="font-bold text-[#0D483F]/60">Your Alias:</span> <strong className="text-[#0D483F]">{name}</strong></div>
                <div className="font-condensed uppercase tracking-wider"><span className="font-bold text-[#0D483F]/60">Your Team:</span> <strong className="text-[#0D483F]">{team || 'Lobby'}</strong></div>
              </div>
            </motion.div>
          )}

          {showBuzzer && (
            <motion.div
              key="opening-buzz"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center max-w-sm w-full text-center"
            >
              <span className="text-xs font-condensed font-bold tracking-[0.16em] text-neonPink mb-3 uppercase">OPENING BUZZ</span>
              <h3 className="text-2xl font-condensed font-bold uppercase tracking-wider text-[#0D483F] mb-3">Who starts this round?</h3>
              <p className="text-sm text-[#0D483F]/70 mb-7">First buzz chooses the opening team. Then turns alternate every 15 seconds.</p>
              <button onClick={handleBuzz} className="w-56 h-56 rounded-full bg-[#0D483F] border-[7px] border-[#D2F128] text-[#D2F128] font-condensed font-black text-4xl shadow-[0_12px_0_rgba(13,72,63,0.3)] hover:scale-105 active:scale-95 transition cursor-pointer">
                BUZZ
              </button>
            </motion.div>
          )}

          {/* ACTIVE TEAM TURN STATE */}
          {showActiveTurn && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-8 bg-white border-2 border-[#0D483F] shadow-[8px_8px_0_#0D483F] relative overflow-hidden flex flex-col items-center text-center"
            >
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${isMyTeamActiveInput ? 'bg-[#D2F128]' : 'bg-[#0D483F]/30'}`} />
              
              <span className={`text-xs font-condensed font-black tracking-[0.2em] uppercase mb-2 ${isMyTeamActiveInput ? 'text-neonPink' : 'text-[#0D483F]/50'}`}>
                {isMyTeamActiveInput ? "YOUR TEAM'S TURN" : `${gameState.activeInputTeam?.toUpperCase()}'S TURN`}
              </span>
              
              <h4 className="text-xl font-condensed font-bold uppercase tracking-tight text-[#0D483F] mb-6 px-2">
                {gameState.currentQuestion?.question}
              </h4>

              {/* Big, Beautiful Circular Countdown Timer */}
              {isMyTeamActiveInput ? (
                <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                  <svg className="absolute w-full h-full transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="#FAF6EE"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke={gameState.timer <= 5 ? "#FF2E93" : "#0D483F"}
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={440}
                      animate={{
                        strokeDashoffset: (1 - (gameState.timer / (gameState.turnSeconds || 15))) * 440
                      }}
                      transition={{ duration: 0.5, ease: "linear" }}
                    />
                  </svg>
                  <div className="flex flex-col items-center justify-center">
                    <span className={`text-5xl font-black font-condensed tracking-tighter ${gameState.timer <= 5 ? 'text-neonPink animate-pulse' : 'text-[#0D483F]'}`}>
                      {gameState.timer}
                    </span>
                    <span className="text-[10px] font-condensed font-bold text-[#0D483F]/50 uppercase tracking-widest mt-1">
                      Seconds Left
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 mb-6">
                  <div className="w-16 h-16 bg-[#0D483F]/5 border-2 border-dashed border-[#0D483F]/30 rounded-full flex items-center justify-center mb-4 text-neonPink text-3xl animate-pulse">
                    💬
                  </div>
                  <span className="text-sm font-bold text-[#0D483F] uppercase tracking-wider">
                    Answering...
                  </span>
                </div>
              )}

              {isMyTeamActiveInput ? (
                <div className="p-4 bg-[#FAF6EE] border-2 border-dashed border-[#0D483F]/30 w-full">
                  <p className="text-sm font-bold text-[#0D483F] uppercase tracking-wide">
                    Answer Verbally Now!
                  </p>
                  <p className="text-xs text-[#0D483F]/70 mt-1 leading-relaxed">
                    Call out your answer to the host. The host will reveal it and award points on the admin board.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-[#FAF6EE]/50 border-2 border-dashed border-[#0D483F]/10 w-full">
                  <p className="text-sm font-bold text-[#0D483F]/65 uppercase tracking-wide">
                    Waiting for Other Team...
                  </p>
                  <p className="text-xs text-[#0D483F]/50 mt-1 leading-relaxed">
                    The other team is answering verbally to the host. Think of your answers in case they get a strike!
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {gameState.status === 'ROUND_END' && (
            <motion.div
              key="round-end"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-8 bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] max-w-sm w-full"
            >
              <Award className="w-12 h-12 text-neonPink mx-auto mb-4" />
              <h3 className="text-xl font-condensed font-bold uppercase tracking-wider text-neonPurple mb-2">Round Complete</h3>
              <p className="text-xs text-[#0D483F]/70">
                Both teams completed their three turns. Watch the board for the next question.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        {gameState.status === 'LOBBY' && (
          <button
            onClick={handleLeave}
            className="text-xs text-[#0D483F]/70 hover:text-neonPurple underline transition cursor-pointer font-semibold"
          >
            Draw New Identity
          </button>
        )}
        <button
          onClick={handleWalkOff}
          className="text-xs text-red-500/70 hover:text-red-600 underline transition cursor-pointer font-semibold"
        >
          Walk Off (Delete Profile)
        </button>
      </div>

      {/* CONGRATULATIONS CELEBRATION OVERLAY */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
          >
            <div className="bg-white border-4 border-[#0D483F] p-8 text-center shadow-[12px_12px_0_#D2F128] max-w-sm w-full flex flex-col items-center">
              <span className="text-4xl mb-3 animate-bounce">🎉</span>
              <h2 className="text-3xl font-condensed font-black uppercase tracking-tight text-[#0D483F] mb-1">
                +{pointsEarned} Points!
              </h2>
              <p className="text-xs font-condensed font-bold text-neonPink tracking-widest uppercase">
                Awesome Job Team!
              </p>
              <div className="mt-4 text-[10px] font-condensed font-bold tracking-widest text-[#0D483F]/55 uppercase">
                Keep it up!
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* STRIKE OVERLAY */}
      <AnimatePresence>
        {showStrikeOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="flex gap-8 strike-animate">
              <span className="text-9xl md:text-[12rem] font-black text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]">X</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
