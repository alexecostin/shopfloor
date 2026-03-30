// File: frontend/src/components/ResponsiveTable.jsx
import { Loader2 } from 'lucide-react'

export default function ResponsiveTable({ columns, rows = [], onRowClick, emptyText = 'Nu exista date.', loading, keyField = 'id', mobileCard, actions }) {
  const visibleColumns = columns.filter(c => !c.mobileHide)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Se incarca...
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
        {emptyText}
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-medium text-slate-600 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr
                key={row[keyField]}
                className={`hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''} ${col.tdClassName || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet card stack */}
      <div className="lg:hidden space-y-2">
        {rows.map(row => (
          <div
            key={row[keyField]}
            className={`bg-white rounded-xl border border-slate-200 p-4 ${onRowClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {mobileCard ? mobileCard(row) : (
              <div className="space-y-1.5">
                {/* First column as title */}
                <div className="font-medium text-slate-800 text-sm">
                  {visibleColumns[0]?.render ? visibleColumns[0].render(row) : row[visibleColumns[0]?.key]}
                </div>
                {/* Rest as label: value */}
                {visibleColumns.slice(1).map(col => (
                  <div key={col.key} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{col.label}</span>
                    <span className={`text-slate-700 ${col.align === 'right' ? '' : ''}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </span>
                  </div>
                ))}
                {actions && (
                  <div className="pt-2 flex justify-end" onClick={e => e.stopPropagation()}>
                    {actions(row)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
