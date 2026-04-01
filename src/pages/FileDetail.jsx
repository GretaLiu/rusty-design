import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import FileIcon from '../components/FileIcon'
import { Pin, ExternalLink, RotateCcw, Archive, Printer, ChevronLeft, ChevronRight } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const STATUS_CLS = {
  active:   'text-emerald-700 bg-emerald-50 border-emerald-200',
  complete: 'text-amber-700  bg-amber-50  border-amber-200',
  void:     'text-red-500    bg-red-50    border-red-200',
}

export default function FileDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // List of file ids passed from the file list for prev/next navigation
  const fileIds = location.state?.fileIds ?? null
  const currentIndex = fileIds ? fileIds.indexOf(id) : -1

  const goToFile = (newId) => navigate(`/home/files/${newId}`, { state: { fileIds } })

  const [file, setFile] = useState(null)
  const [log, setLog] = useState([])
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pdfError, setPdfError] = useState(null)
  const [lightbox, setLightbox] = useState(false)
  const [excelSheets, setExcelSheets] = useState(null)
  const [activeSheet, setActiveSheet] = useState(null)
  const [excelError, setExcelError] = useState(null)
  const [excelLoading, setExcelLoading] = useState(false)

  useEffect(() => {
    setPageNumber(1)
    setPdfError(null)
    setNumPages(null)
    setExcelSheets(null)
    setActiveSheet(null)
    setExcelError(null)
    fetchAll()
  }, [id])

  const fetchAll = async () => {
    const { data: f } = await supabase
      .from('files')
      .select(`id, filename, file_type, file_url, status, pinned, created_at, message_id,
        created_by_user:users!files_created_by_fkey(display_name, avatar_url),
        message:messages(id, title)`)
      .eq('id', id)
      .single()
    setFile(f)

    const { data: l } = await supabase
      .from('activity_log')
      .select(`id, action, created_at,
        performed_by_user:users!activity_log_performed_by_fkey(display_name, avatar_url)`)
      .eq('entity_type', 'file')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
    setLog(l || [])
  }

  const loadExcel = async (url) => {
    setExcelLoading(true)
    setExcelError(null)
    try {
      const res = await fetch(url)
      const buf = await res.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheets = {}
      wb.SheetNames.forEach(name => {
        sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
      })
      setExcelSheets(sheets)
      setActiveSheet(wb.SheetNames[0])
    } catch (e) {
      setExcelError(e?.message || String(e))
    } finally {
      setExcelLoading(false)
    }
  }

  const updateStatus = async (status) => {
    const update = { status }
    if (status === 'complete' || status === 'void') update.folder_id = null
    await supabase.from('files').update(update).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: id, action: status, performed_by: user.id
    })
    fetchAll()
  }

  const togglePin = async () => {
    await supabase.from('files').update({ pinned: !file.pinned }).eq('id', id)
    await supabase.from('activity_log').insert({
      entity_type: 'file', entity_id: id,
      action: file.pinned ? 'unpinned' : 'pinned', performed_by: user.id
    })
    fetchAll()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const path = file.file_url.split('/files/')[1]
    await supabase.storage.from('files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    navigate(file.message_id ? `/home/messages/${file.message_id}` : '/home/files')
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })

  const isImage = (type) => ['JPG', 'JPEG', 'PNG', 'WEBP'].includes(type?.toUpperCase())

  const handlePrint = () => {
    window.print()
  }

  if (!file) return null

  return (
    <div className="max-w-[640px] mx-auto px-6 py-6">
      <style>{`
        @media print {
          body > * { display: none !important; }
          body > * .print-preview { display: block !important; }
          #root { display: block !important; }
          #root > * { display: none !important; }
          .print-preview {
            display: block !important;
            position: fixed !important;
            inset: 0 !important;
            padding: 24px !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
            z-index: 9999 !important;
          }
          .print-preview * { visibility: visible !important; }
          .print-preview button { display: none !important; }
        }
      `}</style>

      {/* Back + prev/next navigation */}
      <div className="relative flex items-center justify-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="absolute left-0 text-sm text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 transition-colors"
        >
          ← Back
        </button>
        {fileIds && fileIds.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToFile(fileIds[currentIndex - 1])}
              disabled={currentIndex <= 0}
              title="Previous file"
              className={`flex items-center justify-center w-7 h-7 border rounded-md cursor-pointer bg-white transition-colors ${
                currentIndex <= 0
                  ? 'border-gray-100 text-gray-200 cursor-not-allowed'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-gray-400 tabular-nums px-1">
              {currentIndex + 1} / {fileIds.length}
            </span>
            <button
              onClick={() => goToFile(fileIds[currentIndex + 1])}
              disabled={currentIndex >= fileIds.length - 1}
              title="Next file"
              className={`flex items-center justify-center w-7 h-7 border rounded-md cursor-pointer bg-white transition-colors ${
                currentIndex >= fileIds.length - 1
                  ? 'border-gray-100 text-gray-200 cursor-not-allowed'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* File info card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 relative">

        {/* Pin button — top right corner */}
        {file.status !== 'void' && (
          <button
            onClick={togglePin}
            title={file.pinned ? 'Unpin' : 'Pin'}
            className={`absolute top-4 right-4 p-1.5 rounded-md border transition-colors cursor-pointer ${
              file.pinned
                ? 'bg-amber-50 border-amber-300 text-amber-500 hover:bg-amber-100'
                : 'bg-transparent border-gray-200 text-gray-300 hover:text-amber-400 hover:border-amber-200 hover:bg-amber-50'
            }`}
          >
            <Pin size={13} strokeWidth={2} />
          </button>
        )}

        {/* Icon + name + status */}
        <div className="flex items-start gap-4 mb-5 pr-10">
          <FileIcon type={file.file_type} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1.5">
              <span className={`text-base font-semibold leading-snug break-words ${
                file.status === 'void' ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}>
                {file.filename}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATUS_CLS[file.status]}`}>
                {file.status === 'complete' ? 'archived' : file.status}
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">{file.file_type}</span>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-5 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Uploaded by</span>
            <img src={file.created_by_user?.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
            <span className="font-medium text-gray-700">{file.created_by_user?.display_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">On</span>
            <span className="text-gray-600">{formatDate(file.created_at)}</span>
          </div>
        </div>

        {/* From ticket */}
        {file.message && (
          <div className="mb-4 pb-4 border-b border-gray-100 text-xs">
            <span className="text-gray-400">From ticket: </span>
            <button
              onClick={() => navigate(`/home/messages/${file.message.id}`)}
              className="text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0 transition-colors"
            >
              {file.message.title}
            </button>
          </div>
        )}

        {/* Actions */}
        {file.status !== 'void' && (
          <div className="flex items-center gap-2 flex-wrap">
            {(isImage(file.file_type) || file.file_type?.toUpperCase() === 'PDF') && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md border-none cursor-pointer hover:bg-gray-700 transition-colors font-medium"
              >
                <Printer size={12} /> Print
              </button>
            )}
            <a
              href={file.file_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-md no-underline hover:bg-gray-50 transition-colors font-medium"
            >
              <ExternalLink size={12} /> Open file
            </a>
            {file.status === 'active' && (
              <button
                onClick={() => updateStatus('complete')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md cursor-pointer hover:bg-amber-100 transition-colors"
              >
                <Archive size={11} /> Archive
              </button>
            )}
            {file.status === 'complete' && (
              <button
                onClick={() => updateStatus('active')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <RotateCcw size={11} /> Unarchive
              </button>
            )}
            <button
              onClick={() => updateStatus('void')}
              className="text-xs px-3 py-1.5 bg-white border border-red-200 text-red-400 rounded-md cursor-pointer hover:bg-red-50 transition-colors ml-auto"
            >
              Void
            </button>
          </div>
        )}
      </div>

      {/* Image preview */}
      {file.status !== 'void' && isImage(file.file_type) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 print-preview">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide m-0">Preview</h3>
          </div>
          <div
            className="bg-gray-50 rounded-lg overflow-hidden cursor-zoom-in flex items-center justify-center max-h-80"
            onClick={() => setLightbox(true)}
          >
            <img
              src={file.file_url}
              alt={file.filename}
              className="max-w-full max-h-80 object-contain block rounded"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Click to expand</p>
        </div>
      )}

      {/* Excel preview */}
      {file.status !== 'void' && ['XLS', 'XLSX'].includes(file.file_type?.toUpperCase()) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide m-0">Preview</h3>
            {!excelSheets && !excelLoading && !excelError && (
              <button
                onClick={() => loadExcel(file.file_url)}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md border-none cursor-pointer hover:bg-gray-700 transition-colors font-medium"
              >
                Load preview
              </button>
            )}
          </div>

          {!excelSheets && !excelLoading && !excelError && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-400">Click "Load preview" to parse this spreadsheet</p>
            </div>
          )}

          {excelLoading && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-400">Loading spreadsheet…</p>
            </div>
          )}

          {excelError && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-sm text-red-400">Failed to load: {excelError}</p>
            </div>
          )}

          {excelSheets && activeSheet && (
            <>
              {Object.keys(excelSheets).length > 1 && (
                <div className="flex gap-1 mb-3 flex-wrap">
                  {Object.keys(excelSheets).map(name => (
                    <button
                      key={name}
                      onClick={() => setActiveSheet(name)}
                      className={`text-xs px-2.5 py-1 rounded-md border cursor-pointer transition-colors ${
                        activeSheet === name
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <div className="bg-gray-50 rounded-lg overflow-auto" style={{ maxHeight: '480px' }}>
                <table className="text-xs border-collapse w-full">
                  <tbody>
                    {excelSheets[activeSheet].map((row, ri) => (
                      <tr key={ri} className={ri === 0 ? 'bg-gray-100' : 'hover:bg-white'}>
                        {row.map((cell, ci) => (
                          ri === 0
                            ? <th key={ci} className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap sticky top-0 bg-gray-100">{cell}</th>
                            : <td key={ci} className="border border-gray-200 px-2 py-1.5 text-gray-600 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* PDF preview */}
      {file.status !== 'void' && file.file_type?.toUpperCase() === 'PDF' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 print-preview">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide m-0">Preview</h3>
            {numPages && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                  className={`px-2 py-1 text-sm border border-gray-200 rounded cursor-pointer bg-white transition-colors ${
                    pageNumber <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >‹</button>
                <span className="text-xs text-gray-500 tabular-nums">{pageNumber} / {numPages}</span>
                <button
                  onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                  disabled={pageNumber >= numPages}
                  className={`px-2 py-1 text-sm border border-gray-200 rounded cursor-pointer bg-white transition-colors ${
                    pageNumber >= numPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >›</button>
              </div>
            )}
          </div>

          {pdfError ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <FileIcon type="PDF" size="md" />
              <p className="text-sm text-gray-500 mt-3 mb-3">Preview unavailable</p>
              <a
                href={file.file_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md no-underline hover:bg-gray-700 transition-colors"
              >
                <ExternalLink size={12} /> Open file
              </a>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg overflow-auto flex justify-center p-4">
              <Document
                file={file.file_url}
                onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPdfError(null) }}
                onLoadError={(err) => setPdfError(err?.message || String(err))}
                onSourceError={(err) => setPdfError(err?.message || String(err))}
                loading={
                  <div className="py-8 text-sm text-gray-400">Loading PDF…</div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={560}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[1000] cursor-zoom-out p-6"
        >
          <img
            src={file.file_url}
            alt={file.filename}
            className="max-w-full max-h-[90vh] object-contain rounded"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="fixed top-4 right-5 bg-transparent border-none text-white text-2xl cursor-pointer leading-none hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Activity log */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 mt-0">
          Activity
        </h3>
        {log.length === 0 && <p className="text-sm text-gray-400">No activity</p>}
        <div className="space-y-2">
          {log.map(entry => (
            <div key={entry.id} className="flex items-center gap-2">
              <img
                src={entry.performed_by_user?.avatar_url} alt=""
                className="w-5 h-5 rounded-full object-cover shrink-0"
              />
              <span className="flex-1 text-xs text-gray-600">
                <span className="font-medium text-gray-800">{entry.performed_by_user?.display_name}</span>
                {' '}{entry.action} this file
              </span>
              <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                {formatDate(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-12 border-t border-red-100 pt-6">
        <h3 className="text-xs font-semibold text-red-500 mb-1 mt-0">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-4">
          Permanently delete this file from storage and all records. This cannot be undone.
        </p>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-xs px-3.5 py-1.5 bg-white text-red-400 border border-red-200 rounded-md cursor-pointer hover:bg-red-50 transition-colors"
          >
            Delete this file
          </button>
        ) : (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <p className="text-xs text-gray-600 mb-2.5">
              Type <code className="font-mono bg-white px-1 py-0.5 rounded border border-red-100">{file.filename}</code> to confirm:
            </p>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={file.filename}
              className="w-full px-2.5 py-1.5 border border-red-200 rounded-md text-sm mb-2.5 bg-white focus:outline-none box-border"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== file.filename}
                className={`text-xs px-3.5 py-1.5 bg-red-500 text-white border-none rounded-md cursor-pointer hover:bg-red-600 transition-colors ${
                  deleting || deleteConfirmText !== file.filename ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {deleting ? 'Deleting…' : 'I understand, delete permanently'}
              </button>
              <button
                onClick={() => { setShowDelete(false); setDeleteConfirmText('') }}
                className="text-xs px-3.5 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
