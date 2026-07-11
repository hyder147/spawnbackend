import React from 'react';

/* ── SpawnPoint SVG Logo ──
   Single source of truth for the brand mark. Previously this was
   defined locally inside Login.tsx while the navbar used an unrelated
   lucide "Zap" icon and index.html used a separate JPEG — three
   different marks for one brand. Import this component wherever the
   logo is needed instead of redefining or substituting it. */
const SpawnLogo: React.FC<{ size?: number }> = ({ size = 52 }) => (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer hexagon */}
        <polygon points="26,2 48,14 48,38 26,50 4,38 4,14" fill="none" stroke="#C8FF00" strokeWidth="1.5" strokeLinejoin="round" opacity="0.35" />
        {/* Inner hexagon */}
        <polygon points="26,9 41,17.5 41,34.5 26,43 11,34.5 11,17.5" fill="rgba(200,255,0,0.06)" stroke="#C8FF00" strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
        {/* Lightning bolt */}
        <path d="M30 10L20 27H27L22 42L34 23H26L30 10Z" fill="#C8FF00" />
        {/* Glow effect */}
        <path d="M30 10L20 27H27L22 42L34 23H26L30 10Z" fill="#C8FF00" opacity="0.3" filter="url(#spawn-logo-glow)" />
        <defs>
            <filter id="spawn-logo-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
        </defs>
    </svg>
);

export default SpawnLogo;