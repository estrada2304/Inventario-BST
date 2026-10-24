'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { OrderForm } from './order-form';
import type { Order } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';

interface OrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order;
}

export function OrderDialog({ isOpen, onClose, order }: OrderDialogProps) {
  const title = order ? 'Editar Venta' : 'Añadir Nueva Venta';
  const description = order
    ? 'Modifica los detalles de la venta y guarda los cambios.'
    : 'Rellena el formulario para añadir una nueva venta.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-12rem)]">
           <div className="py-4 pr-6">
            <OrderForm 
              order={order}
              onSaveSuccess={onClose}
              onCancel={onClose}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
