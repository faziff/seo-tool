import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** CROX's signature open gradient ring and four-point sparkle. */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 44, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    aria-label="CROX logo"
    role="img"
    className={className}
  >
    <defs>
      <linearGradient id="crox-ring-a" x1="15" y1="72" x2="62" y2="8" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFE45D" />
        <stop offset="0.35" stopColor="#FF8051" />
        <stop offset="0.72" stopColor="#FB3D99" />
        <stop offset="1" stopColor="#EB52FF" />
      </linearGradient>
      <linearGradient id="crox-ring-b" x1="28" y1="87" x2="77" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#DDFD70" />
        <stop offset="0.26" stopColor="#36E9B5" />
        <stop offset="0.52" stopColor="#00C7F8" />
        <stop offset="0.77" stopColor="#5868FF" />
        <stop offset="1" stopColor="#B044FF" />
      </linearGradient>
      <linearGradient id="crox-sparkle" x1="75" y1="3" x2="93" y2="23" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FB63F7" />
        <stop offset="1" stopColor="#8A48FF" />
      </linearGradient>
    </defs>
    <path
      d="M59.7 15.2C49.2 10.2 35.6 13.3 25.7 21.7 14.5 31.2 9.2 44.6 12.4 57.8L15.4 68.4"
      stroke="url(#crox-ring-a)"
      strokeWidth="13.5"
      strokeLinecap="round"
    />
    <path
      d="M28.4 80.2C40.1 88 54.8 86.9 65.6 78.5 79.5 67.7 84 49.5 76.9 33.1L75.3 29.5"
      stroke="url(#crox-ring-b)"
      strokeWidth="13.5"
      strokeLinecap="round"
    />
    <path
      d="M83.3 5.9C83.9 5.9 84.3 6.4 84.1 7L81.4 13.3 87.9 15.8C88.5 16 88.5 16.8 87.9 17L81.4 19.5 84.1 25.8C84.3 26.4 83.8 26.9 83.2 26.9L76.8 24.2 74.2 30.5C74 31.1 73.2 31.1 73 30.5L70.4 24.2 64 26.9C63.4 26.9 62.9 26.4 63.1 25.8L65.8 19.5 59.3 17C58.7 16.8 58.7 16 59.3 15.8L65.8 13.3 63.1 7C62.9 6.4 63.4 5.9 64 5.9L70.4 8.6 73 2.3C73.2 1.7 74 1.7 74.2 2.3L76.8 8.6 83.3 5.9Z"
      fill="url(#crox-sparkle)"
      transform="translate(4 2) scale(.86)"
    />
  </svg>
);
