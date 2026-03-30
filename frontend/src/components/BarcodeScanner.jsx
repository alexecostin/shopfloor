import { useState, useRef, useEffect } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Camera, X, Keyboard } from 'lucide-react'

export default function BarcodeScanner({ onScan, onClose, mode = 'input' }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (mode === 'input' && inputRef.current) inputRef.current.focus()
  }, [mode])

  async function handleSubmit(scannedValue) {
    const v = scannedValue || value
    if (!v.trim()) return
    try {
      const { data } = await api.get(`/barcodes/lookup/${encodeURIComponent(v.trim())}`)
      onScan(data)
      setValue('')
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Cod necunoscut: ' + v)
      } else {
        toast.error('Eroare la scanare')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            {mode === 'camera' ? <Camera size={18} /> : <Keyboard size={18} />}
            Scanare cod
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {mode === 'camera' && (
          <div className="bg-slate-100 rounded-lg p-8 text-center mb-4">
            <Camera size={48} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Camera QR scanner necesita libraria html5-qrcode.</p>
            <p className="text-xs text-slate-400 mt-1">Foloseste modul Input pentru scanare cu scanner bluetooth.</p>
          </div>
        )}

        <div className="space-y-3">
          <input
            ref={inputRef}
            className="input text-center font-mono text-lg"
            placeholder="Scaneaza sau introdu codul..."
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            autoFocus
          />
          <button onClick={() => handleSubmit()} disabled={!value.trim()} className="btn-primary w-full">
            Cauta
          </button>
        </div>
      </div>
    </div>
  )
}
