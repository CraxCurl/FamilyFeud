import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Gamepad2 } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [coords, setCoords] = useState({ x: 0, y: 150 });
  const [greeting, setGreeting] = useState("Welcome to AC Feud! 💚");
  const [key, setKey] = useState(0);

  useEffect(() => {
    const moveBugdroid = () => {
      const margin = 120;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Random position relative to screen center
      const nextX = (Math.random() * (width - margin * 2)) - (width / 2) + margin;
      const nextY = (Math.random() * (height - margin * 2)) - (height / 2) + margin;

      setCoords({ x: nextX, y: nextY });

      const quotes = [
        "Welcome to AC Feud! 💚",
        "Ready to play? 🎮",
        "Manifesting 11.11... ✨",
        "Android Club VITC rules! 🤖",
        "ESTD 2015! 📅",
        "Go Team Alpha! 🔴",
        "Go Team Beta! 🔵",
        "Tap me to make me jump! 🚀",
        "Let's see who's faster! ⚡"
      ];
      setGreeting(quotes[Math.floor(Math.random() * quotes.length)]);
      setKey(prev => prev + 1);
    };

    const interval = setInterval(moveBugdroid, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="acfeud-landing select-none relative overflow-hidden min-h-screen flex flex-col items-center justify-center bg-darkBg text-white w-full">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="acfeud-landing__intro"
      >
        <p className="acfeud-eyebrow">ANDROID CLUB VIT CHENNAI PRESENTS</p>
        <h1>THE FEUD<br /><em>STARTS HERE.</em></h1>
        <p className="acfeud-landing__copy">
          A live team game built for fast answers, loud cheers, and a little friendly chaos.
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.55 }}
        className="flex justify-center w-full max-w-sm mt-10 z-10"
      >
        <button onClick={() => navigate('/play')} className="acfeud-choice acfeud-choice--dark w-full">
          <span className="acfeud-choice__icon"><Gamepad2 size={26} /></span>
          <span className="acfeud-choice__label">PLAY THE FEUD</span>
          <span className="acfeud-choice__text">Join a team and send your answers during your timed turn.</span>
          <ArrowUpRight className="acfeud-choice__arrow" size={23} />
        </button>
      </motion.section>

      <p className="acfeud-landing__footer">ONE QUESTION. TWO TEAMS. THREE TURNS EACH.</p>

      {/* Floating Bugdroid Companion */}
      <motion.div
        drag
        dragConstraints={{ left: -window.innerWidth/2, right: window.innerWidth/2, top: -window.innerHeight/2, bottom: window.innerHeight/2 }}
        animate={{ x: coords.x, y: coords.y }}
        transition={{ type: "spring", damping: 15, stiffness: 40 }}
        className="absolute cursor-grab active:cursor-grabbing flex flex-col items-center z-20 group"
        whileTap={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
        onClick={() => {
          setCoords(prev => ({ ...prev, y: prev.y - 45 }));
          setGreeting("Weee! 🚀");
          setKey(prev => prev + 1);
        }}
      >
        {/* Speech Bubble */}
        <AnimatePresence mode="wait">
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            className="absolute bottom-[85px] bg-[#3DDC84] text-darkBg text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xl whitespace-nowrap border border-white/20 select-none flex items-center gap-1"
          >
            {greeting}
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#3DDC84]" />
          </motion.div>
        </AnimatePresence>

        {/* Bugdroid SVG */}
        <svg viewBox="0 0 100 100" className="w-16 h-16 filter drop-shadow-[0_4px_12px_rgba(61,220,132,0.45)] group-hover:scale-110 transition-transform">
          {/* Antennae */}
          <motion.rect 
            x="30" y="8" width="4" height="15" rx="2" transform="rotate(-20 32 23)" fill="#3DDC84"
            animate={{ rotate: [-20, -35, -20] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
          <motion.rect 
            x="66" y="8" width="4" height="15" rx="2" transform="rotate(20 68 23)" fill="#3DDC84"
            animate={{ rotate: [20, 35, 20] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.3 }}
          />
          {/* Head */}
          <path d="M25,38 A25,25 0 0,1 75,38 Z" fill="#3DDC84" />
          {/* Eyes */}
          <circle cx="40" cy="28" r="3" fill="#0D483F" />
          <circle cx="60" cy="28" r="3" fill="#0D483F" />
          {/* Body */}
          <rect x="25" y="42" width="50" height="38" rx="4" fill="#3DDC84" />
          {/* Arms */}
          <motion.rect 
            x="15" y="42" width="8" height="28" rx="4" fill="#3DDC84"
            animate={{ rotate: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
          <motion.rect 
            x="77" y="42" width="8" height="28" rx="4" fill="#3DDC84"
            animate={{ rotate: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.2 }}
          />
          {/* Legs */}
          <rect x="36" y="80" width="8" height="12" rx="4" fill="#3DDC84" />
          <rect x="56" y="80" width="8" height="12" rx="4" fill="#3DDC84" />
        </svg>
      </motion.div>
    </main>
  );
}
