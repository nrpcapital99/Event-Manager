import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export const firebaseConfig = {apiKey:'AIzaSyDREl-3V5UP6OKI-ayDMTLnbARqwrB_2SU',authDomain:'teammanagement-882f0.firebaseapp.com',projectId:'teammanagement-882f0',storageBucket:'teammanagement-882f0.firebasestorage.app',messagingSenderId:'1048235426608',appId:'1:1048235426608:web:7ed996d4ec2212311fbef5',measurementId:'G-917DHBGMT2'};
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
// Analytics is optional: unsupported browsers or blockers must not prevent sign-in.
if (import.meta.env.PROD && typeof window !== 'undefined') {
 import('firebase/analytics').then(async ({ isSupported, getAnalytics }) => {
  if (await isSupported()) getAnalytics(app);
 }).catch(() => {});
}
export const auth = getAuth(app);
// Spark-compatible mutations write directly to Firestore. Security Rules remain
// the final authority for every write.
export async function mutate<T=unknown>(action:string,data:Record<string,unknown> = {}):Promise<T>{const { mutateFirestore } = await import('./mutations');return mutateFirestore(action,data) as Promise<T>;}
export function friendlyError(error:unknown){const e=error as {code?:string;message?:string}; const messages:Record<string,string>={'auth/invalid-credential':'The email or password is incorrect.','auth/too-many-requests':'Too many attempts. Please wait before trying again.','auth/network-request-failed':'Cannot connect. Check your internet and try again.','auth/operation-not-allowed':'Email/password sign-in has not been enabled for this Firebase project.','auth/email-already-in-use':'This email already has an account. Sign in instead.','auth/weak-password':'Choose a stronger password with at least 12 characters.','permission-denied':'Workspace access was denied. Ask your admin to check your membership and Firestore rules.','firestore/permission-denied':'Workspace access was denied. Ask your admin to check your membership and Firestore rules.'};return messages[e.code??''] || e.message?.replace(/^Firebase: /,'') || 'Something went wrong. Please try again.';}
