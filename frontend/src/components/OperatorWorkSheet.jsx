import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Wrench,
  AlertTriangle,
  FileText,
  StopCircle,
  BookOpen,
  RefreshCw,
  Package,
  Settings,
  Cpu,
  Droplets,
} from 'lucide-react'
import api from '../api/client'

function ProgressBar({ percent }) {
  const color =
    percent >= 100
      ? 'bg-green-500'
      : percent >= 75
        ? 'bg-blue-500'
        : percent >= 50
          ? 'bg-yellow-400'
          : 'bg-slate-400'
  return (
    <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
      <div
        className={`h-4 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-5 mb-2">
      <Icon size={14} />
      {children}
    </h4>
  )
}

function NoWorkMessage({ message }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
      <Package size={40} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm text-slate-500 font-medium">{message}</p>
      <p className="text-xs text-slate-400 mt-1">Contacteaza seful de tura.</p>
    </div>
  )
}

export default function OperatorWorkSheet({ machineId }) {
  const navigate = useNavigate()

  const {
    data: sheet,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['operator-worksheet', machineId],
    queryFn: () =>
      api.get(`/dashboard/operator-worksheet?machineId=${machineId}`).then((r) => r.data),
    enabled: !!machineId,
    refetchInterval: 60 * 1000, // refresh every minute
    staleTime: 30 * 1000,
  })

  if (!machineId) {
    return <NoWorkMessage message="Selecteaza o masina din meniul de sus." />
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <RefreshCw size={24} className="mx-auto text-slate-300 animate-spin mb-2" />
        <p className="text-sm text-slate-400">Se incarca fisa de lucru...</p>
      </div>
    )
  }

  if (!sheet || !sheet.hasWork) {
    return (
      <NoWorkMessage
        message={sheet?.message || 'Nicio operatie planificata azi pe aceasta masina.'}
      />
    )
  }

  const { machine, order, product, operation, quantities, shift } = sheet

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base">FISA DE LUCRU</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            {machine?.code} — {machine?.name}
            {shift && <span className="ml-2">| Tura: {shift}</span>}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-slate-400 hover:text-white transition-colors"
          title="Reincarca"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="p-4 space-y-1">
        {/* Order & Product */}
        {order && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="text-xs text-blue-500 font-semibold uppercase">Comanda</div>
            <div className="text-sm font-bold text-blue-800">
              {order.orderNumber}
              {order.clientName && (
                <span className="font-normal text-blue-600"> — {order.clientName}</span>
              )}
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="text-xs text-slate-500 font-semibold uppercase">Piesa</div>
          <div className="text-sm font-bold text-slate-800">
            {product?.reference}
            {product?.name && (
              <span className="font-normal text-slate-600"> — {product.name}</span>
            )}
          </div>
        </div>

        {operation && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-xs text-slate-500 font-semibold uppercase">Operatia</div>
            <div className="text-sm font-bold text-slate-800">
              {operation.name}
              {operation.type && (
                <span className="font-normal text-slate-500"> ({operation.type})</span>
              )}
              {operation.sequence && (
                <span className="text-xs text-slate-400 ml-2">
                  Secventa #{operation.sequence}
                </span>
              )}
            </div>
            {(operation.cycleTimeSeconds || operation.setupTimeMinutes) && (
              <div className="text-xs text-slate-400 mt-1 flex gap-3">
                {operation.cycleTimeSeconds && (
                  <span>Ciclu: {operation.cycleTimeSeconds}s</span>
                )}
                {operation.setupTimeMinutes && (
                  <span>Setup: {operation.setupTimeMinutes} min</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quantities & Progress */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div>
              <div className="text-lg font-bold text-slate-800">{quantities.total}</div>
              <div className="text-xs text-slate-500">De fabricat</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">{quantities.produced}</div>
              <div className="text-xs text-slate-500">Fabricate</div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-600">{quantities.remaining}</div>
              <div className="text-xs text-slate-500">Ramas</div>
            </div>
          </div>
          <ProgressBar percent={quantities.progressPercent} />
          <div className="text-center text-xs text-slate-500 mt-1.5">
            {quantities.progressPercent}% completat
            {quantities.scrapped > 0 && (
              <span className="text-red-500 ml-2">({quantities.scrapped} rebuturi)</span>
            )}
          </div>
        </div>

        {/* CNC Program */}
        {operation?.cncProgram && (
          <>
            <SectionTitle icon={Cpu}>Program CNC</SectionTitle>
            <div className="bg-slate-900 text-green-400 rounded-lg px-4 py-2.5 font-mono text-sm">
              {operation.cncProgram}
            </div>
          </>
        )}

        {/* Raw Material */}
        {operation?.rawMaterialSpec && (
          <>
            <SectionTitle icon={Package}>Semifabricat</SectionTitle>
            <div className="bg-slate-50 rounded-lg px-4 py-2.5 text-sm text-slate-700 border border-slate-100">
              {operation.rawMaterialSpec}
            </div>
          </>
        )}

        {/* Tools Config */}
        {operation?.toolsConfig?.length > 0 && (
          <>
            <SectionTitle icon={Wrench}>Scule</SectionTitle>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="text-left px-3 py-2 font-semibold">Pozitie</th>
                    <th className="text-left px-3 py-2 font-semibold">Scula</th>
                    <th className="text-left px-3 py-2 font-semibold">Detalii</th>
                  </tr>
                </thead>
                <tbody>
                  {operation.toolsConfig.map((tool, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {tool.position || i + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{tool.name || tool.code}</td>
                      <td className="px-3 py-2 text-slate-500">{tool.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Machine Parameters */}
        {operation?.machineParameters?.length > 0 && (
          <>
            <SectionTitle icon={Settings}>Parametri Masina</SectionTitle>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="text-left px-3 py-2 font-semibold">Parametru</th>
                    <th className="text-left px-3 py-2 font-semibold">Valoare</th>
                    <th className="text-left px-3 py-2 font-semibold">Unitate</th>
                  </tr>
                </thead>
                <tbody>
                  {operation.machineParameters.map((param, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{param.name}</td>
                      <td className="px-3 py-2 text-slate-700">{param.value}</td>
                      <td className="px-3 py-2 text-slate-500">{param.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Consumables */}
        {operation?.consumables?.length > 0 && (
          <>
            <SectionTitle icon={Droplets}>Consumabile</SectionTitle>
            <ul className="space-y-1">
              {operation.consumables.map((item, i) => (
                <li
                  key={i}
                  className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700 border border-slate-100"
                >
                  {typeof item === 'string' ? item : item.name || item.description}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Attention Points */}
        {operation?.attentionPoints?.length > 0 && (
          <>
            <SectionTitle icon={AlertTriangle}>Puncte de Atentie</SectionTitle>
            <div className="space-y-1.5">
              {operation.attentionPoints.map((point, i) => (
                <div
                  key={i}
                  className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 flex items-start gap-2"
                >
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  {typeof point === 'string' ? point : point.text || point.description}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-5 pt-4 border-t border-slate-200">
          <button
            onClick={() => navigate('/production')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white text-sm font-medium py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText size={16} />
            Raporteaza
          </button>
          <button
            onClick={() => navigate('/production')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium py-3 rounded-lg hover:bg-red-700 transition-colors"
          >
            <StopCircle size={16} />
            Oprire masina
          </button>
          <button
            onClick={() => navigate('/work-instructions')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-600 text-white text-sm font-medium py-3 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <BookOpen size={16} />
            Instructiuni
          </button>
        </div>
      </div>
    </div>
  )
}
