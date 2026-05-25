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
      className={className}
    >
      <defs>
        {/* Dynamic theme gradient using CSS variables */}
        <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary, #8b5cf6)" />
          <stop offset="100%" stopColor="var(--color-secondary, #ec4899)" />
        </linearGradient>
        
        {/* Dynamic glow effect */}
        <filter id="cloudGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Cloud Outline / Structure */}
      <path
        d="M25 65C13.9543 65 5 56.0457 5 45C5 34.619 12.9238 26.0827 23.0567 25.1054C25.8016 14.8872 35.0345 7.5 46 7.5C57.4851 7.5 66.9744 15.6582 68.8522 26.4385C70.1837 25.819 71.6749 25.4688 73.25 25.4688C83.6053 25.4688 92 33.8634 92 44.2188C92 53.7198 84.973 61.5831 75.7265 62.7758"
        stroke="url(#cloudGradient)"
        strokeWidth={strokeWidth * 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 4"
        className="opacity-45"
      />
      
      <path
        d="M25 65C13.9543 65 5 56.0457 5 45C5 34.619 12.9238 26.0827 23.0567 25.1054C25.8016 14.8872 35.0345 7.5 46 7.5C57.4851 7.5 66.9744 15.6582 68.8522 26.4385"
        stroke="url(#cloudGradient)"
        strokeWidth={strokeWidth * 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M68.8522 26.4385C70.1837 25.819 71.6749 25.4688 73.25 25.4688C83.6053 25.4688 92 33.8634 92 44.2188C92 53.7198 84.973 61.5831 75.7265 62.7758"
        stroke="url(#cloudGradient)"
        strokeWidth={strokeWidth * 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Internal Connected Structural Nodes (Flow/Structure Concept) */}
      
      {/* Structural Lines */}
      <line x1="28" y1="48" x2="48" y2="35" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} opacity="0.8" />
      <line x1="48" y1="35" x2="68" y2="48" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} opacity="0.8" />
      <line x1="28" y1="48" x2="48" y2="60" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} opacity="0.8" />
      <line x1="68" y1="48" x2="48" y2="60" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} opacity="0.8" />
      
      <line x1="48" y1="35" x2="48" y2="60" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} opacity="0.5" strokeDasharray="3 3" />
      <line x1="28" y1="48" x2="68" y2="48" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} opacity="0.5" strokeDasharray="3 3" />

      {/* Structural Nodes (Glow Circles) */}
      <circle cx="48" cy="35" r="4.5" fill="#ffffff" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />
      <circle cx="28" cy="48" r="4.5" fill="#ffffff" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />
      <circle cx="68" cy="48" r="4.5" fill="#ffffff" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />
      <circle cx="48" cy="60" r="4.5" fill="#ffffff" stroke="url(#cloudGradient)" strokeWidth={strokeWidth} filter="url(#cloudGlow)" />

      {/* Flow Connection Lines descending */}
      <path
        d="M48 64.5V87.5"
        stroke="url(#cloudGradient)"
        strokeWidth={strokeWidth * 1.5}
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <circle cx="48" cy="91" r="3.5" fill="var(--color-secondary, #ec4899)" />
    </svg>
  );
}
