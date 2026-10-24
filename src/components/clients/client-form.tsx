'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Client } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  company: z.string().optional(),
  email: z.string().email('Debe ser un email válido.'),
  phone: z.string().min(1, 'El teléfono es requerido.'),
  status: z.enum(['Activo', 'Inactivo']),
  clientType: z.enum(['Empresa', 'Individual'], {
    required_error: "Debe seleccionar un tipo de cliente."
  }),
  taxId: z.string().min(1, 'El RIF o Cédula es requerido.'),
  country: z.string().min(1, 'El país es requerido.'),
  address: z.string().min(1, 'La dirección es requerida.'),
});

type ClientFormValues = z.infer<typeof formSchema>;

interface ClientFormProps {
  client?: Client;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export function ClientForm({ client, onSaveSuccess, onCancel }: ClientFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client?.name || '',
      company: client?.company || '',
      email: client?.email || '',
      phone: client?.phone || '',
      status: client?.status || 'Activo',
      clientType: client?.clientType || 'Empresa',
      taxId: client?.taxId || '',
      country: client?.country || 'Venezuela',
      address: client?.address || '',
    },
  });

  const onSubmit = (values: ClientFormValues) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Error de base de datos",
        description: "No se pudo conectar a la base de datos.",
      });
      return;
    }
    
    setIsLoading(true);
    
    const clientId = client?.id || doc(collection(firestore, `clients`)).id;
    const clientRef = doc(firestore, `clients`, clientId);

    const newClientData = {
      ...values,
      id: clientId,
      updatedAt: serverTimestamp(),
      createdAt: client?.createdAt || serverTimestamp(),
    };
    
    setDoc(clientRef, newClientData, { merge: true })
      .then(() => {
        toast({
          title: client ? "Cliente Actualizado" : "Cliente Creado",
          description: `El cliente "${values.name}" se ha guardado correctamente.`,
        });
        onSaveSuccess();
      })
      .catch((error) => {
        console.error("Error saving client:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: clientRef.path,
          operation: client ? 'update' : 'create',
          requestResourceData: newClientData
        }));
        toast({
          variant: "destructive",
          title: "Error al Guardar",
          description: "No se pudo guardar el cliente. Por favor, inténtalo de nuevo.",
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre completo del contacto</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Jane Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Empresa (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Acme Inc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
              control={form.control}
              name="clientType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cliente</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Empresa">Empresa</SelectItem>
                      <SelectItem value="Individual">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>RIF / Cédula</FormLabel>
                  <FormControl>
                      <Input placeholder="Ej: J-12345678-9" {...field} />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="cliente@ejemplo.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono</FormLabel>
              <FormControl>
                <Input placeholder="+58-412-555-1234" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>País</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Selecciona un país" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Venezuela">Venezuela</SelectItem>
                            <SelectItem value="Panama">Panamá</SelectItem>
                            <SelectItem value="Mexico">México</SelectItem>
                            <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Activo">Activo</SelectItem>
                        <SelectItem value="Inactivo">Inactivo</SelectItem>
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Textarea placeholder="Ej: Av. Principal con Calle 4, Edif. Torre Pro, Piso 5..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cliente
            </Button>
        </div>
      </form>
    </Form>
  );
}
