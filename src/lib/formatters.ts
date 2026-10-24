export const DEFAULT_BCV_RATE = 40.5; // Tasa de cambio por defecto en Bs/USD

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatVES(amountUSD: number, bcvRate: number = DEFAULT_BCV_RATE): string {
  const amountVES = amountUSD * bcvRate;
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
  }).format(amountVES || 0);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-VE').format(num || 0);
}
