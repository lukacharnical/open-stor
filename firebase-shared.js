import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDBd_NPKinJ6Vu4Wk_98rNaM75NBNMaGdo",
  authDomain: "openstore-be393.firebaseapp.com",
  databaseURL: "https://openstore-be393-default-rtdb.firebaseio.com",
  projectId: "openstore-be393",
  storageBucket: "openstore-be393.firebasestorage.app",
  messagingSenderId: "615451083226",
  appId: "1:615451083226:web:2ccfdad00c8474088180e3",
  measurementId: "G-1CRYGEK1G0"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west1");
export const emailKey = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
export async function getRole(user) {
  if (!user?.email) return "";
  const snap = await get(ref(db, "store_users/" + emailKey(user.email)));
  return String((snap.val() || {}).role || "").trim().toLowerCase();
}
export const canDevelopRole = role => ["codeur", "programmeur", "admin", "administrateur"].includes(role);
export const isAdminRole = role => ["admin", "administrateur"].includes(role);
export async function requireRole(allowed) {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { location.href = "index.html?connexion=requise"; return reject(new Error("Connecte-toi à OpenStore.")); }
      try {
        const role = await getRole(user);
        if (!allowed.includes(role)) { location.href = "index.html?acces=refuse"; return reject(new Error("Ton rôle n'autorise pas cette page.")); }
        resolve({ user, role });
      } catch(e) { reject(new Error("Impossible de vérifier ton rôle Firebase : " + e.message)); }
    });
  });
}
export async function uploadBuildFile(file) {
  const user = auth.currentUser;
  if (!user) throw new Error("Connecte-toi avant d'envoyer un fichier.");
  if (file.size > 200 * 1024 * 1024) throw new Error("Fichier trop volumineux (maximum 200 Mo dans cette interface).");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `build-uploads/${user.uid}/${Date.now()}-${safeName}`;
  await uploadBytes(storageRef(storage, path), file, { contentType: file.type || "application/octet-stream", customMetadata: { ownerUid: user.uid } });
  return path;
}
export const requestBuild = httpsCallable(functions, "requestOpenStoreBuild");
export async function logout() { await signOut(auth); location.href = "index.html"; }
