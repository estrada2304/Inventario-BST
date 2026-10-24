'use client';

import * as React from 'react';
import { ColumnDef, Row } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { Quote, Product, Order } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { doc, updateDoc, serverTimestamp, runTransaction, collection } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader2, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { DataTableRowActions } from '@/components/ui/data-table-row-actions';
import { GmailComposerDialog } from '@/components/gmail/gmail-composer-dialog';
import { formatCurrency } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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

const statusTextMap: Record<string, string> = {
    'Draft': 'Borrador',
    'Sent': 'Enviada',
    'Accepted': 'Aceptada',
    'Rejected': 'Rechazada',
    'Cancelled': 'Cancelada',
    'Borrador': 'Borrador',
    'Enviada': 'Enviada',
    'Aprobada': 'Aprobada',
    'Rechazada': 'Rechazada',
};

const statusVariantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    'Accepted': 'default',
    'Aprobada': 'default',
    'Sent': 'secondary',
    'Enviada': 'secondary',
    'Draft': 'outline',
    'Borrador': 'outline',
    'Rejected': 'destructive',
    'Rechazada': 'destructive',
    'Cancelled': 'destructive',
};

const EditableInternalNotesCell = ({ getValue, row }: { getValue: () => any; row: Row<Quote> }) => {
  const initialValue = getValue() as string || '';
  const [value, setValue] = React.useState(initialValue);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSave = async () => {
    if (!firestore || value === initialValue) return;
    setIsUpdating(true);
    const quoteRef = doc(firestore, 'quotes', row.original.id);
    
    try {
      await updateDoc(quoteRef, { internalNotes: value, updatedAt: serverTimestamp() });
      toast({ title: 'Nota interna actualizada.' });
    } catch (error: any) {
      console.error(error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: quoteRef.path,
        operation: 'update',
        requestResourceData: { internalNotes: value }
      }));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <StickyNote className={cn("h-4 w-4", value ? "text-primary" : "text-muted-foreground/50")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none text-sm">Nota Interna (Privada)</h4>
            <p className="text-[10px] text-muted-foreground">Esta nota no aparece en el PDF del cliente.</p>
          </div>
          <Textarea 
            value={value} 
            onChange={(e) => setValue(e.target.value)} 
            placeholder="Escribe una nota interna..."
            className="min-h-[100px] text-xs"
          />
          <Button size="sm" onClick={handleSave} disabled={isUpdating || value === initialValue}>
            {isUpdating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Guardar Nota
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const EditableStatusCell = ({ getValue, row }: { getValue: () => any; row: Row<Quote> }) => {
  const initialStatus = getValue() as Quote['status'];
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isGmailComposerOpen, setIsGmailComposerOpen] = React.useState(false);

  const handleStatusChange = async (newStatusString: string) => {
    const newStatus = newStatusString as Quote['status'];
    if (!newStatus || !firestore || !user || newStatus === initialStatus || isUpdating) return;

    setIsUpdating(true);
    const quote = row.original;
    const oldStatus = quote.status;
    const quoteRef = doc(firestore, 'quotes', quote.id);

    try {
        if (newStatus === 'Accepted' && oldStatus !== 'Accepted') {
            await runTransaction(firestore, async (transaction) => {
                // READ PHASE: Aggregate quantities first
                const productQuantities = new Map<string, { name: string; quantity: number }>();
                for (const item of (quote.items || [])) {
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
                        throw new Error(`El producto "${info.name}" no fue encontrado en el inventario.`);
                    }
                    
                    const currentStock = Number(productDoc.data().stock) || 0;
                    const newStock = currentStock - info.quantity;

                    if (newStock < 0) {
                        throw new Error(`Stock insuficiente para "${info.name}". Stock actual: ${currentStock}, se requieren ${info.quantity}.`);
                    }

                    let newProductStatus: Product['status'] = 'In Stock';
                    if (newStock <= 0) {
                        newProductStatus = 'Out of Stock';
                    } else if (newStock <= 5) {
                        newProductStatus = 'Low Stock';
                    }
                    
                    productUpdates.push({ ref: productRef, newStock, status: newProductStatus });
                }

                // WRITE PHASE: Update product stocks and statuses
                for (const update of productUpdates) {
                    transaction.update(update.ref, { stock: update.newStock, status: update.status, updatedAt: serverTimestamp() });
                }

                // Generar Venta Automáticamente
                const orderRef = doc(collection(firestore, 'orders'));
                const newOrderData: Record<string, any> = {
                    id: orderRef.id,
                    customer: {
                        id: quote.customer?.id || '',
                        name: quote.customer?.name || '',
                        company: quote.customer?.company || '',
                        email: quote.customer?.email || '',
                        phone: quote.customer?.phone || '',
                        clientType: quote.customer?.clientType || 'Individual',
                        country: quote.customer?.country || 'Venezuela',
                        taxId: quote.customer?.taxId || '',
                        address: quote.customer?.address || '',
                    },
                    items: (quote.items || []).map(item => ({
                        productId: item.productId || '',
                        name: item.name || '',
                        description: item.description || '',
                        quantity: Number(item.quantity) || 1,
                        price: Number(item.price) || 0
                    })),
                    amount: Number(quote.amount) || 0,
                    status: 'Processing',
                    date: format(new Date(), 'yyyy-MM-dd'),
                    currency: quote.currency || 'USD',
                    notes: `Generada automáticamente desde Cotización ${quote.quoteNumber || ''}. ${quote.notes || ''}`.trim(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    createdByName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Sistema'),
                    createdByEmail: user.email || '',
                };
                transaction.set(orderRef, newOrderData);

                transaction.update(quoteRef, { status: newStatus, updatedAt: serverTimestamp() });
            });

            toast({
                title: 'Cotización Aceptada',
                description: 'El stock ha sido descontado y se ha generado una nueva venta en estado "Procesando".',
            });
        } 
        else if (newStatus !== 'Accepted' && oldStatus === 'Accepted') {
            await runTransaction(firestore, async (transaction) => {
                // READ PHASE
                const productQuantities = new Map<string, { name: string; quantity: number }>();
                for (const item of (quote.items || [])) {
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

                transaction.update(quoteRef, { status: newStatus, updatedAt: serverTimestamp() });
            });
            toast({
                title: 'Cambio de Estado de Cotización',
                description: 'El stock ha sido devuelto al inventario.',
            });
        }
        else {
            await updateDoc(quoteRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });
            toast({
                title: 'Estado de la Cotización Actualizado',
                description: `La cotización ahora está en estado: ${statusTextMap[newStatus]}.`,
            });
            if (newStatus === 'Sent') {
                setIsGmailComposerOpen(true);
            }
        }
    } catch (error: any) {
        console.error("Error updating quote status:", error);
        const description = typeof error === 'string' 
            ? error 
            : error?.message || 'No se pudo actualizar el estado de la cotización.';
        
        if (error?.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: quoteRef.path,
                operation: 'update',
                requestResourceData: { status: newStatus }
            }));
        }
      
        toast({
            variant: 'destructive',
            title: 'Error al cambiar estado',
            description: description,
        });
    } finally {
      setIsUpdating(false);
    }
  };

  const quote = row.original;

  return (
    <>
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
                {statusTextMap[statusKey as Quote['status']]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {quote && (
        <GmailComposerDialog
          isOpen={isGmailComposerOpen}
          onClose={() => setIsGmailComposerOpen(false)}
          defaultTo={quote.customer?.email || ''}
          defaultSubject={`Cotización #${quote.quoteNumber} - BST`}
          defaultBody={`Estimado(a) ${quote.customer?.name || 'Cliente'},\n\nLe enviamos adjunta la cotización #${quote.quoteNumber} solicitada.\n\n` +
            `Resumen de la Cotización:\n` +
            `- N° Cotización: #${quote.quoteNumber}\n` +
            `- Fecha: ${quote.date}\n` +
            `- Cliente: ${quote.customer?.name || 'N/A'} ${quote.customer?.company ? `(${quote.customer.company})` : ''}\n` +
            `- Monto Total: ${formatCurrency(quote.amount, quote.currency)}\n\n` +
            `Productos/Servicios:\n` +
            (Array.isArray(quote.items) ? quote.items.map(item => `  • ${item.name} x${item.quantity} - ${formatCurrency(item.price * item.quantity, quote.currency)}`).join('\n') : '') +
            `\n\nSi tiene alguna duda o consulta, por favor responda a este correo.\n\nAtentamente,\nEquipo BST`}
          title={`Enviar Cotización #${quote.quoteNumber} por Gmail`}
        />
      )}
    </>
  );
};


const QuoteProductsCell = ({ row }: { row: Row<Quote> }) => {
  const items = row.original.items || [];
  if (items.length === 0) {
    return <span className="text-muted-foreground text-xs italic">Sin productos</span>;
  }

  const firstItem = items[0];
  const remainingCount = items.length - 1;

  if (remainingCount === 0) {
    return (
      <div className="flex items-center gap-1.5 max-w-[200px] text-xs">
        <span className="font-medium truncate" title={firstItem.name}>
          {firstItem.name}
        </span>
        <span className="text-muted-foreground font-mono text-[11px] shrink-0">
          (x{firstItem.quantity})
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 max-w-[220px] cursor-pointer group py-1">
            <span className="font-medium truncate text-xs group-hover:text-primary transition-colors">
              {firstItem.name}
            </span>
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-semibold shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            >
              +{remainingCount} más
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3 space-y-2 bg-popover text-popover-foreground border shadow-md z-50">
          <p className="font-semibold text-xs border-b pb-1 text-foreground">
            Productos en esta cotización ({items.length}):
          </p>
          <ul className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <li key={idx} className="flex justify-between items-center gap-3 py-0.5 border-b border-border/40 last:border-0">
                <span className="font-medium truncate text-foreground">{item.name}</span>
                <span className="text-muted-foreground font-mono text-[11px] shrink-0">
                  x{item.quantity} {item.price ? `(${item.price.toLocaleString()} ${row.original.currency || 'USD'})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const columns: ColumnDef<Quote>[] = [
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
    accessorKey: 'quoteNumber',
    header: ({ column }) => <DataTableColumnHeader column={column} title="N° Cotización" />,
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
    id: 'products',
    accessorFn: (row) => {
      if (!row.items || row.items.length === 0) return '';
      return row.items.map((item) => `${item.name} ${item.description || ''}`).join(' ');
    },
    header: 'Productos',
    cell: QuoteProductsCell,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
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
    accessorKey: 'internalNotes',
    header: 'Nota',
    cell: EditableInternalNotesCell,
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
    cell: ({ row, table }) => <DataTableRowActions row={row} entityName="cotización" table={table} />,
  },
];