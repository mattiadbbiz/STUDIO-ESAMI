# Studio Esami

Web app per studiare gli esami con flashcard, domande chiuse e domande aperte generate dal progetto Claude.
Gira su Cloudflare Workers con database D1: esami, moduli, contenuti e storico restano salvati online e la usi da telefono e PC.

## Struttura

| Percorso | Cosa contiene |
| --- | --- |
| `wrangler.toml` | Configurazione del Worker e del database |
| `schema.sql` | Tabelle del database (esami, moduli, elementi, sessioni) |
| `src/worker.js` | API: esami, import JSON, risultati, riepilogo, backup |
| `public/` | L'app: `index.html`, `style.css`, `app.js`, icona e manifest |
| `esempi/` | 6 file JSON di prova (moduli, flashcard, chiuse, aperte, mappe, mappa dell'esame) |

## Messa online (una volta sola)

Dalla cartella del progetto, nel terminale:

```bash
npm install
npx wrangler login
npx wrangler d1 create studio-esami-db
```

Il comando `d1 create` stampa un `database_id`: copialo in `wrangler.toml` (in questo zip c'è già quello del database `studio-esami-db` esistente). Poi:

```bash
npx wrangler d1 execute studio-esami-db --remote --file=./schema.sql
npx wrangler secret put APP_PASSWORD
npx wrangler deploy
```

`APP_PASSWORD` è la password che l'app ti chiede al primo accesso: senza, chiunque abbia il link vedrebbe i tuoi dati.
Alla fine Wrangler stampa l'indirizzo `https://studio-esami.<tuo-account>.workers.dev`.

Sul telefono apri l'indirizzo e usa "Aggiungi a schermata Home" per averla come un'app.

## Aggiornare l'app

Dopo aver cambiato i file: `npx wrangler deploy`. Il database e lo storico non vengono toccati.

## Come si usa

1. **Crea esame** dalla home, es. "Fisica 1".
2. Nel progetto Claude scrivi `moduli`, poi nell'esame tocca **Carica JSON** e carica il file (o incolla il testo).
3. Per ogni modulo, in Claude: `flashcard`, `domande chiuse`, `domande aperte`, `mappa`. Carichi i file da qualsiasi pagina dell'esame: l'app li mette nel modulo giusto leggendo `modulo_codice`.
4. Studia dal modulo, oppure da **Teoria generale** (flashcard miste) e **Pratica generale** (domande miste), scegliendo quante e se "Solo da ripassare".
5. A fine sessione, **Capisci dove ho sbagliato** copia risposte, risposte modello e il comando `analisi risposte`, poi apre Claude: incolla nel progetto dell'esame.

Ricaricare un file con gli stessi `id` aggiorna il testo ma tiene lo storico; gli `id` nuovi vengono aggiunti.

## Mappe

Il comando `mappa` genera un file con due mappe per modulo. Il comando `mappa esame` genera la **mappa complessiva** dell'esame, con i collegamenti tra moduli: si carica dalla pagina dell'esame e si apre dalla scheda "Mappa complessiva". Finché non la carichi, l'app ne compone una unendo le mappe dei moduli. La **mappa dei concetti** si apre come mappa (trascina, pizzica per lo zoom, tocca un ramo per aprirlo o chiuderlo) oppure a cascata. Lo **schema per gli esercizi** si apre come percorso guidato (rispondi alle domande una alla volta) oppure come schema completo.

## Voti e ripasso

Ogni elemento vale 1 (so, giusta), 0,5 (parziale) o 0 (da ripassare, sbagliata). Il voto di un modulo è la media ×10 sugli elementi già provati.
Gli elementi sbagliati o parziali finiscono in "da ripassare" e nelle sessioni escono per primi; quelli che sai tornano più di rado.

## Backup

I dati sono già online. Dalla home, **Backup** scarica una copia completa in un file e la può ripristinare.
