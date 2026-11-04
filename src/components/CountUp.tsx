import React, { useEffect, useRef, useState } from 'react';

export interface CountUpOptions {
  duration?: number;
  delay?: number;
}

const prefersReducedMotion = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useCountUp = (value: number, { duration = 1200, delay = 0 }: CountUpOptions = {}) => {
  const target = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState(() => prefersReducedMotion() ? target : 0);
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);
  const currentValue = useRef(displayValue);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (event: MediaQueryListEvent | MediaQueryList) => setReduceMotion(event.matches);
    update(query);
    if (query.addEventListener) query.addEventListener('change', update as (event: MediaQueryListEvent) => void);
    else query.addListener(update as (event: MediaQueryListEvent) => void);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update as (event: MediaQueryListEvent) => void);
      else query.removeListener(update as (event: MediaQueryListEvent) => void);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || duration <= 0) {
      currentValue.current = target;
      setDisplayValue(target);
      hasAnimated.current = true;
      return;
    }

    if (!hasAnimated.current) {
      currentValue.current = 0;
      setDisplayValue(0);
      hasAnimated.current = true;
    }

    const startValue = currentValue.current;
    const startTime = performance.now() + Math.max(0, delay);
    let frameId = 0;
    const finishForPrint = () => {
      cancelAnimationFrame(frameId);
      currentValue.current = target;
      setDisplayValue(target);
    };
    window.addEventListener('beforeprint', finishForPrint);
    const animate = (now: number) => {
      if (now < startTime) {
        frameId = requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(1, (now - startTime) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (target - startValue) * easedProgress;
      currentValue.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frameId = requestAnimationFrame(animate);
      else currentValue.current = target;
    };
    frameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('beforeprint', finishForPrint);
    };
  }, [target, duration, delay, reduceMotion]);

  return displayValue;
};

export interface CountUpProps extends CountUpOptions {
  value: number;
  formatter?: (value: number) => string;
  locale?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  formatter,
  locale = 'en-IN',
  maximumFractionDigits = Number.isInteger(value) ? 0 : 2,
  minimumFractionDigits = 0,
  prefix = '',
  suffix = '',
  duration,
  delay,
  className,
}) => {
  const animatedValue = useCountUp(value, { duration, delay });
  const formatted = formatter
    ? formatter(animatedValue)
    : `${prefix}${new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits }).format(animatedValue)}${suffix}`;
  const finalFormatted = formatter
    ? formatter(value)
    : `${prefix}${new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits }).format(value)}${suffix}`;

  return <span className={className} aria-label={finalFormatted}>{formatted}</span>;
};
