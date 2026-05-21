import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2000),
      setTimeout(() => setPhase(5), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      initial={{ rotateY: -90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      exit={{ rotateY: 90, opacity: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
      style={{ perspective: 1000 }}
    >
      <motion.h2 
        className="text-[7vw] font-black text-white absolute top-[15vh]"
        initial={{ y: -50, opacity: 0 }}
        animate={phase >= 1 ? { y: 0, opacity: 1 } : {}}
      >
        GST <span className="text-accent">100% Ready</span>
      </motion.h2>

      <div className="relative flex items-center justify-center w-[40vw] h-[40vw] mt-[10vh]">
        {/* Invoice SVG */}
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.5" className="absolute w-full h-full opacity-30">
          <motion.path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            initial={{ pathLength: 0 }}
            animate={phase >= 1 ? { pathLength: 1 } : {}}
            transition={{ duration: 2 }}
          />
          <motion.polyline points="14 2 14 8 20 8" initial={{ pathLength: 0 }} animate={phase >= 1 ? { pathLength: 1 } : {}} transition={{ duration: 1, delay: 1 }} />
          <motion.line x1="16" y1="13" x2="8" y2="13" initial={{ pathLength: 0 }} animate={phase >= 1 ? { pathLength: 1 } : {}} transition={{ duration: 0.5, delay: 1.5 }} />
          <motion.line x1="16" y1="17" x2="8" y2="17" initial={{ pathLength: 0 }} animate={phase >= 1 ? { pathLength: 1 } : {}} transition={{ duration: 0.5, delay: 1.7 }} />
          <motion.polyline points="10 9 9 9 8 9" initial={{ pathLength: 0 }} animate={phase >= 1 ? { pathLength: 1 } : {}} />
        </svg>

        <div className="flex flex-col gap-6 z-10">
          {[
            { text: "GSTR-1 Auto-fill", phase: 2 },
            { text: "GSTR-3B Summary", phase: 3 },
            { text: "JSON Export", phase: 4 },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-4 bg-primary/80 border border-white/20 px-8 py-4 rounded-xl backdrop-blur-md shadow-2xl"
              initial={{ x: -100, opacity: 0, rotateX: 45 }}
              animate={phase >= item.phase ? { x: 0, opacity: 1, rotateX: 0 } : {}}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent">
                <motion.polyline 
                  points="20 6 9 17 4 12" 
                  initial={{ pathLength: 0 }}
                  animate={phase >= item.phase ? { pathLength: 1 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 }}
                />
              </svg>
              <span className="text-[2.5vw] font-bold text-white">{item.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
