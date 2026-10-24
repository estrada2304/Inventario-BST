'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Rocket, TrendingUp, TrendingDown, User, Package, Trophy } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Order, Product, Client } from '@/lib/types';

interface AnalysisResult {
    mostSoldProduct: { name: string; quantity: number };
    leastSoldProduct: { name: string; quantity: number };
    topClient: { name: string; totalSpent: number };
    topClientFavoriteProduct: { name: string; quantity: number };
    topSalesPerson: { name: string; totalSales: number };
}

export function GeneralReport() {
    const [result, setResult] = React.useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'orders') : null), [firestore]);
    const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

    const productsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'products') : null), [firestore]);
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);

    const clientsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'clients') : null), [firestore]);
    const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);
    
    const handleAnalyze = () => {
        setIsAnalyzing(true);
        setResult(null);

        if (!orders || !products || !clients) {
            setIsAnalyzing(false);
            return;
        }

        const completedOrders = orders.filter(o => o.status === 'Completed');
        if (completedOrders.length === 0) {
            setIsAnalyzing(false);
            return;
        }

        // 1. & 2. Most and least sold product
        const productSales: Record<string, { name: string; quantity: number }> = {};
        if (Array.isArray(products)) {
          products.forEach(p => {
            if (p?.id) productSales[p.id] = { name: p.name || 'Producto', quantity: 0 };
          });
        }
        completedOrders.forEach(order => {
          if (Array.isArray(order?.items)) {
            order.items.forEach(item => {
              if (item?.productId && productSales[item.productId]) {
                productSales[item.productId].quantity += (item.quantity || 0);
              }
            });
          }
        });
        
        const soldProducts = Object.values(productSales).filter(p => p.quantity > 0);
        
        const mostSoldProduct = soldProducts.length > 0 
            ? soldProducts.reduce((max, p) => p.quantity > max.quantity ? p : max, soldProducts[0])
            : { name: 'N/A', quantity: 0 };

        const leastSoldProduct = soldProducts.length > 0
            ? soldProducts.reduce((min, p) => p.quantity < min.quantity ? p : min, soldProducts[0])
            : { name: 'N/A', quantity: 0 };

        // 3. Top Client
        const clientSpending: Record<string, { name: string; totalSpent: number }> = {};
        if (Array.isArray(clients)) {
          clients.forEach(c => {
            if (c?.id) clientSpending[c.id] = { name: c.name || 'Cliente', totalSpent: 0 };
          });
        }

        completedOrders.forEach(order => {
            const customerId = order.customer?.id;
            if (customerId && clientSpending[customerId]) {
                const amountUsd = order.currency === 'USD' ? (order.amount || 0) : ((order.amount || 0) / 40); // Rough conversion if VES
                clientSpending[customerId].totalSpent += amountUsd;
            }
        });
        
        const topClientId = Object.keys(clientSpending).length > 0
            ? Object.keys(clientSpending).reduce((a, b) => clientSpending[a].totalSpent > clientSpending[b].totalSpent ? a : b)
            : null;
        const topClient = topClientId ? clientSpending[topClientId] : { name: 'N/A', totalSpent: 0 };
        
        // 4. Top client's favorite product
        let topClientFavoriteProduct = { name: 'N/A', quantity: 0 };
        if (topClientId) {
            const topClientOrders = completedOrders.filter(o => o.customer?.id === topClientId);
            const topClientProductSales: Record<string, number> = {};
            topClientOrders.forEach(order => {
                if (Array.isArray(order.items)) {
                  order.items.forEach(item => {
                    if (item?.productId) {
                      topClientProductSales[item.productId] = (topClientProductSales[item.productId] || 0) + (item.quantity || 0);
                    }
                  });
                }
            });

            const favoriteProductId = Object.keys(topClientProductSales).length > 0
                ? Object.keys(topClientProductSales).reduce((a, b) => topClientProductSales[a] > topClientProductSales[b] ? a : b)
                : null;
            
            const favoriteProduct = (favoriteProductId && Array.isArray(products)) ? products.find(p => p.id === favoriteProductId) : null;
            topClientFavoriteProduct = { 
                name: favoriteProduct?.name || 'N/A', 
                quantity: favoriteProductId ? topClientProductSales[favoriteProductId] : 0 
            };
        }

        // 5. Líder de Ventas (Salesperson)
        const salespersonPerformance: Record<string, number> = {};
        completedOrders.forEach(order => {
            const seller = order.createdByName || 'Sin Asignar';
            const amountUsd = order.currency === 'USD' ? order.amount : (order.amount / 40);
            salespersonPerformance[seller] = (salespersonPerformance[seller] || 0) + amountUsd;
        });

        const topSellerName = Object.keys(salespersonPerformance).length > 0
            ? Object.keys(salespersonPerformance).reduce((a, b) => salespersonPerformance[a] > salespersonPerformance[b] ? a : b)
            : 'N/A';

        setResult({
            mostSoldProduct,
            leastSoldProduct,
            topClient,
            topClientFavoriteProduct,
            topSalesPerson: { name: topSellerName, totalSales: salespersonPerformance[topSellerName] || 0 }
        });

        setIsAnalyzing(false);
    };

    const isLoading = ordersLoading || productsLoading || clientsLoading;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                <Rocket className="h-6 w-6 text-primary" />
                <div>
                    <CardTitle>Reporte General de Desempeño</CardTitle>
                    <CardDescription>
                    Obtén una visión general del rendimiento de tus productos, clientes y vendedores.
                    </CardDescription>
                </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="ml-2 text-muted-foreground">Cargando datos...</p>
                    </div>
                ) : result ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center"><Package className="w-5 h-5 mr-2 text-primary" />Rendimiento de Ventas</h3>
                             <div className="flex items-start p-3 bg-muted/50 rounded-lg">
                                <TrendingUp className="h-5 w-5 mr-3 mt-1 text-green-500 flex-shrink-0" />
                                <div>
                                    <h4 className="font-medium">Producto Más Vendido</h4>
                                    <p className="text-sm text-muted-foreground">{result.mostSoldProduct.name} ({result.mostSoldProduct.quantity} unidades)</p>
                                </div>
                            </div>
                             <div className="flex items-start p-3 bg-muted/50 rounded-lg">
                                <Trophy className="h-5 w-5 mr-3 mt-1 text-yellow-500 flex-shrink-0" />
                                <div>
                                    <h4 className="font-medium">Líder de Ventas</h4>
                                    <p className="text-sm text-muted-foreground">{result.topSalesPerson.name} (Total: ${result.topSalesPerson.totalSales.toFixed(2)})</p>
                                </div>
                            </div>
                             <div className="flex items-start p-3 bg-muted/50 rounded-lg">
                                <TrendingDown className="h-5 w-5 mr-3 mt-1 text-red-500 flex-shrink-0" />
                                <div>
                                    <h4 className="font-medium">Producto Menos Vendido</h4>
                                    <p className="text-sm text-muted-foreground">{result.leastSoldProduct.name} ({result.leastSoldProduct.quantity} unidades)</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center"><User className="w-5 h-5 mr-2 text-primary" />Rendimiento de Clientes</h3>
                             <div className="flex items-start p-3 bg-muted/50 rounded-lg">
                                <User className="h-5 w-5 mr-3 mt-1 text-amber-500 flex-shrink-0" />
                                <div>
                                    <h4 className="font-medium">Cliente Más Valioso</h4>
                                    <p className="text-sm text-muted-foreground">{result.topClient.name} (aprox. ${result.topClient.totalSpent.toFixed(2)})</p>
                                </div>
                            </div>
                             <div className="flex items-start p-3 bg-muted/50 rounded-lg">
                                <Package className="h-5 w-5 mr-3 mt-1 text-blue-500 flex-shrink-0" />
                                <div>
                                    <h4 className="font-medium">Producto Favorito del Top Cliente</h4>
                                    <p className="text-sm text-muted-foreground">{result.topClientFavoriteProduct.name} ({result.topClientFavoriteProduct.quantity} unidades)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                     <div className="text-center py-8 text-muted-foreground">
                        <p>Haz clic en el botón para generar el reporte de desempeño general.</p>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleAnalyze} disabled={isLoading || isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    'Generar Reporte General'
                  )}
                </Button>
            </CardFooter>
        </Card>
    );
}
