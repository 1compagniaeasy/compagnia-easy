
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

  $('#welcome-text').textContent =
    `Bentornato, ${name.split(' ')[0]}.`;

  $('#admin-banner').classList.toggle('hidden', role !== 'admin');

  membersAdmin.classList.toggle('hidden', role !== 'admin');
  membersReadonly.classList.toggle('hidden', role === 'admin');

  $('#announcements-admin').classList.toggle('hidden', role !== 'admin');
  $('#events-admin').classList.toggle('hidden', role !== 'admin');

  if (role === 'admin') {
    loadMembers();
  }

  loadAnnouncements();
  loadEvents();
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

    currentRole = member.role === 'admin' ? 'admin' : 'member';
    showApp(user, currentRole);

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

    showMessage(inviteMessage, `Invito registrato per ${email}.`);
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

      name.textContent = member.name || member.email || 'Membro';
      email.textContent = member.email || '';
      status.textContent = member.active ? 'ATTIVO' : 'SOSPESO';

      info.append(name, email, status);

      const controls = document.createElement('div');
      controls.className = 'member-controls';

      const roleSelect = document.createElement('select');
      roleSelect.add(new Option('Membro', 'member'));
      roleSelect.add(new Option('Amministratore', 'admin'));
      roleSelect.value = member.role || 'member';

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

      card.append(cancelButton);
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

    const responses = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(item => item.eventId === eventId);

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

    // Solo gli amministratori possono leggere l'elenco completo dei membri.
    if (currentRole === 'admin') {
      const membersSnapshot = await getDocs(collection(db, 'members'));

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
          row.textContent = member.name || member.email || 'Membro';
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
      name.textContent = person.name || 'Membro';

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
        name: currentUser.displayName || currentUser.email || 'Membro',
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
