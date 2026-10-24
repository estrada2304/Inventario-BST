'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Client, Order, Product } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, Search, Package } from 'lucide-react';
import { format } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, serverTimestamp, collection, runTransaction, DocumentReference } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const orderItemSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto."),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1."),
  price: z.coerce.number(),
});

const formSchema = z.object({
  customerId: z.string().optional(),
  isManualClient: z.boolean().default(false),
  manualName: z.string().optional(),
  manualTaxId: z.string().optional(),
  manualAddress: z.string().optional(),
  status: z.enum(['Pending', 'Processing', 'Completed', 'Cancelled']),
  currency: z.enum(['USD', 'VES'], { required_error: 'Debe seleccionar una moneda.' }),
  items: z.array(orderItemSchema).min(1, "Debe añadir al menos un producto a la venta."),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof formSchema>;

interface OrderFormProps {
  order?: Order;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export function OrderForm({ order, onSaveSuccess, onCancel }: OrderFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isProductSearchOpen, setIsProductSearchOpen] = React.useState(false);
  const [activeProductIndex, setActiveProductIndex] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [productSearchQuery, setProductSearchQuery] = React.useState('');
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const clientsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'clients') : null),
    [firestore]
  );
  const { data: clients } = useCollection<Client>(clientsQuery);

  const productsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products } = useCollection<Product>(productsQuery);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: order?.customer.id && !order.customer.id.startsWith('manual') ? order.customer.id : '',
      isManualClient: order?.customer.id?.startsWith('manual') || false,
      manualName: order?.customer.id?.startsWith('manual') ? order.customer.name : '',
      manualTaxId: order?.customer.id?.startsWith('manual') ? order.customer.taxId : '',
      manualAddress: order?.customer.id?.startsWith('manual') ? order.customer.address : '',
      status: order?.status || 'Pending',
      currency: order?.currency || 'USD',
      items: order?.items || [],
      notes: order?.notes || '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = useWatch({ control: form.control, name: 'items' });
  const watchCurrency = form.watch('currency');
  const isManualClient = form.watch('isManualClient');
  
  const { totalAmount, totalQuantity } = React.useMemo(() => {
    const totals = (watchItems || []).reduce((acc: any, item: any) => {
        acc.totalAmount += (Number(item?.price) || 0) * (Number(item?.quantity) || 0);
        acc.totalQuantity += (Number(item?.quantity) || 0);
        return acc;
    }, { totalAmount: 0, totalQuantity: 0 });
    return totals;
  }, [watchItems]);

  const filteredClients = React.useMemo(() => {
    if (!clients || !searchQuery) return clients || [];
    const q = searchQuery.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.company?.toLowerCase().includes(q) || 
      (c.taxId && c.taxId.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  const filteredProducts = React.useMemo(() => {
    if (!products || !productSearchQuery) return products || [];
    const q = productSearchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [products, productSearchQuery]);

  const selectProductFromSearch = (product: Product) => {
    if (activeProductIndex === null) return;

    form.setValue(`items.${activeProductIndex}.productId`, product.id);
    form.setValue(`items.${activeProductIndex}.name`, product.name);
    form.setValue(`items.${activeProductIndex}.description`, product.description || '');
    
    const currency = form.getValues('currency');
    const price = currency === 'USD' 
      ? (product.retailPrice || 0)
      : (product.vesPrice || 0);
    
    form.setValue(`items.${activeProductIndex}.price`, price);
    
    setIsProductSearchOpen(false);
    setActiveProductIndex(null);
    setProductSearchQuery('');
  };

  const onSubmit = async (values: OrderFormValues) => {
    if (!firestore || !products || !user) {
      toast({ variant: "destructive", title: "Error", description: "Servicios no disponibles." });
      return;
    }
    
    setIsLoading(true);

    let clientData: Order['customer'];

    if (values.isManualClient) {
        if (!values.manualName || !values.manualTaxId) {
            toast({ variant: "destructive", title: "Datos incompletos", description: "Nombre y RIF son obligatorios para cliente manual." });
            setIsLoading(false);
            return;
        }
        clientData = {
            id: order?.customer?.id?.startsWith('manual') ? order.customer.id : `manual-${Date.now()}`,
            name: values.manualName || '',
            taxId: values.manualTaxId || '',
            company: '',
            email: 'N/A',
            phone: 'N/A',
            clientType: 'Individual',
            country: 'Venezuela',
            address: values.manualAddress || ''
        };
    } else {
        const selectedCustomerId = values.customerId;
        const found = clients?.find(c => c.id === selectedCustomerId);
        if (!found) {
            toast({ variant: "destructive", title: "Cliente no seleccionado", description: "Por favor elija un cliente de la lista desplegable." });
            setIsLoading(false);
            return;
        }
        clientData = {
            id: found.id,
            name: found.name || '',
            company: found.company || '',
            email: found.email || '',
            phone: found.phone || '',
            clientType: found.clientType || 'Individual',
            country: found.country || '',
            taxId: found.taxId || '',
            address: found.address || ''
        };
    }

    try {
      const orderId = order?.id || doc(collection(firestore, 'orders')).id;
      const orderRef = doc(firestore, `orders`, orderId);

      await runTransaction(firestore, async (transaction) => {
        const productRefs = new Map<string, DocumentReference>();
        const productDocs = new Map<string, any>();
        
        const allProductIds = new Set<string>();
        if (order && Array.isArray(order.items)) {
            order.items.forEach(item => { if (item.productId) allProductIds.add(item.productId); });
        }
        if (Array.isArray(values.items)) {
            values.items.forEach(item => { if (item.productId) allProductIds.add(item.productId); });
        }

        for (const productId of allProductIds) {
            const productRef = doc(firestore, 'products', productId);
            productRefs.set(productId, productRef);
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
                const productName = values.items.find(i => i.productId === productId)?.name || `ID: ${productId}`;
                throw new Error(`El producto "${productName}" no fue encontrado.`);
            }
            productDocs.set(productId, productDoc);
        }
        
        const stockChanges = new Map<string, number>();

        if (order && (order.status !== 'Cancelled' && order.status !== 'Cancelado') && Array.isArray(order.items)) {
            order.items.forEach(item => {
                if (item.productId) {
                    stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + (Number(item.quantity) || 0));
                }
            });
        }
        
        if (values.status !== 'Cancelled' && Array.isArray(values.items)) {
            values.items.forEach(item => {
                if (item.productId) {
                    stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) - (Number(item.quantity) || 0));
                }
            });
        }

        const currentUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Ventas');
        const nowIso = new Date().toISOString();

        for (const [productId, change] of stockChanges.entries()) {
            if (change === 0) continue;

            const productDoc = productDocs.get(productId);
            const prodData = productDoc.data();
            const currentStock = Number(prodData.stock) || 0;
            const newStock = currentStock + change;
            
            if (newStock < 0) {
                throw new Error(`Stock insuficiente para "${prodData.name}". Stock actual: ${currentStock}, se necesitan ${Math.abs(change)}.`);
            }
            
            let newProductStatus: Product['status'] = 'In Stock';
            if (newStock <= 0) {
              newProductStatus = 'Out of Stock';
            } else if (newStock <= 5) {
              newProductStatus = 'Low Stock';
            }
            
            transaction.update(productRefs.get(productId)!, { stock: newStock, status: newProductStatus, updatedAt: serverTimestamp() });

            // Record movement in history
            const movementId = doc(collection(firestore, 'inventoryMovements')).id;
            const movType: 'entry' | 'exit' = change < 0 ? 'exit' : 'entry';
            const movementData = {
              id: movementId,
              productId: productId,
              productName: prodData.name || '',
              serialNumber: prodData.serialNumber || '',
              type: movType,
              quantity: Math.abs(change),
              delta: change,
              previousStock: currentStock,
              newStock: newStock,
              date: nowIso,
              notes: change < 0
                ? `Venta #${orderId.slice(0, 8)} - Cliente: ${clientData.name}`
                : `Reversión/Ajuste por Venta #${orderId.slice(0, 8)}`,
              userName: currentUserName,
              userEmail: user.email || '',
              createdBy: user.uid,
              createdAt: serverTimestamp(),
            };

            transaction.set(doc(firestore, 'inventoryMovements', movementId), movementData);
            transaction.set(doc(firestore, `products/${productId}/inventoryMovements`, movementId), movementData);
        }

        const newOrderData: any = {
            id: orderId,
            customer: clientData,
            items: values.items.map(item => ({
                ...item,
                description: item.description || ''
            })),
            amount: totalAmount,
            status: values.status,
            currency: values.currency,
            date: order?.date || format(new Date(), 'yyyy-MM-dd'),
            notes: values.notes || '',
            updatedAt: serverTimestamp(),
            createdAt: order?.createdAt || serverTimestamp(),
            createdByName: order?.createdByName || user?.displayName || (user?.email ? user.email.split('@')[0] : 'Sistema'),
            createdByEmail: order?.createdByEmail || user.email || '',
        };

        transaction.set(orderRef, newOrderData, { merge: true });
      });

      toast({
        title: order ? "Venta Actualizada" : "Venta Creada",
        description: `La venta para "${clientData.name}" se ha guardado exitosamente.`,
      });
      onSaveSuccess();

    } catch (error: any) {
      console.error("Error saving order:", error);
      const description = error.message || "No se pudo guardar la venta.";
      
      if (error?.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: order ? `orders/${order.id}` : 'orders/new',
            operation: order ? 'update' : 'create',
            requestResourceData: values
        }));
      } else {
        toast({ variant: "destructive", title: "Error al Guardar", description: description });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className='space-y-4'>
              <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30">
                  <FormField
                      control={form.control}
                      name="isManualClient"
                      render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                          <div className="space-y-0.5">
                              <FormLabel className="text-sm font-semibold">Cliente no registrado (Manual)</FormLabel>
                              <FormDescription className="text-[10px]">
                                  Activa esta opción para escribir los datos del cliente manualmente.
                              </FormDescription>
                          </div>
                          <FormControl>
                              <Switch
                                  checked={field.value}
                                  onCheckedChange={(val) => {
                                      field.onChange(val);
                                      if (val) {
                                          form.setValue('customerId', '');
                                      } else {
                                          form.setValue('manualName', '');
                                          form.setValue('manualTaxId', '');
                                          form.setValue('manualAddress', '');
                                      }
                                  }}
                              />
                          </FormControl>
                      </FormItem>
                      )}
                  />

                  {!isManualClient ? (
                      <FormField
                          control={form.control}
                          name="customerId"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Seleccionar Cliente</FormLabel>
                                  <div className="flex gap-2">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger disabled={isLoading} className="flex-1">
                                                <SelectValue placeholder="Elija un cliente de la lista..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {clients?.map((client) => (
                                                <SelectItem key={client.id} value={client.id}>
                                                    {client.name} {client.company ? `(${client.company})` : ''} - {client.taxId}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => setIsSearchOpen(true)}
                                      disabled={isLoading || !clients}
                                      title="Buscar cliente"
                                    >
                                      <Search className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                  ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="manualName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre del Cliente</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Juan Pérez" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="manualTaxId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>RIF / Cédula</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: V-12345678" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="manualAddress"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Dirección del Cliente</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Av. Principal, Las Mercedes..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                      </div>
                  )}
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                            <SelectItem value="Pending">Pendiente</SelectItem>
                            <SelectItem value="Processing">Procesando</SelectItem>
                            <SelectItem value="Completed">Completado</SelectItem>
                            <SelectItem value="Cancelled">Cancelado</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                          <SelectTrigger>
                          <SelectValue placeholder="Selecciona una moneda" />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="VES">VES (Bs.)</SelectItem>
                      </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              </div>
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas de la Venta</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Añade detalles de la venta..."
                    className="resize-y"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <FormLabel className="text-base font-bold">Productos</FormLabel>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start border p-3 rounded-md bg-background shadow-sm">
                  <div className="col-span-12 sm:col-span-5">
                     <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field: selectField }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Producto</FormLabel>
                            <div className="flex gap-1">
                              <Select 
                                onValueChange={(value) => {
                                  const selectedProd = products?.find(p => p.id === value);
                                  selectField.onChange(value);
                                  form.setValue(`items.${index}.name`, selectedProd?.name || '');
                                  form.setValue(`items.${index}.description`, selectedProd?.description || '');
                                  
                                  const currency = form.getValues('currency');
                                  const price = currency === 'USD' 
                                    ? (selectedProd?.retailPrice || 0)
                                    : (selectedProd?.vesPrice || 0);
                                  
                                  form.setValue(`items.${index}.price`, price);
                                }} 
                                value={selectField.value}
                                disabled={!products || isLoading}
                              >
                                <FormControl>
                                  <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Producto" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products?.map(p => (
                                    <SelectItem key={p.id} value={p.id} disabled={(p.stock ?? 0) <= 0}>
                                        {p.name} (Stock: {p.stock ?? 0})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="icon" 
                                className="h-10 w-10 shrink-0"
                                onClick={() => {
                                  setActiveProductIndex(index);
                                  setIsProductSearchOpen(true);
                                }}
                                disabled={isLoading || !products}
                                title="Buscar producto"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                            {watchItems?.[index]?.description && (
                              <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 px-1 italic">
                                {watchItems[index].description}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.price`}
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel className="text-xs">Precio</FormLabel>
                           <FormControl><Input type="number" step="0.01" {...field} placeholder="0.00" /></FormControl>
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <FormField
                      control={form.control as any}
                      name={`items.${index}.quantity` as any}
                      render={({ field }) => (
                         <FormItem>
                           <FormLabel className="text-xs">Cant.</FormLabel>
                           <FormControl><Input type="number" min="1" {...field} placeholder="1" /></FormControl>
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                   <div className="col-span-12 sm:col-span-3 flex items-end gap-2">
                      <div className="w-full space-y-1">
                          <FormLabel className="text-xs">Subtotal</FormLabel>
                          <div className="flex h-10 items-center justify-end rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-medium">
                            {watchCurrency === 'USD' ? '$' : 'Bs.'}{((watchItems?.[index]?.price || 0) * (watchItems?.[index]?.quantity || 0)).toFixed(2)}
                          </div>
                      </div>
                      <Button type="button" variant="destructive" size="icon" className="h-10 w-10 shrink-0" onClick={() => remove(index)} disabled={isLoading}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ productId: '', name: '', quantity: 1, price: 0 })}
              disabled={!products || isLoading}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Producto
            </Button>
             {form.formState.errors.items && (
              <p className="text-sm font-medium text-destructive">
                {typeof form.formState.errors.items?.message === 'string' ? form.formState.errors.items.message : 'Verifique los items de la orden.'}
              </p>
             )}
          </div>
          
          <div className="flex items-center justify-between gap-4 pt-4 border-t">
              <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-2xl font-bold text-primary">{watchCurrency === 'USD' ? '$' : 'Bs.'}{totalAmount.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">({totalQuantity} {totalQuantity === 1 ? 'ítem' : 'ítems'})</span>
              </div>
              <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                      Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading || !products}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar Venta
                  </Button>
              </div>
          </div>
        </form>
      </Form>

      {/* Modal de Búsqueda de Clientes */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar Cliente Registrado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nombre, empresa o RIF..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <ScrollArea className="h-60 rounded-md border p-2">
              {filteredClients.length > 0 ? (
                <div className="space-y-1">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-0"
                      onClick={() => {
                        form.setValue('customerId', client.id);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="font-semibold">{client.name}</div>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>{client.company || 'Personal'}</span>
                        <span>{client.taxId}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No se encontraron clientes.
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Búsqueda de Productos */}
      <Dialog open={isProductSearchOpen} onOpenChange={setIsProductSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar Producto en Inventario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nombre, serial o descripción..."
                className="pl-8"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <ScrollArea className="h-80 rounded-md border p-2">
              {filteredProducts.length > 0 ? (
                <div className="space-y-1">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="w-full text-left px-3 py-3 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-0 group"
                      onClick={() => selectProductFromSearch(product)}
                      disabled={(product.stock ?? 0) <= 0}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-semibold group-hover:text-primary transition-colors">{product.name}</div>
                        <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${(product.stock ?? 0) > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                          Stock: {product.stock ?? 0}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex justify-between mt-1">
                        <span>SN: {product.serialNumber}</span>
                        <span className="font-mono">
                          {watchCurrency === 'USD' ? '$' : 'Bs.'}
                          {(watchCurrency === 'USD' ? product.retailPrice : product.vesPrice)?.toFixed(2)}
                        </span>
                      </div>
                      {product.description && (
                        <div className="text-[10px] italic text-muted-foreground mt-1 line-clamp-1 truncate max-w-[300px]">
                          {product.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No se encontraron productos.</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
