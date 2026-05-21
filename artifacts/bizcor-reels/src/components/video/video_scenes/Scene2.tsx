import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 4000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="text-[8vw] font-black italic text-accent transform -rotate-6"
        initial={{ scale: 3, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        Excel?
      </motion.div>
      <motion.div 
        className="text-[7vw] font-black text-white mt-4"
        initial={{ x: '50vw', opacity: 0 }}
        animate={phase >= 2 ? { x: 0, opacity: 1 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        Manual ledger?
      </motion.div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {['Data Loss', 'Errors', 'Slow', 'Tension'].map((word, i) => (
          <motion.div
            key={i}
            className="absolute text-[4vw] font-black text-white/20 uppercase"
            initial={{ 
              x: Math.random() * 100 - 50 + 'vw', 
              y: Math.random() * 100 - 50 + 'vh',
              scale: 0, rotate: Math.random() * 90 - 45
            }}
            animate={phase >= 3 ? {
              scale: [0, 2, 0],
              opacity: [0, 0.8, 0],
              rotate: '+=30deg'
            } : {}}
            transition={{ duration: 1.5, delay: i * 0.2, ease: 'easeOut' }}
          >
            {word}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
