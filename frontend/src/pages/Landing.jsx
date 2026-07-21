import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Gamepad2 } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [footerX, setFooterX] = useState(0);
  const [greeting, setGreeting] = useState("Welcome to AC Feud! 💚");
  const [key, setKey] = useState(0);

  useEffect(() => {
    const moveFooterBugdroid = () => {
      // Calculate a random X offset within a safe screen range
      const range = window.innerWidth * 0.3;
      const nextX = (Math.random() * range * 2) - range;
      setFooterX(nextX);

      const quotes = [
        "Welcome to AC Feud! 💚",
        "Ready to play? 🎮",
        "Manifesting 11.11... ✨",
        "Android Club VITC rules! 🤖",
        "ESTD 2015! 📅",
        "Go Team Alpha! 🔴",
        "Go Team Beta! 🔵",
        "Peek-a-boo! 👀",
        "Let's see who's faster! ⚡"
      ];
      setGreeting(quotes[Math.floor(Math.random() * quotes.length)]);
      setKey(prev => prev + 1);
    };

    const interval = setInterval(moveFooterBugdroid, 6000);
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

      {/* Peaking Android Head in Footer */}
      <motion.div
        animate={{ x: footerX }}
        transition={{ type: "spring", damping: 18, stiffness: 30 }}
        className="absolute bottom-0 flex flex-col items-center z-20 cursor-pointer"
        whileHover={{ y: -5 }}
        onClick={() => {
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
            className="absolute bottom-[55px] bg-[#3DDC84] text-darkBg text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xl whitespace-nowrap border border-white/20 select-none"
          >
            {greeting}
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#3DDC84]" />
          </motion.div>
        </AnimatePresence>

        {/* Android Head SVG */}
        <svg viewBox="0 0 100 50" className="w-24 h-12 filter drop-shadow-[0_-4px_12px_rgba(61,220,132,0.3)]">
          {/* Antennae */}
          <motion.rect 
            x="30" y="2" width="4" height="15" rx="2" transform="rotate(-20 32 17)" fill="#3DDC84"
            animate={{ rotate: [-20, -32, -20] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
          <motion.rect 
            x="66" y="2" width="4" height="15" rx="2" transform="rotate(20 68 17)" fill="#3DDC84"
            animate={{ rotate: [20, 32, 20] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.3 }}
          />
          {/* Head */}
          <path d="M25,32 A25,25 0 0,1 75,32 Z" fill="#3DDC84" />
          {/* Eyes looking side-to-side */}
          <motion.circle 
            cy="22" r="3" fill="#0D483F"
            animate={{ cx: [39, 43, 39] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />
          <motion.circle 
            cy="22" r="3" fill="#0D483F"
            animate={{ cx: [57, 61, 57] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />
        </svg>
      </motion.div>
    </main>
  );
}
