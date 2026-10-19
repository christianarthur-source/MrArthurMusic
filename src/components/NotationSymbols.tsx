import React from 'react';

// Treble Clef (G-Clef) Symbol using user's attached SVG asset
// Staff lines: Line 5 = y, Line 4 = y+16, Line 3 = y+32, Line 2 (G4) = y+48, Line 1 = y+64
// Spiral center aligns with Line 2 (G4) at y+48
// Treble Clef (G-Clef) Symbol scaled for 18px line spacing
export const TrebleClefSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => {
  return (
    <svg
      x={x - 2}
      y={y - 32}
      width="52"
      height="142"
      viewBox="0 0 15.186 40.768"
      preserveAspectRatio="xMidYMid meet"
      className="select-none pointer-events-none"
    >
      <path
        fill={color}
        d="m12.049 3.5296c0.305 3.1263-2.019 5.6563-4.0772 7.7014-0.9349 0.897-0.155 0.148-0.6437 0.594-0.1022-0.479-0.2986-1.731-0.2802-2.11 0.1304-2.6939 2.3198-6.5875 4.2381-8.0236 0.309 0.5767 0.563 0.6231 0.763 1.8382zm0.651 16.142c-1.232-0.906-2.85-1.144-4.3336-0.885-0.1913-1.255-0.3827-2.51-0.574-3.764 2.3506-2.329 4.9066-5.0322 5.0406-8.5394 0.059-2.232-0.276-4.6714-1.678-6.4836-1.7004 0.12823-2.8995 2.156-3.8019 3.4165-1.4889 2.6705-1.1414 5.9169-0.57 8.7965-0.8094 0.952-1.9296 1.743-2.7274 2.734-2.3561 2.308-4.4085 5.43-4.0046 8.878 0.18332 3.334 2.5894 6.434 5.8702 7.227 1.2457 0.315 2.5639 0.346 3.8241 0.099 0.2199 2.25 1.0266 4.629 0.0925 6.813-0.7007 1.598-2.7875 3.004-4.3325 2.192-0.5994-0.316-0.1137-0.051-0.478-0.252 1.0698-0.257 1.9996-1.036 2.26-1.565 0.8378-1.464-0.3998-3.639-2.1554-3.358-2.262 0.046-3.1904 3.14-1.7356 4.685 1.3468 1.52 3.833 1.312 5.4301 0.318 1.8125-1.18 2.0395-3.544 1.8325-5.562-0.07-0.678-0.403-2.67-0.444-3.387 0.697-0.249 0.209-0.059 1.193-0.449 2.66-1.053 4.357-4.259 3.594-7.122-0.318-1.469-1.044-2.914-2.302-3.792zm0.561 5.757c0.214 1.991-1.053 4.321-3.079 4.96-0.136-0.795-0.172-1.011-0.2626-1.475-0.4822-2.46-0.744-4.987-1.116-7.481 1.6246-0.168 3.4576 0.543 4.0226 2.184 0.244 0.577 0.343 1.197 0.435 1.812zm-5.1486 5.196c-2.5441 0.141-4.9995-1.595-5.6343-4.081-0.749-2.153-0.5283-4.63 0.8207-6.504 1.1151-1.702 2.6065-3.105 4.0286-4.543 0.183 1.127 0.366 2.254 0.549 3.382-2.9906 0.782-5.0046 4.725-3.215 7.451 0.5324 0.764 1.9765 2.223 2.7655 1.634-1.102-0.683-2.0033-1.859-1.8095-3.227-0.0821-1.282 1.3699-2.911 2.6513-3.198 0.4384 2.869 0.9413 6.073 1.3797 8.943-0.5054 0.1-1.0211 0.143-1.536 0.143z"
      />
    </svg>
  );
};

// Bass Clef (F-Clef) Symbol scaled for 18px line spacing
export const BassClefSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => {
  return (
    <svg
      x={x}
      y={y - 2}
      width="58"
      height="68"
      viewBox="0 0 18 20"
      preserveAspectRatio="xMidYMid meet"
      className="select-none pointer-events-none"
    >
      <g transform="translate(0.0066, 0.003125)">
        <g transform="translate(-230.9546, -533.6597)" fill={color}>
          <path d="M 248.25999,536.80200 C 248.26766,537.17138 248.11044,537.54065 247.82878,537.78185 C 247.46853,538.11076 246.91933,538.17813 246.47048,538.01071 C 246.02563,537.83894 245.69678,537.39883 245.67145,536.92060 C 245.63767,536.54689 245.75685,536.15479 246.02747,535.88867 C 246.28257,535.61680 246.66244,535.48397 247.03147,535.50645 C 247.41131,535.51452 247.77805,535.70601 248.00489,536.01019 C 248.17962,536.23452 248.26238,536.51954 248.25999,536.80200 z" />
          <path d="M 248.25999,542.64502 C 248.26772,543.01469 248.11076,543.38446 247.82878,543.62585 C 247.46853,543.95476 246.91933,544.02213 246.47048,543.85472 C 246.02537,543.68288 245.69655,543.24237 245.67145,542.76389 C 245.63651,542.38990 245.76354,542.00308 246.02700,541.73300 C 246.27663,541.45454 246.66060,541.32790 247.02845,541.34950 C 247.51230,541.36282 247.95159,541.69251 248.15162,542.12465 C 248.22565,542.28740 248.26043,542.46657 248.25999,542.64502 z" />
          <path d="M 243.97900,540.86798 C 244.02398,543.69258 242.76360,546.43815 240.76469,548.40449 C 238.27527,550.89277 235.01791,552.47534 231.69762,553.53261 C 231.25590,553.77182 230.58970,553.45643 231.28550,553.13144 C 232.62346,552.52289 234.01319,552.00050 235.24564,551.18080 C 237.96799,549.49750 240.26523,546.84674 240.82279,543.61854 C 241.14771,541.65352 241.05724,539.60795 240.56484,537.67852 C 240.20352,536.25993 239.22033,534.79550 237.66352,534.58587 C 236.25068,534.36961 234.74885,534.85905 233.74057,535.88093 C 233.47541,536.14967 232.95916,536.89403 233.04435,537.74747 C 233.64637,537.27468 233.60528,537.32732 234.09900,537.10717 C 235.23573,536.60031 236.74349,537.32105 237.02700,538.57272 C 237.32909,539.72295 237.09551,541.18638 235.96036,541.79960 C 234.77512,542.44413 233.02612,542.17738 232.36450,540.90866 C 231.26916,538.95418 231.87147,536.28193 233.64202,534.92571 C 235.44514,533.42924 238.07609,533.37089 240.19963,534.13862 C 242.38419,534.95111 243.68629,537.21483 243.89691,539.45694 C 243.95419,539.92492 243.97896,540.39668 243.97900,540.86798 z" />
        </g>
      </g>
    </svg>
  );
};

// Standard Professional Music Engraving Accidentals
// Scaled and centered precisely on the pitch line/space (y=0 relative to notehead center)
export const SharpSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => (
  <g transform={`translate(${x}, ${y})`} className="select-none pointer-events-none">
    {/* Left vertical stem with beveled cut ends */}
    <path
      d="M -3.2 -14.5 L -1.5 -14.8 L -1.5 12.0 L -3.2 12.3 Z"
      fill={color}
    />
    {/* Right vertical stem with beveled cut ends */}
    <path
      d="M 1.5 -12.3 L 3.2 -12.6 L 3.2 14.5 L 1.5 14.2 Z"
      fill={color}
    />
    {/* Upper crossbar slanted ~8.5° */}
    <path
      d="M -6.0 -0.8 L 6.0 -2.6 L 6.0 -4.8 L -6.0 -3.0 Z"
      fill={color}
    />
    {/* Lower crossbar slanted ~8.5° */}
    <path
      d="M -6.0 4.2 L 6.0 2.4 L 6.0 0.2 L -6.0 2.0 Z"
      fill={color}
    />
  </g>
);

export const FlatSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => (
  <g transform={`translate(${x}, ${y})`} className="select-none pointer-events-none">
    <path
      d="M -3.6 -22.0
         L -2.0 -22.0
         L -2.0 -2.0
         C -0.6 -4.8, 2.2 -5.5, 3.8 -3.2
         C 5.4 -1.0, 5.2 2.4, 3.4 4.8
         C 1.8 6.8, -0.6 7.0, -2.0 5.6
         L -2.0 5.8
         L -3.6 5.8
         Z
         M -2.0 3.6
         C -0.8 4.6, 0.8 4.2, 1.8 3.0
         C 2.8 1.6, 2.8 -0.8, 1.8 -2.0
         C 0.8 -3.0, -0.8 -2.4, -2.0 -0.8
         Z"
      fill={color}
      fillRule="evenodd"
    />
  </g>
);

export const NaturalSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => (
  <g transform={`translate(${x}, ${y})`} className="select-none pointer-events-none">
    {/* Left vertical stem */}
    <path
      d="M -3.2 -14.5 L -1.5 -14.8 L -1.5 3.8 L -3.2 4.1 Z"
      fill={color}
    />
    {/* Right vertical stem */}
    <path
      d="M 1.5 -4.1 L 3.2 -4.4 L 3.2 14.5 L 1.5 14.2 Z"
      fill={color}
    />
    {/* Top crossbar */}
    <path
      d="M -3.2 -1.0 L 3.2 -2.6 L 3.2 -4.8 L -3.2 -3.2 Z"
      fill={color}
    />
    {/* Bottom crossbar */}
    <path
      d="M -3.2 4.4 L 3.2 2.8 L 3.2 0.6 L -3.2 2.2 Z"
      fill={color}
    />
  </g>
);

// Whole Rest (hangs under Line 4)
export const WholeRestSymbol: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = '#0F172A' }) => (
  <rect x={x - 12} y={y + 18} width="24" height="10" fill={color} rx="1.5" />
);

// Half Rest (sits on Line 3)
export const HalfRestSymbol: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = '#0F172A' }) => (
  <rect x={x - 12} y={y + 26} width="24" height="10" fill={color} rx="1.5" />
);

// Clean Standard Musical Quarter Rest Symbol using user's attached SVG asset
export const QuarterRestSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => (
  <svg
    x={x - 8}
    y={y + 14}
    width="16"
    height="44"
    viewBox="0 0 26.22 74.74"
    preserveAspectRatio="xMidYMid meet"
    className="select-none pointer-events-none"
  >
    <g transform="translate(0,-977.62215)">
      <g
        fill={color}
        transform="matrix(0.99974987,0,0,0.99997083,-112.50645,534.65124)"
      >
        <path d="m 138.76116,462.5307 c -6.84377,8.15627 -10.26565,14.25001 -10.26562,18.28125 -3e-5,3.89063 3.25778,9.72656 9.77343,17.50781 l -2.03906,2.88282 c -3.28128,-1.92189 -6.09377,-2.88283 -8.4375,-2.88282 -3.04689,-10e-6 -4.57033,1.82811 -4.57031,5.48438 -2e-5,3.74998 1.66404,7.47654 4.99219,11.17969 l -1.82813,2.74218 c -9.23438,-6.84377 -13.85157,-12.93751 -13.85156,-18.28125 -1e-5,-2.71876 0.93749,-4.875 2.8125,-6.46875 1.73436,-1.5 3.98436,-2.25 6.75,-2.25 1.78123,0 3.74998,0.46875 5.90625,1.40625 l -14.13281,-18.77343 c 6.70311,-5.90624 10.05467,-11.24998 10.05468,-16.03125 -10e-6,-3.79685 -2.27345,-8.57809 -6.82031,-14.34375 l 5.625,0 16.03125,19.54687" />
      </g>
    </g>
  </svg>
);

// Authentic Standard Eighth Rest (Quaver Rest)
// Sits cleanly in Space 3 with diagonal stem running to Line 2
export const EighthRestSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => (
  <g transform={`translate(${x}, ${y})`} className="select-none pointer-events-none">
    {/* Solid hook bulb in Space 3 */}
    <circle cx="-1.5" cy="28.5" r="3.2" fill={color} />
    {/* Elegant curved flag arching to stem */}
    <path
      d="M -1.5 25.5
         C 1.5 25.5, 4.2 23.0, 6.2 19.5
         C 6.6 19.0, 7.2 19.2, 7.0 19.8
         C 5.8 24.0, 2.5 28.5, -0.5 30.5
         C -1.2 31.0, -1.8 30.2, -1.5 29.5 Z"
      fill={color}
    />
    {/* Sleek diagonal stem terminating at Line 2 */}
    <path
      d="M 7.2 19.0
         L 5.0 19.0
         L -3.2 52.0
         C -3.7 53.6, -3.0 54.5, -1.8 54.5
         C -0.8 54.5, -0.2 53.8, 0.4 52.0
         L 7.2 19.0 Z"
      fill={color}
    />
  </g>
);

// Authentic Standard Sixteenth Rest (Semiquaver Rest)
// Double hooks in Space 3 and Space 2 sharing a continuous diagonal stem
export const SixteenthRestSymbol: React.FC<{ x: number; y: number; color?: string }> = ({
  x,
  y,
  color = '#0F172A',
}) => (
  <g transform={`translate(${x}, ${y})`} className="select-none pointer-events-none">
    {/* Upper hook in Space 3 */}
    <circle cx="-1.5" cy="27.5" r="3.2" fill={color} />
    <path
      d="M -1.5 24.5
         C 1.5 24.5, 4.2 22.0, 6.2 18.5
         C 6.6 18.0, 7.2 18.2, 7.0 18.8
         C 5.8 23.0, 2.5 27.5, -0.5 29.5
         C -1.2 30.0, -1.8 29.2, -1.5 28.5 Z"
      fill={color}
    />

    {/* Lower hook in Space 2 */}
    <circle cx="-3.5" cy="43.5" r="3.2" fill={color} />
    <path
      d="M -3.5 40.5
         C -0.5 40.5, 2.2 38.0, 4.2 34.5
         C 4.6 34.0, 5.2 34.2, 5.0 34.8
         C 3.8 39.0, 0.5 43.5, -2.5 45.5
         C -3.2 46.0, -3.8 45.2, -3.5 44.5 Z"
      fill={color}
    />

    {/* Long diagonal stem through both hooks down to near Line 1 */}
    <path
      d="M 7.2 18.0
         L 5.0 18.0
         L -4.5 59.5
         C -5.0 61.2, -4.2 62.0, -3.0 62.0
         C -2.0 62.0, -1.4 61.2, -0.8 59.5
         L 7.2 18.0 Z"
      fill={color}
    />
  </g>
);

// Standard Engraving Notehead Flags for Single 8th and 16th Notes
// Designed in exact pixel coordinates so flags are crisp, clearly separated, and never touch the notehead
export const StemFlagSymbol: React.FC<{
  x: number;
  y: number;
  isUp: boolean;
  isSixteenth?: boolean;
  color?: string;
}> = ({ x, y, isUp, isSixteenth = false, color = '#0F172A' }) => {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(1, ${isUp ? 1 : -1})`}
      fill={color}
      className="select-none pointer-events-none"
    >
      {!isSixteenth ? (
        /* Single 8th Note Flag: graceful calligraphic curve */
        <path
          d="M -0.5 0
             C 3.8 3.5, 11.8 9.0, 10.8 19.5
             C 10.2 23.5, 8.4 26.8, 6.2 28.5
             C 5.9 28.7, 5.4 28.3, 5.7 27.7
             C 7.5 24.2, 8.2 18.8, 6.8 14.2
             C 5.0 9.0, 1.8 6.8, -0.5 6.2 Z"
        />
      ) : (
        /* Double 16th Note Flags: two clearly separated parallel flags stopping well clear of the notehead */
        <>
          <path
            d="M -0.5 0
               C 3.8 2.6, 11.2 6.8, 10.4 14.5
               C 10.0 16.6, 8.8 18.4, 7.4 19.5
               C 7.0 19.7, 6.6 19.3, 6.9 18.8
               C 8.0 16.4, 8.3 13.0, 6.6 9.8
               C 5.0 6.8, 1.8 5.4, -0.5 5.0 Z"
          />
          <path
            d="M -0.5 9.5
               C 3.8 12.1, 11.2 16.3, 10.4 24.0
               C 10.0 26.1, 8.8 27.9, 7.4 29.0
               C 7.0 29.2, 6.6 28.8, 6.9 28.3
               C 8.0 25.9, 8.3 22.5, 6.6 19.3
               C 5.0 16.3, 1.8 14.9, -0.5 14.5 Z"
          />
        </>
      )}
    </g>
  );
};

// Authentic Eighth Note and Sixteenth Note icons for UI palette buttons
export const EighthNoteUIIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 44" className={className} fill="currentColor">
    <ellipse cx="6.5" cy="36" rx="6" ry="4.2" transform="rotate(-20 6.5 36)" />
    <rect x="11.0" y="4" width="2.0" height="31" />
    <path d="M 12.5 4 C 16.2 7.2, 22.5 12.0, 21.5 21.0 C 21.0 24.2, 19.5 26.8, 17.8 28.2 C 19.0 25.0, 19.5 20.5, 18.2 16.5 C 16.8 12.0, 14.2 10.0, 12.5 9.5 Z" />
  </svg>
);

export const SixteenthNoteUIIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 44" className={className} fill="currentColor">
    <ellipse cx="6.5" cy="36" rx="6" ry="4.2" transform="rotate(-20 6.5 36)" />
    <rect x="11.0" y="3" width="2.0" height="32" />
    <path d="M 12.5 3 C 16.2 5.4, 22.2 9.2, 21.5 16.0 C 21.0 18.0, 19.8 19.6, 18.5 20.6 C 19.5 18.4, 19.8 15.2, 18.2 12.2 C 16.8 9.4, 14.2 8.0, 12.5 7.6 Z" />
    <path d="M 12.5 11.8 C 16.2 14.2, 22.2 18.0, 21.5 24.8 C 21.0 26.8, 19.8 28.4, 18.5 29.4 C 19.5 27.2, 19.8 24.0, 18.2 21.0 C 16.8 18.2, 14.2 16.8, 12.5 16.4 Z" />
  </svg>
);

// Clean Standard Musical Quarter Rest Icon for UI palette buttons matching user's quarter rest asset
export const RestUIIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 26.22 74.74" className={className} fill="currentColor">
    <g transform="translate(0,-977.62215)">
      <g
        style={{ fill: 'currentColor', fillOpacity: 1, stroke: 'none' }}
        transform="matrix(0.99974987,0,0,0.99997083,-112.50645,534.65124)"
      >
        <path d="m 138.76116,462.5307 c -6.84377,8.15627 -10.26565,14.25001 -10.26562,18.28125 -3e-5,3.89063 3.25778,9.72656 9.77343,17.50781 l -2.03906,2.88282 c -3.28128,-1.92189 -6.09377,-2.88283 -8.4375,-2.88282 -3.04689,-10e-6 -4.57033,1.82811 -4.57031,5.48438 -2e-5,3.74998 1.66404,7.47654 4.99219,11.17969 l -1.82813,2.74218 c -9.23438,-6.84377 -13.85157,-12.93751 -13.85156,-18.28125 -1e-5,-2.71876 0.93749,-4.875 2.8125,-6.46875 1.73436,-1.5 3.98436,-2.25 6.75,-2.25 1.78123,0 3.74998,0.46875 5.90625,1.40625 l -14.13281,-18.77343 c 6.70311,-5.90624 10.05467,-11.24998 10.05468,-16.03125 -10e-6,-3.79685 -2.27345,-8.57809 -6.82031,-14.34375 l 5.625,0 16.03125,19.54687" />
      </g>
    </g>
  </svg>
);

// Standard Accidental UI Icons for Palette
export const SharpUIIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="-7 -16 14 32" className={className} fill="currentColor">
    <path d="M -3.2 -14.5 L -1.5 -14.8 L -1.5 12.0 L -3.2 12.3 Z" />
    <path d="M 1.5 -12.3 L 3.2 -12.6 L 3.2 14.5 L 1.5 14.2 Z" />
    <path d="M -6.0 -0.8 L 6.0 -2.6 L 6.0 -4.8 L -6.0 -3.0 Z" />
    <path d="M -6.0 4.2 L 6.0 2.4 L 6.0 0.2 L -6.0 2.0 Z" />
  </svg>
);

export const FlatUIIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="-5 -23 11 30" className={className} fill="currentColor">
    <path
      d="M -3.6 -22.0 L -2.0 -22.0 L -2.0 -2.0 C -0.6 -4.8, 2.2 -5.5, 3.8 -3.2 C 5.4 -1.0, 5.2 2.4, 3.4 4.8 C 1.8 6.8, -0.6 7.0, -2.0 5.6 L -2.0 5.8 L -3.6 5.8 Z M -2.0 3.6 C -0.8 4.6, 0.8 4.2, 1.8 3.0 C 2.8 1.6, 2.8 -0.8, 1.8 -2.0 C 0.8 -3.0, -0.8 -2.4, -2.0 -0.8 Z"
      fillRule="evenodd"
    />
  </svg>
);

export const NaturalUIIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="-7 -16 14 32" className={className} fill="currentColor">
    <path d="M -3.2 -14.5 L -1.5 -14.8 L -1.5 3.8 L -3.2 4.1 Z" />
    <path d="M 1.5 -4.1 L 3.2 -4.4 L 3.2 14.5 L 1.5 14.2 Z" />
    <path d="M -3.2 -1.0 L 3.2 -2.6 L 3.2 -4.8 L -3.2 -3.2 Z" />
    <path d="M -3.2 4.4 L 3.2 2.8 L 3.2 0.6 L -3.2 2.2 Z" />
  </svg>
);

// Advanced Music Symbols: Articulations
export const AccentSymbol: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = '#0F172A' }) => (
  <path
    d={`M ${x - 7} ${y - 4} L ${x + 7} ${y} L ${x - 7} ${y + 4}`}
    fill="none"
    stroke={color}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

export const StaccatoSymbol: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = '#0F172A' }) => (
  <circle cx={x} cy={y} r="2.8" fill={color} />
);

export const TenutoSymbol: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = '#0F172A' }) => (
  <line x1={x - 7} y1={y} x2={x + 7} y2={y} stroke={color} strokeWidth="2.4" strokeLinecap="round" />
);

export const MarcatoSymbol: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = '#0F172A' }) => (
  <path
    d={`M ${x - 6} ${y + 5} L ${x} ${y - 3} L ${x + 6} ${y + 5}`}
    fill="none"
    stroke={color}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

export const FermataSymbol: React.FC<{ x: number; y: number; isUp?: boolean; color?: string }> = ({
  x,
  y,
  isUp = true,
  color = '#0F172A',
}) => (
  <g transform={`translate(${x}, ${y}) scale(${isUp ? 1 : -1})`}>
    <path d="M -11 0 A 11 11 0 0 1 11 0" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="0" cy="-2.5" r="2.5" fill={color} />
  </g>
);

// Dynamic Marking Glyphs
export const DynamicSymbol: React.FC<{ x: number; y: number; dynamic: string; color?: string }> = ({
  x,
  y,
  dynamic,
  color = '#0F172A',
}) => (
  <text
    x={x}
    y={y}
    textAnchor="middle"
    fontSize="14"
    fontWeight="bold"
    fontStyle="italic"
    fontFamily="serif"
    fill={color}
    className="select-none pointer-events-none"
  >
    {dynamic}
  </text>
);

// Triplet Tuplet Bracket
export const TripletBracketSymbol: React.FC<{ x1: number; x2: number; y: number; isAbove?: boolean }> = ({
  x1,
  x2,
  y,
  isAbove = true,
}) => {
  const midX = (x1 + x2) / 2;
  const tickH = isAbove ? 6 : -6;
  return (
    <g className="pointer-events-none select-none">
      {/* Left bracket wing */}
      <line x1={x1} y1={y + tickH} x2={x1} y2={y} stroke="#0F172A" strokeWidth="1.6" />
      <line x1={x1} y1={y} x2={midX - 10} y2={y} stroke="#0F172A" strokeWidth="1.6" />
      {/* Center number 3 */}
      <text
        x={midX}
        y={isAbove ? y + 4 : y + 5}
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="bold"
        fontStyle="italic"
        fill="#0F172A"
      >
        3
      </text>
      {/* Right bracket wing */}
      <line x1={midX + 10} y1={y} x2={x2} y2={y} stroke="#0F172A" strokeWidth="1.6" />
      <line x1={x2} y1={y} x2={x2} y2={y + tickH} stroke="#0F172A" strokeWidth="1.6" />
    </g>
  );
};
