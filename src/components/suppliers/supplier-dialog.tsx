'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SupplierForm } from './supplier-form';
import type { Supplier } from '@/lib/types';

interface SupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier;
}

export function SupplierDialog({ isOpen, onClose, supplier }: SupplierDialogProps) {
  const title = supplier ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor';
  const description = supplier
    ? 'Modifica los detalles del proveedor y guarda los cambios.'
    : 'Rellena el formulario para añadir un nuevo proveedor a tu lista.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <SupplierForm 
            supplier={supplier}
            onSaveSuccess={onClose}
            onCancel={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
