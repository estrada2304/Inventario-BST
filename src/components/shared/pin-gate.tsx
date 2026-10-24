'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, ShieldAlert } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface PinGateProps {
  children: React.ReactNode;
  isAdmin: boolean;
  isSales?: boolean;
}

export function PinGate({ children, isAdmin, isSales = false }: PinGateProps) {
  const [pin, setPin] = React.useState('');
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'settings', 'security') : null), [firestore]);
  const { data: securitySettings, isLoading: isLoadingSettings } = useDoc<{ deletePin: string }>(settingsRef);

  // Verificar si ya se ha desbloqueado en esta sesión
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bst_module_access_unlocked');
      if (stored === 'true') {
        setIsUnlocked(true);
      }
    }
  }, []);

  const handleVerify = () => {
    setIsVerifying(true);
    const correctPin = securitySettings?.deletePin || '12345';

    if (pin === correctPin) {
      setIsUnlocked(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bst_module_access_unlocked', 'true');
      }
      toast({
        title: 'Acceso Concedido',
        description: 'Módulo desbloqueado correctamente.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'PIN Incorrecto',
        description: 'El código ingresado no es válido.',
      });
    }
    setIsVerifying(false);
  };

  // Si tiene permisos por rol (Admin siempre, o Sales si el módulo lo permite fuera del gate), se muestra directamente.
  // Nota: Si el componente se usa en un módulo que DEBE pedir PIN a Sales, se le pasa isAdmin=false aunque sea Sales.
  if (isAdmin || isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Lock className="text-primary h-6 w-6" />
          </div>
          <CardTitle>Módulo Restringido</CardTitle>
          <CardDescription>
            Este contenido requiere permisos de administrador o un PIN de seguridad para ser visualizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Introduce el PIN de seguridad"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                disabled={isLoadingSettings}
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Contacta a un administrador si no conoces el código.
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={handleVerify} 
              disabled={isVerifying || !pin || isLoadingSettings}
            >
              {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desbloquear Acceso
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
