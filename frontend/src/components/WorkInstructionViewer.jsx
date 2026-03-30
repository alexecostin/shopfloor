import { X, AlertTriangle, Info, AlertOctagon } from 'lucide-react'

const SEVERITY_STYLES = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
}

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
}

const SEVERITY_LABELS = {
  info: 'Info',
  warning: 'Avertisment',
  critical: 'Critic',
}

function isPdf(url) {
  return url && url.toLowerCase().endsWith('.pdf')
}

export default function WorkInstructionViewer({ instruction, onClose }) {
  if (!instruction) return null

  const params = typeof instruction.parameters === 'string' ? JSON.parse(instruction.parameters) : (instruction.parameters || [])
  const attentionPoints = typeof instruction.attention_points === 'string' ? JSON.parse(instruction.attention_points) : (instruction.attention_points || [])
  const tolerances = typeof instruction.tolerances === 'string' ? JSON.parse(instruction.tolerances) : (instruction.tolerances || [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 text-lg">{instruction.title}</h3>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
              v{instruction.revision || 1}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Drawing */}
          {instruction.drawing_url && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Desen tehnic</h4>
              {isPdf(instruction.drawing_url) ? (
                <iframe
                  src={instruction.drawing_url}
                  className="w-full h-80 border border-slate-200 rounded-lg"
                  title="Desen tehnic"
                />
              ) : (
                <img
                  src={instruction.drawing_url}
                  alt="Desen tehnic"
                  className="max-w-full max-h-80 rounded-lg border border-slate-200 object-contain"
                />
              )}
            </div>
          )}

          {/* Parameters */}
          {params.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Parametri</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-1 pr-4">Parametru</th>
                    <th className="pb-1 pr-4">Valoare</th>
                    <th className="pb-1">Unitate</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-4 font-medium text-slate-700">{p.name}</td>
                      <td className="py-1.5 pr-4 text-slate-800">{p.value}</td>
                      <td className="py-1.5 text-slate-500">{p.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Attention Points */}
          {attentionPoints.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Puncte de atentie</h4>
              <div className="space-y-2">
                {attentionPoints.map((a, i) => {
                  const Icon = SEVERITY_ICONS[a.severity] || Info
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-3 rounded-lg border ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info}`}
                    >
                      <Icon size={16} className="mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-xs font-semibold uppercase mr-2">{SEVERITY_LABELS[a.severity] || 'Info'}</span>
                        <span className="text-sm">{a.text}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tolerances */}
          {tolerances.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Tolerante</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-1 pr-4">Cota</th>
                    <th className="pb-1 pr-4">Nominal</th>
                    <th className="pb-1 pr-4">Min</th>
                    <th className="pb-1 pr-4">Max</th>
                    <th className="pb-1">UM</th>
                  </tr>
                </thead>
                <tbody>
                  {tolerances.map((t, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-4 font-medium text-slate-700">{t.characteristic}</td>
                      <td className="py-1.5 pr-4 text-slate-800">{t.nominal}</td>
                      <td className="py-1.5 pr-4 text-slate-600">{t.lower}</td>
                      <td className="py-1.5 pr-4 text-slate-600">{t.upper}</td>
                      <td className="py-1.5 text-slate-500">{t.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Video */}
          {instruction.video_url && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Video</h4>
              {instruction.video_url.includes('youtube') || instruction.video_url.includes('vimeo') ? (
                <iframe
                  src={instruction.video_url}
                  className="w-full h-56 rounded-lg border border-slate-200"
                  allowFullScreen
                  title="Video instructiune"
                />
              ) : (
                <a
                  href={instruction.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Deschide video
                </a>
              )}
            </div>
          )}

          {/* Notes */}
          {instruction.notes && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Note</h4>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">
                {instruction.notes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="btn-primary">
            Am inteles, inchide
          </button>
        </div>
      </div>
    </div>
  )
}
