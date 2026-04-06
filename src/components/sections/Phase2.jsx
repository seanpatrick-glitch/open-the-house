// Phase2.jsx — 3 Weeks Out (the most detailed section)

import React, { useState, useEffect, useRef } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

const CHECKLIST = [
  'Check available materials for builds',
  'Begin signage planning',
  'Review concessions and drink inventory',
  'Shape specialty drink ideas using existing stock',
  'Choose showgram or specialty item options',
]

const DEFAULT_SIGNAGE = [
  { id: 'concessions',         label: 'Concessions' },
  { id: 'specialty-cocktails', label: 'Specialty Cocktails' },
  { id: 'merchandise',         label: 'Merchandise' },
  { id: 'keychain-design',     label: 'Key Chain Design' },
  { id: 'button-design',       label: 'Button Design' },
  { id: 'showgram-tags',       label: 'Showgram Tags' },
]

// 'volunteer-bar-guide' is also treated as a default (read-only label, auto-generated)
const DEFAULT_SIGNAGE_IDS = new Set([...DEFAULT_SIGNAGE.map(d => d.id), 'volunteer-bar-guide'])

const STATUS_STAGES = ['Conceptualized', 'Design in Progress', 'Design Complete']

const STATUS_COLORS = {
  'Conceptualized':     'bg-gray-100 text-gray-600 border-gray-300',
  'Design in Progress': 'bg-blue-100 text-blue-700 border-blue-300',
  'Design Complete':    'bg-purple-100 text-purple-700 border-purple-300',
  'Uploaded':           'bg-green-100 text-green-700 border-green-300',
}

// Fixed drink slots: 2 alcoholic, 1 mocktail
const DRINK_SLOTS = [
  { type: 'alcoholic', label: 'Alcoholic' },
  { type: 'alcoholic', label: 'Alcoholic' },
  { type: 'mocktail',  label: 'Mocktail'  },
]

// Migrate old drink data (4 drinks, menuFinalized field) to new schema
function normalizeDrinks(raw) {
  return DRINK_SLOTS.map((slot, i) => {
    const d = raw[i] || {}
    return {
      name:         d.name         || '',
      ingredients:  d.ingredients  || '',
      instructions: d.instructions || '',
      menuVerbiage: d.menuVerbiage || '',
      finalized:    d.finalized ?? d.menuFinalized ?? false,
      drinkType:    slot.type,
    }
  })
}

// ── Reusable helpers ──────────────────────────────────────────────────────────

function Checkbox({ label, checked, onChange, readOnly }) {
  return (
    <label className={`flex items-start gap-3 py-2.5 select-none ${readOnly ? 'cursor-default' : 'cursor-pointer group'}`}>
      <input type="checkbox" checked={checked || false}
        onChange={(e) => !readOnly && onChange(e.target.checked)}
        disabled={readOnly}
        className="mt-0.5 w-5 h-5 accent-amber-500 cursor-pointer flex-shrink-0 disabled:opacity-60" />
      <span className={`text-sm leading-relaxed ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
    </label>
  )
}

function SavedTextArea({ label, fieldPath, initialValue, save, rows = 3, readOnly }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={val} rows={rows} readOnly={readOnly}
        onChange={(e) => { if (!readOnly) { setVal(e.target.value); save(fieldPath, e.target.value) } }}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-y ${
          readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-2 focus:ring-amber-400'
        }`} />
    </div>
  )
}

function SavedInput({ label, fieldPath, initialValue, save, placeholder = '', readOnly }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input value={val} placeholder={placeholder} readOnly={readOnly}
        onChange={(e) => { if (!readOnly) { setVal(e.target.value); save(fieldPath, e.target.value) } }}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none ${
          readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-2 focus:ring-amber-400'
        }`} />
    </div>
  )
}

function Toggle({ label, value, onChange, readOnly }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button onClick={() => !readOnly && onChange(!value)} disabled={readOnly}
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-amber-500' : 'bg-gray-300'} ${readOnly ? 'opacity-60 cursor-default' : ''}`}>
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  )
}

// ── Signage Tracker ───────────────────────────────────────────────────────────

function SignageSection({ showId, signage, onSignageChange, readOnly }) {
  const [uploadingId,      setUploadingId]      = useState(null)
  const [uploadProgress,   setUploadProgress]   = useState(0)
  const [zipping,          setZipping]          = useState(false)
  const [previewUrl,       setPreviewUrl]        = useState(null)
  const fileInputRef    = useRef(null)
  const uploadingRowRef = useRef(null)

  function updateRow(id, updates) {
    if (readOnly) return
    onSignageChange(signage.map(row => row.id === id ? { ...row, ...updates } : row))
  }

  function addRow() {
    if (readOnly) return
    onSignageChange([
      ...signage,
      { id: `custom-${Date.now()}`, label: '', status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' },
    ])
  }

  function triggerUpload(rowId) {
    if (readOnly) return
    uploadingRowRef.current = rowId
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file || !uploadingRowRef.current) return
    const rowId = uploadingRowRef.current

    setUploadingId(rowId)
    setUploadProgress(0)

    const storagePath = `shows/${showId}/signage/${rowId}_${Date.now()}_${file.name}`
    const storageRef  = ref(storage, storagePath)
    const uploadTask  = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (err) => {
        console.error(err)
        toast.error('Upload failed.')
        setUploadingId(null)
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
        updateRow(rowId, {
          status:   'Uploaded',
          fileUrl:  downloadUrl,
          filePath: storagePath,
          fileName: file.name,
          fileType: file.type,
        })
        toast.success(`"${file.name}" uploaded!`)
        setUploadingId(null)
        setUploadProgress(0)
      }
    )
  }

  async function handleDownloadAll() {
    const withFiles = signage.filter(row => row.fileUrl)
    if (withFiles.length === 0) {
      toast.error('No signage files uploaded yet.')
      return
    }
    setZipping(true)
    toast('Preparing ZIP…')
    try {
      const zip = new JSZip()
      await Promise.all(
        withFiles.map(async (row) => {
          const response = await fetch(row.fileUrl)
          const blob     = await response.blob()
          zip.file(row.fileName || `${row.id}.file`, blob)
        })
      )
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, 'signage-files.zip')
      toast.success('ZIP downloaded!')
    } catch (err) {
      console.error(err)
      toast.error('Could not create ZIP.')
    }
    setZipping(false)
  }

  const uploadedCount = signage.filter(r => r.fileUrl).length

  return (
    <div>
      {/* Lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-8 right-0 text-white text-2xl font-bold hover:text-amber-400"
            >
              ✕
            </button>
            <img src={previewUrl} alt="Signage preview"
              className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Signage Tracker</h3>
        {uploadedCount > 0 && (
          <button
            onClick={handleDownloadAll}
            disabled={zipping}
            className="text-xs bg-gray-900 hover:bg-gray-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {zipping ? 'Preparing ZIP…' : `↓ Download All Signage (${uploadedCount})`}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,application/pdf"
      />

      <div className="space-y-2">
        {signage.map((row) => {
          const isDefault   = DEFAULT_SIGNAGE_IDS.has(row.id)
          const isBarGuide  = row.id === 'volunteer-bar-guide'
          const isUploading = uploadingId === row.id
          const isUploaded  = !!row.fileUrl
          const isImage     = row.fileType && row.fileType.startsWith('image/')

          return (
            <div key={row.id} className={`border rounded-xl p-3 bg-white ${isBarGuide ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
              {/* Row controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Label */}
                <div className="w-44 flex-shrink-0">
                  {isDefault || readOnly ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-700">{row.label}</span>
                      {isBarGuide && (
                        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">Auto</span>
                      )}
                    </div>
                  ) : (
                    <input
                      value={row.label}
                      placeholder="Sign name…"
                      onChange={(e) => updateRow(row.id, { label: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  )}
                </div>

                {/* Status stage buttons — not shown for bar guide */}
                {!isBarGuide && (
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUS_STAGES.map((stage) => (
                      <button
                        key={stage}
                        onClick={() => !isUploaded && !readOnly && updateRow(row.id, { status: stage })}
                        disabled={readOnly}
                        className={`text-xs px-3 py-1 rounded-full font-medium border transition-all ${
                          row.status === stage
                            ? STATUS_COLORS[stage]
                            : 'bg-white text-gray-400 border-gray-200'
                        } ${isUploaded || readOnly ? 'opacity-40 cursor-default' : 'cursor-pointer hover:border-gray-300'}`}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                )}

                {/* Upload / Uploaded badge */}
                {isUploaded ? (
                  <span className={`text-xs px-3 py-1 rounded-full font-medium border ${STATUS_COLORS['Uploaded']}`}>
                    ✓ {isBarGuide ? 'Generated' : 'Uploaded'}
                  </span>
                ) : !readOnly && !isBarGuide ? (
                  <button
                    onClick={() => triggerUpload(row.id)}
                    disabled={isUploading}
                    className="text-xs border border-dashed border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-700 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isUploading ? `Uploading ${uploadProgress}%` : '↑ Upload File'}
                  </button>
                ) : isBarGuide && !isUploaded ? (
                  <span className="text-xs text-gray-400 italic">Pending drink finalization…</span>
                ) : null}

                {/* Re-upload button if already uploaded (admin only, not bar guide) */}
                {isUploaded && !readOnly && !isBarGuide && (
                  <button
                    onClick={() => triggerUpload(row.id)}
                    disabled={isUploading}
                    className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
                  >
                    Replace
                  </button>
                )}
              </div>

              {/* File preview */}
              {isUploaded && (
                <div className="mt-3 pl-3 border-l-2 border-green-200">
                  {isImage ? (
                    <div className="flex items-start gap-3">
                      <img
                        src={row.fileUrl}
                        alt={row.fileName}
                        onClick={() => setPreviewUrl(row.fileUrl)}
                        className="max-h-28 max-w-xs rounded-lg border border-gray-200 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        <p className="font-medium text-gray-700">{row.fileName}</p>
                        <p className="mt-0.5 text-gray-400">Click image to enlarge</p>
                        <a href={row.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="text-amber-600 hover:underline mt-1 inline-block">
                          Open full size ↗
                        </a>
                      </div>
                    </div>
                  ) : (
                    <a
                      href={row.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-amber-600 hover:underline flex items-center gap-1.5"
                    >
                      📄 {row.fileName}
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Add row — admin only */}
        {!readOnly && (
          <button
            onClick={addRow}
            className="w-full text-xs text-gray-500 hover:text-amber-700 border border-dashed border-gray-300 hover:border-amber-400 rounded-xl py-2.5 transition-colors"
          >
            + Add Signage Item
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Phase2({ show, save, readOnly }) {
  const checklist   = show.phase2Checklist || {}
  const fields      = show.phase2Fields    || {}
  const showgrams   = show.showgrams       || {}
  const concessions = show.concessions     || {}

  // Normalize drinks to always be exactly 3 with the right shape
  const drinks = normalizeDrinks(show.drinks || [])

  const allFinalized = drinks.every(d => d.finalized)
  const [barGuideGenerating, setBarGuideGenerating] = useState(false)
  const prevAllFinalizedRef = useRef(false)

  // Build signage array — use saved data or fall back to defaults
  const signage = (show.signage && show.signage.length > 0)
    ? show.signage
    : DEFAULT_SIGNAGE.map(d => ({ ...d, status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' }))

  async function saveDirect(field, value) {
    await updateDoc(doc(db, 'shows', show.id), { [field]: value, updatedAt: serverTimestamp() })
  }

  function handleSignageChange(updated) {
    saveDirect('signage', updated)
  }

  function updateDrink(i, key, val) {
    const updated = drinks.map((d, idx) => idx === i ? { ...d, [key]: val } : d)
    saveDirect('drinks', updated)
  }

  function updateShowgrams(key, val) {
    saveDirect('showgrams', { ...showgrams, [key]: val })
  }

  function updateConcessions(key, val) {
    saveDirect('concessions', { ...concessions, [key]: val })
  }

  async function generateBarGuide() {
    if (barGuideGenerating) return
    setBarGuideGenerating(true)
    toast('Generating Volunteer Bar Guide PDF…')

    try {
      const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
      const pageWidth    = 612
      const margin       = 72
      const contentWidth = pageWidth - margin * 2

      // ── Header band ──────────────────────────────────────────────────────
      pdf.setFillColor(180, 83, 9) // amber-800
      pdf.rect(0, 0, pageWidth, 88, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(24)
      pdf.text('Volunteer Bar Guide', margin, 44)

      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'normal')
      pdf.text(show.title || 'Show', margin, 64)

      pdf.setFontSize(9)
      pdf.setTextColor(255, 220, 160)
      pdf.text('For volunteer use only — keep at the bar station during the show', margin, 80)

      // ── Drinks ───────────────────────────────────────────────────────────
      pdf.setTextColor(20, 20, 20)
      let y = 118

      drinks.forEach((drink, i) => {
        const slot      = DRINK_SLOTS[i]
        const drinkName = drink.name || `Drink ${i + 1}`

        // Page break check
        if (y > 680) { pdf.addPage(); y = 60 }

        // Type badge line
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(slot.type === 'mocktail' ? 13 : 88, slot.type === 'mocktail' ? 148 : 28, slot.type === 'mocktail' ? 136 : 148)
        pdf.text(`— ${slot.label.toUpperCase()} —`, margin, y)
        y += 16

        // Drink name
        pdf.setFontSize(18)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(20, 20, 20)
        pdf.text(drinkName, margin, y)
        y += 26

        // Ingredients
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(120, 80, 0)
        pdf.text('INGREDIENTS', margin, y)
        y += 13

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(40, 40, 40)
        const ingLines = pdf.splitTextToSize(drink.ingredients || '—', contentWidth)
        ingLines.forEach(line => {
          if (y > 720) { pdf.addPage(); y = 60 }
          pdf.text(line, margin, y)
          y += 14
        })
        y += 10

        // Instructions
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(120, 80, 0)
        pdf.text('INSTRUCTIONS', margin, y)
        y += 13

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(40, 40, 40)
        const instLines = pdf.splitTextToSize(drink.instructions || '—', contentWidth)
        instLines.forEach(line => {
          if (y > 720) { pdf.addPage(); y = 60 }
          pdf.text(line, margin, y)
          y += 14
        })
        y += 20

        // Divider between drinks
        if (i < drinks.length - 1) {
          if (y > 720) { pdf.addPage(); y = 60 }
          pdf.setDrawColor(210, 210, 210)
          pdf.setLineWidth(0.75)
          pdf.line(margin, y, pageWidth - margin, y)
          y += 28
        }
      })

      // ── Footer ────────────────────────────────────────────────────────────
      const totalPages = pdf.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p)
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(170, 170, 170)
        pdf.text(`${show.title || 'Show'} — Volunteer Bar Guide`, margin, 780)
        pdf.text(`Page ${p} of ${totalPages}`, pageWidth - margin, 780, { align: 'right' })
      }

      const pdfBlob = pdf.output('blob')

      // Upload to Firebase Storage
      const path      = `shows/${show.id}/barguide/volunteer-bar-guide.pdf`
      const fileRef   = ref(storage, path)
      await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' })
      const downloadUrl = await getDownloadURL(fileRef)

      // Add or update the volunteer-bar-guide entry in the signage array
      const existingIdx = signage.findIndex(r => r.id === 'volunteer-bar-guide')
      let updatedSignage
      if (existingIdx >= 0) {
        updatedSignage = signage.map((r, idx) =>
          idx === existingIdx
            ? { ...r, fileUrl: downloadUrl, filePath: path, fileName: 'Volunteer Bar Guide.pdf', fileType: 'application/pdf', status: 'Uploaded' }
            : r
        )
      } else {
        updatedSignage = [
          ...signage,
          {
            id:       'volunteer-bar-guide',
            label:    'Volunteer Bar Guide',
            status:   'Uploaded',
            fileUrl:  downloadUrl,
            filePath: path,
            fileName: 'Volunteer Bar Guide.pdf',
            fileType: 'application/pdf',
          },
        ]
      }
      await saveDirect('signage', updatedSignage)

      toast.success('Bar Guide generated — find it in Signage Tracker!')
    } catch (err) {
      console.error(err)
      toast.error('Could not generate Bar Guide PDF.')
    }

    setBarGuideGenerating(false)
  }

  // Auto-generate when all 3 drinks become finalized for the first time
  useEffect(() => {
    if (allFinalized && !prevAllFinalizedRef.current && !readOnly) {
      generateBarGuide()
    }
    prevAllFinalizedRef.current = allFinalized
  }, [allFinalized]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-7">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">Phase 2</span>
        <h2 className="text-xl font-bold text-gray-900">3 Weeks Out — Resource and Concept Planning</h2>
      </div>

      {/* Checklist */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Checklist</h3>
        <div className="divide-y divide-gray-50">
          {CHECKLIST.map((item, i) => (
            <Checkbox key={i} label={item} checked={checklist[`item${i}`]}
              onChange={(v) => save(`phase2Checklist.item${i}`, v)} readOnly={readOnly} />
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SavedTextArea label="Materials Available" fieldPath="phase2Fields.materialsAvailable" initialValue={fields.materialsAvailable} save={save} readOnly={readOnly} />
        <SavedTextArea label="Materials Needed"    fieldPath="phase2Fields.materialsNeeded"    initialValue={fields.materialsNeeded}    save={save} readOnly={readOnly} />
        <SavedTextArea label="Signage Ideas"       fieldPath="phase2Fields.signageIdeas"       initialValue={fields.signageIdeas}       save={save} readOnly={readOnly} />
      </div>

      {/* Signage Tracker */}
      <SignageSection showId={show.id} signage={signage} onSignageChange={handleSignageChange} readOnly={readOnly} />

      {/* Specialty Drinks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Specialty Drinks</h3>
          {allFinalized ? (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-100 text-green-700 border border-green-300 px-3 py-1 rounded-full font-medium">
                ✓ All Finalized
              </span>
              {!readOnly && (
                <button
                  onClick={generateBarGuide}
                  disabled={barGuideGenerating}
                  className="text-xs bg-amber-700 hover:bg-amber-800 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {barGuideGenerating ? 'Generating…' : '↻ Regenerate Bar Guide'}
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">
              {drinks.filter(d => d.finalized).length}/3 finalized
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5">
          {DRINK_SLOTS.map((slot, i) => {
            const drink = drinks[i]
            return (
              <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Drink {i + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                      slot.type === 'mocktail'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                      {slot.label}
                    </span>
                  </div>
                  {drink.finalized && (
                    <span className="text-xs font-semibold text-green-600">✓ Finalized</span>
                  )}
                </div>

                {/* Drink Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Drink Name</label>
                  <input
                    value={drink.name}
                    readOnly={readOnly}
                    onChange={(e) => !readOnly && updateDrink(i, 'name', e.target.value)}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none ${
                      readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-1 focus:ring-amber-400'
                    }`}
                  />
                </div>

                {/* Ingredients */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ingredients</label>
                  <textarea
                    value={drink.ingredients}
                    rows={3}
                    readOnly={readOnly}
                    onChange={(e) => !readOnly && updateDrink(i, 'ingredients', e.target.value)}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y ${
                      readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-1 focus:ring-amber-400'
                    }`}
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
                  <textarea
                    value={drink.instructions}
                    rows={4}
                    readOnly={readOnly}
                    onChange={(e) => !readOnly && updateDrink(i, 'instructions', e.target.value)}
                    placeholder={readOnly ? '' : 'Step-by-step instructions for making this drink…'}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y ${
                      readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-1 focus:ring-amber-400'
                    }`}
                  />
                </div>

                {/* Menu Verbiage */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Menu Verbiage</label>
                  <textarea
                    value={drink.menuVerbiage}
                    rows={2}
                    readOnly={readOnly}
                    onChange={(e) => !readOnly && updateDrink(i, 'menuVerbiage', e.target.value)}
                    placeholder={readOnly ? '' : 'Fancy description for the drink menu sign…'}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y ${
                      readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-1 focus:ring-amber-400'
                    }`}
                  />
                </div>

                <Toggle
                  label="Finalized"
                  value={drink.finalized}
                  onChange={(v) => updateDrink(i, 'finalized', v)}
                  readOnly={readOnly}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Showgrams */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Showgrams / Specialty Items</h3>
        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
          <SavedTextArea label="Showgram Ideas" fieldPath="showgrams.ideas" initialValue={showgrams.ideas} save={save} readOnly={readOnly} />
          <SavedInput    label="Final Choice"   fieldPath="showgrams.finalChoice" initialValue={showgrams.finalChoice} save={save} readOnly={readOnly} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <Toggle label="Approval Needed" value={showgrams.approvalNeeded} onChange={(v) => updateShowgrams('approvalNeeded', v)} readOnly={readOnly} />
            <div className="sm:pl-4"><Toggle label="Ordered" value={showgrams.ordered} onChange={(v) => updateShowgrams('ordered', v)} readOnly={readOnly} /></div>
            <div className="sm:pl-4"><Toggle label="Arrived" value={showgrams.arrived} onChange={(v) => updateShowgrams('arrived', v)} readOnly={readOnly} /></div>
          </div>
        </div>
      </div>

      {/* Concessions */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Concessions</h3>
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <Toggle label="Inventory Check Complete" value={concessions.inventoryCheck} onChange={(v) => updateConcessions('inventoryCheck', v)} readOnly={readOnly} />
          <SavedTextArea label="Items to Order" fieldPath="concessions.itemsToOrder" initialValue={concessions.itemsToOrder} save={save} readOnly={readOnly} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <Toggle label="Ordered" value={concessions.ordered} onChange={(v) => updateConcessions('ordered', v)} readOnly={readOnly} />
            <div className="sm:pl-4"><Toggle label="Arrived" value={concessions.arrived} onChange={(v) => updateConcessions('arrived', v)} readOnly={readOnly} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
