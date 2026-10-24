'use client';

import { MoreHorizontal, Edit, Trash2, Eye, PlusCircle, KeyRound } from 'lucide-react';
import { Row, Table } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/hooks/use-current-user';

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
  entityName: string;
  table: Table<TData>;
}

export function DataTableRowActions<TData>({ row, entityName, table }: DataTableRowActionsProps<TData>) {
  const { isAdmin, isSales } = useCurrentUser();
  const { onEdit, onViewDetails, onAddStock, onPasswordReset } = table.options.meta as { 
    onEdit?: (data: TData) => void, 
    onViewDetails?: (data: TData) => void,
    onAddStock?: (data: TData) => void,
    onPasswordReset?: (data: TData) => void,
  };

  const name = entityName.toLowerCase();
  const isAuthorizedModule = ['venta', 'cotización', 'importación', 'usuario', 'cliente', 'proveedor'].includes(name);
  
  const canEdit = isAdmin || (isSales && isAuthorizedModule);

  const isProduct = name === 'producto';
  const copyLabel = isProduct ? `Copiar Nombre de ${name}` : `Copiar ID de ${entityName}`;
  const copyValue = isProduct ? (row.original as any).name : (row.original as any).id;

  return (
    <div className="flex items-center justify-end gap-1">
      {onViewDetails && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDetails(row.original)}>
              <Eye className="h-4 w-4" />
              <span className="sr-only">Ver Detalles</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ver Detalles</p>
          </TooltipContent>
        </Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          
          {canEdit && onEdit && (
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar {entityName}
            </DropdownMenuItem>
          )}

          {isAdmin && onAddStock && name === 'producto' && (
            <DropdownMenuItem onClick={() => onAddStock(row.original)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Stock
            </DropdownMenuItem>
          )}

          {canEdit && onPasswordReset && name === 'usuario' && (
            <DropdownMenuItem onClick={() => onPasswordReset(row.original)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Restablecer Contraseña
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(copyValue)}>
            {copyLabel}
          </DropdownMenuItem>
          
          {canEdit && (
            <DropdownMenuItem className="text-destructive" disabled>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar (usar checkbox)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
