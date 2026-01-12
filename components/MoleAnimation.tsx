
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
        {/* Layered earth transition effect */}
        <div className={`absolute inset-0 bg-slate-900 transition-opacity duration-700 ${isAnimating ? 'opacity-90' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#451a03_100%)] opacity-60"></div>
        </div>
        
        <div className="mole-animating flex flex-col items-center">
            {/* SVG Mole Character with better details */}
            <svg width="150" height="150" viewBox="0 0 100 100" className="drop-shadow-[0_20px_50px_rgba(251,191,36,0.3)]">
                <circle cx="50" cy="65" r="32" fill="#78350f" /> {/* Body */}
                <circle cx="50" cy="38" r="24" fill="#78350f" /> {/* Head */}
                <circle cx="42" cy="34" r="3.5" fill="black" /> {/* Eye L */}
                <circle cx="58" cy="34" r="3.5" fill="black" /> {/* Eye R */}
                <circle cx="50" cy="42" r="7" fill="#fecaca" /> {/* Nose */}
                <path d="M 35 70 Q 50 82 65 70" fill="none" stroke="#a16207" strokeWidth="2.5" strokeLinecap="round" /> {/* Belly */}
                
                {/* Paws */}
                <ellipse cx="25" cy="60" rx="6" ry="10" fill="#78350f" transform="rotate(-30 25 60)" />
                <ellipse cx="75" cy="60" rx="6" ry="10" fill="#78350f" transform="rotate(30 75 60)" />
            </svg>
            
            <div className="mt-8 px-10 py-4 bg-amber-50 rounded-3xl shadow-2xl border-4 border-amber-600 font-black text-amber-900 text-lg uppercase tracking-widest animate-bounce">
                {direction === 'down' ? 'Digging to the Core...' : 'Popping up at the Antipode!'}
            </div>
            
            <div className="mt-4 flex gap-1">
                <div className="w-3 h-3 bg-amber-600 rounded-full animate-ping"></div>
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-ping [animation-delay:0.2s]"></div>
                <div className="w-3 h-3 bg-amber-400 rounded-full animate-ping [animation-delay:0.4s]"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MoleAnimation;
