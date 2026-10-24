'use client';

import * as React from 'react';
import { ColumnDef, Row } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { Order, Product } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DataTableRowActions } from '@/components/ui/data-table-row-actions';
import { doc, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

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

const getStatusText = (status: Order['status']) => {
    switch (status) {
        case 'Completed': return 'Completado';
        case 'Processing': return 'Procesando';
        case 'Pending': return 'Pendiente';
        case 'Cancelled': return 'Cancelado';
        default: return 'Desconocido';
    }
}

const EditableStatusCell = ({ getValue, row }: { getValue: () => any; row: Row<Order> }) => {
  const initialStatus = getValue() as Order['status'];
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isUpdating, setIsUpdating] = React.useState(false);


  const handleStatusChange = async (newStatusString: string) => {
    const newStatus = newStatusString as Order['status'];
    if (!newStatus || !firestore || newStatus === initialStatus || isUpdating) return;

    setIsUpdating(true);
    const order = row.original;
    const oldStatus = order.status;
    const orderRef = doc(firestore, 'orders', order.id);

    try {
        // Logic for returning stock to inventory
        if (newStatus === 'Cancelled' && oldStatus !== 'Cancelled') {
            await runTransaction(firestore, async (transaction) => {
                // READ PHASE
                const productQuantities = new Map<string, { name: string; quantity: number }>();
                for (const item of (order.items || [])) {
                    if (!item.productId) continue;
                    const existing = productQuantities.get(item.productId);
                    if (existing) {
                        existing.quantity += Number(item.quantity) || 0;
                    } else {
                        productQuantities.set(item.productId, {
                            name: item.name || '',
                            quantity: Number(item.quantity) || 0,
                        });
                    }
                }

                const productUpdates: { ref: any; newStock: number; status: Product['status'] }[] = [];

                for (const [productId, info] of productQuantities.entries()) {
                    const productRef = doc(firestore, 'products', productId);
                    const productDoc = await transaction.get(productRef);
                    
                    if (productDoc.exists()) {
                        const currentStock = Number(productDoc.data().stock) || 0;
                        const newStock = currentStock + info.quantity;
                        
                        let newProductStatus: Product['status'] = 'In Stock';
                        if (newStock > 0 && newStock <= 5) {
                            newProductStatus = 'Low Stock';
                        } else if (newStock <= 0) {
                            newProductStatus = 'Out of Stock';
                        }
                        
                        productUpdates.push({ ref: productRef, newStock, status: newProductStatus });
                    }
                }

                // WRITE PHASE
                for (const update of productUpdates) {
                    transaction.update(update.ref, { stock: update.newStock, status: update.status, updatedAt: serverTimestamp() });
                }

                transaction.update(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
            });
            toast({
                title: 'Venta Cancelada',
                description: 'El stock ha sido devuelto al inventario.',
            });
        } 
        // Logic for re-deducting stock from inventory
        else if (newStatus !== 'Cancelled' && oldStatus === 'Cancelled') {
            await runTransaction(firestore, async (transaction) => {
                // READ PHASE
                const productQuantities = new Map<string, { name: string; quantity: number }>();
                for (const item of (order.items || [])) {
                    if (!item.productId) continue;
                    const existing = productQuantities.get(item.productId);
                    if (existing) {
                        existing.quantity += Number(item.quantity) || 0;
                    } else {
                        productQuantities.set(item.productId, {
                            name: item.name || '',
                            quantity: Number(item.quantity) || 0,
                        });
                    }
                }

                const productUpdates: { ref: any; newStock: number; status: Product['status'] }[] = [];

                for (const [productId, info] of productQuantities.entries()) {
                    const productRef = doc(firestore, 'products', productId);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) {
                        throw new Error(`El producto "${info.name}" no fue encontrado.`);
                    }
                    
                    const currentStock = Number(productDoc.data().stock) || 0;
                    const newStock = currentStock - info.quantity;

                    if (newStock < 0) {
                        throw new Error(`Stock insuficiente para "${info.name}". No se puede reactivar la venta.`);
                    }

                    let newProductStatus: Product['status'] = 'In Stock';
                    if (newStock <= 0) {
                        newProductStatus = 'Out of Stock';
                    } else if (newStock <= 5) {
                        newProductStatus = 'Low Stock';
                    }
                    
                    productUpdates.push({ ref: productRef, newStock, status: newProductStatus });
                }

                // WRITE PHASE
                for (const update of productUpdates) {
                    transaction.update(update.ref, { stock: update.newStock, status: update.status, updatedAt: serverTimestamp() });
                }

                transaction.update(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
            });
            toast({
                title: 'Venta Reactivada',
                description: 'El stock ha sido descontado del inventario.',
            });
        }
        // For any other status change, just update the status
        else {
            await updateDoc(orderRef, {
              status: newStatus,
              updatedAt: serverTimestamp(),
            });
            toast({
              title: 'Estado de la Venta Actualizado',
              description: `La venta ahora está en estado: ${getStatusText(newStatus)}.`,
            });
        }
    } catch (error: any) {
      console.error("Error updating order status in columns:", error);
      const description = typeof error === 'string' 
        ? error 
        : error.message || 'No se pudo actualizar el estado de la venta.';
      
      errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: orderRef.path,
          operation: 'update',
          requestResourceData: { status: newStatus }
      }));
      
      toast({
        variant: 'destructive',
        title: 'Error en la Transacción',
        description: description,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const statusTextMap: Record<string, string> = {
    'Pending': 'Pendiente',
    'Processing': 'Procesando',
    'Completed': 'Completado',
    'Cancelled': 'Cancelado',
    'Pendiente': 'Pendiente',
    'Procesando': 'Procesando',
    'Completado': 'Completado',
    'Cancelado': 'Cancelado',
  };

  const statusVariantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    'Completed': 'default',
    'Completado': 'default',
    'Processing': 'secondary',
    'Procesando': 'secondary',
    'Pending': 'outline',
    'Pendiente': 'outline',
    'Cancelled': 'destructive',
    'Cancelado': 'destructive',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="p-0 h-auto w-full justify-start" disabled={isUpdating}>
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Badge variant={statusVariantMap[initialStatus]} className="cursor-pointer">
            {statusTextMap[initialStatus]}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={initialStatus} onValueChange={handleStatusChange}>
          {Object.keys(statusTextMap).map((statusKey) => (
            <DropdownMenuRadioItem key={statusKey} value={statusKey} disabled={isUpdating}>
              {statusTextMap[statusKey as Order['status']]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


export const columns: ColumnDef<Order>[] = [
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
    accessorKey: 'customer.id',
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID Cliente" />,
  },
  {
    accessorKey: 'customer.name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
  },
  {
    accessorKey: 'customer.company',
    header: 'Empresa',
    cell: ({ row }) => row.original.customer.company || 'N/A',
  },
  {
    id: 'items',
    header: 'Productos',
    accessorFn: (row) => row.items.map(item => item.name).join(', '),
    cell: ({ row }) => {
      const items = row.original.items;

      if (!items || items.length === 0) {
        return <span className="text-muted-foreground">-</span>;
      }

      return (
        <ul className="list-disc list-inside text-sm">
          {items.map((item, index) => (
            <li key={index} className="truncate" title={item.name}>
              {item.name}
            </li>
          ))}
        </ul>
      );
    },
  },
  {
    id: 'quantity',
    header: () => <div className="text-center">Cantidad</div>,
    cell: ({ row }) => {
        const totalQuantity = row.original.items.reduce((sum, item) => sum + item.quantity, 0);
        return <div className="text-center">{totalQuantity}</div>;
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: EditableStatusCell,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">Monto</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      const currency = row.original.currency || 'USD';
      
      const formattedAmount = currency === 'VES' ? formatVes(amount) : formatUsd(amount);

      return <div className="text-right font-medium">{formattedAmount}</div>;
    },
  },
  {
    id: 'actions',
    cell: ({ row, table }) => <DataTableRowActions row={row} entityName="venta" table={table} />,
  },
];
