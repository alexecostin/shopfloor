import { Download } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function ExportButton({ endpoint, params = {}, label = 'Export PDF', filename = 'raport.pdf' }) {
  async function handleExport() {
    try {
      const res = await api.get(endpoint, { params, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export generat.')
    } catch (err) {
      if (err.response?.status === 501) toast('Functionalitate in dezvoltare', { icon: '\uD83D\uDD27' })
      else toast.error('Eroare la export.')
    }
  }
  return (
    <button onClick={handleExport} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 rounded-lg px-3 py-1.5">
      <Download size={13} /> {label}
    </button>
  )
}
