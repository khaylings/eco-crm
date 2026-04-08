import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import auth from '../firebase/auth'
import { db } from '../firebase/firestore'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [rol, setRol] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        try {
          const ref = doc(db, 'usuarios', firebaseUser.uid)
          const snap = await getDoc(ref)
          setRol(snap.exists() ? snap.data().rol : 'viewer')
        } catch {
          setRol('viewer')
        }
      } else {
        setUser(null)
        setRol(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider value={{ user, rol, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}