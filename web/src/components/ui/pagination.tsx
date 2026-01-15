'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  total,
  limit,
  offset,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startItem = total === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + limit, total);

  const canGoPrev = offset > 0;
  const canGoNext = offset + limit < total;

  const goToPage = (page: number) => {
    const newOffset = (page - 1) * limit;
    onPageChange(newOffset);
  };

  const goFirst = () => goToPage(1);
  const goPrev = () => goToPage(currentPage - 1);
  const goNext = () => goToPage(currentPage + 1);
  const goLast = () => goToPage(totalPages);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{startItem}</span>
        {' - '}
        <span className="font-medium text-foreground">{endItem}</span>
        {' / '}
        <span className="font-medium text-foreground">{total}</span>
        {' sonuç'}
      </div>

      {/* Page size selector */}
      {onLimitChange && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sayfa boyutu:</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => onLimitChange(Number(value))}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={goFirst}
          disabled={!canGoPrev}
          title="İlk sayfa"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={goPrev}
          disabled={!canGoPrev}
          title="Önceki sayfa"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="icon-sm"
                onClick={() => goToPage(page)}
                className={page === currentPage ? 'pointer-events-none' : ''}
              >
                {page}
              </Button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={goNext}
          disabled={!canGoNext}
          title="Sonraki sayfa"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={goLast}
          disabled={!canGoNext}
          title="Son sayfa"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
