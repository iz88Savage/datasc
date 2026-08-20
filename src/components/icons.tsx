import React from "react";

type P = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const base = (
  { size = 16, className = "", strokeWidth = 1.8 }: P,
  children: React.ReactNode,
  viewBox = "0 0 24 24",
) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconTacho = (p: P) =>
  base(p, <>
    <path d="M4.5 19a9.5 9.5 0 1 1 15 0" />
    <path d="M12 13.5 16 8" />
    <circle cx="12" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 5v1.6M6.1 8.1l1.2 1.1M17.9 8.1l-1.2 1.1" />
  </>);

export const IconWrench = (p: P) =>
  base(p, <path d="M14.7 6.3a4.2 4.2 0 0 0-5.6 5.2L3 17.6V21h3.4l6.1-6.1a4.2 4.2 0 0 0 5.2-5.6L15 12l-3-3 2.7-2.7Z" />);

export const IconBolt = (p: P) =>
  base(p, <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />);

export const IconMail = (p: P) =>
  base(p, <>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </>);

export const IconPhone = (p: P) =>
  base(p, <path d="M5.5 3h3l1.7 4.2-2 1.6a13 13 0 0 0 7 7l1.6-2 4.2 1.7v3A1.5 1.5 0 0 1 19.5 20 16.5 16.5 0 0 1 4 4.5 1.5 1.5 0 0 1 5.5 3Z" />);

export const IconCopy = (p: P) =>
  base(p, <>
    <rect x="9" y="9" width="12" height="12" rx="1.5" />
    <path d="M5 15H3.5A1.5 1.5 0 0 1 2 13.5v-10A1.5 1.5 0 0 1 3.5 2h10A1.5 1.5 0 0 1 15 3.5V5" />
  </>);

export const IconCheck = (p: P) => base(p, <path d="m4 12.5 5 5L20 6.5" />);

export const IconX = (p: P) => base(p, <path d="M5 5l14 14M19 5 5 19" />);

export const IconGear = (p: P) =>
  base(p, <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19 12a7 7 0 0 0-.15-1.4l2-1.55-2-3.4-2.35.95a7 7 0 0 0-2.4-1.4L13.7 2.7h-3.4l-.4 2.5a7 7 0 0 0-2.4 1.4l-2.35-.95-2 3.4 2 1.55A7 7 0 0 0 5 12c0 .48.05.94.15 1.4l-2 1.55 2 3.4 2.35-.95a7 7 0 0 0 2.4 1.4l.4 2.5h3.4l.4-2.5a7 7 0 0 0 2.4-1.4l2.35.95 2-3.4-2-1.55c.1-.46.15-.92.15-1.4Z" />
  </>);

export const IconSearch = (p: P) =>
  base(p, <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20.5 20.5-5.4-5.4" />
  </>);

export const IconDownload = (p: P) =>
  base(p, <>
    <path d="M12 3v11m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </>);

export const IconShield = (p: P) =>
  base(p, <path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.3 7.5 10 4.3-1.7 7.5-5 7.5-10v-6L12 2.5Z" />);

export const IconImage = (p: P) =>
  base(p, <>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="m3.5 18 5.5-5 3.5 3 3-2.5 5 4.5" />
  </>);

export const IconEye = (p: P) =>
  base(p, <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>);

export const IconRefresh = (p: P) =>
  base(p, <>
    <path d="M20 5v5h-5" />
    <path d="M20 10a8 8 0 1 0 2 5.3" opacity="0" />
    <path d="M19.5 10A8 8 0 1 0 20 14" />
  </>);

export const IconTrash = (p: P) =>
  base(p, <>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    <path d="M10 11v5m4-5v5" />
  </>);

export const IconChevron = (p: P) => base(p, <path d="m6 9 6 6 6-6" />);

export const IconTarget = (p: P) =>
  base(p, <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
  </>);

export const IconAlert = (p: P) =>
  base(p, <>
    <path d="M12 3 1.8 20.2h20.4L12 3Z" />
    <path d="M12 9.5v5M12 17.6v.4" />
  </>);

export const IconStop = (p: P) =>
  base(p, <>
    <rect x="6" y="6" width="12" height="12" rx="1" />
    <path d="M3 12h1.5M19.5 12H21M12 3v1.5M12 19.5V21" />
  </>);

export const IconFlag = (p: P) =>
  base(p, <>
    <path d="M5 21V4" />
    <path d="M5 4c4-2.2 7 2 11 0v9c-4 2.2-7-2-11 0" />
  </>);

export const IconQueue = (p: P) =>
  base(p, <>
    <path d="M4 6h16M4 12h10M4 18h13" />
    <circle cx="19" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </>);

export const IconFlame = (p: P) =>
  base(p, <path d="M12 22c4 0 6.5-2.7 6.5-6.2 0-2.6-1.6-4.4-3-6.3-1.2-1.6-2.3-3.2-2.5-5.5-2.6 1.5-3.4 4-3.1 6.4-.9-.3-1.5-1-1.8-2.2-1.4 1.5-2.1 3.6-2.1 5.4C6 19.3 8 22 12 22Z" />);

export const IconInfo = (p: P) =>
  base(p, <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.4" />
  </>);

export const IconSpinner = (p: P) =>
  base({ ...p, className: `spin ${p.className ?? ""}` }, <path d="M12 3a9 9 0 1 0 9 9" />);
