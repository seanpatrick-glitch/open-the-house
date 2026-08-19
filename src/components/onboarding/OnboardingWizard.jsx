// OnboardingWizard.jsx — first-run guided setup for a brand-new org's original admin.
// Order is fixed: Organization -> People -> Places -> Production -> Invites.
// Organization was added as a new first step so the admin can confirm/correct
// the org name already collected at signup and add a logo (see OrgStep.jsx),
// pushing every other step back by one. Production still requires a places
// array to exist (CreateProductionForm.jsx), so Places must come before it
// regardless of UX preference.

import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import OrgStep from './steps/OrgStep'
import PeopleStep from './steps/PeopleStep'
import PlacesStep from './steps/PlacesStep'
import ProductionStep from './steps/ProductionStep'
import InvitesStep from './steps/InvitesStep'

const STEP_COUNT = 5

export default function OnboardingWizard({ orgId }) {
  const [step, setStep] = useState(1)
  const [finishing, setFinishing] = useState(false)

  async function completeOnboarding() {
    setFinishing(true)
    try {
      await updateDoc(doc(db, 'organizations', orgId), { onboardingCompleted: true })
    } finally {
      setFinishing(false)
    }
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, STEP_COUNT))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1))
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-3xl font-bold text-gray-900">Places People!</h1>
          <p className="text-gray-500 mt-2 text-sm">Let's set up your organization</p>
        </div>

        {step === 1 && <OrgStep orgId={orgId} onNext={goNext} />}
        {step === 2 && <PeopleStep orgId={orgId} onNext={goNext} onBack={goBack} />}
        {step === 3 && <PlacesStep orgId={orgId} onNext={goNext} onBack={goBack} />}
        {step === 4 && <ProductionStep orgId={orgId} onNext={goNext} onBack={goBack} />}
        {step === 5 && (
          <InvitesStep orgId={orgId} onFinish={completeOnboarding} onBack={goBack} finishing={finishing} />
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Step {step} of {STEP_COUNT}</p>
          <button
            type="button"
            onClick={completeOnboarding}
            disabled={finishing}
            className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
          >
            Skip setup, I'll do this later
          </button>
        </div>
      </div>
    </div>
  )
}
