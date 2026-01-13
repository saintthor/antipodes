
import React from 'react';

interface MoleAnimationProps {
  isAnimating: boolean;
  onFinish: () => void;
  direction: 'down' | 'up';
}

const MoleAnimation: React.FC<MoleAnimationProps> = ({ isAnimating, onFinish, direction }) => {
  React.useEffect(() => {
    if (isAnimating) {
      // Each phase (down into earth, up from earth) takes half of the total time (1.5s each)
      const timer = setTimeout(() => {
        onFinish();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, onFinish, direction]);

  if (!isAnimating) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Transparent dirt overlay effect */}
        <div className={`absolute inset-0 bg-amber-950/40 backdrop-blur-sm transition-opacity duration-700 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(69,26,3,0.6)_100%)]"></div>
          {/* Subtle dirt particles */}
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        </div>
        
        <div className={`${direction === 'down' ? 'mole-down' : 'mole-up'} flex flex-col items-center`}>
            {/* Cuter SVG Mole */}
            <svg width="180" height="180" viewBox="0 0 100 100" className="drop-shadow-[0_25px_40px_rgba(0,0,0,0.4)]">
                {/* Main Body */}
                <ellipse cx="50" cy="65" rx="35" ry="30" fill="#78350f" />
                {/* Head */}
                <circle cx="50" cy="40" r="25" fill="#78350f" />
                {/* Muzzle */}
                <ellipse cx="50" cy="46" rx="14" ry="10" fill="#fbcfe8" />
                {/* Pink Nose */}
                <circle cx="50" cy="42" r="5" fill="#f472b6" />
                {/* Eyes with highlights */}
                <circle cx="40" cy="35" r="4" fill="#111" />
                <circle cx="39" cy="33.5" r="1.5" fill="white" />
                <circle cx="60" cy="35" r="4" fill="#111" />
                <circle cx="59" cy="33.5" r="1.5" fill="white" />
                {/* Cheeks */}
                <circle cx="34" cy="44" r="3" fill="#f472b6" opacity="0.4" />
                <circle cx="66" cy="44" r="3" fill="#f472b6" opacity="0.4" />
                {/* Whiskers */}
                <line x1="30" y1="46" x2="20" y2="44" stroke="#d97706" strokeWidth="1" />
                <line x1="30" y1="48" x2="18" y2="50" stroke="#d97706" strokeWidth="1" />
                <line x1="70" y1="46" x2="80" y2="44" stroke="#d97706" strokeWidth="1" />
                <line x1="70" y1="48" x2="82" y2="50" stroke="#d97706" strokeWidth="1" />
                {/* Hands */}
                <path d="M 25 65 Q 15 65 18 75" fill="none" stroke="#78350f" strokeWidth="8" strokeLinecap="round" />
                <path d="M 75 65 Q 85 65 82 75" fill="none" stroke="#78350f" strokeWidth="8" strokeLinecap="round" />
                {/* Claws */}
                <line x1="16" y1="76" x2="14" y2="79" stroke="#ddd" strokeWidth="2" strokeLinecap="round" />
                <line x1="19" y1="77" x2="18" y2="80" stroke="#ddd" strokeWidth="2" strokeLinecap="round" />
                <line x1="84" y1="76" x2="86" y2="79" stroke="#ddd" strokeWidth="2" strokeLinecap="round" />
                <line x1="81" y1="77" x2="82" y2="80" stroke="#ddd" strokeWidth="2" strokeLinecap="round" />
            </svg>
            
            <div className="mt-8 px-8 py-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-amber-200 font-bold text-amber-900 text-sm tracking-tight flex items-center gap-3">
                <span className="text-xl">🛠️</span>
                {direction === 'down' ? 'Digging down into the map...' : 'Popping up on the other side!'}
            </div>
        </div>
      </div>
    </div>
  );
};

export default MoleAnimation;