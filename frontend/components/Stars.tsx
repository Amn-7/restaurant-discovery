'use client';
import React from 'react';

type Props = {
  value: number;              // 0..5 (fractional OK)
  onChange?: (v: number) => void; // if present → interactive
  size?: number;
  readOnly?: boolean;
  ariaLabel?: string;
};

export default function Stars({ value, onChange, size = 20, readOnly, ariaLabel = 'rating' }: Props) {
  const whole = Math.floor(value);
  const hasHalf = value - whole >= 0.5;

  return (
    <div
      role={onChange && !readOnly ? 'radiogroup' : undefined}
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', gap: 4 }}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;
        const filled = idx <= whole;
        const half = !filled && hasHalf && idx === whole + 1;
        const star = filled || half ? '★' : '☆';
        const opacity = half ? 0.6 : 1;
        const color = filled ? '#f97316' : half ? '#fb923c' : '#cbd5f5';

        if (!onChange || readOnly) {
          return (
            <span
              key={idx}
              aria-hidden
              style={{ fontSize: size, lineHeight: 1, opacity, color, transition: 'color 0.2s ease' }}
            >
              {star}
            </span>
          );
        }
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onChange(idx)}
            aria-label={`Set rating ${idx}`}
            style={{
              fontSize: size,
              lineHeight: 1,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              opacity,
              color,
              transition: 'transform 0.1s ease, color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget.style.transform = 'scale(1.1)');
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style.transform = 'scale(1)');
            }}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
