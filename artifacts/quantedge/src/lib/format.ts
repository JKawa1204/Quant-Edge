export function formatCurrency(value: number | undefined | null) {
  if (value === undefined || value === null) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentage(value: number | undefined | null) {
  if (value === undefined || value === null) return '0.00%';
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatNumber(value: number | undefined | null) {
  if (value === undefined || value === null) return '0';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function getColorForValue(value: number | undefined | null) {
  if (!value) return 'text-muted-foreground';
  if (value > 0) return 'text-chart-1';
  if (value < 0) return 'text-destructive';
  return 'text-muted-foreground';
}
