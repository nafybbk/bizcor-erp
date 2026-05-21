import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 2000), // Start exit drift
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-30"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center relative">
        <motion.h1 
          className="text-[12vw] font-black tracking-tighter text-white leading-none uppercase"
          initial={{ scale: 0.5, opacity: 0, y: 100, rotateX: 60 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1, y: 0, rotateX: 0 } : {}}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          BizCor ERP
        </motion.h1>
      </div>
    </motion.div>
  );
}
