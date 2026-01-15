'use client';

import { useState, useEffect } from 'react';
import { Columns3, Eye, EyeOff } from 'lucide-react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible?: boolean;
}

interface ColumnSelectorProps {
  columns: ColumnDefinition[];
  visibleColumns: string[];
  onVisibilityChange: (visibleColumns: string[]) => void;
  storageKey?: string;
}

export function ColumnSelector({
  columns,
  visibleColumns,
  onVisibilityChange,
  storageKey,
}: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            onVisibilityChange(parsed);
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [storageKey]);

  // Save to localStorage when visibility changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns, storageKey]);

  const toggleColumn = (columnId: string) => {
    if (visibleColumns.includes(columnId)) {
      // Don't allow hiding all columns - keep at least one
      if (visibleColumns.length > 1) {
        onVisibilityChange(visibleColumns.filter((id) => id !== columnId));
      }
    } else {
      onVisibilityChange([...visibleColumns, columnId]);
    }
  };

  const showAll = () => {
    onVisibilityChange(columns.map((c) => c.id));
  };

  const resetToDefault = () => {
    const defaultVisible = columns
      .filter((c) => c.defaultVisible !== false)
      .map((c) => c.id);
    onVisibilityChange(defaultVisible);
  };

  const hiddenCount = columns.length - visibleColumns.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns3 className="w-4 h-4" />
          <span>Sütunlar</span>
          {hiddenCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
              {hiddenCount} gizli
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
            Görünür Sütunlar
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {columns.map((column) => {
              const isVisible = visibleColumns.includes(column.id);
              return (
                <button
                  key={column.id}
                  onClick={() => toggleColumn(column.id)}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={() => toggleColumn(column.id)}
                    className="pointer-events-none"
                  />
                  <span className="flex-1 text-sm">{column.label}</span>
                  {isVisible ? (
                    <Eye className="w-4 h-4 text-primary" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border mt-2 pt-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={showAll}
              className="flex-1 text-xs"
            >
              Tümünü Göster
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefault}
              className="flex-1 text-xs"
            >
              Varsayılan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
