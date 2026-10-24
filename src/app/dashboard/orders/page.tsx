'use client';

import React, { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { OrderDialog } from '@/components/orders/order-dialog';
import { OrderDetailsDialog } from '@/components/orders/order-details-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2, ShoppingCart, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DataImportExport, FieldMapping } from '@/components/shared/data-import-export';

const orderFields: FieldMapping[] = [
  { key: 'orderNumber', label: 'Número de Orden', example: 'ORD-2026-001' },
  { key: 'date', label: 'Fecha', example: '2026-08-04' },
  { key: 'totalUSD', label: 'Monto Total USD', example: '240', type: 'number' },
  { key: 'totalVES', label: 'Monto Total VES', example: '8760', type: 'number' },
  { key: 'currency', label: 'Moneda', example: 'USD' },
  { key: 'status', label: 'Estado', example: 'Processing' },
  { key: 'notes', label: 'Notas', example: 'Entrega prioritaria' },
];

const statusTextMap: Record<string, string> = {
  Pending: 'Pendiente',
  Processing: 'En Proceso',
  Completed: 'Completada',
  Cancelled: 'Cancelada',
  Pendiente: 'Pendiente',
  Procesando: 'En Proceso',
  Completado: 'Completada',
  Cancelado: 'Cancelada',
};

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Completed: 'default',
  Completado: 'default',
  Processing: 'secondary',
  Procesando: 'secondary',
  Pending: 'outline',
  Pendiente: 'outline',
  Cancelled: 'destructive',
  Cancelado: 'destructive',
};

export default function OrdersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>(undefined);

  const ordersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'orders') : null),
    [firestore]
  );
  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const filteredOrders = React.useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((o) => {
      // Order metadata
      const orderNumMatch = o.orderNumber?.toLowerCase().includes(term);
      const idMatch = o.id?.toLowerCase().includes(term);
      const dateMatch = o.date?.toLowerCase().includes(term);
      const notesMatch = o.notes?.toLowerCase().includes(term);

      // Customer info
      const clientNameMatch = o.customer?.name?.toLowerCase().includes(term);
      const clientCompanyMatch = o.customer?.company?.toLowerCase().includes(term);
      const clientEmailMatch = o.customer?.email?.toLowerCase().includes(term);
      const clientPhoneMatch = o.customer?.phone?.toLowerCase().includes(term);
      const clientTaxIdMatch = o.customer?.taxId?.toLowerCase().includes(term);

      // Status info (Spanish and English)
      const translatedStatus = statusTextMap[o.status] || o.status;
      const statusMatch = o.status?.toLowerCase().includes(term) || translatedStatus.toLowerCase().includes(term);

      // Items / Products in Order (Filter by ANY product name, description, or id)
      const itemsMatch = Array.isArray(o.items) && o.items.some((item) =>
        item.name?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.productId?.toLowerCase().includes(term) ||
        String(item.quantity).includes(term) ||
        String(item.price).includes(term)
      );

      // Amount match
      const amountMatch = String(o.amount ?? '').includes(term) || String(o.totalUSD ?? '').includes(term) || String(o.totalVES ?? '').includes(term);

      return (
        orderNumMatch ||
        idMatch ||
        dateMatch ||
        notesMatch ||
        clientNameMatch ||
        clientCompanyMatch ||
        clientEmailMatch ||
        clientPhoneMatch ||
        clientTaxIdMatch ||
        statusMatch ||
        itemsMatch ||
        amountMatch
      );
    });
  }, [orders, searchTerm]);

  const handleOpenCreate = () => {
    setSelectedOrder(undefined);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (order: Order) => {
    setSelectedOrder(order);
    setIsFormOpen(true);
  };

  const handleOpenDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const handleDelete = async (orderId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'orders', orderId));
      toast({
        title: 'Órden Eliminada',
        description: 'La orden fue eliminada correctamente de la base de datos.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar la orden.',
      });
    }
  };

  const formatCurrency = (amount: number, currency: 'USD' | 'VES') => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-VE', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Órdenes de Venta</h1>
          <p className="text-muted-foreground">
            Gestión y seguimiento de ventas y entregas de productos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DataImportExport
            entityName="Órdenes"
            collectionName="orders"
            data={orders || []}
            fields={orderFields}
          />
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Órden
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Listado de Órdenes
            </CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, producto, N° orden..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No se encontraron órdenes</p>
              <p className="text-xs mt-1">
                {searchTerm
                  ? 'No hay órdenes que coincidan con la búsqueda.'
                  : 'Registra una nueva venta haciendo clic en "Nueva Órden".'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Órden</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="min-w-[240px]">Detalle de Productos</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-medium">
                        <div>{order.orderNumber || order.id.slice(0, 8)}</div>
                        {(order.quoteNumber || order.quoteId) && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-sans">
                            <FileText className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate max-w-[140px]" title={order.quoteNumber || order.quoteId}>
                              Cotiz: {order.quoteNumber || order.quoteId?.slice(0, 8)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{order.date}</TableCell>
                      <TableCell>
                        <div className="font-medium">{order.customer?.name}</div>
                        {order.customer?.company && (
                          <div className="text-xs text-muted-foreground">
                            {order.customer.company}
                          </div>
                        )}
                        {order.customer?.phone && (
                          <div className="text-[11px] text-muted-foreground/80">
                            {order.customer.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(order.items) && order.items.length > 0 ? (
                          <div className="space-y-1.5 py-1">
                            {order.items.slice(0, 3).map((item, idx) => (
                              <div key={`${item.productId || item.name}-${idx}`} className="flex items-center justify-between gap-2 text-xs bg-muted/40 px-2 py-1 rounded border border-border/50">
                                <div className="font-medium truncate max-w-[170px]" title={item.name}>
                                  {item.name}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-semibold">
                                    x{item.quantity}
                                  </Badge>
                                  <span className="text-muted-foreground font-mono text-[11px]">
                                    ${(item.price || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div className="text-[11px] text-primary font-medium pl-1 cursor-pointer hover:underline" onClick={() => handleOpenDetails(order)}>
                                + {order.items.length - 3} producto(s) más...
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin productos</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        {formatCurrency(order.amount, order.currency as any)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariantMap[order.status]}>
                          {statusTextMap[order.status] || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDetails(order)}>
                              <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEdit(order)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(order.id)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        order={selectedOrder}
      />

      <OrderDetailsDialog
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}

