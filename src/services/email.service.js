const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDate = (value) => {
  if (!value) return 'Non specificato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const formatAmount = (value) => new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
}).format(Number(value || 0));

const paymentStatusLabel = (value) => {
  const labels = {
    PAID: 'Pagato',
    UNPAID: 'Non pagato',
    PENDING: 'In attesa',
    FAILED: 'Fallito',
    REFUNDED: 'Rimborsato',
    CANCELLED: 'Annullato',
  };
  return labels[String(value || '').toUpperCase()] || value || 'Non specificato';
};

const detailsTable = (details) => {
  const rows = details
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding:9px 0;color:#5f6b7a;font-size:14px;vertical-align:top;width:42%;">${escapeHtml(label)}</td>
        <td style="padding:9px 0;color:#1f2937;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`)
    .join('');

  return rows
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:22px 0;">${rows}</table>`
    : '';
};

const emailLayout = ({ title, preview, body }) => `
  <!doctype html>
  <html lang="it">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preview || title)}</span>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
        <tr><td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(31,41,55,.08);">
            <tr><td style="background:linear-gradient(135deg,#1d5b8f,#2d92b5);padding:28px 34px;color:#ffffff;">
              <div style="font-size:24px;font-weight:700;">MyPetPlus</div>
              <div style="font-size:13px;opacity:.9;margin-top:4px;">La cura migliore per ogni animale</div>
            </td></tr>
            <tr><td style="padding:32px 34px;">
              <h1 style="font-size:23px;line-height:1.35;margin:0 0 18px;color:#172033;">${escapeHtml(title)}</h1>
              ${body}
            </td></tr>
            <tr><td style="padding:18px 34px;background:#f8fafc;color:#6b7280;font-size:12px;line-height:1.5;">
              Questa è un'email automatica di MyPetPlus. Ti preghiamo di non rispondere direttamente a questo messaggio.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE !== false,
    requireTLS: env.SMTP_REQUIRE_TLS !== false,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    tls: {
      minVersion: 'TLSv1.2',
      servername: env.SMTP_HOST,
    },
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[email] SMTP is not configured; skipping email:', subject);
    return { skipped: true };
  }

  try {
    const info = await mailer.sendMail({
      from: {
        address: env.SMTP_FROM || env.SMTP_USER,
        name: env.SMTP_FROM_NAME || 'MyPetPlus',
      },
      to,
      subject,
      text,
      html,
    });

    console.log('[email] SMTP message accepted', {
      messageId: info.messageId,
      acceptedCount: Array.isArray(info.accepted) ? info.accepted.length : 0,
      rejectedCount: Array.isArray(info.rejected) ? info.rejected.length : 0,
      response: info.response,
    });

    return { messageId: info.messageId };
  } catch (error) {
    console.error('[email] SMTP send failed', {
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
      response: error?.response,
      message: error?.message,
    });
    throw error;
  }
};

const sendWelcomeEmail = async ({ name, email }) => {
  const displayName = name || 'utente';
  const safeName = escapeHtml(displayName);
  const accountUrl = escapeHtml(`${env.APP_URL}/login`);
  return sendEmail({
    to: email,
    subject: 'Benvenuto su MyPetPlus',
    text: `Ciao ${displayName},\n\nBenvenuto su MyPetPlus: siamo felici di averti con noi. Il tuo account per la cura dei tuoi animali è stato creato con successo.\n\nCon MyPetPlus puoi gestire i profili e le informazioni sanitarie dei tuoi animali, prenotare appuntamenti con i veterinari, consultare le cartelle cliniche, comunicare con il tuo team di assistenza e ordinare prodotti presso le farmacie aderenti.\n\nAccedi per esplorare il tuo account: ${env.APP_URL}/login\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Benvenuto su MyPetPlus',
      preview: 'Il tuo account MyPetPlus è pronto.',
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${safeName},</p>
        <p style="font-size:16px;line-height:1.7;">Benvenuto su <strong>MyPetPlus</strong>: siamo felici di accompagnare te e i tuoi animali.</p>
        <div style="margin:22px 0;padding:18px 20px;background:#edf7fb;border:1px solid #c9e7f0;border-radius:10px;font-size:15px;line-height:1.65;color:#1f2937;">Il tuo account per la cura degli animali è stato creato con successo. MyPetPlus riunisce in un unico luogo la cura quotidiana, gli appuntamenti, la documentazione sanitaria e le esigenze farmaceutiche dei tuoi animali.</div>
        <h2 style="font-size:17px;margin:24px 0 10px;color:#172033;">Cosa puoi fare ora</h2>
        <ul style="margin:0;padding-left:22px;color:#4b5563;font-size:15px;line-height:1.8;">
          <li>Aggiungere e gestire i profili dei tuoi animali.</li>
          <li>Prenotare appuntamenti con i veterinari e seguirne gli aggiornamenti.</li>
          <li>Organizzare cartelle cliniche, referti e informazioni sanitarie.</li>
          <li>Chattare con il tuo team di assistenza e ordinare prodotti dalle farmacie aderenti.</li>
        </ul>
        <p style="margin:26px 0 0;text-align:center;"><a href="${accountUrl}" style="display:inline-block;padding:13px 24px;border-radius:8px;background:#149b99;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Vai al mio account</a></p>
        <p style="font-size:14px;line-height:1.65;color:#6b7280;margin:24px 0 0;">Grazie per aver scelto MyPetPlus per sostenere la salute e il benessere dei tuoi animali.</p>`,
    }),
  });
};

const subscriptionRoleLabel = (role) => {
  const normalizedRole = String(role || '').toUpperCase();
  if (normalizedRole === 'PARAPHARMACY') return 'Parafarmacia';
  return normalizedRole === 'PET_STORE' ? 'Farmacia' : 'Veterinario';
};

const subscriptionPanelUrl = (role) => String(role || '').toUpperCase() === 'PET_STORE'
  ? `${env.APP_URL}/pharmacy-admin/subscription`
  : `${env.APP_URL}/doctor/subscription-plans`;

const sendSubscriptionPurchaseEmail = async ({ user, subscription, plan, role }) => {
  const displayName = user?.name || 'utente';
  const roleLabel = subscriptionRoleLabel(role || user?.role);
  const planName = plan?.name || 'Piano di abbonamento';
  const startDate = formatDate(subscription?.startDate);
  const endDate = formatDate(subscription?.endDate);
  const amount = formatAmount(plan?.price);
  const duration = plan?.durationInDays ? `${plan.durationInDays} giorni` : 'Non specificata';
  const panelUrl = escapeHtml(subscriptionPanelUrl(role || user?.role));

  return sendEmail({
    to: user?.email,
    subject: `Il tuo abbonamento MyPetPlus ${planName} è attivo`,
    text: `Ciao ${displayName},\n\nil tuo abbonamento ${roleLabel} è stato acquistato con successo ed è ora attivo.\n\nPiano: ${planName}\nImporto: ${amount}\nData di inizio: ${startDate}\nData di scadenza: ${endDate}\nDurata: ${duration}\n\nAccedi al pannello MyPetPlus per utilizzare e gestire il tuo abbonamento: ${subscriptionPanelUrl(role || user?.role)}\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Il tuo abbonamento è attivo',
      preview: `Il piano ${planName} è stato acquistato con successo.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(displayName)},</p>
        <p style="font-size:15px;line-height:1.65;">Il tuo abbonamento <strong>${escapeHtml(roleLabel)}</strong> è stato acquistato con successo ed è ora attivo.</p>
        ${detailsTable([
          ['Piano', planName],
          ['Importo', amount],
          ['Data di inizio', startDate],
          ['Data di scadenza', endDate],
          ['Durata', duration],
          ['Stato', 'Attivo'],
        ])}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;">Ora puoi utilizzare i servizi e le funzionalità inclusi nel tuo piano.</p>
        <p style="margin:24px 0 0;text-align:center;"><a href="${panelUrl}" style="display:inline-block;padding:13px 24px;border-radius:8px;background:#149b99;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Apri il pannello MyPetPlus</a></p>`,
    }),
  });
};

const sendSubscriptionExpiryEmail = async ({ user, subscription, plan, role }) => {
  const displayName = user?.name || 'utente';
  const roleLabel = subscriptionRoleLabel(role || user?.role);
  const planName = plan?.name || 'Piano di abbonamento';
  const startDate = formatDate(subscription?.startDate);
  const endDate = formatDate(subscription?.endDate);
  const amount = formatAmount(plan?.price);
  const panelUrl = escapeHtml(subscriptionPanelUrl(role || user?.role));

  return sendEmail({
    to: user?.email,
    subject: 'Il tuo abbonamento MyPetPlus è scaduto',
    text: `Ciao ${displayName},\n\nil tuo abbonamento ${roleLabel} è scaduto. Rinnova l'abbonamento per continuare a utilizzare i servizi e le funzionalità disponibili.\n\nPiano: ${planName}\nData di inizio: ${startDate}\nData di scadenza: ${endDate}\nImporto: ${amount}\n\nRinnova l'abbonamento dal pannello MyPetPlus: ${subscriptionPanelUrl(role || user?.role)}\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Il tuo abbonamento è scaduto',
      preview: 'Rinnova il tuo abbonamento MyPetPlus per continuare a utilizzare la piattaforma.',
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(displayName)},</p>
        <p style="font-size:16px;line-height:1.7;">Il tuo abbonamento <strong>${escapeHtml(roleLabel)}</strong> è scaduto.</p>
        <div style="margin:22px 0;padding:18px 20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:15px;line-height:1.65;color:#9a3412;">Rinnova l'abbonamento per continuare a utilizzare i servizi e le funzionalità disponibili su MyPetPlus.</div>
        ${detailsTable([
          ['Piano', planName],
          ['Data di inizio', startDate],
          ['Scaduto il', endDate],
          ['Prezzo del piano', amount],
          ['Stato', 'Scaduto'],
        ])}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;">Il rinnovo ripristinerà l'accesso in base al piano che sceglierai.</p>
        <p style="margin:24px 0 0;text-align:center;"><a href="${panelUrl}" style="display:inline-block;padding:13px 24px;border-radius:8px;background:#149b99;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Rinnova l'abbonamento</a></p>`,
    }),
  });
};

const sendApprovalEmail = async ({ name, email, role }) => {
  const displayName = name || 'utente';
  const safeName = escapeHtml(displayName);
  const roleLabel = role === 'VETERINARIAN'
    ? 'Veterinario'
    : role === 'PARAPHARMACY'
      ? 'Parafarmacia'
      : 'Farmacia';

  return sendEmail({
    to: email,
    subject: 'Il tuo account MyPetPlus è stato approvato',
    text: `Ciao ${displayName},\n\nil tuo account ${roleLabel} è stato approvato. Ora puoi accedere a MyPetPlus e iniziare a utilizzare la piattaforma. Benvenuto su MyPetPlus!\n\nIl team MyPetPlus`,
    html: `<p>Ciao ${safeName},</p><p>Il tuo account <strong>${roleLabel}</strong> è stato approvato.</p><p>Ora puoi accedere a MyPetPlus e iniziare a utilizzare la piattaforma. Benvenuto su MyPetPlus!</p><p>Il team MyPetPlus</p>`,
  });
};

const sendPasswordVerificationCodeEmail = async ({ name, email, code, purpose = 'reset' }) => {
  const displayName = name || 'utente';
  const isChange = purpose === 'change';
  const action = isChange ? 'modificare la password' : 'reimpostare la password';
  const safeCode = escapeHtml(code);

  return sendEmail({
    to: email,
    subject: `Il tuo codice MyPetPlus per ${isChange ? 'modificare la password' : 'reimpostare la password'}`,
    text: `Ciao ${displayName},\n\nUsa questo codice di verifica per ${action}: ${code}\n\nIl codice scade tra 10 minuti. Se non hai richiesto questa operazione, puoi ignorare questa email.\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: isChange ? 'Conferma la modifica della password' : 'Reimposta la password',
      preview: `Il tuo codice di verifica è ${code}`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(displayName)},</p>
        <p style="font-size:15px;line-height:1.65;">Usa il codice di verifica qui sotto per ${escapeHtml(action)}.</p>
        <div style="margin:24px 0;padding:18px;background:#edf7fb;border:1px solid #c9e7f0;border-radius:10px;text-align:center;font-size:30px;letter-spacing:8px;font-weight:700;color:#1d5b8f;">${safeCode}</div>
        <p style="font-size:14px;line-height:1.65;color:#4b5563;">Questo codice scade tra 10 minuti e può essere utilizzato una sola volta. Se non hai effettuato questa richiesta, puoi ignorare questa email.</p>`,
    }),
  });
};

const sendEmailVerificationCodeEmail = async ({ name, email, code }) => {
  const displayName = name || 'utente';
  const safeCode = escapeHtml(code);

  return sendEmail({
    to: email,
    subject: 'Verifica il tuo indirizzo email MyPetPlus',
    text: `Ciao ${displayName},\n\nUsa questo codice di verifica per attivare il tuo account MyPetPlus: ${code}\n\nIl codice scade tra 10 minuti. Se non hai creato questo account, puoi ignorare questa email.\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Verifica il tuo indirizzo email',
      preview: `Il tuo codice di verifica MyPetPlus è ${code}`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(displayName)},</p>
        <p style="font-size:15px;line-height:1.65;">Grazie per esserti unito a MyPetPlus. Inserisci il codice di verifica qui sotto per attivare il tuo account.</p>
        <div style="margin:24px 0;padding:18px;background:#edf7fb;border:1px solid #c9e7f0;border-radius:10px;text-align:center;font-size:30px;letter-spacing:8px;font-weight:700;color:#1d5b8f;">${safeCode}</div>
        <p style="font-size:14px;line-height:1.65;color:#4b5563;">Questo codice scade tra 10 minuti e può essere utilizzato una sola volta. Se non hai creato questo account, puoi ignorare questa email.</p>`,
    }),
  });
};

const sendAppointmentBookedEmail = async ({ veterinarian, petOwner, pet, appointment }) => {
  const doctorName = veterinarian?.name || 'Veterinario';
  const patientName = petOwner?.name || 'un proprietario';
  const petName = pet?.name || "l'animale";
  const appointmentDate = formatDate(appointment?.appointmentDate);
  const appointmentTime = appointment?.appointmentTime || 'Non specificato';
  const bookingType = appointment?.bookingType === 'ONLINE' ? 'Consulenza online' : 'Visita in clinica';
  const details = [
    ['Riferimento appuntamento', appointment?.appointmentNumber || appointment?._id],
    ['Proprietario', patientName],
    ['Animale', petName],
    ['Data', appointmentDate],
    ['Ora', appointmentTime],
    ['Tipo di appuntamento', bookingType],
    ['Motivo della visita', appointment?.reason || 'Non specificato'],
    ['Sintomi / note', appointment?.petSymptoms || appointment?.emergencyDescription || 'Non specificato'],
    ['Clinica', appointment?.clinicName || 'Non specificata'],
  ];

  return sendEmail({
    to: veterinarian.email,
    subject: `Nuova richiesta di appuntamento da ${patientName}`,
    text: `Ciao ${doctorName},\n\n${patientName} ha prenotato un appuntamento per ${petName} il ${appointmentDate} alle ${appointmentTime}.\n\nAccedi al pannello MyPetPlus per accettare o rifiutare la richiesta di appuntamento.\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Nuova richiesta di appuntamento',
      preview: `${patientName} ha prenotato un appuntamento per ${petName}.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(doctorName)},</p>
        <p style="font-size:15px;line-height:1.65;">${escapeHtml(patientName)} ha richiesto un appuntamento con te per ${escapeHtml(petName)}. Controlla i dettagli qui sotto e accedi al pannello MyPetPlus per <strong>accettare o rifiutare</strong> la richiesta.</p>
        ${detailsTable(details)}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;margin-bottom:0;">L'appuntamento resterà in attesa fino a quando non darai una risposta.</p>`,
    }),
  });
};

const sendAppointmentStatusEmail = async ({ petOwner, veterinarian, pet, appointment, status, reason }) => {
  const patientName = petOwner?.name || 'utente';
  const doctorName = veterinarian?.name || 'il tuo veterinario';
  const petName = pet?.name || 'il tuo animale';
  const accepted = String(status).toUpperCase() === 'CONFIRMED';
  const appointmentDate = formatDate(appointment?.appointmentDate);
  const appointmentTime = appointment?.appointmentTime || 'Non specificato';
  const action = accepted ? 'accettato' : 'rifiutato';
  const details = [
    ['Riferimento appuntamento', appointment?.appointmentNumber || appointment?._id],
    ['Veterinario', doctorName],
    ['Animale', petName],
    ['Data', appointmentDate],
    ['Ora', appointmentTime],
    ...(!accepted && reason ? [['Motivo', reason]] : []),
  ];

  return sendEmail({
    to: petOwner.email,
    subject: `Il tuo appuntamento è stato ${action}`,
    text: `Ciao ${patientName},\n\nil tuo appuntamento per ${petName} con ${doctorName} del ${appointmentDate} alle ${appointmentTime} è stato ${action}.${!accepted && reason ? `\n\nMotivo: ${reason}` : ''}\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: accepted ? 'Il tuo appuntamento è stato accettato' : 'Il tuo appuntamento è stato rifiutato',
      preview: `Il tuo appuntamento per ${petName} è stato ${action}.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(patientName)},</p>
        <p style="font-size:15px;line-height:1.65;">${escapeHtml(doctorName)} ha <strong>${action}</strong> la tua richiesta di appuntamento per ${escapeHtml(petName)}.</p>
        ${detailsTable(details)}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;margin-bottom:0;">${accepted ? 'Puoi controllare l’appuntamento dal pannello MyPetPlus.' : 'Accedi al pannello MyPetPlus se desideri effettuare una nuova prenotazione.'}</p>`,
    }),
  });
};

const sendNewOrderEmail = async ({ pharmacy, customer, order, products }) => {
  const pharmacyName = pharmacy?.name || 'Farmacia';
  const customerName = customer?.name || 'un cliente';
  const productLines = (products || [])
    .map((item) => `${item.name || 'Prodotto'}${item.variantName ? ` (${item.variantName})` : ''} x${item.quantity} — ${formatAmount(item.total)}`)
    .join('\n');
  const productListHtml = (products || []).map((item) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#1f2937;">
      <strong>${escapeHtml(item.name || 'Prodotto')}</strong>${item.variantName ? `<br><span style="font-size:12px;color:#6b7280;">${escapeHtml(item.variantName)}</span>` : ''}
    </td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center;color:#1f2937;">${escapeHtml(item.quantity)}</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;color:#1f2937;font-weight:600;">${escapeHtml(formatAmount(item.total))}</td></tr>`).join('');
  const address = [
    order?.shippingAddress?.line1,
    order?.shippingAddress?.line2,
    [order?.shippingAddress?.zip, order?.shippingAddress?.city].filter(Boolean).join(' '),
    order?.shippingAddress?.state,
    order?.shippingAddress?.country,
  ].filter(Boolean).join(', ');

  return sendEmail({
    to: pharmacy.email,
    subject: `Nuovo ordine ricevuto: ${order?.orderNumber || 'ordine MyPetPlus'}`,
    text: `Ciao ${pharmacyName},\n\nHai ricevuto un nuovo ordine da ${customerName}.\n\nOrdine: ${order?.orderNumber || order?._id}\nProdotti:\n${productLines}\n\nImporto dell'ordine: ${formatAmount(order?.total)}\nIndirizzo di consegna: ${address || 'Non specificato'}\n\nAccedi al pannello MyPetPlus per controllare e gestire questo ordine.\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Hai ricevuto un nuovo ordine',
      preview: `${customerName} ha effettuato l'ordine ${order?.orderNumber || ''}.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(pharmacyName)},</p>
        <p style="font-size:15px;line-height:1.65;">Hai ricevuto un nuovo ordine da <strong>${escapeHtml(customerName)}</strong>. Accedi al pannello MyPetPlus per controllarlo e gestirlo.</p>
        ${detailsTable([
          ['Riferimento ordine', order?.orderNumber || order?._id],
          ['Cliente', customerName],
          ['Email cliente', customer?.email || 'Non specificata'],
          ['Telefono cliente', customer?.phone || 'Non specificato'],
          ['Importo dell’ordine', formatAmount(order?.total)],
          ['Stato del pagamento', paymentStatusLabel(order?.paymentStatus)],
          ['Indirizzo di consegna', address || 'Non specificato'],
        ])}
        <h2 style="font-size:16px;margin:24px 0 8px;color:#172033;">Prodotti ordinati</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr><th align="left" style="padding:8px 0;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Prodotto</th><th align="center" style="padding:8px 0;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Quantità</th><th align="right" style="padding:8px 0;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Totale</th></tr>
          ${productListHtml}
        </table>`,
    }),
  });
};

const sendShippingFeeSetEmail = async ({ petOwner, pharmacy, order }) => {
  const patientName = petOwner?.name || 'utente';
  const pharmacyName = pharmacy?.name || 'la farmacia';
  const shippingFee = Number(order?.finalShipping ?? order?.shipping ?? 0);
  const total = Number(order?.total ?? 0);
  const promisedDeliveryDays = Number(order?.promisedDeliveryDays || 0);
  const expectedDeliveryDate = formatDate(order?.expectedDeliveryDate);
  const address = [
    order?.shippingAddress?.line1,
    order?.shippingAddress?.line2,
    [order?.shippingAddress?.zip, order?.shippingAddress?.city].filter(Boolean).join(' '),
    order?.shippingAddress?.state,
    order?.shippingAddress?.country,
  ].filter(Boolean).join(', ');

  return sendEmail({
    to: petOwner.email,
    subject: `Costo di spedizione impostato per l'ordine ${order?.orderNumber || ''}`.trim(),
    text: `Ciao ${patientName},\n\n${pharmacyName} ha impostato il costo di spedizione per il tuo ordine.\n\nOrdine: ${order?.orderNumber || order?._id}\nCosto di spedizione: ${formatAmount(shippingFee)}\nTotale aggiornato: ${formatAmount(total)}\nConsegna stimata: ${promisedDeliveryDays ? `${promisedDeliveryDays} giorni` : '2-5 giorni'}\nData di consegna prevista: ${expectedDeliveryDate}\n\nOra puoi completare il pagamento dal pannello MyPetPlus. L'ordine continuerà a essere elaborato dopo la ricezione del pagamento.\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Il tuo ordine è pronto per il pagamento',
      preview: 'Il costo di spedizione per il tuo ordine è stato impostato.',
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(patientName)},</p>
        <p style="font-size:15px;line-height:1.65;">${escapeHtml(pharmacyName)} ha impostato il costo di spedizione per il tuo ordine. Ora puoi completare il pagamento dal pannello MyPetPlus.</p>
        ${detailsTable([
          ['Riferimento ordine', order?.orderNumber || order?._id],
          ['Costo di spedizione', formatAmount(shippingFee)],
          ['Totale aggiornato', formatAmount(total)],
          ['Impegno di consegna della farmacia', promisedDeliveryDays ? `${promisedDeliveryDays} giorni` : '2-5 giorni'],
          ['Data di consegna prevista', expectedDeliveryDate],
          ['Indirizzo di consegna', address || 'Non specificato'],
        ])}
        <div style="padding:14px 16px;background:#edf7fb;border:1px solid #c9e7f0;border-radius:8px;font-size:14px;line-height:1.6;color:#1f2937;">L'ordine continuerà a essere elaborato dopo la ricezione del pagamento.</div>`,
    }),
  });
};

const sendContactQueryResolutionEmail = async ({ query, responseMessage }) => {
  const recipientName = query?.name || 'utente';
  const responseHtml = escapeHtml(responseMessage).replace(/\r?\n/g, '<br />');

  return sendEmail({
    to: query.email,
    subject: 'Risposta alla tua richiesta a MyPetPlus',
    text: `Ciao ${recipientName},\n\nGrazie per aver contattato MyPetPlus.\n\n${responseMessage}\n\nIl team MyPetPlus`,
    html: emailLayout({
      title: 'Risposta alla tua richiesta',
      preview: 'MyPetPlus ha risposto alla tua richiesta di contatto.',
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Ciao ${escapeHtml(recipientName)},</p>
        <p style="font-size:15px;line-height:1.65;">Grazie per aver contattato MyPetPlus. Il nostro team ha esaminato la tua richiesta e ha fornito la risposta riportata di seguito.</p>
        <div style="margin:20px 0;padding:18px;background:#f8fafc;border-left:4px solid #2d92b5;border-radius:4px;font-size:15px;line-height:1.7;color:#1f2937;">${responseHtml}</div>
        ${detailsTable([
          ['Servizio richiesto', query?.services || 'Non specificato'],
          ['Messaggio originale', query?.message || 'Non specificato'],
        ])}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;margin-bottom:0;">Se hai bisogno di ulteriore assistenza, invia una nuova richiesta e il nostro team sarà lieto di aiutarti.</p>`,
    }),
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendApprovalEmail,
  sendPasswordVerificationCodeEmail,
  sendEmailVerificationCodeEmail,
  sendSubscriptionPurchaseEmail,
  sendSubscriptionExpiryEmail,
  sendAppointmentBookedEmail,
  sendAppointmentStatusEmail,
  sendNewOrderEmail,
  sendShippingFeeSetEmail,
  sendContactQueryResolutionEmail,
};
