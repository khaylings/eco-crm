/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: AuthContext.jsx
 * Módulo:  Context
 * ============================================================
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import auth from '../firebase/auth'
import { db } from '../firebase/firestore'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        try {
          const ref = doc(db, 'usuarios', firebaseUser.uid)
          const snap = await getDoc(ref)
          if (snap.exists()) {
            setUsuario({ uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() })
          } else {
            setUsuario({ uid: firebaseUser.uid, email: firebaseUser.email, nombre: firebaseUser.email, rol: 'Sin acceso' })
          }
        } catch {
          setUsuario({ uid: firebaseUser.uid, email: firebaseUser.email, nombre: firebaseUser.email, rol: 'Sin acceso' })
        }
      } else {
        setUser(null)
        setUsuario(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const cerrarSesion = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, usuario, cerrarSesion, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}