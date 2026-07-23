import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow-left"
  | "arrow-right"
  | "check"
  | "chevron-down"
  | "download"
  | "upload"
  | "trash"
  | "football"
  | "basketball"
  | "lock"
  | "database"
  | "shield"
  | "spark"
  | "user"
  | "map"
  | "home"
  | "pulse"
  | "brain"
  | "bolt"
  | "target"
  | "calendar"
  | "team"
  | "chart"
  | "book"
  | "clock"
  | "trophy"
  | "flame"
  | "menu"
  | "close"
  | "message"
  | "swap"
  | "history";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    "arrow-left": <path d="m15 18-6-6 6-6" />,
    "arrow-right": <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    "chevron-down": <path d="m7 10 5 5 5-5" />,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    upload: <><path d="M12 21V9" /><path d="m17 14-5-5-5 5" /><path d="M5 3h14" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m7 7 1 14h8l1-14" /></>,
    football: <><path d="M18.2 5.8c-3.4-3.4-8.2-2.1-11.1.8-2.9 2.9-4.2 7.7-.8 11.1 3.4 3.4 8.2 2.1 11.1-.8 2.9-2.9 4.2-7.7.8-11.1Z" /><path d="m8.5 15.5 7-7" /><path d="m10.5 9.5 4 4" /></>,
    basketball: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9.5c4.9.2 9.6-2 12.6-5.6" /><path d="M7.8 20.9c.2-5.1 2.5-10 6.4-13.2" /><path d="M20.3 16.7c-4.8-2.3-10.3-2.5-15.2-.5" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    shield: <path d="M12 3 5 6v5c0 4.8 3 8.2 7 10 4-1.8 7-5.2 7-10V6l-7-3Z" />,
    spark: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    pulse: <path d="M3 12h4l2-6 4 12 2-6h6" />,
    brain: <><path d="M9.5 4A3.5 3.5 0 0 0 6 7.5c0 .5.1 1 .3 1.4A3.5 3.5 0 0 0 7 15.7 3.5 3.5 0 0 0 13.5 18V6A3 3 0 0 0 9.5 4Z" /><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5c0 .5-.1 1-.3 1.4a3.5 3.5 0 0 1-.7 6.8A3.5 3.5 0 0 1 10.5 18V6A3 3 0 0 1 14.5 4Z" /></>,
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 21a6 6 0 0 1 12 0" /><path d="M14 17a4 4 0 0 1 7 3" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    book: <><path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4Z" /><path d="M20 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6V4Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M6 6H3v2a4 4 0 0 0 4 4M18 6h3v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6" /></>,
    flame: <path d="M13 3s1 4-2 6c-2 1.4-3 3.2-2 5.2.7 1.4 2 2.1 3.5 1.8 2.4-.5 3.4-3.2 2-5.2 3.5 2.1 4.2 6.2 1.8 8.6A6.4 6.4 0 0 1 5.5 15c-.2-3.6 2.4-6.3 4.5-8.2C11.5 5.5 13 3 13 3Z" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    message: <><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
    swap: <><path d="M7 7h11l-3-3" /><path d="m18 7-3 3" /><path d="M17 17H6l3 3" /><path d="m6 17 3-3" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
