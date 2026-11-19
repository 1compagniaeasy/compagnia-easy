# 1ª Compagnia Easy — Members Area (PWA starter)

Starter tecnico per il portale privato della Compagnia. Interfaccia responsive, manifest PWA, service worker, login Google tramite Firebase Authentication e autorizzazione membri tramite Firestore.

## Importante prima della pubblicazione

- Il progetto è una base iniziale: bacheca, calendario, presenze e archivio sono segnaposto UI, non ancora funzioni operative.
- Il codice ospitato su GitHub Pages è pubblico. Non inserire dati riservati, password o documenti nel repository.
- La riservatezza dei dati dipende dalle regole Firestore e dalla configurazione Firebase, non dal fatto che il link del sito sia difficile da trovare.
- Firebase `apiKey` nel client identifica il progetto; non è una password. La protezione va fatta con Authentication, regole Firestore e restrizioni appropriate.
- I piani gratuiti hanno limiti e condizioni che possono cambiare. Controllare sempre il piano Spark e le quote prima di attivare servizi.

## 1. Crea il progetto Firebase

1. Apri https://console.firebase.google.com/ e crea un progetto (piano Spark gratuito).
2. Aggiungi un'app Web e copia la configurazione Firebase.
3. In **Authentication → Sign-in method**, abilita Google.
4. In **Authentication → Settings → Authorized domains**, aggiungi il dominio GitHub Pages che userai, ad esempio `TUO-UTENTE.github.io`.
5. Crea il database **Cloud Firestore** in modalità produzione.
6. Apri **Firestore → Rules**, sostituisci le regole con il contenuto di `firestore.rules` e pubblicale.
7. In `app.js`, sostituisci i valori `INSERISCI_...` con la configurazione Web del tuo progetto Firebase.

## 2. Crea il primo amministratore

Dopo aver pubblicato il sito e fatto un primo accesso Google con il tuo account:

1. In Firebase Console → Authentication → Users, copia il tuo UID.
2. In Firestore crea la collezione `members` (se non esiste).
3. Crea un documento con ID esattamente uguale al tuo UID.
4. Inserisci questi campi:
   - `name` (string): il tuo nome
   - `email` (string): la tua email Google
   - `role` (string): `admin`
   - `active` (boolean): `true`
5. Esci e accedi di nuovo. Il tuo account sarà riconosciuto come amministratore.

La prima assegnazione dell'amministratore viene fatta manualmente dalla console Firebase, non dal browser: così un utente non può promuovere sé stesso.

## 3. Aggiungi gli altri membri e amministratori

Per ogni membro, chiedi di accedere una prima volta con Google e recupera il suo UID da Authentication → Users. Crea `members/UID` con `name`, `email`, `role` (`member` oppure `admin`) e `active: true`. Non condividere il database con tutti: solo gli amministratori devono avere accesso alla console Firebase.

## 4. Pubblica con GitHub Pages

1. Crea un repository GitHub, per esempio `compagnia-easy-pwa`.
2. Carica i file di questa cartella nella radice del repository.
3. In **Settings → Pages**, seleziona `Deploy from a branch`, branch `main`, cartella `/ (root)` e salva.
4. Attendi la pubblicazione. Il sito avrà un indirizzo simile a `https://TUO-UTENTE.github.io/compagnia-easy-pwa/`.
5. Se usi un repository con nome diverso, verifica che l'app funzioni nel percorso del progetto.

## 5. Installazione sui telefoni

- iPhone: aprire il link in Safari → Condividi → Aggiungi alla schermata Home.
- Android: aprire il link in Chrome → menu ⋮ → Installa app oppure Aggiungi a schermata Home.

La PWA richiede HTTPS, fornito da GitHub Pages.

## 6. Prossime fasi di sviluppo

1. Collegare Firebase e verificare login/ruoli.
2. Realizzare gestione membri amministratori (inviti/attivazione/disattivazione).
3. Bacheca con pubblicazione avvisi.
4. Calendario eventi e modulo presenze con dati privati in Firestore.
5. Documenti e galleria con archiviazione e permessi adeguati.
6. Rifinire installazione, icone e test iOS/Android.
