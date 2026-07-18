import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { Smartphone, Send, Clock, UserCheck, ShieldAlert, Award, Globe, Sparkles } from 'lucide-react';

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
    });

    socket.on('join_blocked', () => {
      setIsBlocked(true);
    });

    return () => {
      socket.off('joined_details');
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
  const isMyTeamActiveInput = gameState.activeInputTeam === team;
  const showAnswerInput = gameState.status === 'PLAYING' && isMyTeamActiveInput;
  const showWaiting = gameState.status === 'PLAYING' && !isMyTeamActiveInput;

  // Render blocked screen if game is currently in progress
  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 text-center bg-darkBg">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 rounded-2xl glass-panel border-[#0D483F]/15 flex flex-col items-center shadow-lg relative"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neonPurple via-neonPink to-neonCyan" />
          
          <div className="w-16 h-16 bg-neonPink/10 border border-neonPink/20 rounded-full flex items-center justify-center mb-4 text-neonPink text-3xl">
            ⏳
          </div>

          <h2 className="text-2xl font-black text-neonPurple mb-2">Game in Progress</h2>
          <p className="text-xs text-neonPink font-extrabold uppercase tracking-widest mb-6">Wait in queue patiently</p>
          
          <div className="p-4 bg-neonPurple/5 border border-neonPurple/10 rounded-xl mb-6 text-sm text-[#0D483F] text-left">
            <p className="mb-2 font-black text-center text-neonPurple">About Android Club VIT Chennai</p>
            <p className="text-xs text-[#0D483F]/80 leading-relaxed">
              We are a community of passionate developers building future-ready mobile apps, organizing top-tier hackathons, and fostering innovation. Discover recruitments and more at our booth!
            </p>
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-2 gap-4 w-full mb-6">
            <a
              href="https://www.instagram.com/androidvitc/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#0D483F] text-white rounded-xl font-bold text-sm hover:opacity-90 transition cursor-pointer"
            >
              <InstagramIcon className="w-4 h-4" /> Instagram
            </a>
            <a
              href="https://androidclubvitc.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#D2F128] text-[#0D483F] border border-[#0D483F] rounded-xl font-bold text-sm hover:bg-[#0D483F] hover:text-white transition cursor-pointer"
            >
              <Globe className="w-4 h-4" /> Website
            </a>
          </div>

          <span className="text-[10px] text-[#0D483F]/60">11+ Years of Innovation</span>
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
          className="w-full max-w-md p-8 rounded-2xl glass-panel border-[#0D483F]/15 flex flex-col items-center shadow-lg relative"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neonPurple via-neonPink to-neonCyan" />
          
          <div className="w-16 h-16 bg-neonPurple/10 border border-neonPurple/20 rounded-full flex items-center justify-center mb-4 text-neonPurple text-3xl">
            🎭
          </div>

          <h2 className="text-2xl font-black text-neonPurple mb-2">Assign Team Identity</h2>
          <p className="text-xs text-[#0D483F]/60 font-semibold mb-6">VIT CHENNAI CLUB EXPO SPECIAL</p>
          
          <div className="p-4 bg-neonPurple/5 border border-neonPurple/10 rounded-xl mb-6 text-sm text-[#0D483F] text-left space-y-2">
            <p className="font-bold text-center text-neonPurple">How it works:</p>
            <p className="text-xs text-[#0D483F]/80 leading-relaxed text-center">
              Click the button below to draw a random VIT coder alias and enroll in either Team Alpha or Team Beta (max 3 per team).
            </p>
            <p className="text-xs text-[#0D483F]/60 text-center italic">
              Note: Team assignments reset at the end of each round!
            </p>
          </div>

          <button
            onClick={() => socket.emit('draw_identity')}
            className="w-full py-3 bg-[#0D483F] text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-md mb-6"
          >
            Draw Alias & Join Team
          </button>

          <span className="text-[10px] text-[#0D483F]/50 font-semibold uppercase">Android Club VITC</span>
        </motion.div>
      </div>
    );
  }

  // Render Promotion Screen at GAME_OVER
  if (gameState.status === 'GAME_OVER') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 rounded-2xl glass-panel relative overflow-hidden flex flex-col items-center border-[#0D483F]/10"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neonPurple via-neonPink to-neonCyan" />
          
          <div className="w-16 h-16 bg-neonPurple/10 rounded-full flex items-center justify-center mb-4 text-neonPurple text-3xl">
            🤖
          </div>

          <h2 className="text-3xl font-extrabold text-neonPurple mb-2">Thank You!</h2>
          <p className="text-sm text-neonPink font-semibold mb-6">Android Club VIT Chennai</p>
          
          <div className="p-4 bg-neonPurple/5 border border-neonPurple/15 rounded-xl mb-6 text-sm text-[#0D483F]">
            <p className="mb-2 font-bold">11+ Years of Innovation</p>
            <p className="text-xs text-[#0D483F]/80">
              We are a community of passionate developers building future-ready mobile apps, organizing top-tier hackathons, and fostering innovation.
            </p>
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-2 gap-4 w-full mb-6">
            <a
              href="https://www.instagram.com/androidvitc/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#0D483F] text-white rounded-xl font-bold text-sm hover:opacity-90 transition cursor-pointer"
            >
              <InstagramIcon className="w-4 h-4" /> Instagram
            </a>
            <a
              href="https://androidclubvitc.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-[#D2F128] border border-[#0D483F] rounded-xl font-bold text-[#0D483F] hover:bg-[#0D483F] hover:text-white transition cursor-pointer"
            >
              <Globe className="w-4 h-4" /> Website
            </a>
          </div>

          <div className="text-xs text-[#0D483F]/60 font-semibold mb-4">
            FIND RECRUITMENTS & MORE AT OUR BOOTH!
          </div>

          <button
            onClick={handleLeave}
            className="text-xs text-[#0D483F]/50 hover:text-neonPurple underline transition cursor-pointer"
          >
            Leave Game
          </button>
        </motion.div>
      </div>
    );
  }

  // Render Game Play Area
  return (
    <div className="flex flex-col min-h-screen px-4 py-6">
      {/* Player Header */}
      <div className="flex justify-between items-center mb-6 glass-panel px-4 py-3 rounded-xl border-[#0D483F]/10">
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
              className="text-center p-8 glass-panel rounded-2xl max-w-sm w-full border-[#0D483F]/10"
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#0D483F] animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#0D483F] mb-2">Waiting for Host...</h3>
              <p className="text-xs text-[#0D483F]/70 mb-4">
                The game will start automatically when the host launches the first round. Get ready!
              </p>
              
              <div className="p-3 bg-[#FAF6EE] border border-[#0D483F]/10 rounded-xl mb-4 text-xs space-y-1 text-left">
                <div><span className="font-bold text-[#0D483F]/60">Your Alias:</span> <strong className="text-neonPurple">{name}</strong></div>
                <div><span className="font-bold text-[#0D483F]/60">Your Team:</span> <strong className="text-[#0D483F]">{team || 'Lobby (Waiting for assignment)'}</strong></div>
              </div>
            </motion.div>
          )}

          {/* INPUT ANSWER STATE (ACTIVE TEAM TURN) */}
          {showAnswerInput && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="w-full max-w-md p-6 rounded-2xl glass-panel relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#0D483F]" />
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-[#0D483F] tracking-wider uppercase">YOUR TURN TO ANSWER</span>
                <div className="flex items-center gap-1 text-neonPink text-xs font-bold">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>{gameState.timer}s</span>
                </div>
              </div>

              <h4 className="text-lg font-bold text-neonPurple mb-4">{gameState.currentQuestion?.question}</h4>

              <form onSubmit={handleSubmitAnswer} className="space-y-4">
                <input
                  type="text"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={submitted}
                  required
                  autoFocus
                  className="w-full px-4 py-3 bg-[#FAF6EE] border border-[#0D483F]/20 rounded-xl text-[#0D483F] placeholder-[#0D483F]/40 focus:outline-none focus:border-[#0D483F]/50 focus:ring-1 focus:ring-[#0D483F]/50 transition text-lg"
                />

                <button
                  type="submit"
                  disabled={submitted}
                  className="w-full py-3 bg-[#0D483F] text-white rounded-xl font-bold hover:bg-[#0D483F]/90 active:scale-[0.98] transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" /> {submitted ? 'Sending...' : 'Submit Answer'}
                </button>
              </form>
            </motion.div>
          )}

          {/* WAITING FOR THE OTHER TEAM'S TURN */}
          {showWaiting && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center p-8 glass-panel rounded-2xl max-w-sm w-full flex flex-col items-center border-[#0D483F]/10"
            >
              <ShieldAlert className="w-12 h-12 text-neonPink mb-4 animate-pulse" />
              <h3 className="text-xl font-bold text-neonPurple mb-2">{gameState.activeInputTeam}'s Turn</h3>
              <p className="text-xs text-[#0D483F]/70">
                The turn changes automatically every 15 seconds. Your team will get three timed turns this round.
              </p>
            </motion.div>
          )}

          {gameState.status === 'ROUND_END' && (
            <motion.div
              key="round-end"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-8 glass-panel rounded-2xl max-w-sm w-full border-[#0D483F]/10"
            >
              <Award className="w-12 h-12 text-neonPink mx-auto mb-4" />
              <h3 className="text-xl font-bold text-neonPurple mb-2">Round Complete</h3>
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
    </div>
  );
}
