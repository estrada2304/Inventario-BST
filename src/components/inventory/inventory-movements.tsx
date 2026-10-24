'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { InventoryMovement } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Search,
  User,
  Download,
  Filter,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

interface InventoryMovementsProps {
  productId?: string;
}

export function InventoryMovements({ productId }: InventoryMovementsProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [selectedUser, setSelectedUser] = React.useState<string>('all');

  const movementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (productId) {
      return query(
        collection(firestore, `products/${productId}/inventoryMovements`),
        orderBy('date', 'desc')
      );
    }
    return query(
      collection(firestore, 'inventoryMovements'),
      orderBy('date', 'desc'),
      limit(250)
    );
  }, [firestore, productId]);

  const { data: movements, isLoading } = useCollection<InventoryMovement>(movementsQuery);

  // Extract unique users from movements
  const uniqueUsers = React.useMemo(() => {
    if (!movements || !Array.isArray(movements)) return [];
    const userSet = new Set<string>();
    movements.forEach((m) => {
      const u = m.userName || m.userEmail;
      if (u) userSet.add(u);
    });
    return Array.from(userSet);
  }, [movements]);

  // Summary statistics
  const stats = React.useMemo(() => {
    if (!movements || !Array.isArray(movements)) {
      return { total: 0, entries: 0, exits: 0, totalUnitsIn: 0, totalUnitsOut: 0 };
    }

    let entries = 0;
    let exits = 0;
    let totalUnitsIn = 0;
    let totalUnitsOut = 0;

    movements.forEach((m) => {
      const qty = Math.abs(Number(m.quantity) || 0);
      if (m.type === 'entry') {
        entries++;
        totalUnitsIn += qty;
      } else if (m.type === 'exit') {
        exits++;
        totalUnitsOut += qty;
      }
    });

    return {
      total: movements.length,
      entries,
      exits,
      totalUnitsIn,
      totalUnitsOut,
    };
  }, [movements]);

  // Filtered movements based on search, type, and user
  const filteredMovements = React.useMemo(() => {
    if (!movements || !Array.isArray(movements)) return [];
    const term = searchTerm.trim().toLowerCase();

    return movements.filter((mov) => {
      // Type Filter
      if (selectedType !== 'all') {
        if (mov.type !== selectedType) return false;
      }

      // User Filter
      if (selectedUser !== 'all') {
        const u = mov.userName || mov.userEmail || '';
        if (u !== selectedUser) return false;
      }

      // Search Query
      if (!term) return true;

      const typeLabel =
        mov.type === 'entry' ? 'entrada' : mov.type === 'exit' ? 'salida resta' : 'ajuste';
      const typeMatch = mov.type?.toLowerCase().includes(term) || typeLabel.includes(term);
      const prodNameMatch = mov.productName?.toLowerCase().includes(term);
      const serialMatch = mov.serialNumber?.toLowerCase().includes(term);
      const notesMatch = mov.notes?.toLowerCase().includes(term);
      const userMatch =
        mov.userName?.toLowerCase().includes(term) || mov.userEmail?.toLowerCase().includes(term);
      const dateMatch = String(mov.date || '').toLowerCase().includes(term);
      const qtyMatch = String(mov.quantity ?? '').includes(term);

      return (
        typeMatch ||
        prodNameMatch ||
        serialMatch ||
        notesMatch ||
        userMatch ||
        dateMatch ||
        qtyMatch
      );
    });
  }, [movements, searchTerm, selectedType, selectedUser]);

  // Export movements to Excel
  const handleExportMovements = () => {
    if (!filteredMovements || filteredMovements.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin datos',
        description: 'No hay movimientos para exportar.',
      });
      return;
    }

    try {
      const exportRows = filteredMovements.map((mov) => {
        let dateFormatted = mov.date;
        try {
          dateFormatted = format(new Date(mov.date), 'dd/MM/yyyy HH:mm');
        } catch {}

        const typeLabel =
          mov.type === 'entry' ? 'Entrada (+)' : mov.type === 'exit' ? 'Salida / Resta (-)' : 'Ajuste (=)';

        return {
          'Fecha y Hora': dateFormatted,
          'ID Producto': mov.productId || '',
          'Producto': mov.productName || 'N/A',
          'Serial / Modelo': mov.serialNumber || 'N/A',
          'Tipo Movimiento': typeLabel,
          'Cantidad': mov.quantity,
          'Variación (Delta)': mov.type === 'exit' ? -mov.quantity : mov.quantity,
          'Stock Previo': mov.previousStock !== undefined ? mov.previousStock : 'N/D',
          'Stock Resultante': mov.newStock !== undefined ? mov.newStock : 'N/D',
          'Verificación Operación':
            mov.previousStock !== undefined && mov.newStock !== undefined
              ? `${mov.previousStock} ${mov.type === 'exit' ? '-' : '+'} ${mov.quantity} = ${mov.newStock}`
              : '',
          'Usuario Responsable': mov.userName || mov.userEmail || 'Sistema',
          'Correo Usuario': mov.userEmail || '',
          'Motivo / Referencia': mov.notes || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos_Inventario');

      const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');
      XLSX.writeFile(workbook, `Historico_Movimientos_Inventario_${dateStr}.xlsx`);

      toast({
        title: 'Exportación completada',
        description: `Se exportaron ${exportRows.length} movimientos de inventario.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de exportación',
        description: error.message || 'No se pudo generar el archivo Excel.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Stats Cards (only for global view) */}
      {!productId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-card/80 border-border/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Movimientos</p>
                <p className="text-2xl font-bold font-mono">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Total Entradas (+)
                </p>
                <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  +{stats.totalUnitsIn} <span className="text-xs font-normal text-muted-foreground">uds</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{stats.entries} operaciones</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  Total Salidas / Restas (-)
                </p>
                <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">
                  -{stats.totalUnitsOut} <span className="text-xs font-normal text-muted-foreground">uds</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{stats.exits} operaciones</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-lg border bg-card">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto, serial, usuario, motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        {/* Type Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[150px] text-xs h-9">
              <SelectValue placeholder="Tipo de Movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Tipos</SelectItem>
              <SelectItem value="entry">Entradas (+)</SelectItem>
              <SelectItem value="exit">Salidas / Restas (-)</SelectItem>
              <SelectItem value="adjustment">Ajustes (=)</SelectItem>
            </SelectContent>
          </Select>

          {/* User Filter */}
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[170px] text-xs h-9">
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

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMovements}
            className="h-9 gap-1.5 text-xs shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Histórico
          </Button>
        </div>
      </div>

      {/* Movements Table */}
      {filteredMovements.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card/40">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="font-medium text-sm">No se encontraron movimientos registrados</p>
          <p className="text-xs mt-1">
            {searchTerm || selectedType !== 'all' || selectedUser !== 'all'
              ? 'No hay registros que coincidan con los filtros aplicados.'
              : 'Los movimientos de entrada, salida y ajustes aparecerán aquí automáticamente.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-card">
          <ScrollArea className={productId ? 'h-72' : 'max-h-[560px]'}>
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur">
                <TableRow>
                  <TableHead className="w-[150px]">Fecha y Hora</TableHead>
                  {!productId && <TableHead className="min-w-[180px]">Producto</TableHead>}
                  <TableHead className="w-[130px]">Tipo</TableHead>
                  <TableHead className="w-[130px] text-center">Variación</TableHead>
                  <TableHead className="w-[170px]">Verificación de Stock (Resta/Suma)</TableHead>
                  <TableHead className="w-[160px]">Usuario Responsable</TableHead>
                  <TableHead className="min-w-[200px]">Motivo / Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((mov) => {
                  let formattedDate = 'Fecha desconocida';
                  try {
                    if (mov.date) {
                      formattedDate = format(new Date(mov.date), 'dd MMM yyyy, HH:mm', { locale: es });
                    }
                  } catch {
                    formattedDate = String(mov.date || '');
                  }

                  const isExit = mov.type === 'exit';
                  const isEntry = mov.type === 'entry';
                  const isAdjustment = mov.type === 'adjustment';

                  return (
                    <TableRow key={mov.id} className="hover:bg-muted/30 transition-colors">
                      {/* Date */}
                      <TableCell className="text-xs whitespace-nowrap font-mono text-muted-foreground">
                        {formattedDate}
                      </TableCell>

                      {/* Product (Global view only) */}
                      {!productId && (
                        <TableCell>
                          <div className="font-medium text-xs text-foreground truncate max-w-[220px]" title={mov.productName}>
                            {mov.productName || `ID: ${mov.productId}`}
                          </div>
                          {mov.serialNumber && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              Serial: {mov.serialNumber}
                            </div>
                          )}
                        </TableCell>
                      )}

                      {/* Type Badge */}
                      <TableCell>
                        {isEntry && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 font-medium text-[11px] py-0.5">
                            <ArrowDownLeft className="h-3 w-3" />
                            Entrada (+)
                          </Badge>
                        )}
                        {isExit && (
                          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 gap-1 font-medium text-[11px] py-0.5">
                            <ArrowUpRight className="h-3 w-3" />
                            Salida / Resta (-)
                          </Badge>
                        )}
                        {isAdjustment && (
                          <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 font-medium text-[11px] py-0.5">
                            <SlidersHorizontal className="h-3 w-3" />
                            Ajuste (=)
                          </Badge>
                        )}
                      </TableCell>

                      {/* Quantity / Variation */}
                      <TableCell className="text-center font-mono font-bold text-xs whitespace-nowrap">
                        {isEntry && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{mov.quantity} uds
                          </span>
                        )}
                        {isExit && (
                          <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/50">
                            -{mov.quantity} uds
                          </span>
                        )}
                        {isAdjustment && (
                          <span className="text-blue-600 dark:text-blue-400">
                            ={mov.quantity} uds
                          </span>
                        )}
                      </TableCell>

                      {/* Math Verification: Previous Stock -> New Stock */}
                      <TableCell className="text-xs">
                        {mov.previousStock !== undefined && mov.newStock !== undefined ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-muted/40 px-2 py-1 rounded border border-border/50">
                            <span className="text-muted-foreground" title="Stock anterior">
                              {mov.previousStock}
                            </span>
                            <span
                              className={
                                isExit
                                  ? 'text-red-600 font-bold'
                                  : isEntry
                                  ? 'text-emerald-600 font-bold'
                                  : 'text-blue-600 font-bold'
                              }
                            >
                              {isExit ? '-' : isEntry ? '+' : '->'}
                            </span>
                            <span className="font-bold text-foreground">
                              {mov.quantity}
                            </span>
                            <span className="text-muted-foreground">=</span>
                            <span
                              className={`font-bold px-1 rounded ${
                                mov.newStock <= 0
                                  ? 'bg-destructive/20 text-destructive'
                                  : 'bg-primary/10 text-primary'
                              }`}
                              title="Stock resultante verificado"
                            >
                              {mov.newStock}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">
                            Verificado ({mov.quantity} uds)
                          </span>
                        )}
                      </TableCell>

                      {/* Responsible User */}
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div className="truncate max-w-[130px]">
                            <div className="font-medium text-foreground truncate" title={mov.userName || mov.userEmail}>
                              {mov.userName || (mov.userEmail ? mov.userEmail.split('@')[0] : 'Sistema')}
                            </div>
                            {mov.userEmail && (
                              <div className="text-[10px] text-muted-foreground truncate" title={mov.userEmail}>
                                {mov.userEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Notes / Reason */}
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="truncate max-w-[260px]" title={mov.notes}>
                          {mov.notes || 'Sin observaciones'}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
