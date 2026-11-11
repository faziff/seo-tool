import React from 'react';

interface NovaOrbProps {
  size?: number;
  className?: string;
}

/** The CROX visible AI agent: an expressive, face-free floating orb. */
export const NovaOrb: React.FC<NovaOrbProps> = ({ size = 28, className = '' }) => (
  <span className={`crox-nova-agent ${className}`} style={{ width: size, height: size }} aria-label="NOVA AI" role="img">
    <i />
    <b />
    <em />
  </span>
);
