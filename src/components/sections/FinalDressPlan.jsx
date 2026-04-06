// FinalDressPlan.jsx — Final Dress Rehearsal Plan

import React, { useState, useEffect } from 'react'

const DRINK_TYPE_LABELS = ['Alcoholic', 'Alcoholic', 'Mocktail']
const DRINK_TYPE_STYLES = [
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-teal-50 text-teal-700 border-teal-200',
]

function Checkbox({ label, checked, onChange, readOnly }) {
  return (
    <label className={`flex items-start gap-3 py-2 select-none ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked || false}
        onChange={(e) => !readOnly && onChange(e.target.checked)}
        disabled={readOnly}
        className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0 cursor-pointer disabled:opacity-60"
      />
      <span className={`text-sm leading-relaxed ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {label}
      </span>
    </label>
  )
}

function SavedTextArea({ fieldPath, initialValue, save, readOnly }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  return (
    <textarea
      value={val}
      rows={4}
      readOnly={readOnly}
      onChange={(e) => { if (!readOnly) { setVal(e.target.value); save(fieldPath, e.target.value) } }}
      placeholder={readOnly ? '' : 'Note what food or snacks will be provided for final dress rehearsal…'}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-y ${
        readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-2 focus:ring-amber-400'
      }`}
    />
  )
}

export default function FinalDressPlan({ show, save, readOnly }) {
  const drinks          = show.drinks   || []
  const dressPlan       = show.dressPlan || {}
  const sampleChecklist = dressPlan.sampleChecklist || {}

  // Pull the 3 drink slots; fall back to empty object if not yet filled in
  const drinkSlots = [0, 1, 2].map(i => drinks[i] || {})
  const hasAnyDrinks = drinkSlots.some(d => d.name || d.ingredients)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-7">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">Final Dress</span>
        <h2 className="text-xl font-bold text-gray-900">Final Dress Rehearsal Plan</h2>
      </div>

      {/* ── Specialty Drink Samples ─────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Specialty Drink Samples</h3>
        <p className="text-xs text-gray-400 mb-4">
          Check off each ingredient as you gather supplies for making drink samples at final dress.
        </p>

        {!hasAnyDrinks ? (
          <p className="text-sm text-gray-400 italic">
            No specialty drinks entered yet — add them in the Phase 2 section.
          </p>
        ) : (
          <div className="space-y-4">
            {drinkSlots.map((drink, i) => {
              if (!drink.name && !drink.ingredients) return null

              // Split ingredients by newline, strip blanks
              const ingredients = (drink.ingredients || '')
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean)

              return (
                <div key={i} className="border border-gray-200 rounded-xl p-4">
                  {/* Drink header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {drink.name || `Drink ${i + 1}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${DRINK_TYPE_STYLES[i]}`}>
                      {DRINK_TYPE_LABELS[i]}
                    </span>
                  </div>

                  {ingredients.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No ingredients listed yet.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {ingredients.map((line, j) => (
                        <Checkbox
                          key={j}
                          label={line}
                          checked={sampleChecklist[`d${i}_i${j}`]}
                          onChange={(v) => save(`dressPlan.sampleChecklist.d${i}_i${j}`, v)}
                          readOnly={readOnly}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Refreshments and Snacks ─────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Refreshments and Snacks</h3>
        <SavedTextArea
          fieldPath="dressPlan.refreshments"
          initialValue={dressPlan.refreshments}
          save={save}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
