'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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
import type { Import, Supplier, ImportDocument } from '@/lib/types';
import { Loader2, Upload, Trash2, FileText, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useFirestore, useUser, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FirebaseError } from 'firebase/app';

const formSchema = z.object({
  supplierId: z.string().min(1, 'Debe seleccionar un proveedor.'),
  title: z.string().min(1, 'El título es requerido.'),
  description: z.string().min(1, 'La descripción es requerida.'),
  origin: z.string().min(1, 'El origen es requerido.'),
  destination: z.string().min(1, 'El destino es requerido.'),
  departureDate: z.date({ required_error: 'La fecha de salida es requerida.'}),
  arrivalDate: z.date({ required_error: 'La fecha de llegada es requerida.'}),
  status: z.enum(['En Origen', 'En Tránsito', 'En Aduana', 'Nacionalizado', 'Entregado', 'Cancelado']),
  incoterm: z.enum(['EXW', 'FOB', 'CIF', 'DDP']),
  costs: z.object({
    fob: z.coerce.number().min(0, 'El valor debe ser positivo.'),
    freight: z.coerce.number().min(0, 'El valor debe ser positivo.'),
    insurance: z.coerce.number().min(0, 'El valor debe ser positivo.'),
    tariffs: z.coerce.number().min(0, 'El valor debe ser positivo.'),
    vat: z.coerce.number().min(0, 'El valor debe ser positivo.'),
    customsExpenses: z.coerce.number().min(0, 'El valor debe ser positivo.'),
  }),
});

type ImportFormValues = z.infer<typeof formSchema>;

interface ImportFormProps {
  importData?: Import;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function ImportForm({ importData, onSaveSuccess, onCancel }: ImportFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();

  const suppliersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'suppliers') : null),
    [firestore]
  );
  const { data: suppliers } = useCollection<Supplier>(suppliersQuery);

  const [documentFiles, setDocumentFiles] = React.useState<File[]>([]);
  const [existingDocuments, setExistingDocuments] = React.useState<ImportDocument[]>(importData?.documents || []);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: importData?.supplier.id || '',
      title: importData?.title || '',
      description: importData?.description || '',
      origin: importData?.origin || '',
      destination: importData?.destination || '',
      departureDate: importData?.departureDate ? parseISO(importData.departureDate) : new Date(),
      arrivalDate: importData?.arrivalDate ? parseISO(importData.arrivalDate) : new Date(),
      status: importData?.status || 'En Origen',
      incoterm: importData?.incoterm || 'FOB',
      costs: {
        fob: importData?.costs?.fob || 0,
        freight: importData?.costs?.freight || 0,
        insurance: importData?.costs?.insurance || 0,
        tariffs: importData?.costs?.tariffs || 0,
        vat: importData?.costs?.vat || 0,
        customsExpenses: importData?.costs?.customsExpenses || 0,
      },
    },
  });

  const watchedCosts = useWatch({ control: form.control, name: 'costs' });
  const totalCost = React.useMemo(() => {
    if (!watchedCosts) return 0;
    return Object.values(watchedCosts).reduce((sum: number, value: any) => sum + (Number(value) || 0), 0);
  }, [watchedCosts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocumentFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeNewFile = (indexToRemove: number) => {
    setDocumentFiles(files => files.filter((_, index) => index !== indexToRemove));
  };

  const removeExistingFile = (indexToRemove: number) => {
    setExistingDocuments(docs => docs.filter((_, index) => index !== indexToRemove));
  };

  const onSubmit = async (values: ImportFormValues) => {
    if (!firestore || !storage || !user) {
      toast({ variant: 'destructive', title: 'Error de Configuración', description: 'No se pudieron cargar los servicios de Firebase.' });
      return;
    }
    
    if (!suppliers) {
        toast({ variant: 'destructive', title: 'Error de Datos', description: 'No se pudo cargar la lista de proveedores.' });
        return;
    }
    
    setIsLoading(true);

    try {
      const selectedSupplier = suppliers.find(s => s.id === values.supplierId);
      if (!selectedSupplier) {
        throw new Error("Proveedor no encontrado.");
      }

      const importId = importData?.id || doc(collection(firestore, 'imports')).id;
      const uploadedDocuments: ImportDocument[] = [...existingDocuments];
      
      const uploadPromises = documentFiles.map(async (file) => {
        const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileStorageRef = storageRef(storage, `imports/${importId}/${safeName}`);
        const snapshot = await uploadBytes(fileStorageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return { id: `doc-${Date.now()}-${Math.random()}`, name: file.name, url };
      });

      const newDocuments = await Promise.all(uploadPromises);
      uploadedDocuments.push(...newDocuments);

      const importRef = doc(firestore, 'imports', importId);

      const newImportData = {
        id: importId,
        supplier: { id: selectedSupplier.id, name: selectedSupplier.name, phone: selectedSupplier.phone, country: selectedSupplier.country },
        title: values.title,
        description: values.description,
        status: values.status,
        origin: values.origin,
        destination: values.destination,
        departureDate: format(values.departureDate, 'yyyy-MM-dd'),
        arrivalDate: format(values.arrivalDate, 'yyyy-MM-dd'),
        incoterm: values.incoterm,
        costs: { ...values.costs, total: totalCost },
        documents: uploadedDocuments,
        updatedAt: serverTimestamp(),
        createdAt: importData?.createdAt || serverTimestamp(),
      };
      
      await setDoc(importRef, newImportData, { merge: true });

      toast({ title: "Importación Guardada", description: "La operación se ha completado con éxito." });
      onSaveSuccess();

    } catch (error: any) {
        console.error("Error al guardar la importación:", error);
        
        let errorTitle = "Error al Guardar la Importación";
        let errorMessage = "Ocurrió un error inesperado.";

        if (error instanceof FirebaseError && error.code === 'storage/unauthorized') {
            errorTitle = "Acceso Denegado al Almacenamiento";
            errorMessage = "IMPORTANTE: Ve a la Consola de Firebase > Storage y haz clic en el botón 'Comenzar'. Si ya lo hiciste, revisa la pestaña 'Reglas' para asegurar que permitan el acceso público durante las pruebas.";
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        
        toast({ 
            variant: "destructive", 
            title: errorTitle, 
            description: errorMessage,
            duration: 15000,
        });

    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField control={form.control} name="supplierId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!suppliers || isLoading}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un proveedor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliers?.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Importación de Repuestos" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Ej: Contenedor 40ft con electrónicos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="incoterm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incoterm</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un Incoterm" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EXW">EXW</SelectItem>
                        <SelectItem value="FOB">FOB</SelectItem>
                        <SelectItem value="CIF">CIF</SelectItem>
                        <SelectItem value="DDP">DDP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
              <CardTitle>Ruta y Fechas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="origin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puerto de Origen</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Shenzhen, China" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="destination" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puerto de Destino</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: La Guaira, Venezuela" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="departureDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Salida</FormLabel>
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown" fromYear={new Date().getFullYear() - 10} toYear={new Date().getFullYear() + 10} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="arrivalDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Llegada</FormLabel>
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown" fromYear={new Date().getFullYear() - 10} toYear={new Date().getFullYear() + 10} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado del Proceso</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="En Origen">En Origen</SelectItem>
                        <SelectItem value="En Tránsito">En Tránsito</SelectItem>
                        <SelectItem value="En Aduana">En Aduana</SelectItem>
                        <SelectItem value="Nacionalizado">Nacionalizado</SelectItem>
                        <SelectItem value="Entregado">Entregado</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
              <CardTitle>Costos de Importación (USD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={form.control} name="costs.fob" render={({ field }) => (<FormItem><FormLabel>Valor FOB</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="costs.freight" render={({ field }) => (<FormItem><FormLabel>Flete</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="costs.insurance" render={({ field }) => (<FormItem><FormLabel>Seguro</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="costs.tariffs" render={({ field }) => (<FormItem><FormLabel>Aranceles</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="costs.vat" render={({ field }) => (<FormItem><FormLabel>IVA</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="costs.customsExpenses" render={({ field }) => (<FormItem><FormLabel>Gastos Aduanales</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="text-right font-bold text-lg">
                    Costo Total (CIF + Imp): {formatCurrency(Number(totalCost) || 0)}
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <FormLabel>Subir Nuevos Documentos</FormLabel>
                    <FormControl>
                        <Button asChild variant="outline" className="relative w-full mt-2">
                            <div>
                                <Upload className="mr-2 h-4 w-4" />
                                Seleccionar Archivos
                                <Input 
                                    type="file" 
                                    multiple 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                    onChange={handleFileChange}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                                    disabled={isLoading}
                                />
                            </div>
                        </Button>
                    </FormControl>
                </div>
                {(existingDocuments.length > 0 || documentFiles.length > 0) && (
                <div className="space-y-2 pt-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Archivos para la importación:</h4>
                    <div className="space-y-2 rounded-md border p-2">
                        {existingDocuments.map((doc, index) => (
                        <div key={`existing-${index}`} className="flex items-center justify-between text-sm p-1">
                            <div className="flex items-center gap-2 truncate">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate" title={doc.name}>
                                    {doc.name}
                                </a>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeExistingFile(index)} disabled={isLoading}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        ))}
                        {documentFiles.map((file, index) => (
                        <div key={`new-${index}`} className="flex items-center justify-between text-sm p-1">
                            <div className="flex items-center gap-2 truncate">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate" title={file.name}>{file.name}</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeNewFile(index)} disabled={isLoading}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        ))}
                    </div>
                </div>
                )}
            </CardContent>
        </Card>


        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || !suppliers}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Importación
            </Button>
        </div>
      </form>
    </Form>
  );
}
