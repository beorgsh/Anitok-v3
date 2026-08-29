import React from 'react';

interface GradientCircleSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const GradientCircleSpinner: React.FC<GradientCircleSpinnerProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }[size];

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}>
      <svg
        className="w-full h-full animate-spin drop-shadow-[0_0_14px_rgba(236,72,153,0.6)]"
        viewBox="0 0 50 50"
      >
        <defs>
          <linearGradient id="gradientMagentaCyanWhite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" /> {/* Magenta / Pink */}
            <stop offset="50%" stopColor="#06b6d4" /> {/* Cyan */}
            <stop offset="100%" stopColor="#ffffff" /> {/* White */}
          </linearGradient>
        </defs>
        {/* Animated Gradient Arc - Clean loader with no background track border */}
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="url(#gradientMagentaCyanWhite)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="90, 150"
        />
      </svg>
    </div>
  );
};

export const LazyLoadSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full bg-black flex items-center justify-center select-none">
      <GradientCircleSpinner size="lg" />
    </div>
  );
};
