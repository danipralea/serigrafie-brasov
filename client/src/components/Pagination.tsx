import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
  /** Test id of the wrapper; the buttons keep their shared ids. */
  testId?: string;
}

/**
 * Page bar for long lists. First and last pages are always reachable, the
 * current page keeps a neighbour on each side, and skipped ranges collapse
 * into a gap.
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onChange,
  testId = 'pagination'
}: PaginationProps) {
  const { t } = useTranslation();

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: (number | 'gap')[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('gap');
    for (let page = start; page <= end; page++) pages.push(page);
    if (end < totalPages - 1) pages.push('gap');
    pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div
      data-testid={testId}
      className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3"
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('dashboard.pagination.showing', {
          from: (currentPage - 1) * pageSize + 1,
          to: Math.min(currentPage * pageSize, totalItems),
          total: totalItems
        })}
      </p>
      <div className="flex items-center gap-1">
        <button
          data-testid="pagination-previous"
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors focus:outline-none"
        >
          {t('dashboard.pagination.previous')}
        </button>
        {pageNumbers.map((page, index) =>
          page === 'gap' ? (
            <span key={`gap-${index}`} className="px-2 text-sm text-slate-400 dark:text-slate-500">
              &hellip;
            </span>
          ) : (
            <button
              key={page}
              data-testid={`pagination-page-${page}`}
              onClick={() => onChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`min-w-9 px-3 py-1.5 rounded-md text-sm transition-colors focus:outline-none ${
                page === currentPage
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          data-testid="pagination-next"
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors focus:outline-none"
        >
          {t('dashboard.pagination.next')}
        </button>
      </div>
    </div>
  );
}
