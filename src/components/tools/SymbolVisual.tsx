import React from 'react';

export interface SymbolVisualProps {
  id: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

export const SymbolVisual: React.FC<SymbolVisualProps> = ({
  id,
  className = '',
  size = 'md',
  color = 'currentColor',
}) => {
  const sizeMap = {
    sm: { w: 32, h: 32 },
    md: { w: 56, h: 56 },
    lg: { w: 84, h: 84 },
    xl: { w: 110, h: 110 },
  };

  const { w, h } = sizeMap[size] || sizeMap.md;

  switch (id) {
    // ----------------------------------------------------
    // NOTES
    // ----------------------------------------------------
    case 'whole-note':
      return (
        <svg
          viewBox="0 0 40 28"
          width={w}
          height={Math.round((h * 28) / 40)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Authentic whole note open oval with angled cutout */}
          <ellipse cx="20" cy="14" rx="14" ry="9.5" fill={color} transform="rotate(-15 20 14)" />
          <ellipse cx="20" cy="14" rx="8" ry="4.5" fill="#0B0F19" transform="rotate(40 20 14)" />
        </svg>
      );

    case 'half-note':
      return (
        <svg
          viewBox="0 0 36 64"
          width={Math.round((w * 36) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Open notehead */}
          <ellipse
            cx="14"
            cy="48"
            rx="11"
            ry="7.5"
            fill="none"
            stroke={color}
            strokeWidth="3.2"
            transform="rotate(-20 14 48)"
          />
          {/* Stem */}
          <rect x="22.5" y="6" width="3" height="42" fill={color} rx="1" />
        </svg>
      );

    case 'quarter-note':
      return (
        <svg
          viewBox="0 0 36 64"
          width={Math.round((w * 36) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Solid filled notehead */}
          <ellipse cx="14" cy="48" rx="11" ry="7.5" fill={color} transform="rotate(-20 14 48)" />
          {/* Stem */}
          <rect x="22.5" y="6" width="3" height="42" fill={color} rx="1" />
        </svg>
      );

    case 'eighth-note':
      return (
        <svg
          viewBox="0 0 42 64"
          width={Math.round((w * 42) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Notehead */}
          <ellipse cx="13" cy="48" rx="10.5" ry="7" fill={color} transform="rotate(-20 13 48)" />
          {/* Stem */}
          <rect x="21" y="6" width="3" height="42" fill={color} rx="1" />
          {/* Flag */}
          <path
            d="M 23 6 C 29 10, 39 18, 37 32 C 34 24, 28 17, 23 15 Z"
            fill={color}
          />
        </svg>
      );

    case 'sixteenth-note':
      return (
        <svg
          viewBox="0 0 42 64"
          width={Math.round((w * 42) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <ellipse cx="13" cy="48" rx="10.5" ry="7" fill={color} transform="rotate(-20 13 48)" />
          <rect x="21" y="5" width="3" height="43" fill={color} rx="1" />
          {/* Double flags */}
          <path
            d="M 23 5 C 29 9, 39 17, 37 29 C 34 22, 28 16, 23 14 Z"
            fill={color}
          />
          <path
            d="M 23 18 C 29 22, 39 29, 37 40 C 34 33, 28 27, 23 25 Z"
            fill={color}
          />
        </svg>
      );

    case 'dotted-half':
      return (
        <svg
          viewBox="0 0 48 64"
          width={Math.round((w * 48) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <ellipse
            cx="14"
            cy="48"
            rx="11"
            ry="7.5"
            fill="none"
            stroke={color}
            strokeWidth="3.2"
            transform="rotate(-20 14 48)"
          />
          <rect x="22.5" y="6" width="3" height="42" fill={color} rx="1" />
          {/* Augmentation dot */}
          <circle cx="36" cy="48" r="4" fill={color} />
        </svg>
      );

    // ----------------------------------------------------
    // RESTS (Rendered with 3 reference staff lines for whole/half rest clarity)
    // ----------------------------------------------------
    case 'whole-rest':
      return (
        <svg
          viewBox="0 0 56 44"
          width={w}
          height={Math.round((h * 44) / 56)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* 3 Reference staff lines */}
          <line x1="4" y1="12" x2="52" y2="12" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="4" y1="22" x2="52" y2="22" stroke="#94a3b8" strokeWidth="2.5" />
          <line x1="4" y1="32" x2="52" y2="32" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
          {/* Whole rest hangs below upper reference line */}
          <rect x="18" y="22" width="20" height="9" fill={color} rx="1" />
        </svg>
      );

    case 'half-rest':
      return (
        <svg
          viewBox="0 0 56 44"
          width={w}
          height={Math.round((h * 44) / 56)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* 3 Reference staff lines */}
          <line x1="4" y1="12" x2="52" y2="12" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="4" y1="22" x2="52" y2="22" stroke="#94a3b8" strokeWidth="2.5" />
          <line x1="4" y1="32" x2="52" y2="32" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
          {/* Half rest sits on reference line */}
          <rect x="18" y="13" width="20" height="9" fill={color} rx="1" />
        </svg>
      );

    case 'quarter-rest':
      return (
        <svg
          viewBox="0 0 32 64"
          width={Math.round((w * 32) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <g fill={color}>
            <path d="M 22 8 C 14 17, 10 23, 10 28 C 10 32, 14 38, 22 47 L 19 50 C 15 48, 12 47, 9 47 C 6 47, 4 49, 4 53 C 4 57, 6 61, 10 65 L 7 67 C -2 60, -2 52, 0 46 C 2 43, 5 41, 9 41 C 11 41, 13 42, 16 43 L 3 26 C 10 19, 14 13, 14 8 C 14 4, 11 0, 7 -5 L 14 -5 C 19 0, 22 4, 22 8 Z" transform="translate(6, 0) scale(0.9)" />
          </g>
        </svg>
      );

    case 'eighth-rest':
      return (
        <svg
          viewBox="0 0 32 54"
          width={Math.round((w * 32) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <circle cx="12" cy="18" r="4.5" fill={color} />
          <path
            d="M 12 14 C 17 14, 22 10, 25 4 C 26 3, 27 3, 27 5 C 24 12, 18 19, 13 22 Z"
            fill={color}
          />
          <path
            d="M 26 4 L 22 4 L 10 48 C 9 51, 11 52, 13 52 C 15 52, 16 51, 17 48 L 26 4 Z"
            fill={color}
          />
        </svg>
      );

    case 'sixteenth-rest':
      return (
        <svg
          viewBox="0 0 36 60"
          width={Math.round((w * 36) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Upper hook */}
          <circle cx="13" cy="16" r="4.2" fill={color} />
          <path
            d="M 13 12 C 18 12, 23 8, 26 2 C 27 1, 28 1, 28 3 C 25 10, 19 17, 14 20 Z"
            fill={color}
          />
          {/* Lower hook */}
          <circle cx="10" cy="30" r="4.2" fill={color} />
          <path
            d="M 10 26 C 15 26, 20 22, 23 16 C 24 15, 25 15, 25 17 C 22 24, 16 31, 11 34 Z"
            fill={color}
          />
          {/* Continuous diagonal stem */}
          <path
            d="M 27 2 L 23 2 L 8 54 C 7 57, 9 58, 11 58 C 13 58, 14 57, 15 54 L 27 2 Z"
            fill={color}
          />
        </svg>
      );

    // ----------------------------------------------------
    // DYNAMICS (Styled in classic bold Italian music engraving font)
    // ----------------------------------------------------
    case 'pianissimo':
      return (
        <span
          className={`font-serif italic font-black tracking-tighter select-none ${className}`}
          style={{
            fontSize: size === 'sm' ? '1.5rem' : size === 'md' ? '2.5rem' : size === 'lg' ? '3.75rem' : '4.5rem',
            lineHeight: 1,
            color,
          }}
        >
          pp
        </span>
      );

    case 'piano':
      return (
        <span
          className={`font-serif italic font-black select-none ${className}`}
          style={{
            fontSize: size === 'sm' ? '1.5rem' : size === 'md' ? '2.5rem' : size === 'lg' ? '3.75rem' : '4.5rem',
            lineHeight: 1,
            color,
          }}
        >
          p
        </span>
      );

    case 'mezzo-piano':
      return (
        <span
          className={`font-serif italic font-black tracking-tighter select-none ${className}`}
          style={{
            fontSize: size === 'sm' ? '1.35rem' : size === 'md' ? '2.25rem' : size === 'lg' ? '3.5rem' : '4.25rem',
            lineHeight: 1,
            color,
          }}
        >
          mp
        </span>
      );

    case 'mezzo-forte':
      return (
        <span
          className={`font-serif italic font-black tracking-tighter select-none ${className}`}
          style={{
            fontSize: size === 'sm' ? '1.35rem' : size === 'md' ? '2.25rem' : size === 'lg' ? '3.5rem' : '4.25rem',
            lineHeight: 1,
            color,
          }}
        >
          mf
        </span>
      );

    case 'forte':
      return (
        <span
          className={`font-serif italic font-black select-none ${className}`}
          style={{
            fontSize: size === 'sm' ? '1.5rem' : size === 'md' ? '2.5rem' : size === 'lg' ? '3.75rem' : '4.5rem',
            lineHeight: 1,
            color,
          }}
        >
          f
        </span>
      );

    case 'fortissimo':
      return (
        <span
          className={`font-serif italic font-black tracking-tighter select-none ${className}`}
          style={{
            fontSize: size === 'sm' ? '1.5rem' : size === 'md' ? '2.5rem' : size === 'lg' ? '3.75rem' : '4.5rem',
            lineHeight: 1,
            color,
          }}
        >
          ff
        </span>
      );

    case 'crescendo':
      return (
        <svg
          viewBox="0 0 64 28"
          width={w}
          height={Math.round((h * 28) / 56)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <path
            d="M 8 14 L 56 4 M 8 14 L 56 24"
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'decrescendo':
      return (
        <svg
          viewBox="0 0 64 28"
          width={w}
          height={Math.round((h * 28) / 56)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <path
            d="M 8 4 L 56 14 M 8 24 L 56 14"
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      );

    // ----------------------------------------------------
    // CLEFS & SIGNS
    // ----------------------------------------------------
    case 'treble-clef':
      return (
        <svg
          viewBox="0 0 15.186 40.768"
          width={Math.round((w * 30) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <path
            fill={color}
            d="m12.049 3.5296c0.305 3.1263-2.019 5.6563-4.0772 7.7014-0.9349 0.897-0.155 0.148-0.6437 0.594-0.1022-0.479-0.2986-1.731-0.2802-2.11 0.1304-2.6939 2.3198-6.5875 4.2381-8.0236 0.309 0.5767 0.563 0.6231 0.763 1.8382zm0.651 16.142c-1.232-0.906-2.85-1.144-4.3336-0.885-0.1913-1.255-0.3827-2.51-0.574-3.764 2.3506-2.329 4.9066-5.0322 5.0406-8.5394 0.059-2.232-0.276-4.6714-1.678-6.4836-1.7004 0.12823-2.8995 2.156-3.8019 3.4165-1.4889 2.6705-1.1414 5.9169-0.57 8.7965-0.8094 0.952-1.9296 1.743-2.7274 2.734-2.3561 2.308-4.4085 5.43-4.0046 8.878 0.18332 3.334 2.5894 6.434 5.8702 7.227 1.2457 0.315 2.5639 0.346 3.8241 0.099 0.2199 2.25 1.0266 4.629 0.0925 6.813-0.7007 1.598-2.7875 3.004-4.3325 2.192-0.5994-0.316-0.1137-0.051-0.478-0.252 1.0698-0.257 1.9996-1.036 2.26-1.565 0.8378-1.464-0.3998-3.639-2.1554-3.358-2.262 0.046-3.1904 3.14-1.7356 4.685 1.3468 1.52 3.833 1.312 5.4301 0.318 1.8125-1.18 2.0395-3.544 1.8325-5.562-0.07-0.678-0.403-2.67-0.444-3.387 0.697-0.249 0.209-0.059 1.193-0.449 2.66-1.053 4.357-4.259 3.594-7.122-0.318-1.469-1.044-2.914-2.302-3.792zm0.561 5.757c0.214 1.991-1.053 4.321-3.079 4.96-0.136-0.795-0.172-1.011-0.2626-1.475-0.4822-2.46-0.744-4.987-1.116-7.481 1.6246-0.168 3.4576 0.543 4.0226 2.184 0.244 0.577 0.343 1.197 0.435 1.812zm-5.1486 5.196c-2.5441 0.141-4.9995-1.595-5.6343-4.081-0.749-2.153-0.5283-4.63 0.8207-6.504 1.1151-1.702 2.6065-3.105 4.0286-4.543 0.183 1.127 0.366 2.254 0.549 3.382-2.9906 0.782-5.0046 4.725-3.215 7.451 0.5324 0.764 1.9765 2.223 2.7655 1.634-1.102-0.683-2.0033-1.859-1.8095-3.227-0.0821-1.282 1.3699-2.911 2.6513-3.198 0.4384 2.869 0.9413 6.073 1.3797 8.943-0.5054 0.1-1.0211 0.143-1.536 0.143z"
          />
        </svg>
      );

    case 'bass-clef':
      return (
        <svg
          viewBox="0 0 18 20"
          width={Math.round((w * 36) / 56)}
          height={Math.round((h * 40) / 56)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <g fill={color} transform="translate(-230.95, -533.66)">
            <path d="M 248.26,536.80 C 248.27,537.17 248.11,537.54 247.83,537.78 C 247.47,538.11 246.92,538.18 246.47,538.01 C 246.03,537.84 245.70,537.40 245.67,536.92 C 245.64,536.55 245.76,536.15 246.03,535.89 C 246.28,535.62 246.66,535.48 247.03,535.51 C 247.41,535.51 247.78,535.71 248.00,536.01 C 248.18,536.23 248.26,536.52 248.26,536.80 z" />
            <path d="M 248.26,542.65 C 248.27,543.01 248.11,543.38 247.83,543.63 C 247.47,543.95 246.92,544.02 246.47,543.85 C 246.03,543.68 245.70,543.24 245.67,542.76 C 245.64,542.39 245.76,542.00 246.03,541.73 C 246.28,541.45 246.66,541.33 247.03,541.35 C 247.51,541.36 247.95,541.69 248.15,542.12 C 248.23,542.29 248.26,542.47 248.26,542.65 z" />
            <path d="M 243.98,540.87 C 244.02,543.69 242.76,546.44 240.76,548.40 C 238.28,550.89 235.02,552.48 231.70,553.53 C 231.26,553.77 230.59,553.46 231.29,553.13 C 232.62,552.52 234.01,552.00 235.25,551.18 C 237.97,549.50 240.27,546.85 240.82,543.62 C 241.15,541.65 241.06,539.61 240.56,537.68 C 240.20,536.26 239.22,534.80 237.66,534.59 C 236.25,534.37 234.75,534.86 233.74,535.88 C 233.48,536.15 232.96,536.89 233.04,537.75 C 233.65,537.27 233.61,537.33 234.10,537.11 C 235.24,536.60 236.74,537.32 237.03,538.57 C 237.33,539.72 237.10,541.19 235.96,541.80 C 234.78,542.44 233.03,542.18 232.36,540.91 C 231.27,538.95 231.87,536.28 233.64,534.93 C 235.45,533.43 238.08,533.37 240.20,534.14 C 242.38,534.95 243.69,537.21 243.90,539.46 C 243.95,539.92 243.98,540.40 243.98,540.87 z" />
          </g>
        </svg>
      );

    case 'sharp':
      return (
        <svg
          viewBox="-7 -16 14 32"
          width={Math.round((w * 28) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <path d="M -3.2 -14.5 L -1.5 -14.8 L -1.5 12.0 L -3.2 12.3 Z" fill={color} />
          <path d="M 1.5 -12.3 L 3.2 -12.6 L 3.2 14.5 L 1.5 14.2 Z" fill={color} />
          <path d="M -6.0 -0.8 L 6.0 -2.6 L 6.0 -4.8 L -6.0 -3.0 Z" fill={color} />
          <path d="M -6.0 4.2 L 6.0 2.4 L 6.0 0.2 L -6.0 2.0 Z" fill={color} />
        </svg>
      );

    case 'flat':
      return (
        <svg
          viewBox="-5 -23 11 30"
          width={Math.round((w * 26) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <path
            d="M -3.6 -22.0 L -2.0 -22.0 L -2.0 -2.0 C -0.6 -4.8, 2.2 -5.5, 3.8 -3.2 C 5.4 -1.0, 5.2 2.4, 3.4 4.8 C 1.8 6.8, -0.6 7.0, -2.0 5.6 L -2.0 5.8 L -3.6 5.8 Z M -2.0 3.6 C -0.8 4.6, 0.8 4.2, 1.8 3.0 C 2.8 1.6, 2.8 -0.8, 1.8 -2.0 C 0.8 -3.0, -0.8 -2.4, -2.0 -0.8 Z"
            fill={color}
            fillRule="evenodd"
          />
        </svg>
      );

    case 'natural':
      return (
        <svg
          viewBox="-7 -16 14 32"
          width={Math.round((w * 28) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <path d="M -3.2 -14.5 L -1.5 -14.8 L -1.5 3.8 L -3.2 4.1 Z" fill={color} />
          <path d="M 1.5 -4.1 L 3.2 -4.4 L 3.2 14.5 L 1.5 14.2 Z" fill={color} />
          <path d="M -3.2 -1.0 L 3.2 -2.6 L 3.2 -4.8 L -3.2 -3.2 Z" fill={color} />
          <path d="M -3.2 4.4 L 3.2 2.8 L 3.2 0.6 L -3.2 2.2 Z" fill={color} />
        </svg>
      );

    case 'fermata':
      return (
        <svg
          viewBox="0 0 40 28"
          width={w}
          height={Math.round((h * 28) / 40)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          <path
            d="M 6 22 A 14 14 0 0 1 34 22"
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="19" r="3.5" fill={color} />
        </svg>
      );

    case 'repeat-sign':
      return (
        <svg
          viewBox="0 0 48 40"
          width={w}
          height={Math.round((h * 40) / 48)}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Thick barline */}
          <rect x="6" y="4" width="4.5" height="32" fill={color} rx="1" />
          {/* Thin barline */}
          <rect x="14" y="4" width="2" height="32" fill={color} />
          {/* Upper repeat dot */}
          <circle cx="24" cy="14" r="3.2" fill={color} />
          {/* Lower repeat dot */}
          <circle cx="24" cy="26" r="3.2" fill={color} />
        </svg>
      );

    case 'staccato':
      return (
        <svg
          viewBox="0 0 36 56"
          width={Math.round((w * 36) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Quarter note with staccato dot above */}
          <circle cx="14" cy="10" r="3.5" fill={color} />
          <ellipse cx="14" cy="44" rx="10" ry="7" fill={color} transform="rotate(-20 14 44)" />
          <rect x="21.5" y="18" width="2.8" height="26" fill={color} rx="1" />
        </svg>
      );

    case 'accent':
      return (
        <svg
          viewBox="0 0 36 56"
          width={Math.round((w * 36) / 56)}
          height={h}
          className={`select-none pointer-events-none inline-block ${className}`}
        >
          {/* Accent wedge above note */}
          <path
            d="M 6 8 L 22 13 L 6 18"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="14" cy="44" rx="10" ry="7" fill={color} transform="rotate(-20 14 44)" />
          <rect x="21.5" y="24" width="2.8" height="20" fill={color} rx="1" />
        </svg>
      );

    default:
      return <span className="text-2xl font-serif">{id}</span>;
  }
};
