import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import BarcodeScanner from './BarcodeScanner'

export default function BarcodeScanButton({ onResult, className = '' }) {
  const [open, setOpen] = useState(false)

  function handleScan(result) {
    setOpen(false)
    if (onResult) onResult(result)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 border border-slate-200 rounded-lg px-3 py-1.5 ${className}`}>
        <ScanLine size={14} /> Scan
      </button>
      {open && <BarcodeScanner onScan={handleScan} onClose={() => setOpen(false)} />}
    </>
  )
}
