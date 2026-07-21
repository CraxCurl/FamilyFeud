import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Gamepad2 } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="acfeud-landing select-none">
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
        className="flex justify-center w-full max-w-sm mt-10"
      >
        <button onClick={() => navigate('/play')} className="acfeud-choice acfeud-choice--dark w-full">
          <span className="acfeud-choice__icon"><Gamepad2 size={26} /></span>
          <span className="acfeud-choice__label">PLAY THE FEUD</span>
          <span className="acfeud-choice__text">Join a team and send your answers during your timed turn.</span>
          <ArrowUpRight className="acfeud-choice__arrow" size={23} />
        </button>
      </motion.section>

      <p className="acfeud-landing__footer">ONE QUESTION. TWO TEAMS. THREE TURNS EACH.</p>
    </main>
  );
}
