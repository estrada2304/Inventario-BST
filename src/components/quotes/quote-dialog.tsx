'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { QuoteForm } from './quote-form';
import type { Quote } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';

interface QuoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  quote?: Quote;
}

export function QuoteDialog({ isOpen, onClose, quote }: QuoteDialogProps) {
  const title = quote ? 'Editar Cotización' : 'Crear Nueva Cotización';
  const description = quote
    ? 'Modifica los detalles de la cotización y guarda los cambios.'
    : 'Rellena el formulario para crear una nueva cotización.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-12rem)]">
           <div className="py-4 pr-6">
            <QuoteForm 
              quote={quote}
              onSaveSuccess={onClose}
              onCancel={onClose}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
