import api from '../api/client'

let rateCache = {}

export async function getRate(from, to) {
  const key = `${from}_${to}`
  if (rateCache[key]) return rateCache[key]
  try {
    const { data } = await api.get(`/currencies/exchange-rates/latest?from=${from}`)
    const found = data.find(r => r.to_currency === to)
    if (found) { rateCache[key] = parseFloat(found.rate); return rateCache[key] }
  } catch {}
  return null
}

export function convertDisplay(amount, fromCurrency, toCurrency, rate) {
  if (!rate || fromCurrency === toCurrency) return null
  return { amount: amount * rate, currency: toCurrency }
}

export function formatMoney(amount, currency = 'RON') {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
}
