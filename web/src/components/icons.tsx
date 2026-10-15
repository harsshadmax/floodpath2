// Small stroke icons (no icon library). All are decorative: the buttons that use them carry text labels.
import type { ReactNode } from "react";

function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const DropIcon = () => (
  <Svg size={22}>
    <path d="M12 3.5c3.2 3.9 5.5 6.8 5.5 9.7a5.5 5.5 0 0 1-11 0C6.5 10.300 8.800 7.400 12 3.500Z" />
  </Svg>
);
export const DashboardIcon = () => (
  <Svg>
    <path d="M4 20V11M10 20V5M16 20v-6M22 20H2" />
  </Svg>
);
export const RouteIcon = () => (
  <Svg>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h7.500a3.500 3.500 0 0 0 0-7h-7a3.500 3.500 0 0 1 0-7H16" />
  </Svg>
);
export const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);
export const CalendarIcon = () => (
  <Svg size={16}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);

export const LayersIcon = () => (
  <Svg>
    <path d="M12 4 3.500 8.500 12 13l8.500-4.500L12 4Z" />
    <path d="m3.500 12.500 8.500 4.500 8.500-4.500" />
    <path d="m3.500 16 8.500 4.500 8.500-4.500" />
  </Svg>
);
export const TableIcon = () => (
  <Svg>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M4 10h16M10 10v9" />
  </Svg>
);
export const DownloadIcon = () => (
  <Svg>
    <path d="M12 4v10m0 0-4-4m4 4 4-4" />
    <path d="M5 19h14" />
  </Svg>
);

// KPI-tile icons (PHASE 13 UI reference pass): one small decorative glyph per headline number,
// matching the icon-in-tile pattern of the Dribbble reference this theme was adapted from.
export const ClockIcon = () => (
  <Svg size={18}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);
export const CheckShieldIcon = () => (
  <Svg size={18}>
    <path d="M12 3.5 5 6v5.5c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6l-7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const TargetIcon = () => (
  <Svg size={18}>
    <circle cx="12" cy="12" r="8.500" />
    <circle cx="12" cy="12" r="4.500" />
    <circle cx="12" cy="12" r="0.800" fill="currentColor" stroke="none" />
  </Svg>
);
export const UsersIcon = () => (
  <Svg size={18}>
    <circle cx="9" cy="8.500" r="3.200" />
    <path d="M3.200 19c0.700-3.200 3-5 5.800-5s5.100 1.800 5.800 5" />
    <path d="M15.500 6.200c1.600 0.300 2.800 1.700 2.800 3.300 0 1.600-1.200 3-2.800 3.300" />
    <path d="M18 14.500c1.900 0.400 3.300 1.900 3.800 4.500" />
  </Svg>
);
export const PulseIcon = () => (
  <Svg size={18}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </Svg>
);
