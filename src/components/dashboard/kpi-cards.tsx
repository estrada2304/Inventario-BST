'use client';

import { DollarSign, Users, TrendingUp, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Order, Product } from '@/lib/types';
import * as React from 'react';

export function KPICards() {
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products } = useCollection<Product>(productsQuery);

  const ordersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'orders') : null),
    [firestore]
  );
  const { data: orders } = useCollection<Order>(ordersQuery);

  const { totalRevenueUsd, totalRevenueVes } = React.useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return { totalRevenueUsd: 0, totalRevenueVes: 0 };
    }
    return orders
      .filter((order) => order.status === 'Completed')
      .reduce(
        (acc, order) => {
          if (order.currency === 'USD') {
            acc.totalRevenueUsd += order.amount || 0;
          } else if (order.currency === 'VES') {
            acc.totalRevenueVes += order.amount || 0;
          }
          return acc;
        },
        { totalRevenueUsd: 0, totalRevenueVes: 0 }
      );
  }, [orders]);

  const totalSales =
    Array.isArray(orders) ? orders.filter((order) => order.status === 'Completed').length : 0;

  const { topSellingProduct, mostProfitableProduct } = React.useMemo(() => {
    if (!orders || !products || !Array.isArray(orders) || !Array.isArray(products)) {
      return { topSellingProduct: null, mostProfitableProduct: null };
    }

    const productSales: { [productId: string]: number } = {};
    orders.forEach((order) => {
      if (order.status === 'Completed' && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          productSales[item.productId] =
            (productSales[item.productId] || 0) + item.quantity;
        });
      }
    });

    let topProduct: { name: string; quantity: number } | null = null;
    if (Object.keys(productSales).length > 0) {
      const topProductId = Object.keys(productSales).reduce((a, b) =>
        productSales[a] > productSales[b] ? a : b
      );
      const product = products.find((p) => p.id === topProductId);
      if (product) {
        topProduct = {
          name: product.name,
          quantity: productSales[topProductId],
        };
      }
    }

    let profitableProduct: { name: string; profit: number } | null = null;
    const productProfits: { [productId: string]: { name: string; profit: number } } = {};

    Object.entries(productSales).forEach(([productId, quantity]) => {
      const product = products.find((p) => p.id === productId);
      // Using CIF as fallback for profit since DDP is removed
      if (
        product &&
        typeof product.retailPrice === 'number' &&
        typeof product.cif === 'number'
      ) {
        const profitPerUnit = product.retailPrice - product.cif;
        const totalProfit = profitPerUnit * quantity;
        if (totalProfit > 0) {
            productProfits[productId] = { name: product.name, profit: totalProfit };
        }
      }
    });

    if (Object.keys(productProfits).length > 0) {
      const profitableProductId = Object.keys(productProfits).reduce((a, b) =>
        productProfits[a].profit > productProfits[b].profit ? a : b
      );
      profitableProduct = productProfits[profitableProductId];
    }

    return { topSellingProduct: topProduct, mostProfitableProduct: profitableProduct };
  }, [orders, products]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalRevenueUsd.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
            })}
          </div>
          <div className="text-md font-semibold text-muted-foreground">
            {totalRevenueVes.toLocaleString('es-VE', {
              style: 'currency',
              currency: 'VES',
            })}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Basado en pedidos completados
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ventas</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+{totalSales}</div>
          <p className="text-xs text-muted-foreground">
            Total de pedidos completados
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Producto Más Vendido
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold truncate"
            title={topSellingProduct?.name || 'N/A'}
          >
            {topSellingProduct?.name || 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            {topSellingProduct
              ? `${topSellingProduct.quantity} unidades vendidas`
              : 'No hay datos de ventas'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Mayor Rentabilidad
          </CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold truncate"
            title={mostProfitableProduct?.name || 'N/A'}
          >
            {mostProfitableProduct?.name || 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            {mostProfitableProduct
              ? `+${mostProfitableProduct.profit.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })} de ganancia (base CIF)`
              : 'No hay datos de rentabilidad'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
