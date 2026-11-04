import React, { useEffect, useRef } from 'react';
import { motion, useInView, useAnimation, useSpring } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader } from './card';

type ChartDataItem = {
  name: string;
  value: number;
  color?: string;
};

export interface StatsCardProps {
  title: string;
  currentValue: number;
  valuePrefix?: string;
  valuePostfix?: string;
  description: React.ReactNode;
  chartData: ChartDataItem[];
  onActionClick?: () => void;
  className?: string;
  defaultBarColor?: string;
  highlightedBarColor?: string;
}

const AnimatedValue = ({ value, prefix = '', postfix = '' }: { value: number; prefix?: string; postfix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { damping: 30, stiffness: 100, mass: 1 });

  useEffect(() => {
    if (isInView) spring.set(value);
  }, [spring, isInView, value]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(latest)}${postfix}`;
      }
    });
    return unsubscribe;
  }, [prefix, postfix, spring]);

  return <span ref={ref}>{`${prefix}${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(0)}${postfix}`}</span>;
};

export const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({
    title,
    currentValue,
    valuePrefix,
    valuePostfix,
    description,
    chartData,
    onActionClick,
    className,
    defaultBarColor = 'bg-primary/20',
    highlightedBarColor = 'bg-amber-500',
  }, ref) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(chartRef, { once: true, amount: 0.4 });
    const controls = useAnimation();

    useEffect(() => {
      if (isInView) controls.start('visible');
    }, [isInView, controls]);

    return (
      <Card ref={ref} className={cn('w-full overflow-hidden', className)}>
        <CardHeader className="flex-row items-center justify-between pb-2">
          {onActionClick ? (
            <button
              type="button"
              onClick={onActionClick}
              className="group flex w-full items-center justify-between rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`${title}, click to view more`}
            >
              <span className="text-sm font-medium text-on-surface-variant">{title}</span>
              <ChevronRight className="h-4 w-4 text-on-surface-variant transition-transform group-hover:translate-x-1" />
            </button>
          ) : <h3 className="text-sm font-medium text-on-surface-variant">{title}</h3>}
        </CardHeader>
        <CardContent>
          <div ref={chartRef} className="flex flex-col gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-on-surface">
                <AnimatedValue value={currentValue} prefix={valuePrefix} postfix={valuePostfix} />
              </h2>
              <div className="text-sm text-on-surface-variant">{description}</div>
            </div>
            <motion.div
              className="flex h-24 w-full items-end gap-2 sm:gap-3"
              initial="hidden"
              animate={controls}
              transition={{ staggerChildren: 0.08 }}
              role="img"
              aria-label={`${title} chart for ${chartData.map((item) => item.name).join(', ')}`}
            >
              {chartData.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <motion.div
                    className={cn('w-full rounded-t-md', item.color || (index === chartData.length - 1 ? highlightedBarColor : defaultBarColor))}
                    variants={{
                      hidden: { height: '0%' },
                      visible: { height: 'var(--bar-height, 0%)', transition: { type: 'spring', damping: 15, stiffness: 100 } },
                    }}
                    style={{ '--bar-height': `${Math.max(0, Math.min(100, item.value))}%` } as React.CSSProperties}
                  />
                  <span className="text-[10px] font-medium text-on-surface-variant sm:text-xs">{item.name}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

StatsCard.displayName = 'StatsCard';
