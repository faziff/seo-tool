import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** CROX symbol supplied in the rebrand reference: red field with the black/white mark. */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 44, className = '' }) => (
  <span
    className={`crox-logo-frame ${className}`.trim()}
    style={{ width: size, height: size }}
    aria-label="CROX logo"
    role="img"
  >
    <img src="/crox-symbol.png" alt="" draggable={false} />
  </span>
);
