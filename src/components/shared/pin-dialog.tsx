'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface PinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PinDialog({ isOpen, onClose, onSuccess }: PinDialogProps) {
  const [pin, setPin] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [error, setError] = React.useState('');
  const { toast } = useToast();
  const firestore = useFirestore();

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'settings', 'security') : null), [firestore]);
  const { data: securitySettings, isLoading: isLoadingSettings } = useDoc<{ deletePin: string }>(settingsRef);

  const handleConfirm = async () => {
    setIsVerifying(true);
    setError('');

    const correctPin = securitySettings?.deletePin || '12345';

    if (pin === correctPin) {
      // Importante: Cerramos el diálogo PRIMERO para asegurar fluidez en la UI
      onClose();
      // Luego disparamos la acción de éxito (eliminación)
      onSuccess();
    } else {
      setError('PIN incorrecto. Inténtalo de nuevo.');
      toast({
        variant: 'destructive',
        title: 'PIN Incorrecto',
        description: 'El PIN de seguridad no es válido.',
      });
      setIsVerifying(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setIsVerifying(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verificación de Seguridad</DialogTitle>
          <DialogDescription>
            Para continuar con la eliminación, por favor ingresa el PIN de seguridad.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Input
            type="password"
            placeholder="Introduce el PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={isVerifying || isLoadingSettings}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
              }
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isVerifying}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isVerifying || !pin || isLoadingSettings}>
            {isVerifying || isLoadingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
