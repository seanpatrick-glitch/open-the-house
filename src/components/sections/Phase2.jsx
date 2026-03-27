// Phase2.jsx — 3 Weeks Out (the most detailed section)

import React, { useState, useEffect } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'

const CHECKLIST = [
  'Check available materials for builds',
  'Begin signage planning',
  'Review concessions and drink inventory',
  'Shape specialty drink ideas using existing stock',
  'Choose showgram or specialty item options',
]

const SIGNAGE_ITEMS = [
  { key: 'lobby',       label: 'Lobby Welcome Sign' },
  { key: 'drink',       label: 'Drink Menu Sign' },
  { key: 'showgram',    label: 'Showgram Sign' },
  { key: 'directional', label: 'Directional Signs' },
]

const SIGNAGE_BADGES = ['Concept', 'Design', 'Printed', 'Installed']

const BADGE_COLORS = {
  Concept:   'bg-gray-100  text-gray-600  border-gray-300',
  Design:    'bg-blue-100  text-blue-700  border-blue-300',
  Printed:   'bg-purple-100 text-purple-700 border-purple-300',
  Installed: 'bg-green-100 text-green-700 border-green-300',
}

// ── Reusable helpers ──────────────────────────────────────────────────────────

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 py-2.5 cursor-pointer group select-none">
      <input type="checkbox" checked={checked || false} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 accent-amber-500 cursor-pointer flex-shrink-0" />
      <span className={`text-sm leading-relaxed ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
    </label>
  )
}

function SavedTextArea({ label, fieldPath, initialValue, save, rows = 3 }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={val} rows={rows} onChange={(e) => { setVal(e.target.value); save(fieldPath, e.target.value) }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y" />
    </div>
  )
}

function SavedInput({ label, fieldPath, initialValue, save, placeholder = '' }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input value={val} placeholder={placeholder} onChange={(e) => { setVal(e.target.value); save(fieldPath, e.target.value) }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-amber-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Phase2({ show, save }) {
  const checklist    = show.phase2Checklist || {}
  const fields       = show.phase2Fields    || {}
  const signage      = show.signageStatus   || {}
  const drinks       = show.drinks          || []
  const showgrams    = show.showgrams       || {}
  const concessions  = show.concessions     || {}

  // Arrays and objects that need atomic writes go direct to Firestore
  async function saveDirect(field, value) {
    await updateDoc(doc(db, 'shows', show.id), { [field]: value, updatedAt: serverTimestamp() })
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

  function updateSignage(key, val) {
    saveDirect('signageStatus', { ...signage, [key]: val })
  }

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
              onChange={(v) => save(`phase2Checklist.item${i}`, v)} />
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SavedTextArea label="Materials Available" fieldPath="phase2Fields.materialsAvailable" initialValue={fields.materialsAvailable} save={save} />
        <SavedTextArea label="Materials Needed"    fieldPath="phase2Fields.materialsNeeded"    initialValue={fields.materialsNeeded}    save={save} />
        <SavedTextArea label="Signage Ideas"       fieldPath="phase2Fields.signageIdeas"       initialValue={fields.signageIdeas}       save={save} />
      </div>

      {/* Signage Status */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Signage Status</h3>
        <div className="space-y-3">
          {SIGNAGE_ITEMS.map(({ key, label }) => (
            <div key={key} className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-700 w-40 flex-shrink-0">{label}</span>
              <div className="flex gap-2 flex-wrap">
                {SIGNAGE_BADGES.map((badge) => (
                  <button key={badge} onClick={() => updateSignage(key, badge)}
                    className={`text-xs px-3 py-1 rounded-full font-medium border transition-all ${
                      signage[key] === badge ? BADGE_COLORS[badge] : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}>
                    {badge}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {/* Other row with custom label */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40 flex-shrink-0">
              <input value={signage.otherText || ''} placeholder="Other (describe)"
                onChange={(e) => updateSignage('otherText', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {SIGNAGE_BADGES.map((badge) => (
                <button key={badge} onClick={() => updateSignage('other', badge)}
                  className={`text-xs px-3 py-1 rounded-full font-medium border transition-all ${
                    signage.other === badge ? BADGE_COLORS[badge] : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}>
                  {badge}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Specialty Drinks */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Specialty Drinks (up to 4)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(drinks.length > 0 ? drinks : [{},{},{},{}]).map((drink, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Drink {i + 1}</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Drink Name</label>
                <input value={drink.name || ''} onChange={(e) => updateDrink(i, 'name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ingredients</label>
                <textarea value={drink.ingredients || ''} rows={2} onChange={(e) => updateDrink(i, 'ingredients', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y" />
              </div>
              <Toggle label="Drink Menu Finalized" value={drink.menuFinalized} onChange={(v) => updateDrink(i, 'menuFinalized', v)} />
            </div>
          ))}
        </div>
      </div>

      {/* Showgrams */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Showgrams / Specialty Items</h3>
        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
          <SavedTextArea label="Showgram Ideas" fieldPath="showgrams.ideas" initialValue={showgrams.ideas} save={save} />
          <SavedInput    label="Final Choice"   fieldPath="showgrams.finalChoice" initialValue={showgrams.finalChoice} save={save} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <Toggle label="Approval Needed" value={showgrams.approvalNeeded} onChange={(v) => updateShowgrams('approvalNeeded', v)} />
            <div className="sm:pl-4"><Toggle label="Ordered" value={showgrams.ordered} onChange={(v) => updateShowgrams('ordered', v)} /></div>
            <div className="sm:pl-4"><Toggle label="Arrived" value={showgrams.arrived} onChange={(v) => updateShowgrams('arrived', v)} /></div>
          </div>
        </div>
      </div>

      {/* Concessions */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Concessions</h3>
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <Toggle label="Inventory Check Complete" value={concessions.inventoryCheck} onChange={(v) => updateConcessions('inventoryCheck', v)} />
          <SavedTextArea label="Items to Order" fieldPath="concessions.itemsToOrder" initialValue={concessions.itemsToOrder} save={save} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <Toggle label="Ordered" value={concessions.ordered} onChange={(v) => updateConcessions('ordered', v)} />
            <div className="sm:pl-4"><Toggle label="Arrived" value={concessions.arrived} onChange={(v) => updateConcessions('arrived', v)} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
