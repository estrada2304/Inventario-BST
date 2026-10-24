'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ClientForm } from './client-form';
import type { Client } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client;
}

export function ClientDialog({ isOpen, onClose, client }: ClientDialogProps) {
  const title = client ? 'Editar Cliente' : 'Añadir Nuevo Cliente';
  const description = client
    ? 'Modifica los detalles del cliente y guarda los cambios.'
    : 'Rellena el formulario para añadir un nuevo cliente a tu lista.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-12rem)]">
          <div className="py-4 pr-6">
            <ClientForm 
              client={client}
              onSaveSuccess={onClose}
              onCancel={onClose}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
