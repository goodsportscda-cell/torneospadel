import React from "react";
import logoImg from "@/assets/new-padel-id-logo.jpg";

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
      <img
        src={logoImg}
        alt="Padel ID Logo"
        style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
        className="shrink-0 rounded-lg"
      />

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
