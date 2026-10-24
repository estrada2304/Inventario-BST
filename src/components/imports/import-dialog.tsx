'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ImportForm } from './import-form';
import type { Import } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  importData?: Import;
}

export function ImportDialog({ isOpen, onClose, onSaveSuccess, importData }: ImportDialogProps) {
  const title = importData ? 'Editar Importación' : 'Añadir Nueva Importación';
  const description = importData
    ? 'Modifica los detalles de la importación y guarda los cambios.'
    : 'Rellena el formulario para añadir una nueva importación a tu lista.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-12rem)]">
          <div className="py-4 pr-6">
            <ImportForm 
              importData={importData}
              onSaveSuccess={onSaveSuccess}
              onCancel={onClose}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
