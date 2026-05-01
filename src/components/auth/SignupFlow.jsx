import React, { useState } from 'react'
import SignupStep1 from './SignupStep1'
import SignupStep2 from './SignupStep2'
import SignupStep3 from './SignupStep3'

export default function SignupFlow() {
  const [step,         setStep]         = useState(1)
  const [firebaseUser, setFirebaseUser] = useState(null)

  function handleStep1Complete(user) {
    setFirebaseUser(user)
    setStep(2)
  }

  function handleStep2Complete() {
    setStep(3)
  }

  if (step === 1) return <SignupStep1 onComplete={handleStep1Complete} />
  if (step === 2) return <SignupStep2 onComplete={handleStep2Complete} />
  if (step === 3) return <SignupStep3 firebaseUser={firebaseUser} />
}
