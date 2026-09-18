import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
const config = {apiKey:'AIzaSyDREl-3V5UP6OKI-ayDMTLnbARqwrB_2SU',authDomain:'teammanagement-882f0.firebaseapp.com',projectId:'teammanagement-882f0',storageBucket:'teammanagement-882f0.firebasestorage.app',messagingSenderId:'1048235426608',appId:'1:1048235426608:web:7ed996d4ec2212311fbef5'};
export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app,'asia-south1');
export async function mutate<T=unknown>(action:string,data:Record<string,unknown> = {}):Promise<T>{const result = await httpsCallable<Record<string,unknown>,T>(functions,'workspace')({action,...data});return result.data;}
export function friendlyError(error:unknown){const e=error as {code?:string;message?:string}; const messages:Record<string,string>={'auth/invalid-credential':'The email or password is incorrect.','auth/too-many-requests':'Too many attempts. Please wait before trying again.','auth/network-request-failed':'Cannot connect. Check your internet and try again.','auth/operation-not-allowed':'Email/password sign-in has not been enabled for this Firebase project.','auth/email-already-in-use':'This email already has an account. Sign in instead.','auth/weak-password':'Choose a stronger password with at least 12 characters.','functions/unavailable':'The workspace backend is unavailable. Your changes have not been saved.','functions/not-found':'The workspace backend has not been deployed yet.','functions/internal':'The request could not be completed. Your changes have not been confirmed.','permission-denied':'Workspace access was denied. Ask your admin to check your membership and Firebase rules.'};return messages[e.code??''] || e.message?.replace(/^Firebase: /,'') || 'Something went wrong. Please try again.';}
