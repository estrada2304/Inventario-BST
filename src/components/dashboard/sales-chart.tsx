'use client';

import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Order, Product } from '@/lib/types';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, User, Package, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

function DateRangePicker({ date, setDate, className }: { date: DateRange | undefined; setDate: (date: DateRange | undefined) => void; className?: string; }) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
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

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
};

export function SalesOverview() {
    const [mounted, setMounted] = React.useState(false);
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: addDays(new Date(), -30),
        to: new Date(),
    });

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'orders') : null), [firestore]);
    const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

    const productsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);

    const { chartData, topCustomers, topProducts, topSalespeople } = React.useMemo(() => {
        if (!orders || !Array.isArray(orders) || !date?.from || !date?.to) {
          return { chartData: [], topCustomers: [], topProducts: [], topSalespeople: [] };
        }
        
        const parseOrderDate = (dateStr: string | undefined): Date | null => {
          if (!dateStr) return null;
          try {
            const cleanStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
            const d = new Date(cleanStr);
            return isNaN(d.getTime()) ? null : d;
          } catch {
            return null;
          }
        };

        const filteredOrders = orders.filter(order => {
          const orderDate = parseOrderDate(order?.date);
          if (!orderDate) return false;
          return isWithinInterval(orderDate, { start: date.from!, end: date.to! }) && order.status === 'Completed';
        });

        // Sales by day
        const salesByDay = filteredOrders.reduce((acc, order) => {
            const orderDate = parseOrderDate(order.date);
            if (!orderDate) return acc;
            const day = format(orderDate, 'yyyy-MM-dd');
            const amountUsd = order.currency === 'USD' ? (order.amount || 0) : 0; 
            acc[day] = (acc[day] || 0) + amountUsd;
            return acc;
        }, {} as Record<string, number>);

        const newChartData = Object.entries(salesByDay).map(([dateStr, total]) => {
            const parsed = parseOrderDate(dateStr) || new Date();
            return {
              date: format(parsed, 'dd MMM', { locale: es }),
              total
            };
        }).sort((a, b) => a.date.localeCompare(b.date));

        // Top customers
        const customerSales = filteredOrders.reduce((acc, order) => {
            const amountUsd = order.currency === 'USD' ? (order.amount || 0) : 0;
            const custName = order.customer?.name || 'Cliente General';
            acc[custName] = (acc[custName] || 0) + amountUsd;
            return acc;
        }, {} as Record<string, number>);

        const newTopCustomers = Object.entries(customerSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, total], index) => ({ id: `customer-${index}-${name}`, name, total }));

        // Top products
        const productSales = filteredOrders.reduce((acc, order) => {
            if (Array.isArray(order.items)) {
              order.items.forEach(item => {
                  if (item?.productId) {
                    acc[item.productId] = (acc[item.productId] || 0) + (item.quantity || 0);
                  }
              });
            }
            return acc;
        }, {} as Record<string, number>);

        const newTopProducts = Object.entries(productSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([productId, quantity], index) => {
                const product = Array.isArray(products) ? products.find(p => p.id === productId) : null;
                return { id: productId || `product-${index}`, name: product?.name || 'Producto Desconocido', quantity };
            });

        // Top salespeople (New!)
        const salespersonSales = filteredOrders.reduce((acc, order) => {
            const sellerName = order.createdByName || 'Sin Asignar';
            const amountUsd = order.currency === 'USD' ? order.amount : 0;
            acc[sellerName] = (acc[sellerName] || 0) + amountUsd;
            return acc;
        }, {} as Record<string, number>);

        const newTopSalespeople = Object.entries(salespersonSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, total], index) => ({ id: `seller-${index}-${name}`, name, total }));

        return { 
          chartData: newChartData, 
          topCustomers: newTopCustomers, 
          topProducts: newTopProducts,
          topSalespeople: newTopSalespeople 
        };
    }, [orders, products, date]);

    const isLoading = ordersLoading || productsLoading;

  return (
    <Card className="col-span-4">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <CardTitle>Visión General de Ventas</CardTitle>
                <CardDescription>Un resumen de ventas, clientes, productos y vendedores.</CardDescription>
            </div>
            <div className='w-full sm:w-auto min-w-[280px]'>
                <DateRangePicker date={date} setDate={setDate} />
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {!mounted || isLoading ? (
            <Skeleton className="w-full h-[350px]" />
        ) : (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} cursor={{fill: 'hsl(var(--muted))'}}/>
            <Legend />
            <Bar dataKey="total" name="Ventas (USD)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
        )}
        <div className="grid gap-8 md:grid-cols-3">
            <div>
                <h3 className="text-sm font-semibold flex items-center mb-4"><User className='mr-2 h-4 w-4 text-primary'/> Top Clientes</h3>
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : topCustomers.length > 0 ? (
                    <div className="space-y-4">
                        {topCustomers.map((customer, index) => (
                            <div key={customer.id || `${customer.name}-${index}`} className="flex items-center">
                                <Avatar className="h-7 w-7">
                                    <AvatarFallback className="text-[10px]">{customer.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="ml-3 space-y-0.5">
                                    <p className="text-xs font-medium leading-none truncate max-w-[120px]" title={customer.name}>{customer.name}</p>
                                </div>
                                <div className="ml-auto text-xs font-medium">{formatCurrency(customer.total)}</div>
                            </div>
                        ))}
                    </div>
                ) : <p className='text-xs text-muted-foreground'>No hay datos.</p>}
            </div>
            <div>
                <h3 className="text-sm font-semibold flex items-center mb-4"><Package className='mr-2 h-4 w-4 text-primary'/> Top Productos</h3>
                 {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : topProducts.length > 0 ? (
                    <div className="space-y-4">
                        {topProducts.map((product, index) => (
                            <div key={product.id || `${product.name}-${index}`} className="flex items-center">
                                <Avatar className="h-7 w-7 rounded-md bg-muted">
                                    <Package className="h-4 w-4 text-muted-foreground m-1.5"/>
                                </Avatar>
                                <div className="ml-3 space-y-0.5">
                                    <p className="text-xs font-medium leading-none truncate max-w-[120px]" title={product.name}>{product.name}</p>
                                </div>
                                <div className="ml-auto text-xs font-medium">{product.quantity} uds.</div>
                            </div>
                        ))}
                    </div>
                 ) : <p className='text-xs text-muted-foreground'>No hay datos.</p>}
            </div>
            <div>
                <h3 className="text-sm font-semibold flex items-center mb-4"><Trophy className='mr-2 h-4 w-4 text-yellow-500'/> Top Vendedores</h3>
                 {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : topSalespeople.length > 0 ? (
                    <div className="space-y-4">
                        {topSalespeople.map((seller, index) => (
                            <div key={seller.id || `${seller.name}-${index}`} className="flex items-center">
                                <Avatar className="h-7 w-7">
                                    <AvatarFallback className="text-[10px] bg-secondary/20">{seller.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="ml-3 space-y-0.5">
                                    <p className="text-xs font-medium leading-none truncate max-w-[120px]" title={seller.name}>{seller.name}</p>
                                </div>
                                <div className="ml-auto text-xs font-medium">{formatCurrency(seller.total)}</div>
                            </div>
                        ))}
                    </div>
                 ) : <p className='text-xs text-muted-foreground'>No hay datos.</p>}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
