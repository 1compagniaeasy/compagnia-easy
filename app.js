
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyD2WyRfiB7HbeXmVu481gmQYbZQLTla2zU",
  authDomain: "compagnia-easy-members.firebaseapp.com",
  projectId: "compagnia-easy-members",
  storageBucket: "compagnia-easy-members.firebasestorage.app",
  messagingSenderId: "837831330373",
  appId: "1:837831330373:web:ca0316b28ee352c361f12c"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const loginButton = document.querySelector('#google-login');
const logoutButton = document.querySelector('#signout-btn');
const loginMessage = document.querySelector('#login-message');
const connectionStatus = document.querySelector('#connection-status');

const membersAdmin = document.querySelector('#members-admin');
const membersReadonly = document.querySelector('#members-readonly');
const inviteForm = document.querySelector('#invite-form');
const inviteEmail = document.querySelector('#invite-email');
const inviteRole = document.querySelector('#invite-role');
const inviteMessage = document.querySelector('#invite-message');
const membersList = document.querySelector('#members-list');

let currentUser = null;

function showMessage(message, isError = false) {
  loginMessage.textContent = message;
  loginMessage.classList.toggle('error', isError);
}

function showLogin(message) {
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
  logoutButton.classList.add('hidden');

  if (message) showMessage(message, true);
}

function showApp(user, role) {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  logoutButton.classList.remove('hidden');

  const name = user.displayName || user.email || 'Membro';

  document.querySelector('#user-name').textContent = name;
  document.querySelector('#user-role').textContent =
    role === 'admin' ? 'AMMINISTRATORE' : 'MEMBRO';

  document.querySelector('#user-avatar').textContent =
    name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();

  document.querySelector('#welcome-text').textContent =
    `Bentornato, ${name.split(' ')[0]}.`;

  document.querySelector('#admin-banner').classList.toggle(
    'hidden',
    role !== 'admin'
  );

  membersAdmin.classList.toggle('hidden', role !== 'admin');
  membersReadonly.classList.toggle('hidden', role === 'admin');

  if (role === 'admin') {
    loadMembers();
  }
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true;
  showMessage('Accesso in corso...');

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    showMessage('Accesso non riuscito. Controlla la configurazione Firebase.', true);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener('click', () => signOut(auth));

/* ACCESSO E ATTIVAZIONE TRAMITE INVITO */

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    showLogin();
    return;
  }

  currentUser = user;

  try {
    if (!user.email || !user.emailVerified) {
      await signOut(auth);
      showLogin('È necessario un account Google con email verificata.');
      return;
    }

    const memberRef = doc(db, 'members', user.uid);
    let memberSnap = await getDoc(memberRef);

    // Se il profilo non esiste, controlla se è presente un invito.
    if (!memberSnap.exists()) {
      const email = user.email.toLowerCase();
      const inviteRef = doc(db, 'invites', email);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        await signOut(auth);
        showLogin('Account non autorizzato. Contatta un amministratore.');
        return;
      }

      const invite = inviteSnap.data();

      if (invite.email !== user.email || !['member', 'admin'].includes(invite.role)) {
        await signOut(auth);
        showLogin('Invito non valido. Contatta un amministratore.');
        return;
      }

      await setDoc(memberRef, {
        email: user.email,
        name: user.displayName || user.email,
        role: invite.role,
        active: true,
        createdAt: serverTimestamp()
      });

      memberSnap = await getDoc(memberRef);
    }

    const member = memberSnap.data();

    if (member.active !== true) {
      await signOut(auth);
      showLogin('Account sospeso. Contatta un amministratore.');
      return;
    }

    const role = member.role === 'admin' ? 'admin' : 'member';
    showApp(user, role);

  } catch (error) {
    console.error(error);
    await signOut(auth);
    showLogin('Errore nella verifica dei permessi. Riprova più tardi.');
  }
});

/* INVITO DI UN NUOVO COMPONENTE */

inviteForm.addEventListener('submit', async event => {
  event.preventDefault();

  const email = inviteEmail.value.trim().toLowerCase();
  const role = inviteRole.value;

  if (!email || !currentUser) return;

  const submitButton = inviteForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  inviteMessage.textContent = 'Registrazione invito in corso...';

  try {
    const inviteRef = doc(db, 'invites', email);

    await setDoc(inviteRef, {
      email,
      role,
      invitedBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    inviteMessage.textContent = `Invito registrato per ${email}.`;
    inviteMessage.classList.remove('error');
    inviteForm.reset();

  } catch (error) {
    console.error(error);
    inviteMessage.textContent = 'Impossibile registrare l’invito. Verifica i permessi.';
    inviteMessage.classList.add('error');
  } finally {
    submitButton.disabled = false;
  }
});

/* ELENCO E GESTIONE DEI COMPONENTI */

async function loadMembers() {
  membersList.textContent = 'Caricamento elenco membri...';

  try {
    const snapshot = await getDocs(collection(db, 'members'));
    membersList.replaceChildren();

    if (snapshot.empty) {
      membersList.textContent = 'Nessun componente registrato.';
      return;
    }

    snapshot.forEach(memberDoc => {
      const member = memberDoc.data();
      const uid = memberDoc.id;

      const card = document.createElement('div');
      card.className = 'member-row';

      const info = document.createElement('div');
      const name = document.createElement('strong');
      const email = document.createElement('p');
      const status = document.createElement('small');

      name.textContent = member.name || member.email || 'Membro';
      email.textContent = member.email || '';
      status.textContent = member.active ? 'ATTIVO' : 'SOSPESO';

      info.append(name, email, status);

      const controls = document.createElement('div');
      controls.className = 'member-controls';

      const roleSelect = document.createElement('select');

      const memberOption = new Option('Membro', 'member');
      const adminOption = new Option('Amministratore', 'admin');

      roleSelect.add(memberOption);
      roleSelect.add(adminOption);
      roleSelect.value = member.role || 'member';

      const statusButton = document.createElement('button');
      statusButton.type = 'button';
      statusButton.className = 'button button-quiet';
      statusButton.textContent = member.active ? 'Sospendi' : 'Riattiva';

      // Evita di modificare accidentalmente il proprio account.
      if (uid === currentUser.uid) {
        roleSelect.disabled = true;
        statusButton.disabled = true;
      }

      roleSelect.addEventListener('change', async () => {
        try {
          await updateDoc(doc(db, 'members', uid), {
            role: roleSelect.value
          });
        } catch (error) {
          console.error(error);
          alert('Non è stato possibile modificare il ruolo.');
          loadMembers();
        }
      });

      statusButton.addEventListener('click', async () => {
        const confirmed = confirm(
          member.active
            ? `Vuoi sospendere ${member.email}?`
            : `Vuoi riattivare ${member.email}?`
        );

        if (!confirmed) return;

        try {
          await updateDoc(doc(db, 'members', uid), {
            active: !member.active
          });

          loadMembers();
        } catch (error) {
          console.error(error);
          alert('Non è stato possibile modificare lo stato del componente.');
        }
      });

      controls.append(roleSelect, statusButton);
      card.append(info, controls);
      membersList.append(card);
    });

  } catch (error) {
    console.error(error);
    membersList.textContent =
      'Errore nel caricamento dei membri. Verifica i permessi Firebase.';
  }
}

/* STATO DELLA CONNESSIONE */

window.addEventListener('online', () => {
  connectionStatus.classList.add('online');
});

window.addEventListener('offline', () => {
  connectionStatus.classList.remove('online');
});

if (navigator.onLine) {
  connectionStatus.classList.add('online');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}
