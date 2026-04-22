// ============================================================
// FIREBASE SERVICE — Spitz Lineage Manager
// Usa Firebase SDK via CDN (ESM)
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Config: lido do window.__ENV__ injetado pelo index.html ──
const cfg = window.__ENV__ || {};
const firebaseConfig = {
  apiKey:            cfg.FIREBASE_API_KEY            || '',
  authDomain:        cfg.FIREBASE_AUTH_DOMAIN        || '',
  projectId:         cfg.FIREBASE_PROJECT_ID         || '',
  storageBucket:     cfg.FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: cfg.FIREBASE_MESSAGING_SENDER_ID|| '',
  appId:             cfg.FIREBASE_APP_ID             || ''
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Auth ──────────────────────────────────────────────────────
export const login  = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logout = ()          => signOut(auth);
export const onAuth = (cb)        => onAuthStateChanged(auth, cb);

// ── Dogs CRUD ─────────────────────────────────────────────────
const dogsCol = (uid) => collection(db, 'users', uid, 'dogs');

export async function getAllDogs(uid) {
  const snap = await getDocs(dogsCol(uid));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDog(uid, dogId) {
  if (!dogId) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'dogs', dogId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveDog(uid, data, existingId = null) {
  if (existingId) {
    await updateDoc(doc(db, 'users', uid, 'dogs', existingId), { ...data, updatedAt: serverTimestamp() });
    return existingId;
  }
  const ref = await addDoc(dogsCol(uid), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteDog(uid, dogId) {
  await deleteDoc(doc(db, 'users', uid, 'dogs', dogId));
}

export async function searchDogsByName(uid, fragment) {
  const all = await getAllDogs(uid);
  const q = fragment.toLowerCase();
  return all.filter(d => d.name?.toLowerCase().includes(q));
}

// ── Recursive pedigree fetch ──────────────────────────────────
export async function fetchAncestors(uid, dogId, depth = 3) {
  if (!dogId || depth === 0) return null;
  const dog = await getDog(uid, dogId);
  if (!dog) return null;
  const [father, mother] = await Promise.all([
    fetchAncestors(uid, dog.pedigree?.fatherId, depth - 1),
    fetchAncestors(uid, dog.pedigree?.motherId, depth - 1)
  ]);
  return { ...dog, father, mother };
}

// ── Collect ancestor IDs for COI ─────────────────────────────
export async function collectAncestorIds(uid, dogId, depth = 5, visited = new Set()) {
  if (!dogId || depth === 0 || visited.has(dogId)) return visited;
  visited.add(dogId);
  const dog = await getDog(uid, dogId);
  if (!dog) return visited;
  await Promise.all([
    collectAncestorIds(uid, dog.pedigree?.fatherId, depth - 1, visited),
    collectAncestorIds(uid, dog.pedigree?.motherId, depth - 1, visited)
  ]);
  return visited;
}
