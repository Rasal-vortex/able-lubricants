import React from 'react';
import { motion } from 'motion/react';

const LoaderOne: React.FC = () => (
  <div className="flex items-center justify-center gap-1.5" role="status" aria-label="Loading report data">
    {[0, 1, 2].map((index) => (
      <motion.span
        key={index}
        className="h-2.5 w-2.5 rounded-full bg-[#c58a00]"
        initial={{ x: 0, opacity: 0.5, scale: 1 }}
        animate={{ x: [0, 7, 0], opacity: [0.5, 1, 0.5], scale: [1, 1.15, 1] }}
        transition={{ duration: 1, repeat: Infinity, delay: index * 0.18, ease: 'easeInOut' }}
      />
    ))}
    <span className="sr-only">Loading report data</span>
  </div>
);

export default LoaderOne;
