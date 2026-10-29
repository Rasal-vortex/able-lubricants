import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useApp();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-inverse-surface text-inverse-on-surface px-space-md py-space-sm rounded-lg shadow-xl flex items-center gap-space-sm z-[100] animate-in fade-in slide-in-from-bottom-3 duration-200">
      <span className="material-symbols-outlined text-tertiary-fixed text-[20px]">
        {toast.type === 'error' ? 'error' : toast.type === 'info' ? 'info' : 'check_circle'}
      </span>
      <span className="font-body-md text-body-md text-inverse-on-surface">{toast.message}</span>
      <button
        type="button"
        onClick={hideToast}
        className="ml-2 text-outline-variant hover:text-inverse-on-surface p-0.5 rounded"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};
