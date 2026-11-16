/** Iconos de trazo simples (24×24), heredan el color del texto. Decorativos: aria-hidden. */
import type { ReactNode } from "react";

function Icon({ children, className = "h-7 w-7" }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}
type P = { className?: string };
export const IconDocCheck = (p: P) => <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="m9 14 2 2 4-4" /></Icon>;
export const IconQuote = (p: P) => <Icon {...p}><path d="M7 7h4v4c0 3-2 5-4 5" /><path d="M14 7h4v4c0 3-2 5-4 5" /></Icon>;
export const IconBook = (p: P) => <Icon {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M9 7h6" /></Icon>;
export const IconFolder = (p: P) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Icon>;
export const IconTemplate = (p: P) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></Icon>;
export const IconLibrary = (p: P) => <Icon {...p}><path d="M5 4v16M10 4v16" /><path d="m14 5 4 15" /></Icon>;
export const IconCompass = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></Icon>;
export const IconArrow = (p: P) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
