import { getFirestore } from 'firebase/firestore';
import { app } from './firebase';
// Kept apart from ./firebase so that importing auth does not pull Firestore in.
export const db = getFirestore(app);
