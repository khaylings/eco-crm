import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/firestore'

const EmpresaContext = createContext()

export function EmpresaProvider({ children }) {
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargarEmpresa = async () => {
    try {
      const ref = doc(db, 'configuracion', 'empresa')
      const snap = await getDoc(ref)
      if (snap.exists()) setEmpresa(snap.data())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const guardarEmpresa = async (datos) => {
    const ref = doc(db, 'configuracion', 'empresa')
    await setDoc(ref, datos, { merge: true })
    setEmpresa((prev) => ({ ...prev, ...datos }))
  }

  useEffect(() => { cargarEmpresa() }, [])

  return (
    <EmpresaContext.Provider value={{ empresa, loading, guardarEmpresa, cargarEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  return useContext(EmpresaContext)
}