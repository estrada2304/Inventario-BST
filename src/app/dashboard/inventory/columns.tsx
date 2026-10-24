'use client';

import { ColumnDef } from '@tanstack/react-table';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DataTableRowActions } from '@/components/ui/data-table-row-actions';
import { Component, Package } from 'lucide-react';
import { format } from 'date-fns';

const formatUsd = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatVes = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
    }).format(amount);
};

export const columns: ColumnDef<Product>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Seleccionar todo"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Seleccionar fila"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'image',
    header: 'Imagen',
    cell: ({ row, table }) => {
      const { onViewImage } = table.options.meta as { onViewImage?: (data: Product) => void };
      return (
        <button onClick={() => onViewImage?.(row.original)} className="w-12 h-12 relative block rounded-md overflow-hidden">
          <Image
            src={row.getValue('image')}
            alt={row.original.name}
            fill
            className="object-cover"
          />
        </button>
      );
    },
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    cell: ({ row }) => (
        <div className="flex items-center gap-2">
         {row.original.isComposite ? <span title="Producto Compuesto"><Component className="h-4 w-4 text-muted-foreground" /></span> : <span title="Producto Simple"><Package className="h-4 w-4 text-muted-foreground" /></span>}
        <span className="font-medium">{row.getValue('name')}</span>
      </div>
    ),
  },
   {
    accessorKey: 'serialNumber',
    header: 'Número de Serie',
  },
  {
    accessorKey: 'description',
    header: 'Descripción',
    cell: ({ row }) => {
      const description = row.original.description;
      return (
        <div className="w-48 truncate" title={description}>
          {description || 'N/A'}
        </div>
      );
    },
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total Histórico" className="justify-end"/>,
    cell: ({ row }) => <div className="text-right">{row.original.quantity ?? row.original.stock ?? 0}</div>,
  },
  {
    accessorKey: 'retailPrice',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Precio Venta (USD)" className="justify-end"/>,
    cell: ({ row }) => {
      const amount = row.original.retailPrice;
      if (typeof amount !== 'number') {
        return <div className="text-right text-muted-foreground">N/A</div>;
      }
      return <div className="text-right font-bold">{formatUsd(amount)}</div>;
    },
  },
  {
    accessorKey: 'vesPrice',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Precio (VES)" className="justify-end"/>,
    cell: ({ row }) => {
      const amount = row.original.vesPrice;
      if (typeof amount !== 'number') {
        return <div className="text-right text-muted-foreground">N/A</div>;
      }
      return <div className="text-right font-bold">{formatVes(amount)}</div>;
    },
  },
  {
    accessorKey: 'bcvPrice',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Precio Venta (BCV)" className="justify-end"/>,
    cell: ({ row }) => {
      const amount = row.original.bcvPrice;
      if (typeof amount !== 'number') {
        return <div className="text-right text-muted-foreground">N/A</div>;
      }
      return <div className="text-right font-bold text-primary">{formatVes(amount)}</div>;
    },
  },
  {
    accessorKey: 'unit',
    header: 'Unidad',
  },
  {
    accessorKey: 'warehouse',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Almacén" />,
  },
  {
    accessorKey: 'stock',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total Real (Stock)" className="justify-end"/>,
    cell: ({ row }) => <div className="text-right font-medium">{row.original.stock ?? row.original.quantity ?? 0}</div>,
  },
  {
    accessorKey: 'createdByName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Registrado por" />,
    cell: ({ row }) => row.original.createdByName || 'N/A',
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha Registro" />,
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      if (!createdAt) return 'N/A';
      try {
        return format(createdAt.toDate(), 'dd/MM/yyyy');
      } catch {
        return 'N/A';
      }
    },
  },
  {
    id: 'createdTime',
    header: 'Hora Registro',
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      if (!createdAt) return 'N/A';
      try {
        return format(createdAt.toDate(), 'HH:mm:ss');
      } catch {
        return 'N/A';
      }
    },
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ row }) => {
      const stock = Number(row.original.stock) || 0;
      let variant: 'default' | 'secondary' | 'destructive' = 'default';
      let statusText = 'En Stock';
      
      if (stock > 5) {
        variant = 'default'; // Green
        statusText = 'En Stock';
      } else if (stock === 5) {
        variant = 'secondary'; // Yellow
        statusText = 'Stock Bajo';
      } else if (stock > 0 && stock < 5) {
        variant = 'destructive'; // Red
        statusText = 'Stock Crítico';
      } else { // stock <= 0
        variant = 'destructive'; // Red
        statusText = 'Sin Stock';
      }

      return <Badge variant={variant}>{statusText}</Badge>;
    },
  },
  {
    id: 'actions',
    cell: ({ row, table }) => <DataTableRowActions row={row} entityName="producto" table={table} />,
  },
];
