'use client';

import React, { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import type { Import } from '@/lib/types';
import { ImportDialog } from '@/components/imports/import-dialog';
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
import { Plus, Search, MoreHorizontal, Edit, Trash2, Globe, Plane } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DataImportExport, FieldMapping } from '@/components/shared/data-import-export';

const importFields: FieldMapping[] = [
  { key: 'trackingNumber', label: 'Número Tracking / BL', example: 'BL-NG-2026-8801' },
  { key: 'originCountry', label: 'País de Origen', example: 'China' },
  { key: 'portOfEntry', label: 'Puerto de Entrada', example: 'Puerto Cabello' },
  { key: 'shippingCostUSD', label: 'Costo Flete USD', example: '2500', type: 'number' },
  { key: 'tariffUSD', label: 'Aranceles USD', example: '1200', type: 'number' },
  { key: 'status', label: 'Estado', example: 'InTransit' },
  { key: 'estimatedArrivalDate', label: 'Fecha Estimada Llegada', example: '2026-08-25' },
  { key: 'notes', label: 'Notas', example: '20 generadores en contenedor 40HQ' },
];

const statusTextMap: Record<string, string> = {
  Ordered: 'Pedido Realizado',
  InTransit: 'En Tránsito',
  Customs: 'En Aduana',
  Arrived: 'Llegado / Almacén',
  'En Origen': 'En Origen',
  'En Tránsito': 'En Tránsito',
  'En Aduana': 'En Aduana',
  Nacionalizado: 'Nacionalizado',
  Entregado: 'Entregado',
  Completado: 'Completado',
  Pendiente: 'Pendiente',
  Cancelado: 'Cancelado',
  Cancelled: 'Cancelado',
};

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Arrived: 'default',
  Entregado: 'default',
  Completado: 'default',
  Nacionalizado: 'default',
  InTransit: 'secondary',
  'En Tránsito': 'secondary',
  Customs: 'secondary',
  'En Aduana': 'secondary',
  'En Origen': 'outline',
  Ordered: 'outline',
  Pendiente: 'outline',
  Cancelled: 'destructive',
  Cancelado: 'destructive',
};

export default function ImportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedImport, setSelectedImport] = useState<Import | undefined>(undefined);

  const importsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'imports') : null),
    [firestore]
  );
  const { data: imports, isLoading } = useCollection<Import>(importsQuery);

  const filteredImports = React.useMemo(() => {
    if (!imports || !Array.isArray(imports)) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return imports;

    return imports.filter((imp) => {
      const trackingMatch = imp.trackingNumber?.toLowerCase().includes(term);
      const supplierNameMatch = imp.supplier?.name?.toLowerCase().includes(term);
      const supplierContactMatch = imp.supplier?.contactPerson?.toLowerCase().includes(term);
      const supplierEmailMatch = imp.supplier?.email?.toLowerCase().includes(term);
      const originMatch = imp.originCountry?.toLowerCase().includes(term);
      const portMatch = imp.destinationPort?.toLowerCase().includes(term);
      const notesMatch = imp.notes?.toLowerCase().includes(term);
      const statusText = statusTextMap[imp.status] || imp.status;
      const statusMatch = imp.status?.toLowerCase().includes(term) || statusText.toLowerCase().includes(term);
      const docsMatch = Array.isArray(imp.documents) && imp.documents.some((d) => d.name?.toLowerCase().includes(term));
      const amountMatch = String(imp.totalCostUSD ?? '').includes(term);

      return (
        trackingMatch ||
        supplierNameMatch ||
        supplierContactMatch ||
        supplierEmailMatch ||
        originMatch ||
        portMatch ||
        notesMatch ||
        statusMatch ||
        docsMatch ||
        amountMatch
      );
    });
  }, [imports, searchTerm]);

  const handleOpenCreate = () => {
    setSelectedImport(undefined);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (imp: Import) => {
    setSelectedImport(imp);
    setIsDialogOpen(true);
  };

  const handleDelete = async (importId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'imports', importId));
      toast({
        title: 'Importación Eliminada',
        description: 'La importación fue eliminada de la base de datos.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el registro de importación.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importaciones y Aduanas</h1>
          <p className="text-muted-foreground">
            Control de fletes internacionales, aranceles, envíos y seguimiento de aduana.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DataImportExport
            entityName="Importaciones"
            collectionName="imports"
            data={imports || []}
            fields={importFields}
          />
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar Importación
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Embarques e Importaciones en Curso
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tracking, proveedor, origen..."
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
          ) : filteredImports.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Plane className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No se encontraron importaciones</p>
              <p className="text-xs mt-1">
                Haz clic en &quot;Registrar Importación&quot; para ingresar un nuevo embarque.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking / ID</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Costo FOB / Flete</TableHead>
                    <TableHead>Llegada Est.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredImports.map((imp) => (
                    <TableRow key={imp.id}>
                      <TableCell className="font-mono font-medium text-xs">
                        {imp.trackingNumber || imp.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {imp.supplier?.name || 'Proveedor General'}
                      </TableCell>
                      <TableCell>{imp.originCountry || 'Internacional'}</TableCell>
                      <TableCell className="text-xs">
                        <div><span className="text-muted-foreground">FOB:</span> ${(imp.fobCost || 0).toFixed(2)}</div>
                        <div><span className="text-muted-foreground">Flete/Tarifa:</span> ${(imp.shippingCost || 0).toFixed(2)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {imp.estimatedArrival || 'Pendiente'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariantMap[imp.status]}>
                          {statusTextMap[imp.status] || imp.status}
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
                            <DropdownMenuItem onClick={() => handleOpenEdit(imp)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(imp.id)}
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

      <ImportDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSaveSuccess={() => setIsDialogOpen(false)}
        importData={selectedImport}
      />
    </div>
  );
}

