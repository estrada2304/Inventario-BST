'use client';

import * as React from 'react';
import { ColumnDef, Row } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { Import } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DataTableRowActions } from '@/components/ui/data-table-row-actions';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const EditableDateCell = ({ getValue, row, column: { id: columnId } }: { getValue: () => any; row: Row<Import>; column: { id: string } }) => {
  const initialValue = getValue() as string;
  const { toast } = useToast();
  const firestore = useFirestore();
  const [date, setDate] = React.useState<Date | undefined>(
    initialValue ? parseISO(initialValue) : undefined
  );

  React.useEffect(() => {
    setDate(initialValue ? parseISO(initialValue) : undefined);
  }, [initialValue]);

  const onDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate || !firestore) return;
    
    setDate(selectedDate);
    const importId = row.original.id;
    const docRef = doc(firestore, 'imports', importId);

    updateDoc(docRef, { [columnId]: format(selectedDate, 'yyyy-MM-dd') })
      .then(() => {
        toast({ title: 'Fecha actualizada correctamente.' });
      })
      .catch((err) => {
        console.error("Error updating date:", err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `imports/${importId}`,
          operation: 'update',
          requestResourceData: { [columnId]: format(selectedDate, 'yyyy-MM-dd') }
        }));
        toast({ 
          variant: 'destructive', 
          title: 'Error al actualizar la fecha.',
          description: 'No tienes permisos para realizar esta acción.'
        });
        setDate(initialValue ? parseISO(initialValue) : undefined); // Revert on error
      });
  };

  return (
    <Popover modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd/MM/yyyy') : <span>Seleccionar</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateSelect}
          captionLayout="dropdown"
          fromYear={new Date().getFullYear() - 10}
          toYear={new Date().getFullYear() + 10}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

const EditableIncotermCell = ({ getValue, row, column: { id: columnId } }: { getValue: () => any; row: Row<Import>; column: { id: string } }) => {
  const initialValue = getValue() as Import['incoterm'];
  const { toast } = useToast();
  const firestore = useFirestore();
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onValueChange = (newValue: Import['incoterm']) => {
    if (!newValue || !firestore) return;
    
    setValue(newValue);
    const importId = row.original.id;
    const docRef = doc(firestore, 'imports', importId);

    updateDoc(docRef, { [columnId]: newValue })
      .then(() => {
        toast({ title: 'Incoterm actualizado correctamente.' });
      })
      .catch((err) => {
        console.error("Error updating incoterm:", err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `imports/${importId}`,
          operation: 'update',
          requestResourceData: { [columnId]: newValue }
        }));
        toast({ 
          variant: 'destructive', 
          title: 'Error al actualizar el Incoterm.',
          description: 'No tienes permisos para realizar esta acción.'
        });
        setValue(initialValue); // Revert on error
      });
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Seleccionar Incoterm" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="EXW">EXW</SelectItem>
        <SelectItem value="FOB">FOB</SelectItem>
        <SelectItem value="CIF">CIF</SelectItem>
        <SelectItem value="DDP">DDP</SelectItem>
      </SelectContent>
    </Select>
  );
};


export const columns: ColumnDef<Import>[] = [
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
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
  },
  {
    accessorKey: 'supplier',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" />,
    cell: ({ row }) => {
      const supplier = row.original.supplier;
      if (!supplier) return null;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{supplier.name}</span>
          <span className="text-sm text-muted-foreground">{supplier.country}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'title',
    header: 'Título',
  },
  {
    accessorKey: 'description',
    header: 'Descripción',
    cell: ({ row }) => {
      const description = row.original.description;
      return (
        <div className="w-64 truncate" title={description}>
          {description}
        </div>
      );
    },
  },
   {
    accessorKey: 'route',
    header: 'Ruta',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.origin}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span>{row.original.destination}</span>
      </div>
    )
  },
  {
    accessorKey: 'departureDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="F. Salida" />,
    cell: EditableDateCell,
  },
  {
    accessorKey: 'arrivalDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="F. Llegada" />,
    cell: EditableDateCell,
  },
  {
    accessorKey: 'incoterm',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Incoterm" />,
    cell: EditableIncotermCell,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => {
      const status: Import['status'] = row.getValue('status');
      let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'secondary';
      if (status === 'Entregado') variant = 'default';
      else if (status === 'En Aduana' || status === 'Nacionalizado') variant = 'outline';
      else if (status === 'Cancelado') variant = 'destructive';

      return <Badge variant={variant}>{status}</Badge>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'costs.total',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Costo Total" />,
    cell: ({ row }) => {
      const amount = row.original.costs.total;
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'documents',
    header: 'Documentos',
    cell: ({ row }) => {
        const documents = row.original.documents;
        if (!documents || documents.length === 0) {
            return <span className="text-muted-foreground">N/A</span>;
        }
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Ver ({documents.length})
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Documentos Adjuntos</h4>
                            <p className="text-sm text-muted-foreground">
                                Archivos relacionados con la importación.
                            </p>
                        </div>
                        <div className="grid gap-2">
                           {documents.map((doc, idx) => (
                             <a 
                                key={`${doc.name}-${idx}`} 
                                href={doc.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {doc.name}
                             </a>
                           ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        )
    }
  },
  {
    id: 'actions',
    cell: ({ row, table }) => <DataTableRowActions row={row} entityName="importación" table={table} />,
  },
];
