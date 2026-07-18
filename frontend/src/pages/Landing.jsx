import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Settings, Monitor, Sparkles } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16 text-center select-none">
      {/* Animated Logo Container */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 text-xs font-semibold tracking-wider text-pink-400 uppercase border rounded-full glass-panel border-pink-500/30">
          <Sparkles className="w-3.5 h-3.5 animate-spin duration-3000" />
          Android Club VIT Chennai Presents
        </div>
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-2">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-neonPurple via-neonPink to-neonCyan text-glow-purple">
            SURVEY SAYS
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-400 font-medium max-w-lg mx-auto">
          The ultimate real-time multiplayer Family Feud experience customized for Club Expo 2026.
        </p>
      </motion.div>

      {/* Hero Interactive Panels */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full mt-6"
      >
        {/* Join as Player Card */}
        <div
          onClick={() => navigate('/play')}
          className="glass-panel glass-panel-interactive p-8 rounded-2xl cursor-pointer flex flex-col items-center text-center group"
        >
          <div className="p-4 bg-neonPink/10 rounded-xl mb-4 group-hover:bg-neonPink/20 transition-colors border border-neonPink/20">
            <Gamepad2 className="w-8 h-8 text-neonPink animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-neonPurple mb-2">Join as Player</h3>
          <p className="text-sm text-[#0D483F]/80">
            Scan the QR code on the main screen to automatically get assigned a team and buzz in from your phone!
          </p>
        </div>

        {/* TV Display Card */}
        <div
          onClick={() => navigate('/display')}
          className="glass-panel glass-panel-interactive p-8 rounded-2xl cursor-pointer flex flex-col items-center text-center group"
        >
          <div className="p-4 bg-neonCyan/10 rounded-xl mb-4 group-hover:bg-neonCyan/20 transition-colors border border-neonCyan/20">
            <Monitor className="w-8 h-8 text-neonCyan animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-neonPurple mb-2">TV Display Board</h3>
          <p className="text-sm text-[#0D483F]/80">
            Open the main game board and live scores. Includes a slide-up Host Control drawer for game operations.
          </p>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-16 text-[#0D483F]/60 text-xs font-semibold tracking-widest uppercase flex flex-col items-center gap-2"
      >
        <span>Android Club VITC</span>
        <div className="w-12 h-[1px] bg-gradient-to-r from-neonPurple to-neonPink" />
        <span>11+ Years of Innovation</span>
      </motion.div>
    </div>
  );
}
