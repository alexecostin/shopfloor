import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, ShoppingBag, Upload, FileText, Building2, Calendar, Package, ChevronRight, Eye, Loader2, Paperclip, X, File, Image } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'

const STATUS_COLORS = {
  planned: 'bg-slate-100 text-slate-600',
  released: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-400',
}
const STATUS_LABELS = {
  planned: 'Planificata', released: 'Lansata', in_progress: 'In productie',
  completed: 'Finalizata', cancelled: 'Anulata',
}
const PRIORITY_COLORS = {
  low: 'text-slate-400', normal: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
}

// ─── Wizard: Comanda Noua ────────────────────────────────────────────────────

function guessDocType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs'].includes(ext)) return 'drawing'
  if (['pdf'].includes(ext)) return 'specification'
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'drawing'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'specification'
  return 'other'
}

function NewOrderWizard({ onClose }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    clientId: '', clientName: '',
    clientContactId: '', clientContactName: '',
    orderNumber: '', notes: '',
    incoterms: '', paymentTerms: '', deliveryAddress: '',
    products: [{ productReference: '', productName: '', quantity: 1, priority: 'normal', deadline: '', unitPrice: '', currency: 'RON' }],
    documents: [], // { file, name, type: 'drawing'|'specification'|'other', description }
  })

  const mutation = useMutation({
    mutationFn: async (data) => {
      const results = []
      for (const prod of data.products) {
        if (!prod.productName) continue
        const res = await api.post('/work-orders', {
          clientId: data.clientId || null,
          clientContactId: data.clientContactId || null,
          orderNumber: data.orderNumber || null,
          productReference: prod.productReference || null,
          productName: prod.productName,
          quantity: Number(prod.quantity) || 1,
          priority: prod.priority || 'normal',
          scheduledEnd: prod.deadline || null,
          notes: data.notes || null,
          unitPrice: prod.unitPrice ? Number(prod.unitPrice) : null,
          currency: prod.currency || 'RON',
          incoterms: data.incoterms || null,
          deliveryAddress: data.deliveryAddress || null,
          paymentTerms: data.paymentTerms || null,
        })
        results.push(res.data)
      }
      // Upload documents and link to first work order
      if (data.documents.length > 0 && results.length > 0) {
        for (const doc of data.documents) {
          try {
            // Create document record
            const docRes = await api.post('/documents', {
              title: doc.name || doc.file.name,
              document_type: doc.type || 'other',
              description: doc.description || '',
              tags: JSON.stringify(['comanda', data.orderNumber || ''].filter(Boolean)),
            })
            const docId = docRes.data?.id
            // Upload file as revision
            if (docId && doc.file) {
              const formData = new FormData()
              formData.append('file', doc.file)
              formData.append('revisionCode', 'A')
              await api.post(`/documents/${docId}/revisions`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              })
            }
            // Link document to work order
            if (docId) {
              for (const wo of results) {
                await api.post(`/documents/${docId}/link`, {
                  entityType: 'work_order', entityId: wo.id, linkType: 'attachment',
                }).catch(() => {})
              }
            }
          } catch (e) {
            console.warn('Document upload failed:', e.message)
          }
        }
      }
      return results
    },
    onSuccess: (results) => {
      qc.invalidateQueries(['work-orders'])
      qc.invalidateQueries(['client-orders'])
      const docCount = form.documents.length
      toast.success(`${results.length} comanda/comenzi create${docCount > 0 ? ` + ${docCount} documente atasate` : ''}!`)
      onClose()
    },
    onError: () => toast.error('Eroare la crearea comenzii. Verificati campurile obligatorii.'),
  })

  function addProduct() {
    setForm(prev => ({
      ...prev,
      products: [...prev.products, { productReference: '', productName: '', quantity: 1, priority: 'normal', deadline: '', unitPrice: '', currency: 'RON' }],
    }))
  }

  function updateProduct(index, field, value) {
    setForm(prev => {
      const products = [...prev.products]
      products[index] = { ...products[index], [field]: value }
      return { ...prev, products }
    })
  }

  function removeProduct(index) {
    if (form.products.length <= 1) return
    setForm(prev => ({ ...prev, products: prev.products.filter((_, i) => i !== index) }))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Comanda Noua de la Client</h2>
            <p className="text-xs text-slate-400 mt-0.5">Pas {step} din 4 — {step === 1 ? 'Client' : step === 2 ? 'Produse' : step === 3 ? 'Documente' : 'Confirmare'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-blue-500' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          {/* STEP 1: Client */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                <Building2 size={16} className="inline mr-2" />
                Selecteaza clientul care a trimis comanda si numarul de referinta al comenzii.
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
                <SearchableSelect
                  endpoint="/companies"
                  labelField="name"
                  valueField="id"
                  placeholder="Cauta client dupa nume..."
                  value={form.clientId || null}
                  onChange={(id, item) => setForm(prev => ({ ...prev, clientId: id || '', clientName: item?.name || '' }))}
                  allowCreate={false}
                />
                <p className="text-[11px] text-slate-400 mt-1">Compania care a plasat comanda</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact client</label>
                {form.clientId ? (
                  <SearchableSelect
                    endpoint={`/companies/${form.clientId}/contacts`}
                    labelField="full_name"
                    valueField="id"
                    placeholder="Cauta contact..."
                    value={form.clientContactId || null}
                    onChange={(id, item) => setForm(prev => ({ ...prev, clientContactId: id || '', clientContactName: item?.full_name || '' }))}
                    allowCreate={false}
                  />
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">Selecteaza mai intai clientul pentru a vedea contactele.</p>
                )}
                <p className="text-[11px] text-slate-400 mt-1">Persoana de contact pentru aceasta comanda</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Numar comanda client</label>
                <input
                  className="input"
                  placeholder="Ex: PO-2026-0042, REF-ABC-123"
                  value={form.orderNumber}
                  onChange={e => setForm(prev => ({ ...prev, orderNumber: e.target.value }))}
                />
                <p className="text-[11px] text-slate-400 mt-1">Referinta comenzii din sistemul clientului (optional)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Incoterms</label>
                  <select
                    className="input"
                    value={form.incoterms}
                    onChange={e => setForm(prev => ({ ...prev, incoterms: e.target.value }))}
                  >
                    <option value="">— Selecteaza —</option>
                    <option value="EXW">EXW — Ex Works</option>
                    <option value="FCA">FCA — Free Carrier</option>
                    <option value="CPT">CPT — Carriage Paid To</option>
                    <option value="CIP">CIP — Carriage & Insurance Paid</option>
                    <option value="DAP">DAP — Delivered At Place</option>
                    <option value="DPU">DPU — Delivered At Place Unloaded</option>
                    <option value="DDP">DDP — Delivered Duty Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Conditii plata</label>
                  <input
                    className="input"
                    placeholder="Ex: 30 zile, avans 50%"
                    value={form.paymentTerms}
                    onChange={e => setForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adresa livrare</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Adresa completa de livrare..."
                  value={form.deliveryAddress}
                  onChange={e => setForm(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observatii</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Detalii suplimentare despre comanda..."
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Products */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                <Package size={16} className="inline mr-2" />
                Adauga produsele din comanda. Pentru fiecare produs, specifica referinta, cantitatea si termenul de livrare.
              </div>

              {form.products.map((prod, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-700">Produs #{i + 1}</span>
                    {form.products.length > 1 && (
                      <button onClick={() => removeProduct(i)} className="text-xs text-red-500 hover:text-red-700">Sterge</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Referinta produs</label>
                      <input className="input" placeholder="Ex: ARBORE-S42" value={prod.productReference}
                        onChange={e => updateProduct(i, 'productReference', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Denumire produs *</label>
                      <input className="input" placeholder="Ex: Arbore motor S42" value={prod.productName}
                        onChange={e => updateProduct(i, 'productName', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Cantitate *</label>
                      <input type="number" className="input" min={1} value={prod.quantity}
                        onChange={e => updateProduct(i, 'quantity', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Prioritate</label>
                      <select className="input" value={prod.priority}
                        onChange={e => updateProduct(i, 'priority', e.target.value)}>
                        <option value="low">Scazuta</option>
                        <option value="normal">Normala</option>
                        <option value="high">Ridicata</option>
                        <option value="urgent">Urgenta</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Termen livrare</label>
                      <input type="date" className="input" value={prod.deadline}
                        onChange={e => updateProduct(i, 'deadline', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Pret unitar de vanzare</label>
                      <input type="number" className="input" min={0} step="0.01" placeholder="0.00"
                        value={prod.unitPrice}
                        onChange={e => updateProduct(i, 'unitPrice', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
                      <select className="input" value={prod.currency}
                        onChange={e => updateProduct(i, 'currency', e.target.value)}>
                        <option value="RON">RON</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addProduct}
                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                + Adauga alt produs in comanda
              </button>
            </div>
          )}

          {/* STEP 3: Documents */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                <Paperclip size={16} className="inline mr-2" />
                Ataseaza documentele tehnice primite de la client: desene tehnice, specificatii, PDF-uri, fisiere CAD.
                Acestea vor fi disponibile pentru inginerul tehnolog cand defineste procesul de fabricatie.
              </div>

              {/* Upload area */}
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('doc-upload-input').click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-50') }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50') }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
                  const files = Array.from(e.dataTransfer.files)
                  const newDocs = files.map(f => ({ file: f, name: f.name, type: guessDocType(f.name), description: '' }))
                  setForm(prev => ({ ...prev, documents: [...prev.documents, ...newDocs] }))
                }}
              >
                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 font-medium">Trage fisierele aici sau click pentru a selecta</p>
                <p className="text-xs text-slate-400 mt-1">PDF, DWG, DXF, STEP, IGES, JPG, PNG, Excel</p>
                <input
                  id="doc-upload-input"
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                  onChange={e => {
                    const files = Array.from(e.target.files)
                    const newDocs = files.map(f => ({ file: f, name: f.name, type: guessDocType(f.name), description: '' }))
                    setForm(prev => ({ ...prev, documents: [...prev.documents, ...newDocs] }))
                    e.target.value = ''
                  }}
                />
              </div>

              {/* Document list */}
              {form.documents.length > 0 && (
                <div className="space-y-2">
                  {form.documents.map((doc, i) => (
                    <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex-shrink-0 mt-1">
                        {doc.file?.type?.startsWith('image/') ? <Image size={20} className="text-green-500" /> : <File size={20} className="text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700 truncate">{doc.name}</span>
                          <span className="text-[10px] text-slate-400">{doc.file ? (doc.file.size / 1024).toFixed(0) + ' KB' : ''}</span>
                        </div>
                        <div className="flex gap-2">
                          <select
                            className="input text-xs py-1 w-40"
                            value={doc.type}
                            onChange={e => {
                              const docs = [...form.documents]
                              docs[i] = { ...docs[i], type: e.target.value }
                              setForm(prev => ({ ...prev, documents: docs }))
                            }}
                          >
                            <option value="drawing">Desen tehnic</option>
                            <option value="specification">Specificatie</option>
                            <option value="certificate">Certificat</option>
                            <option value="report">Raport</option>
                            <option value="manual">Manual</option>
                            <option value="other">Altul</option>
                          </select>
                          <input
                            className="input text-xs py-1 flex-1"
                            placeholder="Descriere scurta (optional)"
                            value={doc.description}
                            onChange={e => {
                              const docs = [...form.documents]
                              docs[i] = { ...docs[i], description: e.target.value }
                              setForm(prev => ({ ...prev, documents: docs }))
                            }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => setForm(prev => ({ ...prev, documents: prev.documents.filter((_, idx) => idx !== i) }))}
                        className="text-slate-400 hover:text-red-500 flex-shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {form.documents.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-4">
                  Niciun document atasat. Poti adauga documente si mai tarziu.
                </p>
              )}
            </div>
          )}

          {/* STEP 4: Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-4 text-sm text-green-700">
                Verifica datele si confirma comanda. Dupa confirmare, comanda va fi vizibila pentru inginerul tehnolog.
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Client:</span>
                  <span className="font-medium text-slate-800">{form.clientName || 'Neselectat'}</span>
                </div>
                {form.clientContactName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-medium text-slate-800">{form.clientContactName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Referinta comanda:</span>
                  <span className="font-medium text-slate-800">{form.orderNumber || '—'}</span>
                </div>
                {form.incoterms && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Incoterms:</span>
                    <span className="font-medium text-slate-800">{form.incoterms}</span>
                  </div>
                )}
                {form.paymentTerms && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Conditii plata:</span>
                    <span className="font-medium text-slate-800">{form.paymentTerms}</span>
                  </div>
                )}
                {form.deliveryAddress && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Adresa livrare:</span>
                    <span className="font-medium text-slate-800 text-right max-w-xs">{form.deliveryAddress}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Produse:</span>
                  <span className="font-medium text-slate-800">{form.products.filter(p => p.productName).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Documente atasate:</span>
                  <span className="font-medium text-slate-800">{form.documents.length} fisiere</span>
                </div>
              </div>

              <div className="space-y-2">
                {form.products.filter(p => p.productName).map((prod, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{prod.productReference || '—'}</span>
                      <span className="text-slate-500 ml-2">{prod.productName}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-blue-600">{prod.quantity} buc</span>
                      {prod.unitPrice && <span className="text-green-600 text-xs ml-2">{prod.unitPrice} {prod.currency}</span>}
                      {prod.deadline && <span className="text-slate-400 text-xs ml-2">→ {prod.deadline}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
          >
            {step === 1 ? 'Anuleaza' : 'Inapoi'}
          </button>
          <div className="flex gap-2">
            {step < 4 && (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !form.clientId && !form.clientName}
                className="btn-primary"
              >
                Urmatorul pas
              </button>
            )}
            {step === 4 && (
              <button
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending || form.products.filter(p => p.productName).length === 0}
                className="btn-primary"
              >
                {mutation.isPending ? 'Se creeaza...' : 'Confirma comanda'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Order Detail ────────────────────────────────────────────────────────────

function OrderDetail({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{order.work_order_number || order.order_number}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Produs</p>
              <p className="font-medium text-slate-800">{order.product_reference || '—'}</p>
              <p className="text-sm text-slate-500">{order.product_name}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Cantitate</p>
              <p className="font-medium text-slate-800 text-lg">{order.quantity} buc</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Prioritate</p>
              <p className={`font-medium ${PRIORITY_COLORS[order.priority]}`}>{order.priority}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Status</p>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Termen</p>
              <p className="font-medium text-slate-800">
                {order.scheduled_end ? new Date(order.scheduled_end).toLocaleDateString('ro-RO') : '—'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Data creare</p>
              <p className="font-medium text-slate-800">
                {order.created_at ? new Date(order.created_at).toLocaleDateString('ro-RO') : '—'}
              </p>
            </div>
          </div>
          {order.notes && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Observatii</p>
              <p className="text-sm text-slate-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientOrdersPage() {
  const { user } = useAuth()
  const [showWizard, setShowWizard] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['client-orders', statusFilter, search],
    queryFn: () => api.get('/work-orders', { params: { status: statusFilter || undefined, search: search || undefined } }).then(r => r.data),
  })

  const orders = data?.data || []

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-blue-500" />
      <span className="ml-2 text-slate-500">Se incarca comenzile...</span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Comenzi Clienti</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestioneaza comenzile primite de la clienti</p>
        </div>
        <button onClick={() => setShowWizard(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Comanda Noua
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="input w-64"
          placeholder="Cauta dupa produs, referinta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Toate statusurile</option>
          <option value="planned">Planificata</option>
          <option value="released">Lansata</option>
          <option value="in_progress">In productie</option>
          <option value="completed">Finalizata</option>
          <option value="cancelled">Anulata</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total comenzi', value: orders.length, color: 'blue' },
          { label: 'In productie', value: orders.filter(o => o.status === 'in_progress').length, color: 'amber' },
          { label: 'Finalizate', value: orders.filter(o => o.status === 'completed').length, color: 'green' },
          { label: 'Urgente', value: orders.filter(o => o.priority === 'urgent' || o.priority === 'high').length, color: 'red' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Comanda</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Cantitate</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Prioritate</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Termen</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-blue-600">{o.work_order_number || o.order_number}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{o.product_reference || '—'}</div>
                  <div className="text-xs text-slate-400">{o.product_name}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-medium">{o.quantity} buc</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs font-medium ${PRIORITY_COLORS[o.priority]}`}>{o.priority}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[o.status]}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                  {o.scheduled_end ? new Date(o.scheduled_end).toLocaleDateString('ro-RO') : '—'}
                </td>
                <td className="px-4 py-3"><ChevronRight size={14} className="text-slate-300" /></td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <ShoppingBag size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Nicio comanda</p>
                  <p className="text-slate-400 text-sm mt-1">Apasa "Comanda Noua" pentru a inregistra prima comanda de la client.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showWizard && <NewOrderWizard onClose={() => setShowWizard(false)} />}
      {selectedOrder && <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  )
}
