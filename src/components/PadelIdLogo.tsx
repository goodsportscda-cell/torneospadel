import React from "react";

interface PadelIdLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textColorClass?: string;
}

export function PadelIdLogo({
  className = "",
  size = 40,
  showText = false,
  textColorClass = "text-foreground",
}: PadelIdLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* SVG Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Outer Hexagon / Rounded Shield Container */}
        <path
          d="M50 5L89.64 27.89V72.11L50 95L10.36 72.11V27.89L50 5Z"
          className="fill-primary/10 stroke-primary"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Dynamic Scan/ID Lines (Hexagon background detail) */}
        <path
          d="M25 40H75"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted-foreground/30"
          strokeDasharray="4 4"
        />
        <path
          d="M20 50H80"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted-foreground/45"
          strokeDasharray="4 4"
        />
        <path
          d="M25 60H75"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted-foreground/30"
          strokeDasharray="4 4"
        />

        {/* Padel Racket Outline & Handle */}
        <circle
          cx="50"
          cy="42"
          r="20"
          className="fill-card stroke-primary"
          strokeWidth="4"
        />
        {/* Racket neck and handle */}
        <path
          d="M50 62V82"
          className="stroke-primary"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Racket neck triangle joint */}
        <path
          d="M45 62L50 56L55 62H45Z"
          className="fill-primary"
        />

        {/* Racket holes (representing the padel racket pattern and also digital bits/ID) */}
        <circle cx="44" cy="36" r="2" className="fill-primary/60" />
        <circle cx="50" cy="36" r="2" className="fill-primary" />
        <circle cx="56" cy="36" r="2" className="fill-primary/60" />

        <circle cx="42" cy="42" r="2" className="fill-primary" />
        <circle cx="48" cy="42" r="2" className="fill-primary" />
        <circle cx="52" cy="42" r="2" className="fill-primary" />
        <circle cx="58" cy="42" r="2" className="fill-primary" />

        <circle cx="44" cy="48" r="2" className="fill-primary/60" />
        <circle cx="50" cy="48" r="2" className="fill-primary" />
        <circle cx="56" cy="48" r="2" className="fill-primary/60" />

        {/* ID Card fingerprint overlay or circular ID scanner arch */}
        <path
          d="M24 35C22 42 22 58 24 65"
          className="stroke-primary/80"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M76 35C78 42 78 58 76 65"
          className="stroke-primary/80"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`text-lg font-black tracking-tight leading-none ${textColorClass}`}>
            Padel <span className="text-primary">ID</span>
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">
            Tournament Platform
          </span>
        </div>
      )}
    </div>
  );
}
