import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
  deleteDoc,
  writeBatch,
  collection,
  getDocs,
  addDoc,
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

// SUPABASE: archivio PDF privato. L'autenticazione resta gestita da Firebase.
const supabaseUrl = 'https://iqwftffzaqwfpxdistbb.supabase.co';
const supabasePublishableKey = 'sb_publishable_bBrKpzYOL46pWSHTBy0uvQ_D2_p4X-3';
const documentsBucket = 'documenti-squadra';
const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  accessToken: async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  }
});

const $ = selector => document.querySelector(selector);

const loginView = $('#login-view');
const appView = $('#app-view');
const loginButton = $('#google-login');
const logoutButton = $('#signout-btn');
const loginMessage = $('#login-message');
const connectionStatus = $('#connection-status');

const membersAdmin = $('#members-admin');
const membersReadonly = $('#members-readonly');
const inviteForm = $('#invite-form');
const inviteEmail = $('#invite-email');
const inviteRole = $('#invite-role');
const inviteMessage = $('#invite-message');
const membersList = $('#members-list');

const announcementForm = $('#announcement-form');
const announcementMessage = $('#announcement-message');
const announcementsList = $('#announcements-list');

const trainingForm = $('#training-form');
const trainingMessage = $('#training-message');
const boardEventsList = $('#board-events-list');
const calendarEventsList = $('#calendar-events-list');

const documentsAdmin = $('#documents-admin');
const documentCategoryForm = $('#document-category-form');
const documentCategoryName = $('#document-category-name');
const documentCategoryMessage = $('#document-category-message');
const documentCategoriesAdminList = $('#document-categories-admin-list');
const documentUploadForm = $('#document-upload-form');
const documentUploadTitle = $('#document-upload-title');
const documentUploadCategory = $('#document-upload-category');
const documentUploadFile = $('#document-upload-file');
const documentUploadMessage = $('#document-upload-message');
const documentCategoriesList = $('#document-categories-list');
const documentsList = $('#documents-list');
const documentsMessage = $('#documents-message');

let documentCategories = [];
let storedDocuments = [];

const attendanceSelect = $('#attendance-event-select');
const attendanceDetails = $('#attendance-event-details');
const attendanceControls = $('#attendance-controls');
const attendanceResults = $('#attendance-results');
const attendanceEmpty = $('#attendance-empty');
const attendanceList = $('#attendance-list');
const attendanceMessage = $('#attendance-message');

let currentUser = null;
let currentRole = 'member';
let allEvents = [];
let selectedEventId = null;
let currentMember = {};
let membersByUid = new Map();

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function showLogin(message) {
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
  logoutButton.classList.add('hidden');

  if (message) showMessage(loginMessage, message, true);
}

function showApp(user, role) {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  logoutButton.classList.remove('hidden');

  const name = user.displayName || user.email || 'Membro';

  $('#user-name').textContent = name;
  $('#user-role').textContent =
    role === 'admin' ? 'AMMINISTRATORE' : 'MEMBRO';

  $('#user-avatar').textContent = name
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  $('#welcome-text').textContent = 'Bentornato, ' + name.split(' ')[0] + '.';
  if (!validPages.has((window.location.hash || '#home').slice(1).toLowerCase())) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#home`);
  }
  renderCurrentPage();
  loadOwnProfile();
  loadBirthdays();

  $('#admin-banner').classList.toggle('hidden', role !== 'admin');

  membersAdmin.classList.toggle('hidden', role !== 'admin');
  membersReadonly.classList.toggle('hidden', role === 'admin');

  $('#announcements-admin').classList.toggle('hidden', role !== 'admin');
  $('#events-admin').classList.toggle('hidden', role !== 'admin');
  documentsAdmin.classList.toggle('hidden', role !== 'admin');

  if (role === 'admin') {
    loadMembers();
  }

  loadAnnouncements();
  loadEvents();
  loadDocuments();
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true;
  showMessage(loginMessage, 'Accesso in corso...');

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    showMessage(
      loginMessage,
      'Accesso non riuscito. Controlla la configurazione Firebase.',
      true
    );
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener('click', () => signOut(auth));

/* ACCESSO E ATTIVAZIONE TRAMITE INVITO */

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    currentRole = 'member';
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

      if (
        invite.email !== email ||
        !['member', 'admin'].includes(invite.role)
      ) {
        await signOut(auth);
        showLogin('Invito non valido. Contatta un amministratore.');
        return;
      }

      await setDoc(memberRef, {
        email: user.email,
        name: user.displayName || user.email,
        firstName: '',
        lastName: '',
        nickname: '',
        birthDate: '',
        role: invite.role,
        active: true,
        createdAt: serverTimestamp()
      });

      memberSnap = await getDoc(memberRef);
    }

    const member = memberSnap.data();
    currentMember = { ...member };

    if (member.active !== true) {
      await signOut(auth);
      showLogin('Account sospeso. Contatta un amministratore.');
      return;
    }

    currentRole = member.role === 'admin' ? 'admin' : 'member';
    // Forza il rinnovo del token per includere il claim role richiesto da Supabase.
    await user.getIdToken(true);
    showApp(user, currentRole);

  } catch (error) {
    console.error(error);
    await signOut(auth);
    showLogin('Errore nella verifica dei permessi. Riprova più tardi.');
  }
});

/* PROFILO PERSONALE E COMPLEANNI */
function displayMemberName(member) {
  return (member?.nickname || [member?.firstName, member?.lastName].filter(Boolean).join(' ') || member?.name || member?.email || 'Membro').trim();
}

async function loadOwnProfile() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'members', currentUser.uid));
    if (!snap.exists()) return;
    currentMember = snap.data();
    $('#profile-first-name').value = currentMember.firstName || '';
    $('#profile-last-name').value = currentMember.lastName || '';
    $('#profile-nickname').value = currentMember.nickname || '';
    $('#profile-birthday').value = currentMember.birthDate ? `2000-${currentMember.birthDate}` : '';
    $('#profile-role').textContent = roleLabel(currentMember.teamRole || currentMember.role);
    $('#profile-status').textContent = currentMember.active ? 'Attivo' : 'Sospeso';
    const visibleName = displayMemberName(currentMember);
    $('#user-name').textContent = visibleName;
    $('#user-avatar').textContent = visibleName.slice(0, 2).toUpperCase();
    $('#welcome-text').textContent = `Bentornato, ${visibleName}.`;
  } catch (error) { console.error(error); showMessage($('#profile-message'), 'Impossibile caricare il profilo.', true); }
}

function roleLabel(role) {
  const labels = { admin: 'Amministratore', member: 'Membro', 'capo-squadra': 'Capo squadra', 'vice-capo-squadra': 'Vice capo squadra', operatore: 'Operatore' };
  return labels[role] || role || 'Membro';
}

$('#profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  const firstName = $('#profile-first-name').value.trim();
  const lastName = $('#profile-last-name').value.trim();
  const nickname = $('#profile-nickname').value.trim();
  const enteredBirthDate = $('#profile-birthday').value;
  const birthDate = enteredBirthDate ? enteredBirthDate.slice(5) : '';
  if (!firstName || !lastName || !nickname || !birthDate) { showMessage($('#profile-message'), 'Compila tutti i campi.', true); return; }
  const button = $('#profile-form').querySelector('button[type="submit"]'); button.disabled = true;
  try {
    await updateDoc(doc(db, 'members', currentUser.uid), { firstName, lastName, nickname, birthDate, profileUpdatedAt: serverTimestamp() });
    currentMember = { ...currentMember, firstName, lastName, nickname, birthDate };
    showMessage($('#profile-message'), 'Profilo aggiornato.');
    const visibleName = displayMemberName(currentMember);
    $('#user-name').textContent = visibleName; $('#user-avatar').textContent = visibleName.slice(0,2).toUpperCase();
    $('#welcome-text').textContent = `Bentornato, ${visibleName}.`;
    await loadBirthdays();
  } catch (error) { console.error(error); showMessage($('#profile-message'), 'Salvataggio non riuscito. Verifica le regole Firestore.', true); }
  finally { button.disabled = false; }
});

async function loadBirthdays() {
  const target = $('#birthdays-list'); if (!target) return;
  try {
    const snap = await getDocs(collection(db, 'members'));
    const today = new Date(); const mmdd = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const birthdays = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(m => m.active === true && /^\d{2}-\d{2}$/.test(m.birthDate || '') && m.birthDate === mmdd);
    target.replaceChildren();
    if (!birthdays.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Nessun compleanno oggi.'; target.append(p); return; }
    birthdays.forEach(member => { const row = document.createElement('div'); row.className = 'birthday-person'; const name = document.createElement('strong'); name.textContent = displayMemberName(member); const label = document.createElement('span'); label.textContent = 'Buon compleanno!'; row.append(name, label); target.append(row); });
  } catch (error) { console.error(error); target.textContent = 'Compleanni momentaneamente non disponibili.'; }
}

/* INVITO DI UN NUOVO COMPONENTE */

inviteForm.addEventListener('submit', async event => {
  event.preventDefault();

  const email = inviteEmail.value.trim().toLowerCase();
  const role = inviteRole.value;

  if (!email || !currentUser || currentRole !== 'admin') return;

  const submitButton = inviteForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showMessage(inviteMessage, 'Registrazione invito in corso...');

  try {
    await setDoc(doc(db, 'invites', email), {
      email,
      role,
      invitedBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    showMessage(inviteMessage, 'Invito registrato per ' + email + '.');
    inviteForm.reset();

  } catch (error) {
    console.error(error);
    showMessage(
      inviteMessage,
      'Impossibile registrare l’invito. Verifica i permessi.',
      true
    );
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

      name.textContent = displayMemberName(member);
      const details = document.createElement('small');
      details.textContent = member.email || '';
      info.append(name, details);
      status.textContent = `${roleLabel(member.teamRole || 'member')} · ${member.active ? 'ATTIVO' : 'SOSPESO'}`;
      info.append(status);

      const controls = document.createElement('div');
      controls.className = 'member-controls';

      const roleSelect = document.createElement('select');
      roleSelect.add(new Option('Membro', 'member'));
      roleSelect.add(new Option('Capo squadra', 'capo-squadra'));
      roleSelect.add(new Option('Vice capo squadra', 'vice-capo-squadra'));
      roleSelect.add(new Option('Operatore', 'operatore'));
      roleSelect.value = member.teamRole || 'member';

      const statusButton = document.createElement('button');
      statusButton.type = 'button';
      statusButton.className = 'button button-quiet';
      statusButton.textContent = member.active ? 'Sospendi' : 'Riattiva';

      if (uid === currentUser.uid) {
        roleSelect.disabled = true;
        statusButton.disabled = true;
      }

      roleSelect.addEventListener('change', async () => {
        try {
          await updateDoc(doc(db, 'members', uid), {
            teamRole: roleSelect.value
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

/* ANNUNCI IMPORTANTI */

announcementForm.addEventListener('submit', async event => {
  event.preventDefault();

  if (currentRole !== 'admin' || !currentUser) return;

  const title = $('#announcement-title').value.trim();
  const text = $('#announcement-text').value.trim();

  if (!title || !text) return;

  const button = announcementForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showMessage(announcementMessage, 'Pubblicazione in corso...');

  try {
    await addDoc(collection(db, 'announcements'), {
      title,
      text,
      author: currentUser.displayName || currentUser.email,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp()
    });

    announcementForm.reset();
    showMessage(announcementMessage, 'Annuncio pubblicato correttamente.');
    await loadAnnouncements();

  } catch (error) {
    console.error(error);
    showMessage(announcementMessage, 'Errore durante la pubblicazione.', true);
  } finally {
    button.disabled = false;
  }
});

async function loadAnnouncements() {
  announcementsList.textContent = 'Caricamento comunicazioni...';

  try {
    const snapshot = await getDocs(collection(db, 'announcements'));

    const announcements = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const first = a.createdAt?.toMillis?.() || 0;
        const second = b.createdAt?.toMillis?.() || 0;
        return second - first;
      });

    announcementsList.replaceChildren();

    if (!announcements.length) {
      announcementsList.textContent = 'Nessuna comunicazione pubblicata.';
      announcementsList.className = 'empty-state';
      return;
    }

    announcementsList.className = 'announcement-list';

    announcements.forEach(item => {
      const card = document.createElement('article');
      card.className = 'announcement-card';

      const label = document.createElement('span');
      label.className = 'announcement-label';
      label.textContent = 'ANNUNCIO IMPORTANTE';

      const title = document.createElement('h3');
      title.textContent = item.title || 'Comunicazione';

      const body = document.createElement('p');
      body.textContent = item.text || '';

      const meta = document.createElement('small');
      meta.textContent = `Pubblicato da ${item.author || 'Amministrazione'} · ${formatTimestamp(item.createdAt)}`;

      card.append(label, title, body, meta);

      if (currentRole === 'admin') {
        const controls = document.createElement('div');
        controls.className = 'member-controls';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'button button-quiet';
        editButton.textContent = 'Modifica';

        editButton.addEventListener('click', async () => {
          const newTitle = prompt('Modifica il titolo:', item.title || '');
          if (newTitle === null) return;

          const newText = prompt('Modifica il testo:', item.text || '');
          if (newText === null) return;

          if (!newTitle.trim() || !newText.trim()) {
            alert('Titolo e testo non possono essere vuoti.');
            return;
          }

          try {
            await updateDoc(doc(db, 'announcements', item.id), {
              title: newTitle.trim(),
              text: newText.trim(),
              updatedAt: serverTimestamp()
            });

            await loadAnnouncements();
          } catch (error) {
            console.error(error);
            alert('Non è stato possibile modificare l’annuncio.');
          }
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'button button-quiet';
        deleteButton.textContent = 'Elimina';

        deleteButton.addEventListener('click', async () => {
          if (!confirm(`Vuoi eliminare l’annuncio "${item.title}"?`)) return;

          try {
            await deleteDoc(doc(db, 'announcements', item.id));
            await loadAnnouncements();
          } catch (error) {
            console.error(error);
            alert('Non è stato possibile eliminare l’annuncio.');
          }
        });

        controls.append(editButton, deleteButton);
        card.append(controls);
      }

      announcementsList.append(card);
    });

  } catch (error) {
    console.error(error);
    announcementsList.textContent = 'Errore nel caricamento degli annunci.';
  }
}

/* CREAZIONE ALLENAMENTI */

trainingForm.addEventListener('submit', async event => {
  event.preventDefault();

  if (currentRole !== 'admin' || !currentUser) return;

  const title = $('#training-title').value.trim();
  const date = $('#training-date').value;
  const time = $('#training-time').value;
  const location = $('#training-location').value.trim();
  const description = $('#training-description').value.trim();

  if (!title || !date || !time || !location) return;

  const button = trainingForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showMessage(trainingMessage, 'Salvataggio allenamento...');

  try {
    await addDoc(collection(db, 'events'), {
      title,
      date,
      time,
      location,
      description,
      type: 'training',
      status: 'scheduled',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    trainingForm.reset();
    showMessage(trainingMessage, 'Allenamento pubblicato correttamente.');

    await loadEvents();

  } catch (error) {
    console.error(error);
    showMessage(trainingMessage, 'Errore nel salvataggio dell’allenamento.', true);
  } finally {
    button.disabled = false;
  }
});

async function loadEvents() {
  boardEventsList.textContent = 'Caricamento allenamenti...';
  calendarEventsList.textContent = 'Caricamento calendario...';

  try {
    const snapshot = await getDocs(collection(db, 'events'));

    allEvents = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const first = `${a.date || ''} ${a.time || ''}`;
        const second = `${b.date || ''} ${b.time || ''}`;
        return first.localeCompare(second);
      });

    renderEventLists();
    populateAttendanceSelect();

  } catch (error) {
    console.error(error);
    boardEventsList.textContent = 'Errore nel caricamento degli allenamenti.';
    calendarEventsList.textContent = 'Errore nel caricamento del calendario.';
  }
}

function renderEventLists() {
  const activeEvents = allEvents.filter(item => item.status !== 'cancelled');

  renderEventCards(
    boardEventsList,
    activeEvents.filter(item => item.date >= todayString()).slice(0, 5)
  );

  renderEventCards(calendarEventsList, activeEvents);
}

function renderEventCards(container, events) {
  container.replaceChildren();

  if (!events.length) {
    container.className = 'empty-state';
    container.textContent = 'Nessun allenamento programmato.';
    return;
  }

  container.className = 'event-list';

  events.forEach(item => {
    const card = document.createElement('article');
    card.className = 'event-card';

    const dateBox = document.createElement('div');
    dateBox.className = 'event-date';

    const date = new Date(`${item.date}T12:00:00`);
    const day = document.createElement('strong');
    day.textContent = String(date.getDate()).padStart(2, '0');

    const month = document.createElement('span');
    month.textContent = date.toLocaleDateString('it-IT', { month: 'short' });

    dateBox.append(day, month);

    const info = document.createElement('div');
    info.className = 'event-info';

    const title = document.createElement('h3');
    title.textContent = item.title || 'Allenamento';

    const details = document.createElement('p');
    details.textContent =
      `${formatDate(item.date)} · ${item.time || 'Orario da definire'} · ${item.location || 'Luogo da definire'}`;

    const description = document.createElement('p');
    description.textContent = item.description || '';

    info.append(title, details, description);
    card.append(dateBox, info);

    if (currentRole === 'admin') {
      const controls = document.createElement('div');
      controls.className = 'member-controls';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button button-quiet';
      editButton.textContent = 'Modifica';

      editButton.addEventListener('click', async () => {
        const newTitle = prompt('Titolo dell’allenamento:', item.title || '');
        if (newTitle === null) return;

        const newDate = prompt('Data (AAAA-MM-GG):', item.date || '');
        if (newDate === null) return;

        const newTime = prompt('Ora (HH:MM):', item.time || '');
        if (newTime === null) return;

        const newLocation = prompt('Luogo:', item.location || '');
        if (newLocation === null) return;

        const newDescription = prompt('Descrizione:', item.description || '');
        if (newDescription === null) return;

        if (
          !newTitle.trim() ||
          !/^\d{4}-\d{2}-\d{2}$/.test(newDate.trim()) ||
          !newTime.trim() ||
          !newLocation.trim()
        ) {
          alert('Inserisci titolo, data valida, ora e luogo.');
          return;
        }

        try {
          await updateDoc(doc(db, 'events', item.id), {
            title: newTitle.trim(),
            date: newDate.trim(),
            time: newTime.trim(),
            location: newLocation.trim(),
            description: newDescription.trim(),
            updatedAt: serverTimestamp()
          });

          await loadEvents();
        } catch (error) {
          console.error(error);
          alert('Non è stato possibile modificare l’allenamento.');
        }
      });

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'button button-quiet';
      cancelButton.textContent = 'Annulla';

      cancelButton.addEventListener('click', async () => {
        if (!confirm(`Vuoi annullare "${item.title}"?`)) return;

        try {
          await updateDoc(doc(db, 'events', item.id), {
            status: 'cancelled'
          });

          await loadEvents();
        } catch (error) {
          console.error(error);
          alert('Non è stato possibile annullare l’allenamento.');
        }
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button button-quiet';
      deleteButton.textContent = 'Elimina';

      deleteButton.addEventListener('click', async () => {
        if (!confirm(`Vuoi eliminare definitivamente "${item.title}"? Verranno eliminate anche tutte le presenze associate. Questa operazione non può essere annullata.`)) {
          return;
        }

        deleteButton.disabled = true;

        try {
          const attendanceSnapshot = await getDocs(collection(db, 'attendance'));

          const relatedAttendance = attendanceSnapshot.docs.filter(attendanceDoc => {
            return attendanceDoc.data().eventId === item.id;
          });

          const batch = writeBatch(db);

          relatedAttendance.forEach(attendanceDoc => {
            batch.delete(attendanceDoc.ref);
          });

          batch.delete(doc(db, 'events', item.id));

          await batch.commit();
          await loadEvents();

          if (selectedEventId === item.id) {
            selectedEventId = null;
          }
        } catch (error) {
          console.error(error);
          alert('Non è stato possibile eliminare l’allenamento e le presenze associate. Verifica i permessi Firebase.');
        } finally {
          deleteButton.disabled = false;
        }
      });

      controls.append(editButton, cancelButton, deleteButton);
      card.append(controls);
    }

    container.append(card);
  });
}

/* PRESENZE */

function populateAttendanceSelect() {
  const previousSelection = attendanceSelect.value;

  attendanceSelect.replaceChildren(
    new Option('Seleziona un allenamento...', '')
  );

  const availableEvents = allEvents.filter(item =>
    item.status !== 'cancelled' && item.date >= todayString()
  );

  availableEvents.forEach(item => {
    attendanceSelect.add(
      new Option(
        `${formatDate(item.date)} · ${item.title}`,
        item.id
      )
    );
  });

  attendanceEmpty.classList.toggle('hidden', availableEvents.length > 0);

  if (availableEvents.some(item => item.id === previousSelection)) {
    attendanceSelect.value = previousSelection;
  } else if (availableEvents.length) {
    attendanceSelect.value = availableEvents[0].id;
  }

  if (attendanceSelect.value) {
    loadAttendance(attendanceSelect.value);
  } else {
    selectedEventId = null;
    attendanceDetails.classList.add('hidden');
    attendanceControls.classList.add('hidden');
    attendanceResults.classList.add('hidden');
  }
}

attendanceSelect.addEventListener('change', () => {
  if (attendanceSelect.value) {
    loadAttendance(attendanceSelect.value);
  } else {
    selectedEventId = null;
    attendanceDetails.classList.add('hidden');
    attendanceControls.classList.add('hidden');
    attendanceResults.classList.add('hidden');
  }
});

$('#attendance-present').addEventListener('click', () => saveAttendance('present'));
$('#attendance-absent').addEventListener('click', () => saveAttendance('absent'));

async function loadAttendance(eventId) {
  selectedEventId = eventId;

  const event = allEvents.find(item => item.id === eventId);
  if (!event) return;

  attendanceEmpty.classList.add('hidden');
  attendanceDetails.classList.remove('hidden');
  attendanceControls.classList.remove('hidden');
  attendanceResults.classList.remove('hidden');

  attendanceDetails.textContent =
    `${event.title} · ${formatDate(event.date)} · ${event.time} · ${event.location}`;

  attendanceList.textContent = 'Caricamento presenze...';

  try {
    const snapshot = await getDocs(collection(db, 'attendance'));

    const membersSnapshot = await getDocs(collection(db, 'members'));
    membersByUid = new Map(membersSnapshot.docs.map(d => [d.id, d.data()]));
    const responses = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(item => item.eventId === eventId)
      .map(item => ({ ...item, name: displayMemberName(membersByUid.get(item.uid)) }));

    const myResponse = responses.find(item => item.uid === currentUser.uid);

    showMessage(
      attendanceMessage,
      myResponse
        ? `La tua risposta attuale è: ${myResponse.status === 'present' ? 'PRESENTE' : 'ASSENTE'}. Puoi modificarla.`
        : 'Non hai ancora comunicato la tua presenza.'
    );

    const present = responses.filter(item => item.status === 'present');
    const absent = responses.filter(item => item.status === 'absent');

    $('#present-count').textContent = present.length;
    $('#absent-count').textContent = absent.length;

    attendanceList.replaceChildren();

    appendAttendanceGroup(attendanceList, 'PRESENTI', present, 'present');
    appendAttendanceGroup(attendanceList, 'ASSENTI', absent, 'absent');

    if (currentRole === 'admin') {
      const activeMembers = membersSnapshot.docs
        .map(item => ({ uid: item.id, ...item.data() }))
        .filter(item => item.active === true);

      const responded = new Set(responses.map(item => item.uid));
      const unanswered = activeMembers.filter(item => !responded.has(item.uid));

      $('#unanswered-count').textContent = unanswered.length;

      const group = document.createElement('div');
      group.className = 'attendance-group';

      const heading = document.createElement('h4');
      heading.textContent = 'NON HANNO RISPOSTO';

      group.append(heading);

      if (!unanswered.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Tutti hanno risposto.';
        group.append(empty);
      } else {
        unanswered.forEach(member => {
          const row = document.createElement('div');
          row.className = 'attendance-person';
          row.textContent = displayMemberName(member);
          group.append(row);
        });
      }

      attendanceList.append(group);
      $('.unanswered-count').classList.remove('hidden');

    } else {
      $('#unanswered-count').textContent = '—';
      $('.unanswered-count').classList.add('hidden');
    }

  } catch (error) {
    console.error(error);
    attendanceList.textContent = 'Errore nel caricamento delle presenze.';
  }
}

function appendAttendanceGroup(container, title, people, status) {
  const group = document.createElement('div');
  group.className = 'attendance-group';

  const heading = document.createElement('h4');
  heading.textContent = title;

  group.append(heading);

  if (!people.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Nessuna risposta.';
    group.append(empty);
  } else {
    people.forEach(person => {
      const row = document.createElement('div');
      row.className = 'attendance-person';

      const name = document.createElement('span');
      name.textContent = displayMemberName(membersByUid.get(person.uid)) || person.name || 'Membro';

      const badge = document.createElement('span');
      badge.className = `attendance-badge ${status}`;
      badge.textContent = status === 'present' ? 'PRESENTE' : 'ASSENTE';

      row.append(name, badge);
      group.append(row);
    });
  }

  container.append(group);
}

async function saveAttendance(status) {
  if (!currentUser || !selectedEventId) return;

  const presentButton = $('#attendance-present');
  const absentButton = $('#attendance-absent');

  presentButton.disabled = true;
  absentButton.disabled = true;

  showMessage(attendanceMessage, 'Salvataggio risposta...');

  try {
    const attendanceId = `${selectedEventId}_${currentUser.uid}`;

    await setDoc(
      doc(db, 'attendance', attendanceId),
      {
        eventId: selectedEventId,
        uid: currentUser.uid,
        name: displayMemberName(currentMember),
        status,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    showMessage(
      attendanceMessage,
      `Risposta registrata: ${status === 'present' ? 'PRESENTE' : 'ASSENTE'}.`
    );

    await loadAttendance(selectedEventId);

  } catch (error) {
    console.error(error);
    showMessage(
      attendanceMessage,
      'Impossibile salvare la risposta. Verifica i permessi Firebase.',
      true
    );
  } finally {
    presentButton.disabled = false;
    absentButton.disabled = false;
  }
}

/* FUNZIONI DI SUPPORTO */

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return 'Data da definire';

  return new Date(`${value}T12:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatTimestamp(value) {
  if (!value?.toDate) return 'Data non disponibile';

  return value.toDate().toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

/* DOCUMENTI PRIVATI - SUPABASE STORAGE + DATABASE */

function safeFileName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'documento.pdf';
}

function setDocumentMessage(message, isError = false) {
  showMessage(documentsMessage, message, isError);
}

async function loadDocuments() {
  if (!documentsList || !documentCategoriesList) return;

  documentsList.textContent = 'Caricamento documenti...';
  documentCategoriesList.textContent = 'Caricamento categorie...';
  if (currentRole === 'admin' && documentCategoriesAdminList) {
    documentCategoriesAdminList.textContent = 'Caricamento categorie...';
  }

  try {
    const [categoryResult, documentResult] = await Promise.all([
      supabase.from('document_categories').select('id, name').order('name'),
      supabase.from('documents')
        .select('id, category_id, title, file_name, storage_path, created_at')
        .order('created_at', { ascending: false })
    ]);

    if (categoryResult.error) throw categoryResult.error;
    if (documentResult.error) throw documentResult.error;

    documentCategories = categoryResult.data || [];
    storedDocuments = documentResult.data || [];

    renderDocumentCategories();
    renderDocuments();
    populateDocumentCategorySelect();
    setDocumentMessage('Archivio aggiornato.');
  } catch (error) {
    console.error('Errore caricamento archivio Supabase:', error);
    documentsList.textContent = 'Non è stato possibile caricare i documenti.';
    documentCategoriesList.textContent = 'Non è stato possibile caricare le categorie.';
    if (documentCategoriesAdminList) {
      documentCategoriesAdminList.textContent = 'Errore nel caricamento delle categorie.';
    }
    setDocumentMessage(
      'Accesso all’archivio non riuscito. Verifica il collegamento Supabase e che il tuo account sia autorizzato.',
      true
    );
  }
}

function populateDocumentCategorySelect() {
  if (!documentUploadCategory) return;
  const previous = documentUploadCategory.value;
  documentUploadCategory.replaceChildren(
    new Option('Seleziona una categoria...', '')
  );
  documentCategories.forEach(category => {
    documentUploadCategory.add(new Option(category.name, String(category.id)));
  });
  if (documentCategories.some(category => String(category.id) === previous)) {
    documentUploadCategory.value = previous;
  }
}

function renderDocumentCategories() {
  documentCategoriesList.replaceChildren();
  if (!documentCategories.length) {
    documentCategoriesList.className = 'empty-state';
    documentCategoriesList.textContent = 'Nessuna categoria disponibile.';
  } else {
    documentCategoriesList.className = 'document-category-list';
    documentCategories.forEach(category => {
      const row = document.createElement('div');
      row.className = 'document-category-row';
      const name = document.createElement('strong');
      name.textContent = category.name;
      const count = storedDocuments.filter(item => item.category_id === category.id).length;
      const amount = document.createElement('small');
      amount.textContent = `${count} ${count === 1 ? 'documento' : 'documenti'}`;
      row.append(name, amount);
      documentCategoriesList.append(row);
    });
  }

  if (!documentCategoriesAdminList) return;
  documentCategoriesAdminList.replaceChildren();
  if (!documentCategories.length) {
    documentCategoriesAdminList.textContent = 'Nessuna categoria creata.';
    return;
  }

  documentCategories.forEach(category => {
    const row = document.createElement('div');
    row.className = 'document-category-row';
    const name = document.createElement('strong');
    name.textContent = category.name;
    const controls = document.createElement('div');
    controls.className = 'member-controls';

    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.className = 'button button-quiet';
    renameButton.textContent = 'Rinomina';
    renameButton.addEventListener('click', () => renameDocumentCategory(category));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'button button-quiet';
    deleteButton.textContent = 'Elimina';
    deleteButton.addEventListener('click', () => deleteDocumentCategory(category));

    controls.append(renameButton, deleteButton);
    row.append(name, controls);
    documentCategoriesAdminList.append(row);
  });
}

/* VISUALIZZAZIONE DOCUMENTI RAGGRUPPATI PER CATEGORIA */

function renderDocuments() {
  documentsList.replaceChildren();

  if (!documentCategories.length && !storedDocuments.length) {
    documentsList.className = 'empty-state';
    documentsList.textContent = 'Nessun documento condiviso.';
    return;
  }

  documentsList.className = 'document-list';

  function createDocumentRow(item) {
    const row = document.createElement('article');
    row.className = 'document-row';

    const info = document.createElement('div');
    info.className = 'document-info';

    const title = document.createElement('strong');
    title.textContent = item.title;

    const meta = document.createElement('small');
    meta.textContent = 'PDF';
    info.append(title, meta);

    const controls = document.createElement('div');
    controls.className = 'member-controls';

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'button button-primary';
    openButton.textContent = 'Apri / Scarica';
    openButton.addEventListener('click', () => openPrivateDocument(item));
    controls.append(openButton);

    if (currentRole === 'admin') {
      const renameButton = document.createElement('button');
      renameButton.type = 'button';
      renameButton.className = 'button button-quiet';
      renameButton.textContent = 'Rinomina';
      renameButton.addEventListener('click', () => renameDocument(item));

      const replaceButton = document.createElement('button');
      replaceButton.type = 'button';
      replaceButton.className = 'button button-quiet';
      replaceButton.textContent = 'Sostituisci PDF';
      replaceButton.addEventListener('click', () => replaceDocument(item));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button button-quiet';
      deleteButton.textContent = 'Elimina';
      deleteButton.addEventListener('click', () => deleteDocument(item));

      controls.append(renameButton, replaceButton, deleteButton);
    }

    row.append(info, controls);
    return row;
  }

  documentCategories.forEach(category => {
    const categoryDocuments = storedDocuments.filter(
      item => String(item.category_id) === String(category.id)
    );

    const section = document.createElement('section');
    section.className = 'document-category-section';

    const heading = document.createElement('div');
    heading.className = 'document-category-row';

    const name = document.createElement('strong');
    name.textContent = category.name;

    const count = document.createElement('small');
    count.textContent = `${categoryDocuments.length} ${categoryDocuments.length === 1 ? 'documento' : 'documenti'}`;
    heading.append(name, count);
    section.append(heading);

    const files = document.createElement('div');
    files.className = 'document-category-files';

    if (categoryDocuments.length) {
      categoryDocuments.forEach(item => files.append(createDocumentRow(item)));
    } else {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Nessun documento in questa categoria.';
      files.append(empty);
    }

    section.append(files);
    documentsList.append(section);
  });

  const uncategorizedDocuments = storedDocuments.filter(item =>
    !documentCategories.some(
      category => String(category.id) === String(item.category_id)
    )
  );

  if (uncategorizedDocuments.length) {
    const section = document.createElement('section');
    section.className = 'document-category-section';

    const heading = document.createElement('div');
    heading.className = 'document-category-row';

    const name = document.createElement('strong');
    name.textContent = 'Senza categoria';
    heading.append(name);
    section.append(heading);

    const files = document.createElement('div');
    files.className = 'document-category-files';
    uncategorizedDocuments.forEach(item => files.append(createDocumentRow(item)));

    section.append(files);
    documentsList.append(section);
  }
}

async function openPrivateDocument(item) {
  try {
    const { data, error } = await supabase.storage
      .from(documentsBucket)
      .createSignedUrl(item.storage_path, 60);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('Link temporaneo non disponibile.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error(error);
    setDocumentMessage('Impossibile aprire il PDF. Verifica i permessi di accesso.', true);
  }
}

if (documentCategoryForm) {
  documentCategoryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (currentRole !== 'admin') return;
    const name = documentCategoryName.value.trim();
    if (!name) return;
    const button = documentCategoryForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(documentCategoryMessage, 'Creazione categoria...');
    try {
      const { error } = await supabase.from('document_categories').insert({ name });
      if (error) throw error;
      documentCategoryForm.reset();
      showMessage(documentCategoryMessage, 'Categoria creata correttamente.');
      await loadDocuments();
    } catch (error) {
      console.error(error);
      showMessage(documentCategoryMessage, 'Impossibile creare la categoria. Verifica che il nome non sia già utilizzato.', true);
    } finally {
      button.disabled = false;
    }
  });
}

async function renameDocumentCategory(category) {
  const name = prompt('Nuovo nome della categoria:', category.name);
  if (name === null || !name.trim()) return;
  try {
    const { error } = await supabase.from('document_categories')
      .update({ name: name.trim() }).eq('id', category.id);
    if (error) throw error;
    await loadDocuments();
  } catch (error) {
    console.error(error);
    alert('Non è stato possibile rinominare la categoria.');
  }
}

async function deleteDocumentCategory(category) {
  const count = storedDocuments.filter(item => item.category_id === category.id).length;
  if (count > 0) {
    alert('Questa categoria contiene documenti. Sposta o elimina prima i documenti associati.');
    return;
  }
  if (!confirm(`Vuoi eliminare la categoria "${category.name}"?`)) return;
  try {
    const { error } = await supabase.from('document_categories')
      .delete().eq('id', category.id);
    if (error) throw error;
    await loadDocuments();
  } catch (error) {
    console.error(error);
    alert('Non è stato possibile eliminare la categoria.');
  }
}

if (documentUploadForm) {
  documentUploadForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (currentRole !== 'admin' || !currentUser) return;

    const title = documentUploadTitle.value.trim();
    const categoryId = Number(documentUploadCategory.value);
    const file = documentUploadFile.files?.[0];
    if (!title || !categoryId || !file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showMessage(documentUploadMessage, 'È consentito caricare soltanto file PDF.', true);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showMessage(documentUploadMessage, 'Il PDF supera il limite di 20 MB.', true);
      return;
    }

    const button = documentUploadForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(documentUploadMessage, 'Caricamento PDF in corso...');
    const storagePath = `${currentUser.uid}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(documentsBucket)
        .upload(storagePath, file, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('documents').insert({
        category_id: categoryId,
        title,
        file_name: file.name,
        storage_path: storagePath,
        created_by: currentUser.uid
      });
      if (insertError) {
        await supabase.storage.from(documentsBucket).remove([storagePath]);
        throw insertError;
      }

      documentUploadForm.reset();
      showMessage(documentUploadMessage, 'Documento caricato correttamente.');
      await loadDocuments();
    } catch (error) {
      console.error(error);
      showMessage(documentUploadMessage, 'Errore durante il caricamento. Verifica le autorizzazioni Supabase.', true);
    } finally {
      button.disabled = false;
    }
  });
}

async function renameDocument(item) {
  const title = prompt('Nuovo titolo del documento:', item.title);
  if (title === null || !title.trim()) return;
  try {
    const { error } = await supabase.from('documents')
      .update({ title: title.trim() }).eq('id', item.id);
    if (error) throw error;
    await loadDocuments();
  } catch (error) {
    console.error(error);
    alert('Non è stato possibile rinominare il documento.');
  }
}

function replaceDocument(item) {
  if (currentRole !== 'admin') return;
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'application/pdf,.pdf';
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('È consentito caricare soltanto file PDF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('Il PDF supera il limite di 20 MB.');
      return;
    }

    const newPath = `${currentUser.uid}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage.from(documentsBucket)
        .upload(newPath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.from('documents').update({
        file_name: file.name,
        storage_path: newPath
      }).eq('id', item.id);
      if (updateError) {
        await supabase.storage.from(documentsBucket).remove([newPath]);
        throw updateError;
      }

      const { error: removeError } = await supabase.storage.from(documentsBucket)
        .remove([item.storage_path]);
      if (removeError) console.error('Il vecchio PDF non è stato rimosso:', removeError);
      alert('PDF sostituito correttamente.');
      await loadDocuments();
    } catch (error) {
      console.error(error);
      alert('Non è stato possibile sostituire il PDF.');
    }
  });
  picker.click();
}

async function deleteDocument(item) {
  if (!confirm(`Vuoi eliminare definitivamente "${item.title}"?`)) return;
  try {
    const { error: removeError } = await supabase.storage.from(documentsBucket)
      .remove([item.storage_path]);
    if (removeError) throw removeError;

    const { error: deleteError } = await supabase.from('documents')
      .delete().eq('id', item.id);
    if (deleteError) throw deleteError;
    await loadDocuments();
  } catch (error) {
    console.error(error);
    alert('Non è stato possibile eliminare il documento.');
  }
}



/* NAVIGAZIONE TRA LE PAGINE DELL'AREA MEMBRI */
const validPages = new Set(['home', 'bacheca', 'calendario', 'presenze', 'documenti', 'galleria', 'membri', 'profilo']);

function renderCurrentPage() {
  if (!appView || appView.classList.contains('hidden')) return;

  const requestedPage = (window.location.hash || '#home').slice(1).toLowerCase();
  const activePage = validPages.has(requestedPage) ? requestedPage : 'home';

  document.querySelectorAll('[data-page]').forEach(page => {
    page.classList.toggle('hidden', page.dataset.page !== activePage);
  });

  document.querySelectorAll('[data-nav]').forEach(link => {
    const isActive = link.dataset.nav === activePage;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const titles = {
    home: 'Home',
    bacheca: 'Bacheca',
    calendario: 'Calendario',
    presenze: 'Presenze',
    documenti: 'Documenti',
    galleria: 'Galleria',
    membri: 'Membri',
    profilo: 'Il mio profilo'
  };
  document.title = `${titles[activePage]} — 1ª Compagnia Easy`;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

window.addEventListener('hashchange', renderCurrentPage);

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