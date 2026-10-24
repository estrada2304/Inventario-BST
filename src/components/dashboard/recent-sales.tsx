'use client';

import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Order, Product, Client } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';


function DateRangePicker({ date, setDate, className }: { date: DateRange | undefined; setDate: (date: DateRange | undefined) => void; className?: string; }) {
    return (
      <div className={cn('grid gap-2', className)}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date-analytics"
              variant={'outline'}
              className={cn('w-full sm:w-[280px] justify-start text-left font-normal', !date && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'LLL dd, y', { locale: es })} -{' '}
                    {format(date.to, 'LLL dd, y', { locale: es })}
                  </>
                ) : (
                  format(date.from, 'LLL dd, y', { locale: es })
                )
              ) : (
                <span>Selecciona un rango</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

function ClientAnalysis() {
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: addDays(new Date(), -30),
        to: new Date(),
    });
    const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);
    const [result, setResult] = React.useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);

    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'orders') : null), [firestore]);
    const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

    const clientsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'clients') : null), [firestore]);
    const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);
    
    const handleAnalyze = () => {
        setIsAnalyzing(true);
        setResult(null);

        if (!orders || !selectedClientId || !date?.from || !date?.to) {
            setResult("Por favor, selecciona un cliente y un rango de fechas.");
            setIsAnalyzing(false);
            return;
        }

        const filteredOrders = orders.filter(order => {
            if (!order || order.status !== 'Completed' || !order.customer?.id || !order.date) return false;
            try {
              const orderDate = new Date(order.date.includes('T') ? order.date : order.date + 'T00:00:00');
              return order.customer.id === selectedClientId && isWithinInterval(orderDate, { start: date.from!, end: date.to! });
            } catch {
              return false;
            }
        });

        if (filteredOrders.length === 0) {
            const clientName = clients?.find(c => c.id === selectedClientId)?.name || 'El cliente';
            setResult(`${clientName} no tiene compras en el rango de fechas seleccionado.`);
            setIsAnalyzing(false);
            return;
        }

        const productSales = filteredOrders.reduce((acc, order) => {
            if (Array.isArray(order.items)) {
              order.items.forEach(item => {
                if (item?.name) {
                  acc[item.name] = (acc[item.name] || 0) + (item.quantity || 0);
                }
              });
            }
            return acc;
        }, {} as Record<string, number>);

        const topProduct = Object.entries(productSales).sort(([,a], [,b]) => b - a)[0];
        
        if (topProduct) {
            setResult(`El producto más comprado es "${topProduct[0]}" con ${topProduct[1]} unidades.`);
        } else {
             setResult(`No se encontraron productos comprados por este cliente en el rango de fechas seleccionado.`);
        }

        setIsAnalyzing(false);
    };

    const isLoading = clientsLoading || ordersLoading;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-2">
                <Select onValueChange={setSelectedClientId} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                        {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <DateRangePicker date={date} setDate={setDate} />
            </div>
            <Button onClick={handleAnalyze} disabled={isLoading || isAnalyzing || !selectedClientId}>
                <Search className="mr-2 h-4 w-4" />
                Analizar Cliente
            </Button>
            {isAnalyzing && <Skeleton className='h-10 w-full'/>}
            {result && <p className='text-sm font-medium p-4 bg-muted rounded-lg'>{result}</p>}
        </div>
    )
}


function ProductAnalysis() {
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: addDays(new Date(), -365),
        to: new Date(),
    });
    const [result, setResult] = React.useState<{top: string, bottom: string} | null>(null);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);

    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'orders') : null), [firestore]);
    const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

    const productsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);

    const handleAnalyze = () => {
        setIsAnalyzing(true);
        setResult(null);

        if (!orders || !products || !date?.from || !date?.to) {
            setResult({top: "Faltan datos para realizar el análisis.", bottom: "Faltan datos para realizar el análisis."});
            setIsAnalyzing(false);
            return;
        }

        const filteredOrders = orders.filter(order => 
            order.status === 'Completed' &&
            isWithinInterval(new Date(order.date + 'T00:00:00'), { start: date.from!, end: date.to! })
        );

        const productSales: Record<string, {name: string, quantity: number}> = {};

        products.forEach(p => {
            productSales[p.id] = { name: p.name, quantity: 0 };
        });

        filteredOrders.forEach(order => {
            order.items.forEach(item => {
                if (productSales[item.productId]) {
                   productSales[item.productId].quantity += item.quantity;
                }
            });
        });
        
        const sortedProducts = Object.values(productSales).sort((a,b) => b.quantity - a.quantity);

        if (sortedProducts.length > 0 && sortedProducts[0].quantity > 0) {
            const topProduct = sortedProducts[0];
            const bottomProduct = sortedProducts.filter(p => p.quantity > 0).pop() || sortedProducts[sortedProducts.length - 1];
            setResult({
                top: `"${topProduct.name}" con ${topProduct.quantity} unidades.`,
                bottom: `"${bottomProduct.name}" con ${bottomProduct.quantity} unidades.`
            });
        } else {
            setResult({top: "No hay ventas en este período.", bottom: "No hay ventas en este período."});
        }

        setIsAnalyzing(false);
    };

     const isLoading = productsLoading || ordersLoading;

    return (
        <div className="space-y-4">
             <div className="flex flex-col sm:flex-row items-center gap-2">
                <DateRangePicker date={date} setDate={setDate} />
                <Button onClick={handleAnalyze} disabled={isLoading || isAnalyzing}>
                    <Search className="mr-2 h-4 w-4" />
                    Analizar Productos
                </Button>
            </div>
             {isAnalyzing ? (
                 <div className="space-y-4 pt-4">
                     <Skeleton className='h-12 w-full' />
                     <Skeleton className='h-12 w-full' />
                 </div>
             ) : result && (
                <div className='space-y-2 pt-4'>
                    <div className="flex items-start p-4 bg-muted rounded-lg">
                        <TrendingUp className="h-5 w-5 mr-3 mt-1 text-green-500 flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold">Producto Más Vendido</h4>
                            <p className="text-sm text-muted-foreground">{result.top}</p>
                        </div>
                    </div>
                     <div className="flex items-start p-4 bg-muted rounded-lg">
                        <TrendingDown className="h-5 w-5 mr-3 mt-1 text-red-500 flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold">Producto Menos Vendido</h4>
                            <p className="text-sm text-muted-foreground">{result.bottom}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export function AdvancedAnalytics() {
  return (
    <Card className="col-span-4 lg:col-span-3">
      <CardHeader>
        <CardTitle>Análisis Avanzado</CardTitle>
        <CardDescription>Filtra por cliente o producto para obtener información detallada.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="products">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">Por Producto</TabsTrigger>
            <TabsTrigger value="clients">Por Cliente</TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="pt-4">
            <ProductAnalysis />
          </TabsContent>
          <TabsContent value="clients" className="pt-4">
            <ClientAnalysis />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
