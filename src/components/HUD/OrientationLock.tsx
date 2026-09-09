import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw, Maximize2 } from 'lucide-react';

export const OrientationLock: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isTouch =
        'ontouchstart' in window ||
        (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0);
      
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Consider mobile/tablet if touch is supported and either dimension is under 1100px
      const mobileDevice = isTouch && (width < 1100 || height < 1100);
      setIsMobile(mobileDevice);

      // Portrait check: height is greater than width
      setIsPortrait(height > width);
    };

    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleRequestFullscreenLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      // Attempt screen orientation lock if supported by the browser
      const screenAny = screen as any;
      if (screenAny?.orientation?.lock) {
        await screenAny.orientation.lock('landscape');
      }
    } catch {
      // Browsers may reject lock without user gesture or on unsupported platforms
    }
  };

  if (!isMobile || !isPortrait) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
      {/* Background neon ambient glow */}
      <div className="absolute w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Rotating Phone Graphic */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="w-24 h-24 rounded-3xl bg-cyan-950/40 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_40px_rgba(0,240,255,0.25)]">
          <Smartphone className="w-12 h-12 text-cyan-400 animate-[spin_3s_ease-in-out_infinite]" />
        </div>
        <div className="absolute -top-2 -right-2 p-1.5 rounded-full bg-amber-500 text-slate-950 shadow-md">
          <RotateCw className="w-4 h-4 animate-spin" />
        </div>
      </div>

      {/* Heading */}
      <h2 className="text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 drop-shadow mb-2">
        ROTATE YOUR DEVICE
      </h2>

      {/* Badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-4">
        <span>Landscape Mode Required</span>
      </div>

      {/* Description */}
      <p className="max-w-xs text-sm text-gray-300 leading-relaxed mb-6 font-medium">
        Deep Rush City is engineered exclusively for horizontal widescreen play. Please turn your phone sideways to unlock the 3D controls.
      </p>

      {/* Action Button */}
      <button
        onClick={handleRequestFullscreenLandscape}
        className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-cyan-500/30 active:scale-95 transition-all flex items-center gap-2"
      >
        <Maximize2 className="w-4 h-4" />
        <span>Switch to Fullscreen</span>
      </button>
    </div>
  );
};
