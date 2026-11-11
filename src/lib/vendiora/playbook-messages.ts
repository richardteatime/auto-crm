// Calendar of automatic messages of the VendiOra playbook (M1–M10 + offer in signature + onboarding G0–G7).
// Texts quoted in the playbook are used as written ([Nome] → {nome}, [Brand] → {brand}, [Commerciale] → {commerciale});
// the others follow the playbook description. Every text is editable in Impostazioni → Playbook.
// channel "task" = something a person must do (phone call, voice note, personal message): it becomes a team task.

import type { TaskRole } from "@/lib/vendiora/types";

export type Channel = "wa" | "email" | "task";
export interface PbMessage {
  id: string;
  group: string;
  when: string;
  channel: Channel;
  /** for tasks */
  role?: TaskRole;
  title?: string;
  text: string;
}

const M = (id: string, group: string, when: string, channel: Channel, text: string, extra: Partial<PbMessage> = {}): PbMessage => ({ id, group, when, channel, text, ...extra });

export const PB_GROUPS: Record<string, string> = {
  M1: "M1 · Lead appena arrivato",
  M2: "M2 · Call di vendita prenotata",
  M3: "M3 · Call svolta ma non chiusa",
  OF: "Offerta in firma + link di pagamento",
  M4: "M4 · Link di pagamento inviato ma non pagato",
  M5: "M5 · Pagamento ricevuto (attivazione)",
  ONB: "Onboarding: i primi 7 giorni",
  M6: "M6 · Ogni call (consulenza e DFY)",
  M7: "M7 · Consulenza, ritmo settimanale",
  M8: "M8 · Done For You, scadenze di produzione",
  M9: "M9 · Rate e pagamenti",
  M10: "M10 · Fine percorso",
  HS: "Health score",
};

export const PB_MESSAGES: PbMessage[] = [
  // ---------------- M1 ----------------
  M("M1.first.A-DELUSO", "M1", "T+3 min, angle A-DELUSO (contiene la domanda 1)", "wa", "Ciao {nome}, sono {commerciale} di {brand}. Ho visto la tua richiesta. Ti faccio 3 domande veloci per capire se possiamo aiutarti davvero. Prima: che percorso hai fatto prima e cosa non ha funzionato?"),
  M("M1.first.A-SCAM", "M1", "T+3 min, angle A-SCAM (contiene la domanda 1)", "wa", "Ciao {nome}, sono {commerciale} di {brand}. Prima di tutto: niente promesse di guadagno facile. 3 domande veloci e ti dico onestamente se possiamo esserti utili. Prima: con chi ti sei scottato e cosa è successo?"),
  M("M1.first.A-SISTEMA", "M1", "T+3 min, angle A-SISTEMA (contiene la domanda 1)", "wa", "Ciao {nome}, sono {commerciale} di {brand}. 3 domande veloci per capire il tuo caso. Prima: mi mandi il link del tuo store e mi dici il problema più grosso tra vendite, ads e gestione?"),
  M("M1.first.A-SCALA", "M1", "T+3 min, angle A-SCALA (contiene la domanda 1)", "wa", "Ciao {nome}, sono {commerciale} di {brand}. 3 domande veloci per capire come farti crescere. Prima: quanto fatturi oggi al mese, più o meno, e dove vuoi arrivare?"),
  M("M1.first.none", "M1", "T+3 min, angle non indicato (contiene la domanda 1)", "wa", "Ciao {nome}, sono {commerciale} di {brand}. Ho visto la tua richiesta. Ti faccio 3 domande veloci per capire se possiamo aiutarti davvero. Prima: hai già un ecommerce attivo o parti da zero?"),
  M("M1.q2", "M1", "Subito dopo la risposta 1", "wa", "Vuoi imparare a farlo tu o preferisci che lo facciamo noi per te?"),
  M("M1.q3", "M1", "Subito dopo la risposta 2", "wa", "Sei pronto a investire tra 1.500 € e 4.000 € per partire entro le prossime 2 settimane? (Sì / Ne parliamo / No)"),
  M("M1.qualified", "M1", "Dopo la risposta 3, se qualificato", "wa", "Perfetto, ti fisso una call con {commerciale}: scegli qui l'orario 👉 {link}"),
  M("M1.nurturing", "M1", "Dopo la risposta 3, se non qualificato", "wa", "Grazie {nome}, ti capisco: non è il momento giusto e va benissimo così. Intanto ti lascio un contenuto gratuito che ti può essere utile 👉 {link}\n\nQuando vuoi ripartire scrivimi qui."),
  M("M1.callNow", "M1", "Qualificato, nessuna prenotazione dopo 1 h", "task", "Chiama {nome} per fissare la call di vendita: è qualificato ma non ha prenotato.", { role: "commerciale", title: "Chiama ora: lead qualificato senza call" }),
  M("M1.nudge2h", "M1", "Nessuna risposta, T+2 h", "wa", "Ciao {nome}, ti è arrivato il mio messaggio? Mi basta una risposta veloce"),
  M("M1.voice1d", "M1", "Nessuna risposta, T+1 g alle 10:00", "task", "Manda a {nome} il vocale breve registrato per l'angle {angle}.", { role: "commerciale", title: "Vocale WhatsApp per angle" }),
  M("M1.problem3d", "M1", "Nessuna risposta, T+3 g alle 18:00", "wa", "Hai ancora {problema}? Rispondi SÌ e ti scrivo io"),
  M("M1.repeat24h", "M1", "Risposte incomplete da 24 h", "wa", "{nome}, mi manca solo questa risposta: {domanda}"),
  M("M1.close7d", "M1", "Nessuna risposta, T+7 g (→ Nurturing)", "wa", "Chiudo la tua richiesta, se ti serve scrivimi qui"),
  M("M1.nurtureEmail", "M1", "T+14 g, +30 g, poi ogni 30 g (email)", "email", "Ciao {nome},\n\nti lascio un contenuto utile per il tuo progetto ecommerce: {link}\n\nSe vuoi ripartire, rispondi a questa email o scrivici su WhatsApp e riprendiamo da dove eravamo.\n\n{brand}"),

  // ---------------- M2 ----------------
  M("M2.confirm", "M2", "Alla prenotazione (WhatsApp + email)", "wa", "Ciao {nome}, call confermata con {commerciale} {data} alle {ora}.{linkcall}\n\nA presto!"),
  M("M2.preframe", "M2", "Alla prenotazione + 5 min (email)", "email", "Ciao {nome},\n\nprima della nostra call ti lascio un video di 5 minuti: chi siamo, come lavoriamo e cosa non facciamo.\n\n{video}\n\nCi sentiamo {data} alle {ora}.\n\n{commerciale} – {brand}"),
  M("M2.t24", "M2", "T−24 h", "wa", "Domani alle {ora} ci sentiamo. Confermi con un OK?"),
  M("M2.noConfirm", "M2", "T−24 h senza risposta", "task", "{nome} non ha confermato la call di domani alle {ora}: contattalo.", { role: "commerciale", title: "Call di vendita non confermata" }),
  M("M2.t3", "M2", "T−3 h", "wa", "{nome}, ci sentiamo oggi alle {ora}.{storehint}"),
  M("M2.t15", "M2", "T−15 min", "wa", "Ci siamo! Ecco il link della call 👉 {linkcall}"),
  M("M2.absent", "M2", "T+5 min, se assente (segnato no-show)", "wa", "Ti stiamo aspettando, tutto ok?"),
  M("M2.absentCall", "M2", "T+5 min, se assente", "task", "{nome} non si è presentato alla call di vendita: chiamalo ora.", { role: "commerciale", title: "No-show: chiama il lead" }),
  M("M2.rebook1h", "M2", "T+1 h, se no-show", "wa", "{nome}, nessun problema: capita. Scegli qui un nuovo orario 👉 {link}"),
  M("M2.rebook1d", "M2", "T+1 g, se no-show", "wa", "Ciao {nome}, ti tengo ancora un posto per la call con {commerciale}. Riprenota qui 👉 {link}"),
  M("M2.rebook3d", "M2", "T+3 g, se no-show (poi Nurturing)", "wa", "{nome}, ultimo messaggio da parte mia: se vuoi ancora parlarne, l'agenda è qui 👉 {link}"),

  // ---------------- M3 ----------------
  M("M3.recap", "M3", "T+1 h (email)", "email", "Ciao {nome},\n\ngrazie per la call. Ecco il riepilogo.\n\nObiettivo: {obiettivo}\nPacchetto proposto: {pacchetto} – {prezzo}\nCosa include e condizioni: {link}\n\nPer partire basta accettare e firmare dal link qui sopra.\n\n{commerciale} – {brand}"),
  M("M3.obj.prezzo", "M3", "T+1 g, obiezione «prezzo»", "wa", "Ciao {nome}, ripensavo alla nostra call. Sul prezzo: nel {pacchetto} è tutto scritto nell'offerta, senza costi nascosti da parte nostra, e se ti aiuta si può pagare a rate. Vuoi che ti mostri come?"),
  M("M3.obj.tempo", "M3", "T+1 g, obiezione «tempo»", "wa", "Ciao {nome}, sul tempo: il percorso è costruito a passi settimanali, con compiti chiari e una call a settimana. Se preferisci delegare, c'è anche la formula Done For You. Ne parliamo 5 minuti?"),
  M("M3.obj.fiducia", "M3", "T+1 g, obiezione «fiducia»", "wa", "Ciao {nome}, capisco i dubbi. Niente promesse di guadagno: ti mostriamo processi, casi reali e cosa è incluso, tutto per iscritto nel contratto. Vuoi vedere il caso di un cliente partito come te?"),
  M("M3.obj.socio", "M3", "T+1 g, obiezione «socio»", "wa", "Ciao {nome}, se vuoi coinvolgere il tuo socio o chi decide con te, possiamo fare una call breve insieme e rispondere alle sue domande. Quando vi andrebbe?"),
  M("M3.obj.generic", "M3", "T+1 g, obiezione non indicata", "wa", "Ciao {nome}, hai avuto modo di ripensare alla proposta? Se c'è un dubbio che ti frena dimmelo pure: ti rispondo con calma."),
  M("M3.call3d", "M3", "T+3 g (telefono)", "task", "Follow-up telefonico con {nome} sulla proposta {pacchetto}.", { role: "commerciale", title: "Follow-up telefonico della proposta" }),
  M("M3.case5d", "M3", "T+5 g", "wa", "{nome}, ti lascio il caso di un cliente con una situazione simile alla tua 👉 {link}"),
  M("M3.close7d", "M3", "T+7 g (→ Perso o Nurturing)", "wa", "Ti tengo il posto fino a domani, poi chiudo la proposta"),
  M("M3.lost", "M3", "T+8 g senza pagamento (A6)", "task", "La proposta a {nome} è chiusa senza pagamento: segna il motivo di perdita (prezzo, tempistica, fiducia, decisore, non adatto).", { role: "commerciale", title: "Lead perso: indica il motivo" }),

  // ---------------- Offer in signature ----------------
  M("OF.send", "OF", "Minuto 0 (WhatsApp + email)", "wa", "Ciao {nome}, ecco la tua offerta {brand} per «{pacchetto}» ({prezzo}). Leggi il contratto e firmalo qui 👉 {link}{pagamento}\n\nL'attivazione parte appena c'è firma e pagamento."),
  M("OF.sign4h", "OF", "T+4 h, se non firmata", "wa", "Ti manca solo la firma per partire 👉 {link}"),
  M("OF.call24h", "OF", "T+24 h, se non firmata (telefono)", "task", "{nome} non ha ancora firmato l'offerta {pacchetto}: chiamalo.", { role: "commerciale", title: "Offerta non firmata: chiama" }),
  M("OF.last48h", "OF", "T+48 h, ultimo promemoria (poi Follow-up)", "wa", "{nome}, ultimo promemoria: l'offerta per «{pacchetto}» ti aspetta qui 👉 {link}"),

  // ---------------- M4 ----------------
  M("M4.paid2h", "M4", "T+2 h dalla firma, se non pagato", "wa", "Ti è arrivato il link? Se hai problemi col pagamento scrivimi qui{pagamento}"),
  M("M4.call24h", "M4", "T+24 h, se non pagato (telefono)", "task", "{nome} ha firmato ma non ha pagato: chiamalo.", { role: "commerciale", title: "Firmato ma non pagato: chiama" }),
  M("M4.last48h", "M4", "T+48 h, ultimo promemoria", "wa", "{nome}, ultimo promemoria per completare il pagamento e partire con «{pacchetto}»{pagamento}"),

  // ---------------- M5 ----------------
  M("M5.contract", "M5", "Minuto 0 (email): ricevuta + contratto firmato", "email", "Ciao {nome},\n\nabbiamo ricevuto il pagamento per «{pacchetto}». In allegato al link trovi il contratto firmato: {contratto}\n\nLa fattura arriva dall'amministrazione.\n\n{brand}"),
  M("M5.welcome", "M5", "Minuto 5: video di benvenuto del CEO + prossimi 3 passi", "wa", "Benvenuto in {brand}, {nome}! 🎉 {video}\n\nEcco i prossimi 3 passi:\n1. Prenota la call 1\n2. {passo2}\n3. Completa il primo compito che ti diamo in call"),
  M("M5.kit", "M5", "Minuto 5 (email): welcome kit del pacchetto", "email", "Ciao {nome},\n\necco il tuo welcome kit di «{pacchetto}».\n\nCosa include:\n{scheda}\n\nCalendario delle call:\n{calendario}\n\nRegole: le call si prenotano dal link del calendario; una disdetta con meno di 24 ore di preavviso o un'assenza conta come call svolta (1 recupero per l'intero pacchetto).\n\nContatti: rispondi a questa email o scrivici su WhatsApp.\n\n{brand}"),
  M("M5.book1", "M5", "Minuto 10: link per prenotare la call 1", "wa", "Prenota qui la tua call 1 👉 {link}"),
  M("M5.group", "M5", "Minuto 10 (solo Consulenza): gruppo WhatsApp + form di intake", "wa", "Entra nel gruppo WhatsApp del percorso 👉 {gruppo}\n\nE compila il form di intake (obiettivi, situazione di partenza, KPI da misurare) 👉 {form}"),
  M("M5.brief", "M5", "Minuto 10 (solo DFY): brief + lista accessi", "email", "Ciao {nome},\n\nper partire con «{pacchetto}» compila il brief 👉 {form}\n\nE prepara questi accessi:\n{elenco}\n\nI 7 giorni di consegna partono dal giorno in cui abbiamo tutto.\n\n{brand}"),
  M("M5.form12h", "M5", "T+12 h, se il form non è compilato", "wa", "{nome}, ti ricordo il form da compilare prima della call 1 👉 {form}"),
  M("M5.form24h", "M5", "T+24 h, se il form non è compilato", "wa", "{nome}, ultimo promemoria per il form: ci serve per preparare la call 1 👉 {form}"),
  M("M5.personal24h", "M5", "T+24 h, se la call 1 non è prenotata (A9)", "task", "{nome} non ha prenotato la call 1: mandagli un WhatsApp personale.", { role: "csm", title: "Call 1 non prenotata: WhatsApp personale" }),
  M("M5.phone48h", "M5", "T+48 h, se la call 1 non è prenotata", "task", "{nome} non ha ancora prenotato la call 1: chiamalo.", { role: "csm", title: "Call 1 non prenotata: chiama" }),
  M("M5.team", "M5", "Minuto 10: notifica interna al team", "task", "Nuovo cliente {nome} · {pacchetto}. Scheda di passaggio: {passaggio}", { role: "csm", title: "Nuovo cliente attivato" }),

  // ---------------- Onboarding ----------------
  M("ONB.coach", "ONB", "G2: coach o PM assegnato (A11)", "wa", "{nome}, ti presento {coach}: sarà il tuo riferimento per tutto il percorso. Prenota le call da qui 👉 {link}"),
  M("ONB.coachTask", "ONB", "Call 1 fatta senza coach (A10)", "task", "Assegna il coach a {nome} ({pacchetto}).", { role: "csm", title: "Assegna il coach" }),
  M("ONB.quickwin", "ONB", "G3: prima azione (quick win)", "wa", "{nome}, ecco la tua prima azione: {compiti}\n\nQuando l'hai fatta scrivimelo qui."),
  M("ONB.g7", "ONB", "G7: check di onboarding", "wa", "{nome}, da 1 a 10 quanto è chiaro il percorso?"),
  M("ONB.g7low", "ONB", "G7: voto ≤ 7", "task", "{nome} ha dato {voto}/10 alla chiarezza del percorso: contattalo subito.", { role: "csm", title: "Onboarding poco chiaro (voto ≤ 7)" }),

  // ---------------- Call calendar (task with deadline per package) ----------------
  M("CAL.due3", "M6", "Scadenza della call −3 g, se non prenotata", "wa", "{nome}, è il momento di prenotare la {call} (entro il {scadenza}) 👉 {link}"),
  M("CAL.due3alert", "M6", "Scadenza −3 g, se non prenotata (alert al coach o al PM)", "task", "La {call} di {nome} scade il {scadenza} e non è ancora prenotata: gli abbiamo mandato il link.", { role: "coach", title: "Call da prenotare entro 3 giorni" }),
  M("CAL.due1", "M6", "Scadenza −1 g, se ancora non prenotata", "task", "Chiama {nome} per fissare la {call}: scade il {scadenza}.", { role: "coach", title: "Chiama il cliente per fissare la call" }),
  M("CAL.prep", "M6", "Giorno della call, 1 ora prima (alert al coach o al PM)", "task", "Tra un'ora la {call} con {nome}.\n\nCall precedente: {riepilogo}\n\nCompiti da controllare: {compiti}", { role: "coach", title: "Call tra un'ora: riepilogo e compiti" }),
  M("CAL.noshow", "M6", "Orario della call + 15 min, nessuna registrazione Fathom (no-show)", "task", "{nome} non risulta alla {call} (nessuna registrazione Fathom): verifica e segna l'esito. Parte la sequenza di recupero.", { role: "coach", title: "No-show alla call" }),
  M("CAL.last", "M6", "Ultima call del pacchetto: deal Upsell (U1) + alert al commerciale", "task", "{nome} ha fatto l'ultima call di «{pacchetto}». Prepara la proposta del passo successivo: {proposta}\n\n{riepilogo}", { role: "commerciale", title: "Upsell: ultima call del pacchetto" }),

  // ---------------- M6 ----------------
  M("M6.book", "M6", "Alla prenotazione: conferma + form pre-call", "wa", "{nome}, {call} confermata {data} alle {ora}. Cosa vuoi ottenere da questa call?{form}"),
  M("M6.t24", "M6", "T−24 h: promemoria + richiesta di conferma", "wa", "Ciao {nome}, domani alle {ora} c'è la {call}. Confermi con un OK?"),
  M("M6.t1", "M6", "T−1 h: link della call + compiti da portare", "wa", "{nome}, tra un'ora la {call}.{linkcall}\n\nDa portare: {portare}"),
  M("M6.absent", "M6", "T+5 min, se assente (segnata «saltata»)", "wa", "Ti stiamo aspettando"),
  M("M6.recap", "M6", "T+2 h dopo la call: riepilogo da Fathom", "wa", "{nome}, ecco il riepilogo della {call}:\n\n{riepilogo}\n\nCompiti: {compiti}\nScadenza: {scadenza}\nProssima call: {prossima} 👉 {link}"),
  M("M6.rebook2d", "M6", "T+2 g, se la prossima call non è prenotata", "wa", "{nome}, prenota la prossima call ({prossima}) 👉 {link}"),

  // ---------------- M7 ----------------
  M("M7.monday", "M7", "Lunedì 9:00: focus e compiti della settimana", "wa", "Buongiorno {nome}! Focus della settimana {settimana}: {focus}\n\nCompiti: {compiti}"),
  M("M7.wednesday", "M7", "Mercoledì 18:00", "wa", "A che punto sei con i compiti? Dove ti sei bloccato?"),
  M("M7.hwDue", "M7", "Giorno prima della scadenza compiti, 18:00", "wa", "{nome}, domani scadono i compiti per la {call}: {compiti}"),
  M("M7.hwMissed", "M7", "Scadenza +1 g, se non consegnati", "task", "{nome} non ha consegnato i compiti per la {call}: messaggio personale.", { role: "coach", title: "Compiti non consegnati" }),
  M("M7.checkin", "M7", "Venerdì 17:00: check-in di 3 domande (health score)", "wa", "Check-in del venerdì, {nome}! 3 domande veloci.\n\n1/3 Cosa hai fatto questa settimana?"),
  M("M7.checkin2", "M7", "Check-in, domanda 2", "wa", "2/3 I tuoi numeri: {kpi}? (scrivi solo il numero)"),
  M("M7.checkin3", "M7", "Check-in, domanda 3", "wa", "3/3 Dove sei bloccato?"),
  M("M7.checkinThanks", "M7", "Check-in completato", "wa", "Grazie {nome}, ricevuto! Buon weekend 💪"),
  M("M7.mid", "M7", "Metà percorso (sett. 3 Base, sett. 5 Elite): form risultati intermedi", "wa", "{nome}, siamo a metà percorso! Raccontaci i risultati intermedi qui 👉 {form}"),
  M("M7.midCoach", "M7", "Metà percorso: segnale upsell al coach", "task", "Metà percorso di {nome} ({pacchetto}): indica nel CRM se è pronto per il livello successivo (Sì/No/Forse).", { role: "coach", title: "Upsell readiness a metà percorso" }),
  M("M7.end2w", "M7", "2 settimane dalla fine", "wa", "Mancano 2 settimane: ecco cosa chiudiamo.\n\n{chiusura}\n\nRaccontaci i risultati finali qui 👉 {form}"),
  M("M7.end1w", "M7", "1 settimana dalla fine", "wa", "{nome}, prenota l'ultima call del percorso 👉 {link}"),

  // ---------------- M8 ----------------
  M("M8.access", "M8", "Fine call di onboarding: lista accessi con scadenza (3 giorni)", "wa", "{nome}, ecco cosa ci serve entro il {scadenza}:\n{elenco}\n\nI 7 giorni di consegna partono quando abbiamo tutto."),
  M("M8.accessD1", "M8", "Scadenza accessi −1 g", "wa", "Domani scade la consegna degli accessi: ti mancano {elenco}"),
  M("M8.accessLate", "M8", "Scadenza +1 g, se mancanti (WhatsApp)", "wa", "{nome}, non abbiamo ancora ricevuto: {elenco}. Come da contratto, la data di consegna dello store slitta di conseguenza: ti confermiamo la nuova data appena abbiamo tutto."),
  M("M8.accessLateCall", "M8", "Scadenza +1 g, se mancanti (telefono)", "task", "{nome} non ha consegnato gli accessi ({elenco}): chiamalo. La consegna slitta.", { role: "pm", title: "Accessi in ritardo: chiama" }),
  M("M8.accessOk", "M8", "Accessi completi", "wa", "Abbiamo tutto: il tuo store sarà pronto entro il {data}"),
  M("M8.progress", "M8", "Giorno 3 di produzione", "task", "Manda a {nome} l'aggiornamento di avanzamento con screenshot dello store.", { role: "pm", title: "Aggiornamento produzione con screenshot" }),
  M("M8.ready", "M8", "Store pronto: link per la call di consegna", "wa", "{nome}, il tuo store è pronto! 🚀 Prenota la call di consegna 👉 {link}"),
  M("M8.d2", "M8", "Consegna +2 g", "wa", "Come va con lo store? Hai domande?"),
  M("M8.d13", "M8", "Consegna +13 g (Store + Ads, Full)", "wa", "{nome}, prenota la call dei 15 giorni 👉 {link}\n\nE mandami i numeri: vendite e spesa ads."),
  M("M8.d28", "M8", "Consegna +28 g (tutti)", "wa", "{nome}, prenota la call dei 30 giorni 👉 {link}\n\nE mandami i numeri: vendite e spesa ads."),
  M("M8.full5", "M8", "Lancio +5 g (solo Full)", "wa", "{nome}, prenota la call di analisi delle ads 👉 {link}\n\nTi mandiamo il report dei numeri."),
  M("M8.full43", "M8", "Consegna +43 g (solo Full)", "wa", "{nome}, prenota la call di iterazioni 👉 {link}\n\nTi mandiamo il report dei numeri."),

  // ---------------- M9 ----------------
  M("M9.due3", "M9", "Rata −3 g (email)", "email", "Ciao {nome},\n\nti ricordiamo la rata {numero} di {importo} in scadenza il {data}.{pagamento}\n\n{brand}"),
  M("M9.fail0", "M9", "Rata fallita, giorno 0", "wa", "Il pagamento non è andato a buon fine, aggiorna qui il metodo{pagamento}"),
  M("M9.fail3", "M9", "Rata fallita +3 g", "wa", "{nome}, secondo promemoria: la rata {numero} di {importo} non risulta ancora pagata{pagamento}"),
  M("M9.fail7", "M9", "Rata fallita +7 g (telefono)", "task", "Rata {numero} di {nome} ({importo}) non pagata da 7 giorni: chiamalo.", { role: "admin", title: "Rata non pagata: chiama" }),
  M("M9.fail14call", "M9", "Rata fallita +14 g: chiamata del CSM prima della sospensione", "task", "Rata {numero} di {nome} non pagata da 14 giorni: chiamalo prima dell'avviso di sospensione.", { role: "csm", title: "Rata a 14 giorni: chiama prima di sospendere" }),
  M("M9.fail14", "M9", "Rata fallita +14 g (email): avviso di sospensione", "email", "Ciao {nome},\n\nla rata {numero} di {importo} risulta non pagata da 14 giorni. Come previsto dall'art. 3.4 del contratto, i servizi vengono sospesi fino al saldo, senza che la sospensione prolunghi la durata del pacchetto.\n\nPer qualsiasi problema rispondi a questa email.\n\n{brand}"),

  // ---------------- M10 ----------------
  M("M10.thanks", "M10", "Giorno dell'ultima call: grazie + certificato o report finale", "wa", "{nome}, oggi si chiude il tuo percorso «{pacchetto}». Grazie per la fiducia! {chiusura}"),
  M("M10.review", "M10", "Fine +1 g: recensione o video testimonianza (call bonus in cambio)", "wa", "{nome}, ci lasci una recensione o una breve video testimonianza? In cambio ti regaliamo una call bonus 🎁 {link}"),
  M("M10.nps", "M10", "Fine +3 g: NPS", "wa", "{nome}, da 0 a 10 quanto consiglieresti {brand} a un amico? (scrivi solo il numero)"),
  M("M10.upsell7", "M10", "Fine +7 g, se upsell non prenotato", "wa", "{nome}, vuoi capire il passo successivo? Prenota una call con {commerciale} 👉 {link}"),
  M("M10.referral", "M10", "Fine +14 g: programma referral", "wa", "{nome}, conosci qualcuno a cui serve una mano con l'ecommerce? Ecco il tuo link personale 👉 {link}\n\n{premio}"),
  M("M10.alumni", "M10", "Ogni 30 g (email): newsletter Alumni + offerta del mese", "email", "Ciao {nome},\n\nle novità del mese per gli Alumni {brand}: {link}\n\nSe vuoi ripartire con un nuovo obiettivo, rispondi a questa email.\n\n{brand}"),

  // ---------------- Health ----------------
  M("HS.yellow", "HS", "Health score Giallo (A15)", "task", "{nome} è giallo ({motivi}): contattalo entro 48 h con un messaggio personale e proponi una call.", { role: "coach", title: "Cliente giallo: contatto entro 48 h" }),
  M("HS.red", "HS", "Health score Rosso (A16)", "task", "{nome} è rosso ({motivi}): chiamalo entro 24 h e fissa una call di recupero di 20 minuti.", { role: "csm", title: "Cliente rosso: chiamata entro 24 h" }),
  M("HS.ceo", "HS", "Rosso da 2 settimane o richiesta di rimborso", "task", "{nome} è rosso da 2 settimane: decidi azione e concessioni.", { role: "ceo", title: "Escalation: cliente rosso da 2 settimane" }),
  M("HS.callLate", "HS", "Scadenza call superata da 48 h (escalation)", "task", "La {call} di {nome} doveva essere entro il {scadenza} ed è in ritardo di oltre 48 ore.", { role: "ceo", title: "Scadenza call in ritardo da 48 h" }),
];

export const PB_BY_ID = new Map(PB_MESSAGES.map((m) => [m.id, m]));

/** Text with the overrides saved in settings; null = message switched off */
export function pbText(id: string, overrides: Record<string, { enabled?: boolean; text?: string }>): string | null {
  const def = PB_BY_ID.get(id);
  if (!def) return null;
  const o = overrides[id];
  if (o?.enabled === false) return null;
  return o?.text?.trim() ? o.text : def.text;
}
