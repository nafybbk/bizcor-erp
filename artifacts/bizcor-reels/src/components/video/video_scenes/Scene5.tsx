import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3200),
      setTimeout(() => setPhase(5), 4200),
      setTimeout(() => setPhase(6), 6000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const features = [
    { text: "INVOICING", x: '-10vw', y: '-20vh', color: 'text-white' },
    { text: "INVENTORY", x: '10vw', y: '15vh', color: 'text-accent' },
    { text: "ACCOUNTS", x: '-15vw', y: '25vh', color: 'text-white' },
    { text: "CASH & BANK", x: '20vw', y: '-10vh', color: 'text-accent' },
    { text: "DATA BACKUP", x: '0vw', y: '0vh', color: 'text-white' },
  ];

  return (
    <motion.div 
      className="absolute inset-0 z-30"
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, filter: 'blur(20px)' }}
      transition={{ duration: 0.6 }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {features.map((f, i) => (
          <motion.div
            key={i}
            className={`absolute text-[9vw] font-black uppercase tracking-tighter ${f.color} drop-shadow-2xl`}
            initial={{ scale: 0, opacity: 0, x: f.x, y: f.y, rotateZ: Math.random() * 20 - 10 }}
            animate={phase >= i + 1 ? { 
              scale: [0, 1.2, 1], 
              opacity: [0, 1, 0.8],
            } : {}}
            transition={{ duration: 0.4, type: 'spring' }}
            style={{ zIndex: i }}
          >
            {f.text}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
