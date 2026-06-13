import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Google Auth plugin for Capacitor
if (Capacitor.isNativePlatform()) {
  try {
    GoogleAuth.initialize({
      clientId: '1072056160706-1sndoo5uo069kshm9tg1268j8qfo6grt.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
  } catch (error) {
    console.error("Error initializing GoogleAuth plugin:", error);
  }
}

export const loginWithGoogle = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Use Native Google Sign-In
      const googleUser = await GoogleAuth.signIn();
      if (googleUser?.authentication?.idToken) {
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        await signInWithCredential(auth, credential);
      } else {
        throw new Error('No ID token found from Google Sign-In');
      }
    } else {
      // Use Web Popup
      await signInWithPopup(auth, googleProvider);
    }
  } catch (error: any) {
    console.error("Error logging in with Google", error);
    alert(`登录失败: ${error.message}\n\n如果您看到 "auth/unauthorized-domain" 错误，请前往 Firebase 控制台的 Authentication -> Settings -> Authorized domains 中添加当前网页的域名。`);
  }
};

export const logout = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await GoogleAuth.signOut();
    }
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out", error);
  }
};
