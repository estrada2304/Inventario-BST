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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Client, Quote, Product } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, AlertTriangle, Search, Package } from 'lucide-react';
import { format } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const IVA_RATE = 0.16; // 16%
const IGTF_RATE = 0.03; // 3%

const DEFAULT_TERMS = `Vigencia: Esta cotización es válida por 30 días continuos.
Moneda: Precios expresados en USD. Pagos en Bs. sujetos a la tasa oficial BCV del día.
Disponibilidad: Sujeta a inventario al momento de la confirmación de la compra.
Entrega: Los tiempos de entrega se confirmarán tras la recepción del pago/orden de compra.`;

const DEFAULT_PAYMENT = `Transferencia Bancaria:
Banco: [Nombre del Banco]
Cuenta: [0000-0000-00-0000000000]
RIF: [J-00000000-0]
A nombre de: Byte Services Telecom`;

const quoteItemSchema = z.object({
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
  status: z.enum(['Draft', 'Sent', 'Accepted', 'Rejected', 'Cancelled']),
  currency: z.enum(['USD', 'VES'], { required_error: 'Debe seleccionar una moneda.' }),
  applyIgtf: z.boolean().default(false),
  items: z.array(quoteItemSchema).min(1, "Debe añadir al menos un producto a la cotización."),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  paymentMethods: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof formSchema>;

interface QuoteFormProps {
  quote?: Quote;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export function QuoteForm({ quote, onSaveSuccess, onCancel }: QuoteFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showStockWarning, setShowStockWarning] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isProductSearchOpen, setIsProductSearchOpen] = React.useState(false);
  const [activeProductIndex, setActiveProductIndex] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [productSearchQuery, setProductSearchQuery] = React.useState('');
  const [pendingValues, setPendingValues] = React.useState<QuoteFormValues | null>(null);
  
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
      customerId: quote?.customer.id && !quote.customer.id.startsWith('manual') ? quote.customer.id : '',
      isManualClient: quote?.customer.id?.startsWith('manual') || false,
      manualName: quote?.customer.id?.startsWith('manual') ? quote.customer.name : '',
      manualTaxId: quote?.customer.id?.startsWith('manual') ? quote.customer.taxId : '',
      manualAddress: quote?.customer.id?.startsWith('manual') ? quote.customer.address : '',
      status: quote?.status || 'Draft',
      currency: quote?.currency || 'USD',
      applyIgtf: quote?.applyIgtf || false,
      items: quote?.items || [],
      notes: quote?.notes || '',
      internalNotes: quote?.internalNotes || '',
      termsAndConditions: quote?.termsAndConditions || DEFAULT_TERMS,
      paymentMethods: quote?.paymentMethods || DEFAULT_PAYMENT,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = useWatch({ control: form.control, name: 'items' });
  const watchCurrency = form.watch('currency');
  const watchApplyIgtf = form.watch('applyIgtf');
  const isManualClient = form.watch('isManualClient');

  const { subtotal, ivaAmount, igtfAmount, totalAmount } = React.useMemo(() => {
    const sub = (watchItems || []).reduce((acc: number, item: any) => {
        return acc + (Number(item?.price) || 0) * (Number(item?.quantity) || 0);
    }, 0);
    
    let iva = 0;
    let igtf = 0;

    if (watchCurrency === 'VES') {
        iva = sub * IVA_RATE;
    } else if (watchCurrency === 'USD' && watchApplyIgtf) {
        igtf = sub * IGTF_RATE;
    }
    
    const total = sub + iva + igtf;
    
    return {
        subtotal: sub,
        ivaAmount: iva,
        igtfAmount: igtf,
        totalAmount: total,
    };
  }, [watchItems, watchCurrency, watchApplyIgtf]);

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

  const processSubmit = async (values: QuoteFormValues) => {
    if (!firestore || !products) {
      toast({ variant: "destructive", title: "Error", description: "Base de datos no disponible." });
      return;
    }
    
    setIsLoading(true);

    let clientData: Quote['customer'];

    if (values.isManualClient) {
        if (!values.manualName || !values.manualTaxId) {
            toast({ variant: "destructive", title: "Datos incompletos", description: "Nombre y RIF son obligatorios para cliente manual." });
            setIsLoading(false);
            return;
        }
        clientData = {
            id: quote?.customer?.id?.startsWith('manual') ? quote.customer.id : `manual-${Date.now()}`,
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
            toast({ variant: "destructive", title: "Seleccione un cliente", description: "Debe elegir un cliente de la lista desplegable." });
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
      const quoteId = quote?.id || doc(collection(firestore, 'quotes')).id;
      const quoteRef = doc(firestore, 'quotes', quoteId);

      let quoteNumber = quote?.quoteNumber;
      if (!quoteNumber) {
        const nameForInitials = clientData.company || clientData.name;
        let clientInitials = nameForInitials.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
        if (clientInitials.length < 3) {
            clientInitials = clientInitials.padEnd(3, 'X');
        }

        const today = new Date();
        const dateString = format(today, 'ddMMyyyy');
        const todayStringForFilter = format(today, 'yyyy-MM-dd');

        const quotesCollectionRef = collection(firestore, 'quotes');
        const q = query(quotesCollectionRef, where("date", "==", todayStringForFilter));
        const quotesSnapshot = await getDocs(q);
        const dailyCount = quotesSnapshot.size;
        
        const sequentialNumber = String(dailyCount + 1).padStart(4, '0');
        quoteNumber = `${clientInitials}_${dateString}_${sequentialNumber}`;
      }
      
      const newQuoteData: any = {
          id: quoteId,
          quoteNumber: quoteNumber,
          customer: clientData,
          items: values.items.map(item => ({
              ...item,
              description: item.description || ''
          })),
          subtotal,
          ivaAmount,
          applyIgtf: values.applyIgtf,
          igtfAmount,
          amount: totalAmount,
          status: values.status,
          currency: values.currency,
          date: quote?.date || format(new Date(), 'yyyy-MM-dd'),
          notes: values.notes || '',
          internalNotes: values.internalNotes || '',
          termsAndConditions: values.termsAndConditions || DEFAULT_TERMS,
          paymentMethods: values.paymentMethods || DEFAULT_PAYMENT,
          createdByName: quote?.createdByName || user?.displayName || (user?.email ? user.email.split('@')[0] : 'Ventas'),
          createdByEmail: quote?.createdByEmail || user?.email || '',
          userId: quote?.userId || user?.uid || '',
          updatedAt: serverTimestamp(),
          createdAt: quote?.createdAt || serverTimestamp(),
      };

      const currentUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Ventas');
      const nowIso = new Date().toISOString();

      if (values.status === 'Accepted' && (!quote || quote.status !== 'Accepted')) {
        await runTransaction(firestore, async (transaction) => {
          // READ PHASE
          const productQuantities = new Map<string, { name: string; quantity: number }>();
          for (const item of (values.items || [])) {
            if (!item.productId) continue;
            const existing = productQuantities.get(item.productId);
            if (existing) {
              existing.quantity += Number(item.quantity) || 0;
            } else {
              productQuantities.set(item.productId, {
                name: item.name || '',
                quantity: Number(item.quantity) || 0,
              });
            }
          }

          const productUpdates: { ref: any; newStock: number; status: Product['status']; productId: string; prodName: string; serialNumber: string; prevStock: number; qty: number }[] = [];

          for (const [productId, info] of productQuantities.entries()) {
            const productRef = doc(firestore, 'products', productId);
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
              throw `El producto "${info.name}" no fue encontrado en el inventario.`;
            }

            const prodData = productDoc.data();
            const currentStock = Number(prodData.stock) || 0;
            const newStock = currentStock - info.quantity;
            if (newStock < 0) {
              throw `Stock insuficiente para "${info.name}". Stock actual: ${currentStock}, solicitados: ${info.quantity}.`;
            }

            let newProductStatus: Product['status'] = 'In Stock';
            if (newStock <= 0) {
              newProductStatus = 'Out of Stock';
            } else if (newStock <= 5) {
              newProductStatus = 'Low Stock';
            }

            productUpdates.push({
              ref: productRef,
              newStock,
              status: newProductStatus,
              productId,
              prodName: prodData.name || info.name,
              serialNumber: prodData.serialNumber || '',
              prevStock: currentStock,
              qty: info.quantity,
            });
          }

          // WRITE PHASE
          for (const update of productUpdates) {
            transaction.update(update.ref, { stock: update.newStock, status: update.status, updatedAt: serverTimestamp() });

            // Write movement exit
            const movementId = doc(collection(firestore, 'inventoryMovements')).id;
            const movementData = {
              id: movementId,
              productId: update.productId,
              productName: update.prodName,
              serialNumber: update.serialNumber,
              type: 'exit',
              quantity: update.qty,
              delta: -update.qty,
              previousStock: update.prevStock,
              newStock: update.newStock,
              date: nowIso,
              notes: `Cotización Aceptada #${quoteNumber} - Cliente: ${clientData.name}`,
              userName: currentUserName,
              userEmail: user?.email || '',
              createdBy: user?.uid || '',
              createdAt: serverTimestamp(),
            };
            transaction.set(doc(firestore, 'inventoryMovements', movementId), movementData);
            transaction.set(doc(firestore, `products/${update.productId}/inventoryMovements`, movementId), movementData);
          }

          const orderRef = doc(collection(firestore, 'orders'));
          const newOrderData: Record<string, any> = {
            id: orderRef.id,
            orderNumber: `ORD-${quoteNumber}`,
            quoteId: quoteId,
            quoteNumber: quoteNumber,
            customer: clientData,
            items: values.items.map(item => ({
              productId: item.productId || '',
              name: item.name || '',
              description: item.description || '',
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
            })),
            amount: totalAmount,
            status: 'Processing',
            date: format(new Date(), 'yyyy-MM-dd'),
            currency: values.currency,
            notes: `Generada automáticamente desde Cotización ${quoteNumber}. ${values.notes || ''}`.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdByName: user?.displayName || user?.email?.split('@')[0] || 'Sistema',
            createdByEmail: user?.email || '',
          };

          transaction.set(orderRef, newOrderData);
          newQuoteData.orderId = orderRef.id;
          transaction.set(quoteRef, newQuoteData, { merge: true });
        });
      } else if (quote && quote.status === 'Accepted' && values.status !== 'Accepted') {
        await runTransaction(firestore, async (transaction) => {
          // READ PHASE
          const productQuantities = new Map<string, { name: string; quantity: number }>();
          for (const item of (values.items || [])) {
            if (!item.productId) continue;
            const existing = productQuantities.get(item.productId);
            if (existing) {
              existing.quantity += Number(item.quantity) || 0;
            } else {
              productQuantities.set(item.productId, {
                name: item.name || '',
                quantity: Number(item.quantity) || 0,
              });
            }
          }

          const productUpdates: { ref: any; newStock: number; status: Product['status']; productId: string; prodName: string; serialNumber: string; prevStock: number; qty: number }[] = [];

          for (const [productId, info] of productQuantities.entries()) {
            const productRef = doc(firestore, 'products', productId);
            const productDoc = await transaction.get(productRef);
            if (productDoc.exists()) {
              const prodData = productDoc.data();
              const currentStock = Number(prodData.stock) || 0;
              const newStock = currentStock + info.quantity;

              let newProductStatus: Product['status'] = 'In Stock';
              if (newStock > 0 && newStock <= 5) {
                newProductStatus = 'Low Stock';
              } else if (newStock <= 0) {
                newProductStatus = 'Out of Stock';
              }

              productUpdates.push({
                ref: productRef,
                newStock,
                status: newProductStatus,
                productId,
                prodName: prodData.name || info.name,
                serialNumber: prodData.serialNumber || '',
                prevStock: currentStock,
                qty: info.quantity,
              });
            }
          }

          // WRITE PHASE
          for (const update of productUpdates) {
            transaction.update(update.ref, { stock: update.newStock, status: update.status, updatedAt: serverTimestamp() });

            // Write movement entry (reversion)
            const movementId = doc(collection(firestore, 'inventoryMovements')).id;
            const movementData = {
              id: movementId,
              productId: update.productId,
              productName: update.prodName,
              serialNumber: update.serialNumber,
              type: 'entry',
              quantity: update.qty,
              delta: update.qty,
              previousStock: update.prevStock,
              newStock: update.newStock,
              date: nowIso,
              notes: `Reversión por cambio de estado en Cotización #${quoteNumber}`,
              userName: currentUserName,
              userEmail: user?.email || '',
              createdBy: user?.uid || '',
              createdAt: serverTimestamp(),
            };
            transaction.set(doc(firestore, 'inventoryMovements', movementId), movementData);
            transaction.set(doc(firestore, `products/${update.productId}/inventoryMovements`, movementId), movementData);
          }

          if (quote.orderId) {
            transaction.delete(doc(firestore, 'orders', quote.orderId));
            newQuoteData.orderId = null;
          }

          transaction.set(quoteRef, newQuoteData, { merge: true });
        });
      } else {
        await setDoc(quoteRef, newQuoteData, { merge: true });
      }

      toast({
        title: quote ? "Cotización Actualizada" : "Cotización Creada",
        description: `La cotización ${quoteNumber} se ha guardado correctamente.`,
      });
      onSaveSuccess();

    } catch (error: any) {
      console.error("Error saving quote:", error);
      const description = error.message || "No se pudo guardar la cotización.";
      
      if (error?.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: quote ? `quotes/${quote.id}` : 'quotes/new',
            operation: quote ? 'update' : 'create',
            requestResourceData: values
        }));
      } else {
        toast({ variant: "destructive", title: "Error al Guardar", description: description });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (values: QuoteFormValues) => {
    const itemsWithoutStock = values.items.filter(item => {
      const product = products?.find(p => p.id === item.productId);
      return !product || ((product.stock ?? 0) < item.quantity);
    });

    if (itemsWithoutStock.length > 0) {
      setPendingValues(values);
      setShowStockWarning(true);
    } else {
      processSubmit(values);
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
                                  Úsalo para cotizar a clientes rápidos sin registrarlos en la base de datos.
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
                                                <SelectValue placeholder="Elija un cliente registrado..." />
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
                                        <FormLabel>Nombre o Empresa</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Importadora ABC" {...field} />
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
                                            <Input placeholder="Ej: J-00000000-0" {...field} />
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
                                        <Input placeholder="Ej: Calle Principal, Edf. Horizonte..." {...field} />
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
                            <SelectItem value="Draft">Borrador</SelectItem>
                            <SelectItem value="Sent">Enviada</SelectItem>
                            <SelectItem value="Accepted">Aceptada</SelectItem>
                            <SelectItem value="Rejected">Rechazada</SelectItem>
                            <SelectItem value="Cancelled">Cancelada</SelectItem>
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
                      <FormLabel>Moneda de Pago</FormLabel>
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

              <FormField
                control={form.control}
                name="internalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota Interna (Manual)</FormLabel>
                    <FormDescription className="text-[10px]">Nota visible solo en el tablero, no en el PDF.</FormDescription>
                    <FormControl>
                      <Input placeholder="Ej: Cliente solicitó descuento extra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

               {watchCurrency === 'USD' && (
                <FormField
                  control={form.control}
                  name="applyIgtf"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Aplicar IGTF (3%)</FormLabel>
                        <FormDescription>
                          Añade el impuesto a pagos en Dólares.
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
              )}
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas Adicionales</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Incluye instalación básica."
                    className="resize-y"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="termsAndConditions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Términos y Condiciones</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Introduce los términos y condiciones..."
                    className="resize-y min-h-[100px] text-xs"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paymentMethods"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Métodos de Pago</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Introduce los datos bancarios..."
                    className="resize-y min-h-[80px] text-xs"
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
                      control={form.control as any}
                      name={`items.${index}.productId` as any}
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
                                      <SelectValue placeholder="Elegir" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products?.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} (Stock: {p.stock || 0})
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
                      control={form.control as any}
                      name={`items.${index}.price` as any}
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel className="text-xs">Precio</FormLabel>
                           <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
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
                           <FormControl><Input type="number" min="1" {...field} /></FormControl>
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                   <div className="col-span-12 sm:col-span-3 flex items-end gap-2">
                      <div className="w-full space-y-1">
                          <FormLabel className="text-xs">Total</FormLabel>
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
                {typeof form.formState.errors.items?.message === 'string' ? form.formState.errors.items.message : 'Verifique los productos de la cotización.'}
              </p>
             )}
          </div>
          
          <div className="flex items-start justify-between gap-4 pt-4 border-t">
              <div className="w-full max-sm:max-w-full max-w-sm space-y-2 rounded-lg border bg-muted/50 p-4 shadow-inner">
                  <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{watchCurrency === 'USD' ? '$' : 'Bs.'}{subtotal.toFixed(2)}</span>
                  </div>
                  {watchCurrency === 'VES' && (
                      <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IVA ({IVA_RATE * 100}%)</span>
                          <span className="font-medium">Bs.{ivaAmount.toFixed(2)}</span>
                      </div>
                  )}
                  {watchCurrency === 'USD' && watchApplyIgtf && (
                      <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IGTF ({IGTF_RATE * 100}%)</span>
                          <span className="font-medium">${igtfAmount.toFixed(2)}</span>
                      </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between text-xl font-bold text-primary">
                      <span>Total</span>
                      <span>{watchCurrency === 'USD' ? '$' : 'Bs.'}{totalAmount.toFixed(2)}</span>
                  </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                  <Button type="submit" disabled={isLoading || !products} className="w-full h-11">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar Cotización
                  </Button>
                  <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full">
                      Cancelar
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

      <AlertDialog open={showStockWarning} onOpenChange={setShowStockWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <AlertDialogTitle>¡Atención: Stock Insuficiente!</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Has incluido productos que no tienen stock suficiente en el inventario actual:</p>
                <ul className="list-disc list-inside bg-muted p-3 rounded-md text-xs font-mono">
                  {pendingValues?.items.filter(item => {
                    const product = products?.find(p => p.id === item.productId);
                    return !product || ((product.stock ?? 0) < item.quantity);
                  }).map((item, idx) => (
                    <li key={idx}>
                      {item.name}: Solicitado {item.quantity} | Disponible {products?.find(p => p.id === item.productId)?.stock || 0}
                    </li>
                  ))}
                </ul>
                <p>¿Deseas continuar con la creación de esta cotización a pesar de la falta de stock?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingValues(null); setIsLoading(false); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { 
              if (pendingValues) {
                processSubmit(pendingValues);
                setPendingValues(null);
                setShowStockWarning(false);
              }
            }}>
              Continuar de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
