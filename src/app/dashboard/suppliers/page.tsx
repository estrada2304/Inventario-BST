'use client';

import React, { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import type { Supplier } from '@/lib/types';
import { SupplierDialog } from '@/components/suppliers/supplier-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Search, MoreHorizontal, Edit, Trash2, Truck, Mail, Phone, MapPin, Contact } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DataImportExport, FieldMapping } from '@/components/shared/data-import-export';

const supplierFields: FieldMapping[] = [
  { key: 'name', label: 'Nombre del Proveedor', example: 'Ningbo Power Machinery Co., Ltd.' },
  { key: 'contactPerson', label: 'Contacto / Vendedor', example: 'David Chen' },
  { key: 'email', label: 'Correo Electrónico', example: 'sales@ningbopower.cn' },
  { key: 'phone', label: 'Teléfono', example: '+86 574-87654321' },
  { key: 'country', label: 'País', example: 'China' },
  { key: 'address', label: 'Dirección', example: 'Industrial Zone, Ningbo, Zhejiang' },
  { key: 'notes', label: 'Notas', example: 'Proveedor principal de generadores' },
];

export default function SuppliersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | undefined>(undefined);

  const suppliersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers, isLoading } = useCollection<Supplier>(suppliersQuery);

  const filteredSuppliers = React.useMemo(() => {
    if (!suppliers || !Array.isArray(suppliers)) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return suppliers;

    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        s.contactPerson?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.phone?.toLowerCase().includes(term) ||
        s.taxId?.toLowerCase().includes(term) ||
        s.address?.toLowerCase().includes(term) ||
        s.city?.toLowerCase().includes(term) ||
        s.country?.toLowerCase().includes(term) ||
        s.notes?.toLowerCase().includes(term) ||
        s.status?.toLowerCase().includes(term) ||
        s.createdByName?.toLowerCase().includes(term) ||
        s.createdByEmail?.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  const handleOpenCreate = () => {
    setSelectedSupplier(undefined);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDialogOpen(true);
  };

  const handleDelete = async (supplierId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'suppliers', supplierId));
      toast({
        title: 'Proveedor Eliminado',
        description: 'El proveedor ha sido eliminado correctamente de la base de datos.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el proveedor.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-muted-foreground">
            Gestión de datos de proveedores e importaciones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DataImportExport
            entityName="Proveedores"
            collectionName="suppliers"
            data={suppliers || []}
            fields={supplierFields}
          />
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Proveedor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Directorio de Proveedores
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, contacto, email..."
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
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No se encontraron proveedores</p>
              <p className="text-xs mt-1">
                Registra tus proveedores para gestionar compras e importaciones.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Email / Teléfono</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">
                        {supplier.name}
                      </TableCell>
                      <TableCell>
                        {supplier.contactPerson ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Contact className="h-3.5 w-3.5 text-muted-foreground" />
                            {supplier.contactPerson}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {supplier.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {supplier.email}
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {supplier.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {supplier.country || supplier.address ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {[supplier.address, supplier.country].filter(Boolean).join(', ')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
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
                            <DropdownMenuItem onClick={() => handleOpenEdit(supplier)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(supplier.id)}
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

      <SupplierDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        supplier={selectedSupplier}
      />
    </div>
  );
}

