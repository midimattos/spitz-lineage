// ============================================================
// FIREBASE FIRESTORE SECURITY RULES
// Cole estas regras em: Firebase Console > Firestore > Rules
// ============================================================

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Cada usuário só acessa seus próprios dados
    match /users/{userId}/dogs/{dogId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Bloqueia qualquer outro acesso
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
