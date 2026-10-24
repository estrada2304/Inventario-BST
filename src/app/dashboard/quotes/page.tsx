'use client';

import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, deleteDoc, getDoc, getDocs, updateDoc, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import type { Quote, Product } from '@/lib/types';
import { QuoteDialog } from '@/components/quotes/quote-dialog';
import { QuoteDetailsDialog } from '@/components/quotes/quote-details-dialog';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  FileText,
  Download,
  User,
  Package,
  Layers,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
  ShoppingCart,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DataImportExport, FieldMapping } from '@/components/shared/data-import-export';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const statusTextMap: Record<string, string> = {
  Draft: 'Borrador',
  Sent: 'Enviada',
  Accepted: 'Aprobada / Aceptada',
  Rejected: 'Rechazada',
  Cancelled: 'Cancelada',
  Borrador: 'Borrador',
  Enviada: 'Enviada',
  Aprobada: 'Aprobada / Aceptada',
  Rechazada: 'Rechazada',
};

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Accepted: 'default',
  Aprobada: 'default',
  Sent: 'secondary',
  Enviada: 'secondary',
  Draft: 'outline',
  Borrador: 'outline',
  Rejected: 'destructive',
  Rechazada: 'destructive',
  Cancelled: 'destructive',
};

const quoteFields: FieldMapping[] = [
  { key: 'quoteNumber', label: 'Número Cotización', example: 'COR_04082026_0001' },
  { key: 'date', label: 'Fecha', example: '2026-08-04' },
  { key: 'client', label: 'Cliente', getValue: (q) => q.customer?.name || '' },
  { key: 'company', label: 'Empresa', getValue: (q) => q.customer?.company || '' },
  { key: 'email', label: 'Email Cliente', getValue: (q) => q.customer?.email || '' },
  { key: 'phone', label: 'Teléfono Cliente', getValue: (q) => q.customer?.phone || '' },
  {
    key: 'productsDetail',
    label: 'Detalle de Productos',
    getValue: (q) =>
      (q.items || [])
        .map((i: any) => `${i.name || 'Producto'} (Cant: ${i.quantity || 1}, Precio: $${i.price || 0})`)
        .join(' | '),
  },
  { key: 'totalAmount', label: 'Monto Total', type: 'number', getValue: (q) => q.amount || 0 },
  { key: 'currency', label: 'Moneda', example: 'USD' },
  { key: 'status', label: 'Estado', getValue: (q) => statusTextMap[q.status] || q.status },
  {
    key: 'user',
    label: 'Usuario Creador',
    getValue: (q) => q.createdByName || q.createdByEmail || 'Sistema',
  },
  { key: 'notes', label: 'Notas', example: 'Cotización con entrega inmediata' },
  { key: 'termsAndConditions', label: 'Términos', example: 'Vigencia 30 días.' },
];

export default function QuotesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | undefined>(undefined);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const quotesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'quotes') : null),
    [firestore]
  );
  const { data: quotes, isLoading } = useCollection<Quote>(quotesQuery);

  // Extract list of unique users who created quotes
  const uniqueUsers = useMemo(() => {
    if (!quotes || !Array.isArray(quotes)) return [];
    const userSet = new Set<string>();
    quotes.forEach((q) => {
      const u = q.createdByName || (q.createdByEmail ? q.createdByEmail.split('@')[0] : null);
      if (u) userSet.add(u);
    });
    return Array.from(userSet);
  }, [quotes]);

  // Filtered quotes based on search, user, and status
  const filteredQuotes = useMemo(() => {
    if (!quotes || !Array.isArray(quotes)) return [];
    const term = searchTerm.trim().toLowerCase();

    return quotes.filter((q) => {
      // User filter
      if (selectedUser !== 'all') {
        const u = q.createdByName || (q.createdByEmail ? q.createdByEmail.split('@')[0] : '');
        if (u !== selectedUser) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (q.status !== selectedStatus) return false;
      }

      // Search term
      if (!term) return true;

      const quoteNumMatch = q.quoteNumber?.toLowerCase().includes(term);
      const idMatch = q.id?.toLowerCase().includes(term);
      const dateMatch = q.date?.toLowerCase().includes(term);
      const validUntilMatch = q.validUntil?.toLowerCase().includes(term);
      const notesMatch = q.notes?.toLowerCase().includes(term);

      // User search
      const userCreatorMatch =
        q.createdByName?.toLowerCase().includes(term) ||
        q.createdByEmail?.toLowerCase().includes(term);

      // Customer search
      const clientNameMatch = q.customer?.name?.toLowerCase().includes(term);
      const clientCompanyMatch = q.customer?.company?.toLowerCase().includes(term);
      const clientEmailMatch = q.customer?.email?.toLowerCase().includes(term);
      const clientPhoneMatch = q.customer?.phone?.toLowerCase().includes(term);

      // Status search
      const statusText = statusTextMap[q.status] || q.status;
      const statusMatch =
        q.status?.toLowerCase().includes(term) || statusText.toLowerCase().includes(term);

      // Items / Products search
      const itemsMatch =
        Array.isArray(q.items) &&
        q.items.some(
          (item) =>
            item.name?.toLowerCase().includes(term) ||
            item.description?.toLowerCase().includes(term) ||
            item.productId?.toLowerCase().includes(term) ||
            String(item.quantity).includes(term) ||
            String(item.price).includes(term)
        );

      // Amount search
      const amountMatch = String(q.amount ?? '').includes(term);

      return (
        quoteNumMatch ||
        idMatch ||
        dateMatch ||
        validUntilMatch ||
        notesMatch ||
        userCreatorMatch ||
        clientNameMatch ||
        clientCompanyMatch ||
        clientEmailMatch ||
        clientPhoneMatch ||
        statusMatch ||
        itemsMatch ||
        amountMatch
      );
    });
  }, [quotes, searchTerm, selectedUser, selectedStatus]);

  // Export Quotes with Full Product Breakdown to Excel
  const handleExportDetailedExcel = () => {
    if (!filteredQuotes || filteredQuotes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin datos para exportar',
        description: 'No hay cotizaciones disponibles con los filtros actuales.',
      });
      return;
    }

    try {
      // 1. Detailed Product Rows (Every line is a product item inside a quote)
      const detailedProductRows: any[] = [];
      // 2. Summary Rows (One line per quote)
      const summaryRows: any[] = [];

      filteredQuotes.forEach((quote) => {
        const creator =
          quote.createdByName || (quote.createdByEmail ? quote.createdByEmail.split('@')[0] : 'Sistema');
        const statusLabel = statusTextMap[quote.status] || quote.status;
        const totalItemsCount = quote.items?.length || 0;
        const totalUnitsCount = (quote.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);

        // Populate Summary
        summaryRows.push({
          'N° Cotización': quote.quoteNumber || quote.id,
          'Fecha Emisión': quote.date,
          'Válido Hasta': quote.validUntil || 'N/A',
          'Cliente': quote.customer?.name || 'Cliente sin nombre',
          'Empresa': quote.customer?.company || '',
          'Email Cliente': quote.customer?.email || '',
          'Teléfono Cliente': quote.customer?.phone || '',
          'Usuario Creador': creator,
          'Total Productos Distintos': totalItemsCount,
          'Total Unidades': totalUnitsCount,
          'Monto Total': quote.amount || 0,
          'Moneda': quote.currency || 'USD',
          'Estado': statusLabel,
          'Productos Incluidos': (quote.items || [])
            .map((i) => `${i.name} (x${i.quantity || 1} - $${i.price || 0})`)
            .join('; '),
          'Notas': quote.notes || '',
          'Términos y Condiciones': quote.termsAndConditions || '',
        });

        // Populate Product Details
        if (Array.isArray(quote.items) && quote.items.length > 0) {
          quote.items.forEach((item, itemIdx) => {
            const qty = Number(item.quantity) || 1;
            const unitPrice = Number(item.price) || 0;
            const subtotal = qty * unitPrice;

            detailedProductRows.push({
              'N° Cotización': quote.quoteNumber || quote.id,
              'Fecha Cotización': quote.date,
              'Cliente': quote.customer?.name || '',
              'Empresa': quote.customer?.company || '',
              'Usuario Creador': creator,
              'Ítem N°': itemIdx + 1,
              'ID / Código Producto': item.productId || 'N/A',
              'Nombre del Producto': item.name || 'Sin nombre',
              'Descripción / Detalle': item.description || '',
              'Cantidad': qty,
              'Precio Unitario ($)': unitPrice,
              'Subtotal Ítem ($)': subtotal,
              'Moneda Cotización': quote.currency || 'USD',
              'Estado Cotización': statusLabel,
              'Monto Total Cotización ($)': quote.amount || 0,
              'Notas Generales': quote.notes || '',
            });
          });
        } else {
          // Quote with no products
          detailedProductRows.push({
            'N° Cotización': quote.quoteNumber || quote.id,
            'Fecha Cotización': quote.date,
            'Cliente': quote.customer?.name || '',
            'Empresa': quote.customer?.company || '',
            'Usuario Creador': creator,
            'Ítem N°': 1,
            'ID / Código Producto': 'N/A',
            'Nombre del Producto': 'Sin productos especificados',
            'Descripción / Detalle': '',
            'Cantidad': 0,
            'Precio Unitario ($)': 0,
            'Subtotal Ítem ($)': 0,
            'Moneda Cotización': quote.currency || 'USD',
            'Estado Cotización': statusLabel,
            'Monto Total Cotización ($)': quote.amount || 0,
            'Notas Generales': quote.notes || '',
          });
        }
      });

      const workbook = XLSX.utils.book_new();

      // Sheet 1: Detalle de Productos
      const wsDetails = XLSX.utils.json_to_sheet(detailedProductRows);
      XLSX.utils.book_append_sheet(workbook, wsDetails, 'Detalle_Productos');

      // Sheet 2: Resumen de Cotizaciones
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Resumen_Cotizaciones');

      const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');
      XLSX.writeFile(workbook, `Cotizaciones_Con_Detalle_Productos_${dateStr}.xlsx`);

      toast({
        title: 'Exportación Exitosa',
        description: `Se exportaron ${detailedProductRows.length} líneas de productos de ${filteredQuotes.length} cotizaciones.`,
      });
    } catch (error: any) {
      console.error('Error exportando detalle de productos:', error);
      toast({
        variant: 'destructive',
        title: 'Error al exportar',
        description: error.message || 'No se pudo generar el archivo Excel.',
      });
    }
  };

  const handleOpenCreate = () => {
    setSelectedQuote(undefined);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsFormOpen(true);
  };

  const handleOpenDetails = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDetailsOpen(true);
  };

  const promptDelete = (quote: Quote) => {
    setQuoteToDelete(quote);
  };

  const confirmDeleteQuote = async () => {
    if (!firestore || !quoteToDelete) return;
    setIsDeleting(true);

    try {
      const quote = quoteToDelete;
      const currentUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Ventas');
      const nowIso = new Date().toISOString();

      // 1. Locate all linked orders in 'orders' collection
      const linkedOrderIds = new Set<string>();
      if (quote.orderId) {
        linkedOrderIds.add(quote.orderId);
      }
      
      // Query by quoteId
      try {
        const qByQuoteId = query(collection(firestore, 'orders'), where('quoteId', '==', quote.id));
        const snapByQuoteId = await getDocs(qByQuoteId);
        snapByQuoteId.forEach((d) => linkedOrderIds.add(d.id));
      } catch (err) {
        console.warn("Could not query orders by quoteId", err);
      }

      // Query by quoteNumber
      if (quote.quoteNumber) {
        try {
          const qByQuoteNum = query(collection(firestore, 'orders'), where('quoteNumber', '==', quote.quoteNumber));
          const snapByQuoteNum = await getDocs(qByQuoteNum);
          snapByQuoteNum.forEach((d) => linkedOrderIds.add(d.id));
        } catch (err) {
          console.warn("Could not query orders by quoteNumber", err);
        }
      }

      // Fallback: search all orders if any order's notes or orderNumber references this quote number
      if (quote.quoteNumber && linkedOrderIds.size === 0) {
        try {
          const allOrdersSnap = await getDocs(collection(firestore, 'orders'));
          allOrdersSnap.forEach((d) => {
            const ordData = d.data();
            if (
              (typeof ordData.notes === 'string' && ordData.notes.includes(quote.quoteNumber)) ||
              (typeof ordData.orderNumber === 'string' && ordData.orderNumber.includes(quote.quoteNumber))
            ) {
              linkedOrderIds.add(d.id);
            }
          });
        } catch (err) {
          console.warn("Could not search all orders fallback", err);
        }
      }

      // 2. If the quote was Accepted or has linked orders, revert inventory stock
      const wasAccepted = quote.status === 'Accepted' || quote.status === 'Aprobada' || linkedOrderIds.size > 0;

      if (wasAccepted && Array.isArray(quote.items) && quote.items.length > 0) {
        const productQuantities = new Map<string, { name: string; quantity: number }>();
        for (const item of quote.items) {
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

        for (const [productId, info] of productQuantities.entries()) {
          try {
            const prodRef = doc(firestore, 'products', productId);
            const prodDoc = await getDoc(prodRef);
            if (prodDoc.exists()) {
              const prodData = prodDoc.data();
              const currentStock = Number(prodData.stock) || 0;
              const newStock = currentStock + info.quantity;
              let newProductStatus: Product['status'] = 'In Stock';
              if (newStock > 0 && newStock <= 5) {
                newProductStatus = 'Low Stock';
              } else if (newStock <= 0) {
                newProductStatus = 'Out of Stock';
              }

              await updateDoc(prodRef, {
                stock: newStock,
                status: newProductStatus,
                updatedAt: serverTimestamp(),
              });

              // Record inventory movement entry
              const movementId = doc(collection(firestore, 'inventoryMovements')).id;
              const movementData = {
                id: movementId,
                productId: productId,
                productName: prodData.name || info.name,
                serialNumber: prodData.serialNumber || '',
                type: 'entry',
                quantity: info.quantity,
                delta: info.quantity,
                previousStock: currentStock,
                newStock: newStock,
                date: nowIso,
                notes: `Reversión de stock por eliminación de Cotización #${quote.quoteNumber}`,
                userName: currentUserName,
                userEmail: user?.email || '',
                createdBy: user?.uid || '',
                createdAt: serverTimestamp(),
              };

              await setDoc(doc(firestore, 'inventoryMovements', movementId), movementData);
              await setDoc(doc(firestore, `products/${productId}/inventoryMovements`, movementId), movementData);
            }
          } catch (prodErr) {
            console.error(`Error reverting stock for product ${productId}:`, prodErr);
          }
        }
      }

      // 3. Delete linked orders from 'orders' collection
      for (const ordId of linkedOrderIds) {
        try {
          await deleteDoc(doc(firestore, 'orders', ordId));
        } catch (ordErr) {
          console.error(`Error deleting linked order ${ordId}:`, ordErr);
        }
      }

      // 4. Delete the quote itself
      await deleteDoc(doc(firestore, 'quotes', quote.id));

      if (linkedOrderIds.size > 0 || wasAccepted) {
        toast({
          title: 'Cotización y Órdenes Vinculadas Eliminadas',
          description: `Se eliminó la cotización ${quote.quoteNumber}. La orden vinculada desapareció de la sección Órdenes y el inventario fue restituido correctamente.`,
        });
      } else {
        toast({
          title: 'Cotización Eliminada',
          description: `La cotización ${quote.quoteNumber} ha sido eliminada correctamente.`,
        });
      }

      setQuoteToDelete(null);
    } catch (error: any) {
      console.error("Error deleting quote:", error);
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: error.message || 'No se pudo eliminar la cotización.',
      });
    } finally {
      setIsDeleting(false);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-muted-foreground">
            Gestión de propuestas comerciales, exportación detallada con desglose de productos y control por usuario.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Detailed Excel Export Button */}
          <Button
            variant="outline"
            onClick={handleExportDetailedExcel}
            className="gap-2 border-emerald-600/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Exportar Detalle Productos
          </Button>

          <DataImportExport
            entityName="Cotizaciones"
            collectionName="quotes"
            data={quotes || []}
            fields={quoteFields}
          />

          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Cotización
          </Button>
        </div>
      </div>

      {/* Main Card with Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Listado de Cotizaciones
            </CardTitle>

            {/* Filter Bar: Search + User Filter + Status Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, producto, N°, usuario..."
                  className="pl-8 text-xs h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* User Filter */}
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[180px] text-xs h-9">
                  <SelectValue placeholder="Filtrar por Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Usuarios</SelectItem>
                  {uniqueUsers.map((userName) => (
                    <SelectItem key={userName} value={userName}>
                      {userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[160px] text-xs h-9">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  <SelectItem value="Draft">Borrador</SelectItem>
                  <SelectItem value="Sent">Enviada</SelectItem>
                  <SelectItem value="Accepted">Aprobada / Aceptada</SelectItem>
                  <SelectItem value="Rejected">Rechazada</SelectItem>
                  <SelectItem value="Cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
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
          ) : filteredQuotes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No se encontraron cotizaciones</p>
              <p className="text-xs mt-1">
                {searchTerm || selectedUser !== 'all' || selectedStatus !== 'all'
                  ? 'No hay cotizaciones que coincidan con los filtros aplicados.'
                  : 'Haz clic en "Nueva Cotización" para emitir la primera oferta comercial.'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Cotización</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="min-w-[260px]">Detalle de Productos</TableHead>
                    <TableHead>Usuario Creador</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => {
                    const creatorName =
                      quote.createdByName ||
                      (quote.createdByEmail ? quote.createdByEmail.split('@')[0] : 'Sistema');

                    return (
                      <TableRow key={quote.id} className="hover:bg-muted/30 transition-colors">
                        {/* Quote Number */}
                        <TableCell className="font-mono font-medium text-xs whitespace-nowrap">
                          {quote.quoteNumber}
                        </TableCell>

                        {/* Date */}
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {quote.date}
                        </TableCell>

                        {/* Customer */}
                        <TableCell>
                          <div className="font-medium text-xs">{quote.customer?.name}</div>
                          {quote.customer?.company && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {quote.customer.company}
                            </div>
                          )}
                          {quote.customer?.phone && (
                            <div className="text-[10px] text-muted-foreground/80 font-mono">
                              {quote.customer.phone}
                            </div>
                          )}
                        </TableCell>

                        {/* Products Detail */}
                        <TableCell>
                          {Array.isArray(quote.items) && quote.items.length > 0 ? (
                            <div className="space-y-1.5 py-1">
                              {quote.items.slice(0, 3).map((item, idx) => (
                                <div
                                  key={`${item.productId || item.name}-${idx}`}
                                  className="flex items-center justify-between gap-2 text-xs bg-muted/40 px-2 py-1 rounded border border-border/50"
                                >
                                  <div className="font-medium truncate max-w-[170px]" title={item.name}>
                                    {item.name}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 h-4 font-mono font-semibold"
                                    >
                                      x{item.quantity}
                                    </Badge>
                                    <span className="text-muted-foreground font-mono text-[11px]">
                                      ${(Number(item.price) || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {quote.items.length > 3 && (
                                <div
                                  className="text-[11px] text-primary font-medium pl-1 cursor-pointer hover:underline"
                                  onClick={() => handleOpenDetails(quote)}
                                >
                                  + {quote.items.length - 3} producto(s) más...
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sin productos</span>
                          )}
                        </TableCell>

                        {/* User Creator */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                              <User className="h-3.5 w-3.5" />
                            </div>
                            <div className="truncate max-w-[120px]">
                              <span className="font-medium text-foreground truncate" title={creatorName}>
                                {creatorName}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Total Amount */}
                        <TableCell className="font-semibold whitespace-nowrap text-xs font-mono">
                          {formatCurrency(quote.amount, quote.currency as any)}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant={statusVariantMap[quote.status]}>
                            {statusTextMap[quote.status] || quote.status}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleOpenDetails(quote)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver / Exportar PDF / Gmail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(quote)}>
                                <Edit className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => promptDelete(quote)}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <QuoteDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        quote={selectedQuote}
      />

      <QuoteDetailsDialog
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        quote={selectedQuote}
      />

      {/* Modal de Confirmación de Eliminación con Descarte en Cascada */}
      <AlertDialog open={!!quoteToDelete} onOpenChange={(open) => !open && !isDeleting && setQuoteToDelete(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle>¿Eliminar Cotización?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3 pt-2 text-sm text-foreground/80">
              <p>
                Estás a punto de eliminar la cotización{' '}
                <span className="font-semibold font-mono text-foreground">
                  {quoteToDelete?.quoteNumber || quoteToDelete?.id}
                </span>{' '}
                del cliente <span className="font-semibold text-foreground">{quoteToDelete?.customer?.name || 'Cliente'}</span>.
              </p>

              {(quoteToDelete?.status === 'Accepted' || quoteToDelete?.status === 'Aprobada' || quoteToDelete?.orderId) ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                    <ShoppingCart className="h-4 w-4" />
                    Esta cotización generó una Orden de Venta
                  </div>
                  <p>
                    Al confirmar la eliminación, el sistema automáticamente:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li><strong>Eliminará la orden</strong> de la sección Órdenes de Venta.</li>
                    <li><strong>Devolverá el stock</strong> de los productos al inventario disponible.</li>
                    <li><strong>Registrará el movimiento</strong> de auditoría en el historial de almacén.</li>
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Esta acción no se puede deshacer y la cotización será borrada de la base de datos.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteQuote();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Confirmar Eliminación
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
