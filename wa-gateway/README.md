# Vendiora WhatsApp gateway

Collega un numero WhatsApp come "dispositivo collegato" (QR, Baileys: integrazione NON ufficiale, rischio di blocco del numero)
e fa da ponte con il CRM: il CRM chiede di inviare messaggi, il gateway gli inoltra i messaggi ricevuti.

Env:
- `WA_GATEWAY_SECRET` (obbligatorio): lo stesso valore va nel CRM. Header `X-WA-Secret` su ogni chiamata.
- `CRM_INBOUND_URL`: es. `https://crm.app.easlydev.online/api/vendiora/wa/inbound`
- `DATA_DIR` (default `/data`, volume persistente: contiene la sessione WhatsApp).

API (tutte con `X-WA-Secret`, tranne `/health`):
- `GET /status` -> `{status, reason, phone, qr}` (`qr` = immagine data URL quando serve scansionare)
- `POST /connect` · `POST /logout`
- `POST /send {phone, text}` -> `{ok, chatId, id}`; 409 se WhatsApp non e' collegato, 422 se il numero non ha WhatsApp.

Un solo processo per sessione: due copie attive si buttano fuori a vicenda.
