'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/lib/types';
import { AlertTriangle, Package } from 'lucide-react';

interface LowStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export function LowStockDialog({ isOpen, onClose, products }: LowStockDialogProps) {
  if (!isOpen || !products || products.length === 0) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-full text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <AlertDialogTitle className="text-xl font-bold">
                Alerta de Stock Crítico ({products.length} productos)
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm mt-1 text-muted-foreground">
                Los siguientes artículos tienen 5 o menos unidades en inventario. Se recomienda gestionar compras o reabastecimiento.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <ScrollArea className="max-h-80 border rounded-md my-2">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0">
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Serial / Modelo</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Stock Disponible</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, idx) => {
                const stock = product.stock ?? product.quantity ?? 0;
                const isOutOfStock = stock <= 0 || product.status === 'Out of Stock';
                return (
                  <TableRow key={product.id || `low-stock-${idx}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div>{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {product.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {product.serialNumber || 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {product.warehouse || 'Principal'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={isOutOfStock ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                        {stock} {product.unit || 'uds'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {isOutOfStock ? (
                        <Badge variant="destructive" className="text-[10px]">Agotado</Badge>
                      ) : (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">Stock Bajo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose} className="w-full sm:w-auto">
            Entendido, Cerrar Alerta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
