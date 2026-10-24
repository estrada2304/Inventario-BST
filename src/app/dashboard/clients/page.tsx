'use client';

import React, { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import type { Client } from '@/lib/types';
import { ClientDialog } from '@/components/clients/client-dialog';
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
import { Plus, Search, MoreHorizontal, Edit, Trash2, Users, Mail, Phone, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DataImportExport, FieldMapping } from '@/components/shared/data-import-export';

const clientFields: FieldMapping[] = [
  { key: 'name', label: 'Nombre Completo', example: 'Corporación Venezolana de Energía' },
  { key: 'company', label: 'Empresa', example: 'CorpoEner C.A.' },
  { key: 'taxId', label: 'RIF / Tax ID', example: 'J-30948571-0' },
  { key: 'email', label: 'Correo Electrónico', example: 'contacto@corpoener.com' },
  { key: 'phone', label: 'Teléfono', example: '+58 212-555-0199' },
  { key: 'clientType', label: 'Tipo de Cliente', example: 'Empresa' },
  { key: 'country', label: 'País', example: 'Venezuela' },
  { key: 'address', label: 'Dirección', example: 'Av. Francisco de Miranda, Edif. Galipán, Caracas' },
];

export default function ClientsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | undefined>(undefined);

  const clientsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'clients') : null),
    [firestore]
  );
  const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

  const filteredClients = React.useMemo(() => {
    if (!clients || !Array.isArray(clients)) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clients;

    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.taxId?.toLowerCase().includes(term) ||
        c.address?.toLowerCase().includes(term) ||
        c.country?.toLowerCase().includes(term) ||
        c.clientType?.toLowerCase().includes(term) ||
        c.notes?.toLowerCase().includes(term) ||
        c.status?.toLowerCase().includes(term) ||
        c.createdByName?.toLowerCase().includes(term) ||
        c.createdByEmail?.toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  const handleOpenCreate = () => {
    setSelectedClient(undefined);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setIsDialogOpen(true);
  };

  const handleDelete = async (clientId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'clients', clientId));
      toast({
        title: 'Cliente Eliminado',
        description: 'El cliente ha sido eliminado correctamente de la base de datos.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el cliente.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gestión completa de cartera de clientes y empresas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DataImportExport
            entityName="Clientes"
            collectionName="clients"
            data={clients || []}
            fields={clientFields}
          />
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Cliente
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Directorio de Clientes
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, empresa, email..."
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
          ) : filteredClients.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No se encontraron clientes</p>
              <p className="text-xs mt-1">
                Añade nuevos clientes haciendo clic en &quot;Nuevo Cliente&quot;.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell>
                        {client.company ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Building className="h-3.5 w-3.5 text-muted-foreground" />
                            {client.company}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {client.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {client.email}
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {client.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate">
                        {client.address || 'Sin dirección'}
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
                            <DropdownMenuItem onClick={() => handleOpenEdit(client)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(client.id)}
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

      <ClientDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        client={selectedClient}
      />
    </div>
  );
}

