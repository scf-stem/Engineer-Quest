import React from 'react';

const paths = {
  desk: <><path d="M3 15h18M6 15v6m12-6v6M5 4h14v8H5zM9 12v3m6-3v3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M10 10h4v4h-4z"/></>,
  chart: <><path d="M4 20h17M6 16v-4m6 4V4m6 12V8"/></>,
  book: <><path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2z"/></>,
  arrow: <><path d="M4 12h15m-5-5 5 5-5 5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  bulb: <><path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 2H9zM12 1v2M2 10h2m16 0h2"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/></>,
  link: <><path d="m10 7 2-2a5 5 0 0 1 7 7l-2 2m-3 3-2 2a5 5 0 0 1-7-7l2-2m2 6 6-6"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  play: <path d="m8 4 12 8-12 8z"/>,
  coin: <><circle cx="12" cy="12" r="9"/><path d="M15 8h-5v8h5m-5-4h4"/></>,
};
export function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.chip}</svg>;
}
