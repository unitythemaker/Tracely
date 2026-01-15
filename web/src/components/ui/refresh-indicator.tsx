'use client';

import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RefreshIndicatorProps {
  isRefreshing: boolean;
  lastUpdated: Date | null;
  onRefresh?: () => void;
  className?: string;
}

export function RefreshIndicator({
  isRefreshing,
  lastUpdated,
  onRefresh,
  className,
}: RefreshIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="p-1.5 rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
        title="Yenile"
      >
        <RefreshCw
          className={cn(
            'w-4 h-4 transition-all',
            isRefreshing && 'animate-spin text-[#00d9ff]'
          )}
        />
      </button>
      {lastUpdated && (
        <span className="text-xs">
          Son: {format(lastUpdated, 'HH:mm:ss', { locale: tr })}
        </span>
      )}
    </div>
  );
}
