import React from 'react';
import CountUp from '../ReactBitsCountUp';

export interface StatsWidgetProps {
  label: string;
  value: number;
  formatter: (value: number) => string;
  icon: React.ReactNode;
  delay?: number;
}

export const StatsWidget: React.FC<StatsWidgetProps> = ({ label, value, formatter, icon, delay = 0 }) => (
  <article className="relative isolate flex min-h-[164px] min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_28px_rgba(38,32,22,.09)] backdrop-blur-xl sm:p-5">
    <div
      className="pointer-events-none absolute inset-0 z-0 opacity-40"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(110, 110, 110, .32) 1px, transparent 1.2px)',
        backgroundSize: '12px 12px',
      }}
      aria-hidden="true"
    />
    <span className="pointer-events-none absolute -bottom-3 -right-2 z-0 text-[#807969]/[.10] [&>svg]:h-[92px] [&>svg]:w-[92px] sm:[&>svg]:h-[104px] sm:[&>svg]:w-[104px]" aria-hidden="true">
      {icon}
    </span>
    <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
      <h2 className="max-w-[90%] whitespace-normal break-words text-[16px] font-semibold leading-snug text-[#5f5d58] sm:text-[17px]">{label}</h2>
      <p className="mt-2 break-words text-[27px] font-bold leading-tight tracking-tight text-[#171717]"><CountUp to={Math.round(value)} formatter={(amount) => formatter(Math.round(amount))} delay={delay / 1000} duration={0.65} trigger="view" easing="easeOut" /></p>
    </div>
  </article>
);
