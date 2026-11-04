import React, { useEffect, useRef, useState } from 'react';
import { animate, cubicBezier, useInView, useReducedMotion } from 'motion/react';

type CountUpOptions = {
  from?: number;
  duration?: number;
  delay?: number;
  startWhen?: boolean;
  trigger?: 'view' | 'load';
  direction?: 'up' | 'down';
  easing?: 'linear' | 'easeOut' | 'expo' | 'spring';
  onStart?: () => void;
  onEnd?: () => void;
};

const easeOut = cubicBezier(0.33, 1, 0.68, 1);
const expoEase = (t: number) => t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10));
const springEase = (t: number) => t >= 1 ? 1 : 1 - Math.exp(-8 * t) * Math.cos(10 * t);
const getEase = (easing: NonNullable<CountUpOptions['easing']>) => easing === 'linear' ? 'linear' : easing === 'expo' ? expoEase : easing === 'spring' ? springEase : easeOut;

export const useReactBitsCountUp = (
  to: number,
  active: boolean,
  { from = 0, duration = 1, delay = 0, startWhen = true, direction = 'up', easing = 'easeOut', onStart, onEnd }: CountUpOptions = {},
) => {
  const target = Number.isFinite(to) ? to : 0;
  const initial = direction === 'down' ? target : from;
  const final = direction === 'down' ? from : target;
  const [value, setValue] = useState(initial);
  const [replayKey, setReplayKey] = useState(0);
  const valueRef = useRef(initial);
  const started = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active || !startWhen) return;
    const start = started.current ? valueRef.current : initial;
    started.current = true;
    valueRef.current = start;
    if (reduceMotion || duration <= 0) {
      valueRef.current = final;
      setValue(final);
      onEnd?.();
      return;
    }

    onStart?.();
    const controls = animate(start, final, {
      duration,
      delay,
      ease: getEase(easing),
      onUpdate: (next) => {
        valueRef.current = next;
        setValue(next);
      },
      onComplete: () => {
        valueRef.current = final;
        setValue(final);
        onEnd?.();
      },
    });
    return () => controls.stop();
  }, [active, startWhen, initial, final, duration, delay, reduceMotion, easing, onStart, onEnd, replayKey]);

  return {
    value,
    reset: () => {
      started.current = false;
      valueRef.current = initial;
      setValue(initial);
      setReplayKey((current) => current + 1);
    },
  };
};

export interface ReactBitsCountUpProps extends CountUpOptions {
  to: number;
  decimals?: number;
  format?: 'standard' | 'compact';
  separator?: string;
  prefix?: string;
  suffix?: string;
  formatter?: (value: number) => string;
  className?: string;
  style?: React.CSSProperties;
  replayOnHover?: boolean;
}

const compactValue = (value: number, decimals?: number) => {
  const units: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  const unit = units.find(([size]) => Math.abs(value) >= size);
  return unit
    ? `${(value / unit[0]).toFixed(decimals ?? (Math.abs(value / unit[0]) < 100 ? 1 : 0))}${unit[1]}`
    : value.toLocaleString('en-IN', { maximumFractionDigits: decimals ?? 2 });
};

const formatNumber = (value: number, decimals?: number, separator = ',') => {
  const formatted = value.toLocaleString('en-IN', {
    maximumFractionDigits: decimals ?? 2,
    minimumFractionDigits: decimals ?? 0,
  });
  if (separator === ',') return formatted;
  return formatted.replace(/,/g, separator);
};

const ReactBitsCountUp: React.FC<ReactBitsCountUpProps> = ({
  to,
  from = 0,
  duration = 1.2,
  delay = 0,
  startWhen = true,
  trigger = 'view',
  direction = 'up',
  easing = 'easeOut',
  decimals,
  format = 'standard',
  separator = ',',
  prefix = '',
  suffix = '',
  formatter,
  className = '',
  style,
  replayOnHover = false,
  onStart,
  onEnd,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });
  const active = trigger === 'load' || isInView;
  const { value, reset } = useReactBitsCountUp(to, active, { from, duration, delay, startWhen, direction, easing, onStart, onEnd });
  const display = formatter
    ? formatter(value)
    : `${prefix}${format === 'compact' ? compactValue(value, decimals) : formatNumber(value, decimals, separator)}${suffix}`;
  const finalValue = direction === 'down' ? from : to;
  const accessibleValue = formatter
    ? formatter(finalValue)
    : `${prefix}${format === 'compact' ? compactValue(finalValue, decimals) : formatNumber(finalValue, decimals, separator)}${suffix}`;

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
      aria-label={accessibleValue}
      onPointerEnter={replayOnHover ? reset : undefined}
    >
      {display}
    </span>
  );
};

export default ReactBitsCountUp;
