import React from 'react';

interface CloudLogoProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export default function CloudLogo({ className = '', size = 40, strokeWidth = 2 }: CloudLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} overflow-visible`}
    >
      <defs>
        {/* Dynamic glow effect */}
        <filter id="cloudGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Styled Rounded Box Background */}
      {/* Uses Tailwind class to support dark/light modes automatically */}
      <rect
        width="100"
        height="100"
        rx="24"
        className="fill-sky-100/90 dark:fill-slate-900/90 stroke-sky-200/50 dark:stroke-slate-800/50"
        strokeWidth="1.5"
      />

      {/* Cloud Structure Graphics perfectly centered inside a scaled group */}
      <g transform="translate(10, 10) scale(0.8)">
        {/* Cloud Outline */}
        <path
          d="M25 65C13.9543 65 5 56.0457 5 45C5 34.619 12.9238 26.0827 23.0567 25.1054C25.8016 14.8872 35.0345 7.5 46 7.5C57.4851 7.5 66.9744 15.6582 68.8522 26.4385C70.1837 25.819 71.6749 25.4688 73.25 25.4688C83.6053 25.4688 92 33.8634 92 44.2188C92 53.7198 84.973 61.5831 75.7265 62.7758"
          className="stroke-blue-600 dark:stroke-sky-400"
          strokeWidth={strokeWidth * 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Structural Lines */}
        <line x1="28" y1="48" x2="48" y2="35" className="stroke-blue-500/50 dark:stroke-sky-400/40" strokeWidth={strokeWidth} />
        <line x1="48" y1="35" x2="68" y2="48" className="stroke-blue-500/50 dark:stroke-sky-400/40" strokeWidth={strokeWidth} />
        <line x1="28" y1="48" x2="48" y2="60" className="stroke-blue-500/50 dark:stroke-sky-400/40" strokeWidth={strokeWidth} />
        <line x1="68" y1="48" x2="48" y2="60" className="stroke-blue-500/50 dark:stroke-sky-400/40" strokeWidth={strokeWidth} />
        
        <line x1="48" y1="35" x2="48" y2="60" className="stroke-blue-500/30 dark:stroke-sky-400/25" strokeWidth={strokeWidth} strokeDasharray="2 2" />
        <line x1="28" y1="48" x2="68" y2="48" className="stroke-blue-500/30 dark:stroke-sky-400/25" strokeWidth={strokeWidth} strokeDasharray="2 2" />

        {/* Structural Nodes (Glow Circles) */}
        <circle cx="48" cy="35" r="4.5" className="fill-white dark:fill-slate-900 stroke-blue-600 dark:stroke-sky-400" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />
        <circle cx="28" cy="48" r="4.5" className="fill-white dark:fill-slate-900 stroke-blue-600 dark:stroke-sky-400" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />
        <circle cx="68" cy="48" r="4.5" className="fill-white dark:fill-slate-900 stroke-blue-600 dark:stroke-sky-400" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />
        <circle cx="48" cy="60" r="4.5" className="fill-white dark:fill-slate-900 stroke-blue-600 dark:stroke-sky-400" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />

        {/* Flow Connection Lines descending */}
        <path
          d="M48 64.5V85"
          className="stroke-blue-500/40 dark:stroke-sky-400/40"
          strokeWidth={strokeWidth * 1.5}
          strokeLinecap="round"
          strokeDasharray="3 3"
          fill="none"
        />
        <circle cx="48" cy="89" r="3.5" className="fill-blue-600 dark:fill-sky-400" />
      </g>
    </svg>
  );
}
