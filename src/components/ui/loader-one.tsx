import React from 'react';

const LoaderOne: React.FC = () => (
  <div className="flex items-center justify-center gap-1.5" role="status" aria-label="Loading data">
    {[0, 1, 2].map((index) => (
      <span
        key={index}
        className="loader-one-dot h-2.5 w-2.5 rounded-full bg-[#c58a00]"
        style={{ animationDelay: `${index * 0.16}s` }}
      />
    ))}
    <span className="sr-only">Loading data</span>
  </div>
);

export default LoaderOne;
