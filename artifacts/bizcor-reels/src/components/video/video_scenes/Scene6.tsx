import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 6000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-primary"
      initial={{ clipPath: 'inset(100% 0 0 0)' }}
      animate={{ clipPath: 'inset(0% 0 0 0)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="text-[8vw] font-black text-white text-center leading-tight"
        initial={{ y: 50, opacity: 0 }}
        animate={phase >= 1 ? { y: 0, opacity: 1 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        30 DIN <br/> <span className="text-accent text-[10vw]">FREE TRIAL</span>
      </motion.div>

      <motion.div
        className="mt-12 border-2 border-white/20 px-10 py-4 rounded-full bg-white/5 backdrop-blur-md"
        initial={{ scale: 0, opacity: 0 }}
        animate={phase >= 2 ? { scale: 1, opacity: 1 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <span className="font-mono text-[3vw] text-white tracking-widest">erp.naewtgroup.com</span>
      </motion.div>
    </motion.div>
  );
}
