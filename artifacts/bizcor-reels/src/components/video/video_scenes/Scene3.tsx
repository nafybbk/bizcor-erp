import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 5000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-30"
      initial={{ clipPath: 'polygon(50% 0, 50% 0, 50% 100%, 50% 100%)' }}
      animate={{ clipPath: 'polygon(0% 0, 100% 0, 100% 100%, 0% 100%)' }}
      exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-[10vh] w-full text-center">
        <motion.h2 
          className="text-[5vw] font-black text-white"
          initial={{ y: -50, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : {}}
        >
          Cloud ya LAN <span className="text-accent">— aap choose karo</span>
        </motion.h2>
      </div>

      <div className="absolute inset-0 flex mt-[20vh]">
        {/* Left Side: Cloud */}
        <div className="flex-1 flex flex-col items-center justify-center border-r-2 border-white/10 relative">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <motion.path 
              d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={phase >= 2 ? { pathLength: 1, opacity: 1, fill: 'rgba(255,255,255,0.1)' } : {}}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          </svg>
          <motion.div 
            className="mt-8 px-6 py-2 bg-white/10 rounded-full font-mono text-[2vw] backdrop-blur-md"
            initial={{ scale: 0, opacity: 0 }}
            animate={phase >= 3 ? { scale: 1, opacity: 1 } : {}}
            transition={{ type: 'spring' }}
          >
            ANYWHERE ACCESS
          </motion.div>
        </div>

        {/* Right Side: LAN */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <motion.rect x="2" y="2" width="20" height="8" rx="2" ry="2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={phase >= 2 ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
            />
            <motion.rect x="2" y="14" width="20" height="8" rx="2" ry="2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={phase >= 2 ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, ease: "easeInOut", delay: 0.4 }}
            />
            <motion.line x1="6" y1="6" x2="6.01" y2="6" initial={{opacity:0}} animate={phase>=2?{opacity:1}:{}} />
            <motion.line x1="6" y1="18" x2="6.01" y2="18" initial={{opacity:0}} animate={phase>=2?{opacity:1}:{}} />
          </svg>
          <motion.div 
            className="mt-8 px-6 py-2 bg-accent/20 rounded-full text-accent font-mono text-[2vw] backdrop-blur-md"
            initial={{ scale: 0, opacity: 0 }}
            animate={phase >= 3 ? { scale: 1, opacity: 1 } : {}}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            OFFLINE CONTROL
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
