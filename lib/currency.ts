// lib/currency.ts
export const formatINR = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(typeof value === 'string' ? Number(value) : value);
