import React from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-bold overflow-hidden', className)}>
      <Package className="h-6 w-6 shrink-0 text-primary" />
      <span className="truncate group-data-[collapsible=icon]:hidden">
        BST INVENTARIO
      </span>
    </div>
  );
}
