import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import app from './config'

export const db = getFirestore(app)
export const storage = getStorage(app)