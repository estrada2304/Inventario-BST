'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ProductForm } from './product-form';
import type { Product } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
}

export function ProductDialog({ isOpen, onClose, product }: ProductDialogProps) {
  const title = product ? 'Editar Producto' : 'Añadir Nuevo Producto';
  const description = product
    ? 'Modifica los detalles del producto y guarda los cambios.'
    : 'Rellena el formulario para añadir un nuevo producto a tu inventario.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-12rem)]">
          <div className="py-4 pr-6">
            <ProductForm 
              product={product}
              onSaveSuccess={onClose}
              onCancel={onClose}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
