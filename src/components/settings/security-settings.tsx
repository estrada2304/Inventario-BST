'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, KeyRound, ShieldCheck } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const pinSchema = z.object({
  pin: z.string().min(4, 'El PIN debe tener al menos 4 dígitos.').max(8, 'El PIN no puede tener más de 8 dígitos.'),
});
type PinFormValues = z.infer<typeof pinSchema>;

export function SecuritySettings() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = React.useState(false);

  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'security') : null, [firestore]);
  const { data: securitySettings, isLoading: isLoadingSettings } = useDoc<{ deletePin: string }>(settingsRef);

  const form = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });
  
  React.useEffect(() => {
    if (securitySettings?.deletePin) {
      form.reset({ pin: securitySettings.deletePin });
    } else {
      form.reset({ pin: '12345' });
    }
  }, [securitySettings, form]);

  const onSubmit = async (values: PinFormValues) => {
    if (!settingsRef) return;
    setIsLoading(true);
    try {
      await setDoc(settingsRef, { deletePin: values.pin });
      toast({
        title: 'PIN de Seguridad Actualizado',
        description: 'El nuevo PIN ha sido guardado y ahora se requiere para acceder a módulos restringidos y realizar eliminaciones.',
      });
    } catch (error: any) {
      console.error("Error updating PIN:", error);
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: settingsRef.path,
            operation: 'update',
            requestResourceData: { deletePin: values.pin }
        }));
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al actualizar',
          description: 'No se pudo guardar el nuevo PIN.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          Seguridad Global del Sistema
        </CardTitle>
        <CardDescription>
          El PIN de seguridad protege los módulos sensibles (Tablero, Importaciones, Proveedores y Reportes) y autoriza la eliminación permanente de registros. El PIN predeterminado es <strong>12345</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    PIN de Seguridad Maestro
                  </FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="****" {...field} disabled={isLoadingSettings || isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading || isLoadingSettings}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Nuevo PIN
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
