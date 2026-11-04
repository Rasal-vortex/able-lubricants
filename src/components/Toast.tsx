import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useApp();

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';
  const isWarning = toast.type === 'warning';
  const Icon = isError ? AlertCircle : isWarning ? TriangleAlert : isInfo ? Info : CheckCircle2;
  const tone = isError
    ? { stroke: 'text-red-500', icon: 'bg-red-50 text-red-600', title: 'Something needs attention' }
    : isWarning
      ? { stroke: 'text-amber-500', icon: 'bg-amber-50 text-amber-700', title: 'Warning' }
      : isInfo
        ? { stroke: 'text-blue-500', icon: 'bg-blue-50 text-blue-600', title: 'Information' }
        : { stroke: 'text-emerald-500', icon: 'bg-emerald-50 text-emerald-600', title: 'Success' };

  const dismissWhenFuseCompletes = (event: React.AnimationEvent<SVGRectElement>) => {
    if (event.animationName === 'toast-outline-progress') hideToast();
  };

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className="fixed right-4 top-[68px] z-[100] flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-xl border border-[#e9e3d9] bg-white p-4 text-[#171717] shadow-[0_14px_38px_rgba(24,22,18,.18)] animate-in fade-in slide-in-from-top-2 duration-200 sm:right-6"
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <rect
          key={toast.id}
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="12"
          ry="12"
          pathLength="100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="100"
          strokeDashoffset="100"
          className={`toast-outline-fuse ${tone.stroke}`}
          onAnimationEnd={dismissWhenFuseCompletes}
        />
      </svg>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pr-1">
        <p className="text-sm font-bold leading-5">{tone.title}</p>
        <p className="mt-1 break-words text-sm leading-5 text-[#595959]">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={hideToast}
        aria-label="Close notification"
        className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6b6b6b] transition hover:bg-[#f3f1ed] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b87500]"
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
};
