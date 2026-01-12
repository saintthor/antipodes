
import React from 'react';

interface MoleAnimationProps {
  isAnimating: boolean;
  onFinish: () => void;
  direction: 'down' | 'up';
}

const MoleAnimation: React.FC<MoleAnimationProps> = ({ isAnimating, onFinish, direction }) => {
  React.useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        onFinish();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, onFinish]);

  if (!isAnimating) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Semi-transparent Earth core visual during transition */}
        <div className={`absolute inset-0 bg-amber-900/40 transition-opacity duration-1000 ${isAnimating ? 'opacity-100' : 'opacity-0'}`} />
        
        <div className="mole-animating flex flex-col items-center">
            {/* SVG Mole Character */}
            <svg width="120" height="120" viewBox="0 0 100 100" className="drop-shadow-2xl">
                <circle cx="50" cy="60" r="35" fill="#8B4513" /> {/* Body */}
                <circle cx="50" cy="35" r="25" fill="#8B4513" /> {/* Head */}
                <circle cx="40" cy="30" r="4" fill="black" /> {/* Eye L */}
                <circle cx="60" cy="30" r="4" fill="black" /> {/* Eye R */}
                <ellipse cx="50" cy="40" rx="8" ry="5" fill="#FFB6C1" /> {/* Nose */}
                <path d="M 40 70 Q 50 85 60 70" fill="none" stroke="white" strokeWidth="2" /> {/* Belly patch */}
                <path d="M 20 40 L 10 30" stroke="#8B4513" strokeWidth="4" /> {/* Whisker */}
                <path d="M 80 40 L 90 30" stroke="#8B4513" strokeWidth="4" /> {/* Whisker */}
            </svg>
            <div className="mt-4 px-6 py-2 bg-white rounded-full shadow-lg border-2 border-amber-600 font-bold text-amber-800">
                {direction === 'down' ? 'Digging down...' : 'Coming out!'}
            </div>
        </div>
      </div>
    </div>
  );
};

export default MoleAnimation;
