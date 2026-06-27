import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../firebase'

export const useUserPlan = () => {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeUserDoc = null

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc()
        unsubscribeUserDoc = null
      }

      setUser(firebaseUser)

      if (!firebaseUser) {
        setPlan('free')
        setLoading(false)
        return
      }

      setLoading(true)

      const userRef = doc(db, 'users', firebaseUser.uid)

      unsubscribeUserDoc = onSnapshot(
        userRef,
        (snapshot) => {
          const data = snapshot.data()

          if (data?.plan === 'pro') {
            setPlan('pro')
          } else {
            setPlan('free')
          }

          setLoading(false)
        },
        (error) => {
          console.error('Failed to load user plan:', error)
          setPlan('free')
          setLoading(false)
        }
      )
    })

    return () => {
      unsubscribeAuth()

      if (unsubscribeUserDoc) {
        unsubscribeUserDoc()
      }
    }
  }, [])

  return {
    user,
    plan,
    isPro: plan === 'pro',
    loading,
  }
}