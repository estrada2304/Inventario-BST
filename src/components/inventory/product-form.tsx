'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
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
import type { Product, ImportDocument } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, Upload, FileText, CheckCircle } from 'lucide-react';
import { useFirestore, useUser, useStorage } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, writeBatch } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { FirebaseError } from 'firebase/app';
import { useCurrentUser } from '@/hooks/use-current-user';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  serialNumber: z.string().min(1, 'El Número de Serie es requerido.'),
  unit: z.string().min(1, 'La unidad es requerida.'),
  unitValue: z.coerce.number().optional().nullable(),
  description: z.string().optional(),
  exw: z.coerce.number().min(0, 'El precio debe ser un número positivo.'),
  fob: z.coerce.number().min(0, 'El precio debe ser un número positivo.'),
  cif: z.coerce.number().min(0, 'El precio debe ser un número positivo.'),
  retailPrice: z.coerce.number().min(0, 'El precio de venta debe ser un número positivo.'),
  bcvPrice: z.coerce.number().min(0, 'El precio BCV debe ser un número positivo.'),
  stock: z.coerce.number().int('El stock debe ser un número entero.').min(0, 'El stock no puede ser negativo.'),
  status: z.enum(['In Stock', 'Low Stock', 'Out of Stock']),
  warehouse: z.string().min(1, 'Debe seleccionar un almacén.'),
  isComposite: z.boolean().default(false),
  components: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1, "El nombre del componente es requerido."),
    quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1."),
    unit: z.string().min(1, "La unidad es requerida."),
    unitValue: z.coerce.number().optional().nullable(),
    description: z.string().min(1, 'La descripción es requerida.'),
    informativePrice: z.coerce.number().optional().nullable(),
  })).optional(),
});

type ProductFormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
  product?: Product;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const formatUsd = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function ProductForm({ product, onSaveSuccess, onCancel }: ProductFormProps) {
  const { isAdmin } = useCurrentUser();
  const [isLoading, setIsLoading] = React.useState(false);
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();

  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(product?.image || null);
  
  const [datasheetFiles, setDatasheetFiles] = React.useState<File[]>([]);
  const [existingDatasheets, setExistingDatasheets] = React.useState<ImportDocument[]>(product?.datasheets || []);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: product ? {
      ...product,
      unitValue: product.unitValue ?? null,
      description: product.description ?? '',
      bcvPrice: product.bcvPrice ?? product.vesPrice ?? 0,
      components: product.components?.map((c: any) => ({
        ...c,
        unitValue: c.unitValue ?? null,
        informativePrice: c.informativePrice ?? null,
      })) || [],
    } : {
      name: '',
      serialNumber: '',
      unit: 'UN',
      unitValue: null,
      description: '',
      exw: 0,
      fob: 0,
      cif: 0,
      retailPrice: 0,
      bcvPrice: 0,
      stock: 0,
      status: 'In Stock',
      warehouse: 'Almacén Principal',
      isComposite: false,
      components: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'components',
  });

  const isComposite = form.watch('isComposite');
  const cifValue = useWatch({ control: form.control, name: "cif" });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleDatasheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDatasheetFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };
  
  const removeNewDatasheet = (indexToRemove: number) => {
    setDatasheetFiles(files => files.filter((_, index) => index !== indexToRemove));
  };
  
  const removeExistingDatasheet = (indexToRemove: number) => {
    setExistingDatasheets(docs => docs.filter((_, index) => index !== indexToRemove));
  };

  const onSubmit = async (values: ProductFormValues) => {
    if (!user || !firestore || !storage) {
      toast({ variant: "destructive", title: "Error de inicialización", description: "No se pudieron cargar los servicios de Firebase." });
      return;
    }
    
    setIsLoading(true);

    try {
      const productId = product?.id || doc(collection(firestore, `products`)).id;
      const productRef = doc(firestore, `products`, productId);
      const batch = writeBatch(firestore);

      let imageUrl = product?.image || `https://picsum.photos/seed/${productId}/200/200`;

      if (imageFile) {
        const safeImageName = imageFile.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.-]/g, '_');
        const imageStorageRef = storageRef(storage, `products/${productId}/image/${safeImageName}`);
        await uploadBytes(imageStorageRef, imageFile);
        imageUrl = await getDownloadURL(imageStorageRef);
      }
      
      const uploadedDatasheets: ImportDocument[] = [...existingDatasheets];
      const uploadPromises = datasheetFiles.map(async (file) => {
        const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileStorageRef = storageRef(storage, `products/${productId}/datasheets/${safeName}`);
        const snapshot = await uploadBytes(fileStorageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return { id: `doc-${Date.now()}-${Math.random()}`, name: file.name, url };
      });

      const newDocuments = await Promise.all(uploadPromises);
      uploadedDatasheets.push(...newDocuments);

      const newProductData: any = {
        ...values,
        id: productId,
        image: imageUrl,
        datasheets: uploadedDatasheets,
        updatedAt: serverTimestamp(),
        createdAt: product?.createdAt || serverTimestamp(),
      };
      
      if (product) {
        const stockChange = values.stock - (product.stock || 0);
        newProductData.quantity = (product.quantity || 0) + (stockChange > 0 ? stockChange : 0);
        if (stockChange > 0) {
          const movementRef = doc(collection(firestore, `products/${productId}/inventoryMovements`));
          batch.set(movementRef, { id: movementRef.id, productId, type: 'entry', quantity: stockChange, date: new Date().toISOString(), notes: 'Ajuste de stock manual desde edición.' });
        }
      } else {
        newProductData.quantity = values.stock;
        newProductData.createdByName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Sistema');
        newProductData.createdByEmail = user.email || '';
        
        if(values.stock > 0) {
            const movementRef = doc(collection(firestore, `products/${productId}/inventoryMovements`));
            batch.set(movementRef, { id: movementRef.id, productId, type: 'entry', quantity: values.stock, date: new Date().toISOString(), notes: 'Stock inicial de creación de producto.' });
        }
      }
      
      batch.set(productRef, newProductData, { merge: true });
      await batch.commit();

      toast({ title: "Producto Guardado", description: `El producto "${values.name}" se ha guardado correctamente.` });
      onSaveSuccess();

    } catch (error: any) {
      console.error("Error saving product:", error);
      let title = "Error al Guardar";
      let description = "No se pudo guardar el producto.";

      if (error instanceof FirebaseError && error.code === 'storage/unauthorized') {
          title = "Acceso Denegado al Almacenamiento";
          description = "IMPORTANTE: Ve a la Consola de Firebase > Storage y haz clic en el botón 'Comenzar'. Si ya lo hiciste, revisa la pestaña 'Reglas' para asegurar que permitan el acceso público durante las pruebas.";
      } else if (error instanceof Error) {
        description = error.message;
      }
      
      toast({ variant: "destructive", title: title, description: description, duration: 15000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={() => (
              <FormItem>
                <FormLabel>Imagen del Producto</FormLabel>
                <div className="flex items-center gap-4">
                    {imagePreview && (
                        <div className="w-24 h-24 relative rounded-md overflow-hidden border">
                            <img src={imagePreview} alt="Vista previa" className="object-cover w-full h-full" />
                        </div>
                    )}
                    <FormControl>
                        <Button asChild variant="outline" className="relative">
                            <div>
                                <Upload className="mr-2 h-4 w-4" />
                                Subir Imagen
                                <Input 
                                    type="file" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept="image/png, image/jpeg, image/gif"
                                    onChange={handleImageChange}
                                    disabled={isLoading}
                                />
                            </div>
                        </Button>
                    </FormControl>
                </div>
                 <FormMessage />
              </FormItem>
            )}
          />
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel>Nombre del Producto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Laptop QuantumCore" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Serie</FormLabel>
                  <FormControl>
                    <Input placeholder="Ingrese el número de serie" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="UN">UN</SelectItem>
                            <SelectItem value="M">M</SelectItem>
                            <SelectItem value="KG">KG</SelectItem>
                            <SelectItem value="KM">KM</SelectItem>
                            <SelectItem value="SET">SET</SelectItem>
                            <SelectItem value="SOL">SOL</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="unitValue"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Valor por Unidad</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="Ej: 100" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
          </div>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe el producto" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isComposite"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Producto Compuesto</FormLabel>
                  <FormDescription>
                    Activa si este producto está formado por otros productos.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {isComposite && (
             <Card>
              <CardHeader>
                <CardTitle>Componentes del Producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-md border p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <FormField
                          control={form.control}
                          name={`components.${index}.name`}
                          render={({ field }) => (
                              <FormItem className='md:col-span-4'>
                              <FormLabel>Nombre del Componente</FormLabel>
                              <FormControl>
                                  <Input placeholder="Ej: Memoria RAM 8GB" {...field} />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                      control={form.control}
                      name={`components.${index}.quantity`}
                      render={({ field }) => (
                          <FormItem className="md:col-span-2">
                          <FormLabel>Cantidad</FormLabel>
                          <FormControl>
                              <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                      <FormField
                          control={form.control}
                          name={`components.${index}.unit`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Unidad</FormLabel>
                               <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Unidad" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="UN">UN</SelectItem>
                                    <SelectItem value="M">M</SelectItem>
                                    <SelectItem value="KG">KG</SelectItem>
                                    <SelectItem value="KM">KM</SelectItem>
                                    <SelectItem value="SET">SET</SelectItem>
                                    <SelectItem value="SOL">SOL</SelectItem>
                                </SelectContent>
                            </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                      />
                      <FormField
                        control={form.control}
                        name={`components.${index}.unitValue`}
                        render={({ field }) => (
                            <FormItem className="md:col-span-2">
                            <FormLabel>Valor Unidad</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Ej: 100" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                      <div className="md:col-span-2 flex items-end justify-end">
                          <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                    </div>
                     <FormField
                      control={form.control}
                      name={`components.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción del Componente</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Ej: Memoria RAM DDR4 para laptop" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {isAdmin && (
                      <FormField
                        control={form.control}
                        name={`components.${index}.informativePrice`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Precio Informativo (USD)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                      />
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', quantity: 1, unit: 'UN', description: '', unitValue: null, informativePrice: null })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Componente
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Inventario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="warehouse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Almacén</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un almacén" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Almacén Principal">Almacén Principal</SelectItem>
                          <SelectItem value="Almacén Secundario">Almacén Secundario</SelectItem>
                          <SelectItem value="Depósito">Depósito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Stock {product ? '(Actual)' : '(Inicial)'}</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} />
                            </FormControl>
                             <FormDescription>El Histórico se actualizará con entradas.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="In Stock">En Stock</SelectItem>
                        <SelectItem value="Low Stock">Stock Bajo</SelectItem>
                        <SelectItem value="Out of Stock">Sin Stock</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>
          
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Precios (Incoterms)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="exw" render={({ field }) => (<FormItem><FormLabel>EXW (USD)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? 0} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="fob" render={({ field }) => (<FormItem><FormLabel>FOB (USD)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? 0} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="cif" render={({ field }) => (<FormItem><FormLabel>CIF (USD)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? 0} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="text-right font-bold text-lg pt-2">
                    Costo CIF: {formatUsd(cifValue || 0)}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
              <CardHeader>
                <CardTitle>Ficha Técnica (Datasheet)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div>
                      <FormLabel>Subir Nuevos Archivos</FormLabel>
                      <FormControl>
                          <Button asChild variant="outline" className="relative w-full mt-2">
                              <div>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Seleccionar Archivos
                                  <Input 
                                      type="file" 
                                      multiple 
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                      onChange={handleDatasheetChange}
                                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                      disabled={isLoading}
                                  />
                              </div>
                          </Button>
                      </FormControl>
                  </div>
                  {(existingDatasheets.length > 0 || datasheetFiles.length > 0) && (
                  <div className="space-y-2 pt-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Archivos:</h4>
                      <div className="space-y-2 rounded-md border p-2">
                          {existingDatasheets.map((doc, index) => (
                          <div key={`existing-${index}`} className="flex items-center justify-between text-sm p-1">
                              <div className="flex items-center gap-2 truncate">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate" title={doc.name}>
                                      {doc.name}
                                  </a>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeExistingDatasheet(index)} disabled={isLoading}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </div>
                          ))}
                          {datasheetFiles.map((file, index) => (
                          <div key={`new-${index}`} className="flex items-center justify-between text-sm p-1">
                              <div className="flex items-center gap-2 truncate">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="truncate" title={file.name}>{file.name}</span>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeNewDatasheet(index)} disabled={isLoading}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </div>
                          ))}
                      </div>
                  </div>
                  )}
              </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precios de Venta Final</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="retailPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio de Venta (USD)</FormLabel>
                    <FormDescription>
                      Precio base al cliente en dólares.
                    </FormDescription>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ej: 199.99" {...field} value={field.value ?? 0} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bcvPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio de Venta (BCV)</FormLabel>
                    <FormDescription>
                      Precio de venta sugerido en bolívares.
                    </FormDescription>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ej: 8500.00" {...field} value={field.value ?? 0} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Producto
            </Button>
        </div>
      </form>
    </Form>
  );
}
