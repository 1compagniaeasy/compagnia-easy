const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
initializeApp();
const db = getFirestore();

async function sendToActiveMembers(title, body, url = '/#home', excludedUid = null) {
  const members = await db.collection('members').where('active', '==', true).get();
  const tokens = [];
  for (const member of members.docs) {
    if (member.id === excludedUid) continue;
    const devices = await member.ref.collection('devices').get();
    devices.forEach(device => { if (device.data().token) tokens.push({ token: device.data().token, ref: device.ref }); });
  }
  if (!tokens.length) return;
  const result = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(item => item.token),
    notification: { title, body },
    data: { url },
    webpush: { fcmOptions: { link: url } }
  });
  const invalid = [];
  result.responses.forEach((response, index) => {
    if (!response.success && ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(response.error?.code)) invalid.push(tokens[index].ref.delete());
  });
  await Promise.all(invalid);
}

exports.newAnnouncementPush = onDocumentCreated('announcements/{id}', async event => {
  const data = event.data.data();
  await sendToActiveMembers('Nuova comunicazione', data.title || 'È stata pubblicata una comunicazione in bacheca.', '/#bacheca');
});

exports.eventCreatedPush = onDocumentCreated('events/{id}', async event => {
  const data = event.data.data();
  if (data.status === 'cancelled') return;
  await sendToActiveMembers('Nuovo allenamento pubblicato', `${data.title || 'Nuova attività'} · ${data.date || ''} ${data.time || ''}`, '/#calendario');
});

exports.eventUpdatedPush = onDocumentUpdated('events/{id}', async event => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const cancelled = after.status === 'cancelled';
  await sendToActiveMembers(cancelled ? 'Allenamento annullato' : 'Allenamento modificato', after.title || 'Consulta il calendario per i dettagli aggiornati.', '/#calendario');
});

// Controlla ogni 15 minuti gli eventi che iniziano tra circa 24 ore.
// Il campo reminderSentAt evita invii ripetuti.
exports.attendanceReminderPush = onSchedule('every 15 minutes', async () => {
  const now = new Date();
  const from = new Date(now.getTime() + 23.75 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 24.25 * 60 * 60 * 1000);
  const date = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const events = await db.collection('events').where('date', '>=', date(from)).where('date', '<=', date(to)).get();
  for (const event of events.docs) {
    const data = event.data();
    if (data.status === 'cancelled' || data.reminderSentAt) continue;
    const members = await db.collection('members').where('active', '==', true).get();
    const attendance = await db.collection('attendance').where('eventId', '==', event.id).get();
    const responded = new Set(attendance.docs.map(doc => doc.data().uid));
    for (const member of members.docs) {
      if (responded.has(member.id)) continue;
      const devices = await member.ref.collection('devices').get();
      const tokens = devices.docs.map(d => d.data().token).filter(Boolean);
      if (tokens.length) await getMessaging().sendEachForMulticast({ tokens, notification: { title: 'Promemoria presenza', body: `Non hai ancora risposto per ${data.title || 'il prossimo allenamento'}.` }, data: { url: '/#presenze' } });
    }
    await event.ref.update({ reminderSentAt: new Date() });
  }
});
