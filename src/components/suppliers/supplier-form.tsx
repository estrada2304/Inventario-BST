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
import type { Supplier } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  seller: z.string().optional(),
  email: z.string().email('Debe ser un email válido.'),
  phone: z.string().min(1, 'El teléfono es requerido.'),
  country: z.string().min(1, 'El país es requerido.'),
  status: z.enum(['Activo', 'Inactivo']),
});

type SupplierFormValues = z.infer<typeof formSchema>;

interface SupplierFormProps {
  supplier?: Supplier;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const countries = [
  "Afganistán", "Albania", "Alemania", "Andorra", "Angola", "Antigua y Barbuda",
  "Arabia Saudita", "Argelia", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaiyán", "Bahamas", "Bangladés", "Barbados", "Baréin", "Bélgica",
  "Belice", "Benín", "Bielorrusia", "Birmania", "Bolivia",
  "Bosnia y Herzegovina", "Botsuana", "Brasil", "Brunéi", "Bulgaria",
  "Burkina Faso", "Burundi", "Bután", "Cabo Verde", "Camboya", "Camerún",
  "Canadá", "Catar", "Chad", "Chile", "China", "Chipre", "Ciudad del Vaticano",
  "Colombia", "Comoras", "Corea del Norte", "Corea del Sur", "Costa de Marfil",
  "Costa Rica", "Croacia", "Cuba", "Dinamarca", "Dominica", "Ecuador", "Egipto",
  "El Salvador", "Emiratos Árabes Unidos", "Eritrea", "Eslovaquia",
  "Eslovenia", "España", "Estados Unidos", "Estonia", "Etiopía", "Filipinas",
  "Finlandia", "Fiyi", "Francia", "Gabón", "Gambia", "Georgia", "Ghana",
  "Granada", "Grecia", "Guatemala", "Guinea", "Guinea-Bisáu",
  "Guinea Ecuatorial", "Guyana", "Haití", "Honduras", "Hungría", "India",
  "Indonesia", "Irak", "Irán", "Irlanda", "Islandia", "Islas Marshall",
  "Islas Salomón", "Israel", "Italia", "Jamaica", "Japón", "Jordania",
  "Kazajistán", "Kenia", "Kirguistán", "Kiribati", "Kuwait", "Laos",
  "Lesoto", "Letonia", "Líbano", "Liberia", "Libia", "Liechtenstein",
  "Lituania", "Luxemburgo", "Macedonia del Norte", "Madagascar", "Malasia",
  "Malaui", "Maldivas", "Malí", "Malta", "Marruecos", "Mauricio",
  "Mauritania", "México", "Micronesia", "Moldavia", "Mónaco", "Mongolia",
  "Montenegro", "Mozambique", "Namibia", "Nauru", "Nepal", "Nicaragua",
  "Níger", "Nigeria", "Noruega", "Nueva Zelanda", "Omán", "Países Bajos",
  "Pakistán", "Palaos", "Panamá", "Papúa Nueva Guinea", "Paraguay", "Perú",
  "Polonia", "Portugal", "Reino Unido", "República Centroafricana",
  "República Checa", "República del Congo", "República Democrática del Congo",
  "República Dominicana", "Ruanda", "Rumania", "Rusia", "Samoa",
  "San Cristóbal y Nieves", "San Marino", "San Vicente y las Granadinas",
  "Santa Lucía", "Santo Tomé y Príncipe", "Senegal", "Serbia", "Seychelles",
  "Sierra Leona", "Singapur", "Siria", "Somalia", "Sri Lanka", "Suazilandia",
  "Sudáfrica", "Sudán", "Sudán del Sur", "Suecia", "Suiza", "Surinam",
  "Tailandia", "Tanzania", "Tayikistán", "Timor Oriental", "Togo", "Tonga",
  "Trinidad y Tobago", "Túnez", "Turkmenistán", "Turquía", "Tuvalu", "Ucrania",
  "Uganda", "Uruguay", "Uzbekistán", "Vanuatu", "Venezuela", "Vietnam",
  "Yemen", "Yibuti", "Zambia", "Zimbabue"
];

export function SupplierForm({ supplier, onSaveSuccess, onCancel }: SupplierFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: supplier?.name || '',
      seller: supplier?.seller || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      country: supplier?.country || '',
      status: supplier?.status || 'Activo',
    },
  });

  const onSubmit = (values: SupplierFormValues) => {
     if (!firestore) {
      toast({
        variant: "destructive",
        title: "Error de base de datos",
        description: "No se pudo conectar a la base de datos.",
      });
      return;
    }

    setIsLoading(true);
    
    const supplierId = supplier?.id || doc(collection(firestore, `suppliers`)).id;
    const supplierRef = doc(firestore, `suppliers`, supplierId);
    
    const newSupplierData = {
      ...values,
      id: supplierId,
      updatedAt: serverTimestamp(),
      createdAt: supplier?.createdAt || serverTimestamp(),
    };

    setDoc(supplierRef, newSupplierData, { merge: true })
      .then(() => {
        toast({
          title: supplier ? "Proveedor Actualizado" : "Proveedor Creado",
          description: `El proveedor "${values.name}" se ha guardado correctamente.`,
        });
        onSaveSuccess();
      })
      .catch((error) => {
        console.error("Error saving supplier:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: supplierRef.path,
          operation: supplier ? 'update' : 'create',
          requestResourceData: newSupplierData
        }));
        toast({
          variant: "destructive",
          title: "Error al Guardar",
          description: "No se pudo guardar el proveedor. Por favor, inténtalo de nuevo.",
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
              <FormLabel>Nombre del Proveedor</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Global Tech Imports" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="seller"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendedor</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del contacto de ventas" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="proveedor@ejemplo.com" {...field} />
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
                <Input placeholder="+1-202-555-0172" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
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
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
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
        
        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Proveedor
            </Button>
        </div>
      </form>
    </Form>
  );
}
