import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const DEFAULT_PAGE_SIZE = 10;

export const shouldShowPagination = (totalRecords: number, pageSize = DEFAULT_PAGE_SIZE) =>
  totalRecords >= pageSize;

export const getPageRecords = <T,>(records: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) => {
  if (!shouldShowPagination(records.length, pageSize)) return records;
  const start = (Math.max(1, page) - 1) * pageSize;
  return records.slice(start, start + pageSize);
};

export const getPaginationRange = (totalRecords: number, page: number, pageSize = DEFAULT_PAGE_SIZE) => {
  if (totalRecords === 0) return { start: 0, end: 0 };
  if (!shouldShowPagination(totalRecords, pageSize)) return { start: 1, end: totalRecords };
  const safePage = Math.min(Math.max(1, page), Math.ceil(totalRecords / pageSize));
  return { start: (safePage - 1) * pageSize + 1, end: Math.min(safePage * pageSize, totalRecords) };
};

type PaginationControlsProps = {
  totalRecords: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  className?: string;
};

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  totalRecords,
  page,
  onPageChange,
  pageSize = DEFAULT_PAGE_SIZE,
  className = '',
}) => {
  if (!shouldShowPagination(totalRecords, pageSize)) return null;

  const pageCount = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pages = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : safePage <= 3
      ? [1, 2, 3, 4, 5]
      : safePage >= pageCount - 2
        ? Array.from({ length: 5 }, (_, index) => pageCount - 4 + index)
        : [safePage - 1, safePage, safePage + 1];
  const buttonClass = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-sm text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav aria-label="Table pagination" className={`flex flex-wrap items-center justify-end gap-1 ${className}`}>
      <button type="button" aria-label="First page" title="First page" disabled={safePage === 1} onClick={() => onPageChange(1)} className={buttonClass}><ChevronsLeft size={16} /></button>
      <button type="button" aria-label="Previous page" title="Previous page" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)} className={buttonClass}><ChevronLeft size={16} /></button>
      {pages.map((pageNumber) => <button key={pageNumber} type="button" aria-current={safePage === pageNumber ? 'page' : undefined} onClick={() => onPageChange(pageNumber)} className={`${buttonClass} ${safePage === pageNumber ? 'border-primary bg-primary-container/30 font-semibold' : ''}`}>{pageNumber}</button>)}
      <button type="button" aria-label="Next page" title="Next page" disabled={safePage === pageCount} onClick={() => onPageChange(safePage + 1)} className={buttonClass}><ChevronRight size={16} /></button>
      <button type="button" aria-label="Last page" title="Last page" disabled={safePage === pageCount} onClick={() => onPageChange(pageCount)} className={buttonClass}><ChevronsRight size={16} /></button>
    </nav>
  );
};
