import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { useEffect, useRef } from 'react';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

export const SCENE_DURATIONS: Record<string, number> = {
  hook: 3000,
  problem: 5000,
  solution: 6000,
  gst: 6000,
  features: 7000,
  cta: 7000
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook: Scene1,
  problem: Scene2,
  solution: Scene3,
  gst: Scene4,
  features: Scene5,
  cta: Scene6,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <>
      <div className="relative w-full h-screen overflow-hidden bg-bg-dark font-display text-text-inverse">
        {/* Persistent Background Layer */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}bg-texture-1.png)` }}
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 2, -2, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}bg-texture-2.png)` }}
            animate={{
              x: ['-5%', '5%', '-5%'],
              y: ['-5%', '5%', '-5%'],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute w-[80vw] h-[80vw] rounded-full blur-[100px] opacity-20 bg-accent mix-blend-screen"
            animate={{
              x: ['-20vw', '40vw', '-10vw'],
              y: ['-20vh', '30vh', '10vh'],
              scale: [1, 1.5, 0.8],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Persistent Midground Accent Line */}
        <motion.div
          className="absolute h-1 bg-accent z-20"
          animate={{
            left: ['0%', '10%', '30%', '5%', '50%', '20%'][sceneIndex] ?? '0%',
            width: ['10%', '30%', '50%', '20%', '80%', '40%'][sceneIndex] ?? '10%',
            top: ['50%', '30%', '80%', '20%', '90%', '60%'][sceneIndex] ?? '50%',
          }}
          transition={{ duration: 1.2, type: 'spring', bounce: 0.2 }}
        />

        {/* Powered by tag - persists across all scenes */}
        <div className="absolute bottom-[5vh] left-0 w-full text-center z-50">
          <motion.p
            className="font-mono text-text-inverse/60 text-[1.5vw] tracking-[0.2em] uppercase"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            Powered by NAEWTGROUP.COM
          </motion.p>
        </div>

        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </>
  );
}
