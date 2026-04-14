import React from 'react';

/**
 * Custom Duck icons that match Lucide React's style (24x24 viewBox, stroke-based)
 */

export const Duck = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 11c0 3.314-2.686 6-6 6-1.105 0-2.126-.299-3-.822C5.534 15.334 4.142 14 3 14c-.552 0-1 .448-1 1 0 2.761 2.239 5 5 5h3c6.075 0 11-4.925 11-11 0-1.657-1.343-3-3-3s-3 1.343-3 3" />
    <circle cx="17.5" cy="5.5" r="1.5" />
    <path d="M19 11h2" />
  </svg>
);

export const RubberDuck = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10 17c5 0 8-3 8-7 0-2-1-4-3-4s-3 2-3 4-1 2-2 2-2-1-2-2 0-4-3-4-4 2-4 6c0 3 2 5 5 5h4" />
    <circle cx="15" cy="8" r="1" />
    <path d="M18 10c1.5 0 2 .5 2 1s-.5 1-2 1" />
  </svg>
);

export const BabyDuck = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="7" r="4" />
    <circle cx="13" cy="6" r="0.5" fill="currentColor" />
    <path d="M16 7h2l-1 1z" fill="currentColor" />
    <path d="M8 12c0 3 2 5 4 5s4-2 4-5H8z" />
    <path d="M10 17v2m4-2v2" />
  </svg>
);

export const SwimDuck = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 14c4 0 7-3 7-7 0-1.5-.5-3-2-3s-2 1.5-2 3-1 2-2 2-2-1-2-2 0-3-2-3-3 1.5-3 5c0 2.5 1.5 4.5 4 4.5h2" />
    <circle cx="15" cy="6" r="1" />
    <path d="M2 18c2-2 4 2 6 0s4-2 6 0 4-2 6 0" />
  </svg>
);

export const PaperDuck = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 15l4 4h10l4-4-4-4H7l-4 4z" />
    <path d="M7 11l5-8 5 8" />
    <path d="M12 3v8" />
    <circle cx="12" cy="7" r="0.5" fill="currentColor" />
  </svg>
);

export const CUSTOM_ICONS = {
  Duck,
  RubberDuck,
  BabyDuck,
  SwimDuck,
  PaperDuck
};
