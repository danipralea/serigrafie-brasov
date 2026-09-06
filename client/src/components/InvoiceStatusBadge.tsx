import { useTranslation } from 'react-i18next';
import { InvoiceStatus, InvoiceStatusType } from '../types';

/** Tailwind classes per invoice status, shared by every list and header. */
const STATUS_CLASSES: Record<string, string> = {
  [InvoiceStatus.DRAFT]: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
  [InvoiceStatus.ISSUED]: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  [InvoiceStatus.PAID]: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  [InvoiceStatus.CANCELLED]: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
};

function getInvoiceStatusClasses(status: string): string {
  return STATUS_CLASSES[status] || STATUS_CLASSES[InvoiceStatus.DRAFT];
}

interface InvoiceStatusBadgeProps {
  status: InvoiceStatusType | string;
  size?: 'sm' | 'md';
}

export default function InvoiceStatusBadge({ status, size = 'sm' }: InvoiceStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      data-testid={`invoice-status-${status}`}
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      } ${getInvoiceStatusClasses(status)}`}
    >
      {t(`invoices.status.${status}`)}
    </span>
  );
}
