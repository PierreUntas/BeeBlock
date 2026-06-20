/**
 * Transactional emails for the subscription system, with FR / DE templates.
 *
 * Resend SDK is already installed (used by the contact form). The sender
 * domain monaeditions.com is verified, so any `<something>@monaeditions.com`
 * prefix works as a from address.
 *
 * All sends are best-effort: if Resend fails we log and swallow the error so
 * the webhook handler still returns 200 to Stripe. The DB state is the
 * source of truth, the email is a notification.
 */

import { Resend } from 'resend';
import type { Locale } from './db';

const FROM = 'Mona Editions <abonnement@monaeditions.com>';
const REPLY_TO = 'pierre.untas@gmail.com';

let _resend: Resend | null = null;
function getResend(): Resend | null {
    if (_resend) return _resend;
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    _resend = new Resend(key);
    return _resend;
}

// ---- Shared template wrapper ----------------------------------------------

function shell(title: string, bodyHtml: string, locale: Locale): string {
    const footerLabels = {
        fr: {
            tagline: 'Mona Editions — certification d\'œuvres d\'art',
            manage: 'Gérer mon abonnement',
        },
        de: {
            tagline: 'Mona Editions — Zertifizierung von Kunstwerken',
            manage: 'Mein Abonnement verwalten',
        },
    }[locale];

    const subscriptionUrl =
        locale === 'fr'
            ? 'https://www.monaeditions.com/artist/subscription'
            : 'https://www.monaeditions.com/de/artist/subscription';

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Helvetica Neue',Arial,sans-serif;color:#1c1917;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f3ef;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fafaf8;border:1px solid #d6d0c8;">
                    <tr>
                        <td style="padding:40px 40px 24px 40px;text-align:center;border-bottom:1px solid #d6d0c8;">
                            <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:normal;letter-spacing:-0.5px;color:#1c1917;">
                                Mona <span style="font-style:italic;color:#78716c;">Editions</span>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px;font-size:15px;line-height:1.7;color:#1c1917;">
                            ${bodyHtml}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 40px;border-top:1px solid #d6d0c8;font-size:11px;color:#a8a29e;text-align:center;letter-spacing:0.06em;">
                            ${footerLabels.tagline}<br>
                            <a href="https://www.monaeditions.com" style="color:#78716c;text-decoration:underline;">monaeditions.com</a>
                            ·
                            <a href="${subscriptionUrl}" style="color:#78716c;text-decoration:underline;">${footerLabels.manage}</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
    const resend = getResend();
    if (!resend) {
        console.warn('[email] RESEND_API_KEY not set, skipping email to', to);
        return;
    }
    try {
        const { error } = await resend.emails.send({
            from: FROM,
            to: [to],
            replyTo: REPLY_TO,
            subject,
            html,
            text,
        });
        if (error) console.error('[email] Resend error:', error);
    } catch (e) {
        console.error('[email] Send threw:', e);
    }
}

// ---- Email templates: Welcome Atelier --------------------------------------

const welcomeAtelier = {
    fr: {
        subject: "Bienvenue dans l'Atelier — Mona Editions",
        text: (createUrl: string) => `Bonjour,

Votre abonnement à l'Atelier de Mona Editions est maintenant actif.

Vous pouvez désormais certifier jusqu'à 50 œuvres par fenêtre glissante de 30 jours.

Créer une œuvre : ${createUrl}

Si vous avez la moindre question, répondez à cet email — je vous lirai personnellement.

À très vite,
Pierre`,
        body: (createUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Bienvenue dans l'<em style="color:#78716c;">Atelier</em>.</p>
        <p style="margin:0 0 16px 0;">Votre abonnement est maintenant actif. Vous pouvez certifier jusqu'à <strong>50 œuvres par fenêtre glissante de 30 jours</strong>.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${createUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">CERTIFIER UNE ŒUVRE</a>
        </p>
        <p style="margin:24px 0 0 0;font-size:13px;color:#78716c;">Si vous avez la moindre question, vous pouvez répondre à cet email — je vous lirai personnellement.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À très vite,<br>Pierre</p>`,
    },
    de: {
        subject: "Willkommen im Atelier — Mona Editions",
        text: (createUrl: string) => `Hallo,

Ihr Abonnement im Atelier von Mona Editions ist nun aktiv.

Sie können nun bis zu 50 Werke pro 30-Tage-Fenster zertifizieren.

Ein Werk zertifizieren: ${createUrl}

Bei Fragen können Sie auf diese E-Mail antworten — ich werde sie persönlich lesen.

Bis bald,
Pierre`,
        body: (createUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Willkommen im <em style="color:#78716c;">Atelier</em>.</p>
        <p style="margin:0 0 16px 0;">Ihr Abonnement ist nun aktiv. Sie können bis zu <strong>50 Werke pro 30-Tage-Fenster</strong> zertifizieren.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${createUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">WERK ZERTIFIZIEREN</a>
        </p>
        <p style="margin:24px 0 0 0;font-size:13px;color:#78716c;">Bei Fragen können Sie auf diese E-Mail antworten — ich werde sie persönlich lesen.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Bis bald,<br>Pierre</p>`,
    },
};

export async function sendWelcomeAtelier(to: string, locale: Locale = 'fr'): Promise<void> {
    const tpl = welcomeAtelier[locale];
    const createUrl =
        locale === 'fr'
            ? 'https://www.monaeditions.com/artist/editions/create'
            : 'https://www.monaeditions.com/de/artist/editions/create';
    await send(to, tpl.subject, shell(tpl.subject, tpl.body(createUrl), locale), tpl.text(createUrl));
}

// ---- Email templates: Subscription canceled --------------------------------

function formatDate(periodEnd: Date | null, locale: Locale): string {
    if (!periodEnd) return locale === 'fr' ? 'la fin de votre période en cours' : 'das Ende Ihres aktuellen Zeitraums';
    return periodEnd.toLocaleDateString(locale === 'de' ? 'de-DE' : 'fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

const canceled = {
    fr: {
        subject: "Confirmation d'annulation — Mona Editions",
        text: (endDate: string, manageUrl: string) => `Bonjour,

Votre demande d'annulation a bien été prise en compte.

Vous conservez l'accès à l'Atelier jusqu'au ${endDate}. Vous basculerez ensuite automatiquement sur le palier Découverte.

Les œuvres que vous avez déjà certifiées restent votre propriété et continuent d'exister sur la blockchain de manière permanente, indépendamment de votre statut d'abonnement.

Vous pouvez réactiver l'Atelier à tout moment :
${manageUrl}

À bientôt,
Pierre`,
        body: (endDate: string, manageUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Votre annulation est confirmée.</p>
        <p style="margin:0 0 16px 0;">Vous conservez l'accès à l'Atelier jusqu'au <strong>${endDate}</strong>, puis vous basculerez sur le palier Découverte.</p>
        <p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Les œuvres déjà certifiées restent votre propriété et continuent d'exister sur la blockchain de manière permanente, indépendamment de votre abonnement.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${manageUrl}" style="display:inline-block;background:#f5f3ef;color:#1c1917;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #d6d0c8;">MON ABONNEMENT</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À bientôt,<br>Pierre</p>`,
    },
    de: {
        subject: "Kündigungsbestätigung — Mona Editions",
        text: (endDate: string, manageUrl: string) => `Hallo,

Ihre Kündigung wurde berücksichtigt.

Sie behalten den Zugang zum Atelier bis zum ${endDate}. Anschließend wechseln Sie automatisch zum Entdeckungs-Tarif.

Die Werke, die Sie bereits zertifiziert haben, bleiben Ihr Eigentum und existieren dauerhaft auf der Blockchain, unabhängig von Ihrem Abonnementstatus.

Sie können das Atelier jederzeit wieder aktivieren:
${manageUrl}

Bis bald,
Pierre`,
        body: (endDate: string, manageUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Ihre Kündigung ist bestätigt.</p>
        <p style="margin:0 0 16px 0;">Sie behalten den Zugang zum Atelier bis zum <strong>${endDate}</strong>, anschließend wechseln Sie zum Entdeckungs-Tarif.</p>
        <p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Bereits zertifizierte Werke bleiben Ihr Eigentum und existieren dauerhaft auf der Blockchain, unabhängig von Ihrem Abonnement.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${manageUrl}" style="display:inline-block;background:#f5f3ef;color:#1c1917;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #d6d0c8;">MEIN ABONNEMENT</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Bis bald,<br>Pierre</p>`,
    },
};

export async function sendSubscriptionCanceled(
    to: string,
    periodEnd: Date | null,
    locale: Locale = 'fr',
): Promise<void> {
    const tpl = canceled[locale];
    const endDate = formatDate(periodEnd, locale);
    const manageUrl =
        locale === 'fr'
            ? 'https://www.monaeditions.com/artist/subscription'
            : 'https://www.monaeditions.com/de/artist/subscription';
    await send(to, tpl.subject, shell(tpl.subject, tpl.body(endDate, manageUrl), locale), tpl.text(endDate, manageUrl));
}

// ---- Email templates: Payment failed ---------------------------------------

const paymentFailed = {
    fr: {
        subject: "Échec de paiement — Mona Editions",
        text: (manageUrl: string) => `Bonjour,

Le paiement de votre abonnement Atelier a échoué.

Stripe va automatiquement retenter le prélèvement plusieurs fois sur les 21 prochains jours. Pour éviter la suspension de votre abonnement, mettez à jour votre moyen de paiement dès maintenant :

${manageUrl}

Si rien n'est fait à l'issue de ces 21 jours, votre abonnement sera automatiquement résilié et vous basculerez sur le palier Découverte. Vos œuvres déjà certifiées resteront évidemment intactes sur la blockchain.

À très vite,
Pierre`,
        body: (manageUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;color:#991b1b;">Échec de paiement.</p>
        <p style="margin:0 0 16px 0;">Le prélèvement de votre abonnement Atelier n'a pas pu aboutir. Stripe va retenter automatiquement plusieurs fois sur les 21 prochains jours.</p>
        <p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Pour éviter la suspension de votre abonnement, mettez à jour votre moyen de paiement dès maintenant.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${manageUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">METTRE À JOUR MA CARTE</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Vos œuvres déjà certifiées resteront évidemment intactes sur la blockchain, quel que soit le résultat.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À très vite,<br>Pierre</p>`,
    },
    de: {
        subject: "Zahlung fehlgeschlagen — Mona Editions",
        text: (manageUrl: string) => `Hallo,

Die Zahlung Ihres Atelier-Abonnements ist fehlgeschlagen.

Stripe wird in den nächsten 21 Tagen automatisch mehrmals erneut versuchen, abzubuchen. Um die Aussetzung Ihres Abonnements zu vermeiden, aktualisieren Sie Ihre Zahlungsmethode jetzt:

${manageUrl}

Wenn innerhalb von 21 Tagen nichts unternommen wird, wird Ihr Abonnement automatisch gekündigt und Sie wechseln zum Entdeckungs-Tarif. Ihre bereits zertifizierten Werke bleiben selbstverständlich auf der Blockchain unverändert.

Bis bald,
Pierre`,
        body: (manageUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;color:#991b1b;">Zahlung fehlgeschlagen.</p>
        <p style="margin:0 0 16px 0;">Die Abbuchung Ihres Atelier-Abonnements konnte nicht erfolgreich abgeschlossen werden. Stripe wird in den nächsten 21 Tagen automatisch mehrmals erneut versuchen.</p>
        <p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Um die Aussetzung Ihres Abonnements zu vermeiden, aktualisieren Sie Ihre Zahlungsmethode jetzt.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${manageUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">KARTE AKTUALISIEREN</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Ihre bereits zertifizierten Werke bleiben selbstverständlich auf der Blockchain unverändert, unabhängig vom Ergebnis.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Bis bald,<br>Pierre</p>`,
    },
};

export async function sendPaymentFailed(to: string, locale: Locale = 'fr'): Promise<void> {
    const tpl = paymentFailed[locale];
    const manageUrl =
        locale === 'fr'
            ? 'https://www.monaeditions.com/artist/subscription'
            : 'https://www.monaeditions.com/de/artist/subscription';
    await send(to, tpl.subject, shell(tpl.subject, tpl.body(manageUrl), locale), tpl.text(manageUrl));
}

// ---- Email templates: Renewal confirmation ---------------------------------

const renewal = {
    fr: {
        subject: "Nouvelle période ouverte — Mona Editions",
        text: (endDate: string | null, createUrl: string) => `Bonjour,

Votre nouvelle période d'abonnement Atelier est ouverte. Votre quota est remis à zéro : 50 nouvelles œuvres certifiables.${endDate ? `\n\nPériode en cours jusqu'au ${endDate}.` : ''}

Créer une œuvre : ${createUrl}

À très vite,
Pierre`,
        body: (endDate: string | null, createUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Nouvelle période ouverte.</p>
        <p style="margin:0 0 16px 0;">Votre quota Atelier est remis à zéro : <strong>50 nouvelles œuvres certifiables</strong>.${endDate ? ` Période en cours jusqu'au <strong>${endDate}</strong>.` : ''}</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${createUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">CERTIFIER UNE ŒUVRE</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À très vite,<br>Pierre</p>`,
    },
    de: {
        subject: "Neuer Zeitraum eröffnet — Mona Editions",
        text: (endDate: string | null, createUrl: string) => `Hallo,

Ihr neuer Atelier-Abonnement-Zeitraum ist eröffnet. Ihr Kontingent wird zurückgesetzt: 50 neue zertifizierbare Werke.${endDate ? `\n\nAktueller Zeitraum bis ${endDate}.` : ''}

Ein Werk zertifizieren: ${createUrl}

Bis bald,
Pierre`,
        body: (endDate: string | null, createUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Neuer Zeitraum eröffnet.</p>
        <p style="margin:0 0 16px 0;">Ihr Atelier-Kontingent wird zurückgesetzt: <strong>50 neue zertifizierbare Werke</strong>.${endDate ? ` Aktueller Zeitraum bis <strong>${endDate}</strong>.` : ''}</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${createUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">WERK ZERTIFIZIEREN</a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Bis bald,<br>Pierre</p>`,
    },
};

export async function sendRenewalConfirmation(
    to: string,
    periodEnd: Date | null,
    locale: Locale = 'fr',
): Promise<void> {
    const tpl = renewal[locale];
    const endDate = periodEnd
        ? periodEnd.toLocaleDateString(locale === 'de' ? 'de-DE' : 'fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
          })
        : null;
    const createUrl =
        locale === 'fr'
            ? 'https://www.monaeditions.com/artist/editions/create'
            : 'https://www.monaeditions.com/de/artist/editions/create';
    await send(to, tpl.subject, shell(tpl.subject, tpl.body(endDate, createUrl), locale), tpl.text(endDate, createUrl));
}

// ---- Email templates: Claim receipt ----------------------------------------

const claimReceipt = {
    fr: {
        subject: (title: string) => `Votre certificat « ${title} » est confirmé — Mona Editions`,
        text: (title: string, artist: string, editionUrl: string, explorerUrl: string | null) => `Bonjour,

Votre certificat pour l'œuvre « ${title} » de ${artist} a bien été réceptionné sur la blockchain Base.

Vous pouvez consulter votre certificat à tout moment depuis votre espace :
https://www.monaeditions.com/collector

Page publique de l'œuvre :
${editionUrl}
${explorerUrl ? `\nTransaction blockchain (preuve d'enregistrement) :\n${explorerUrl}\n` : ''}
Le certificat est désormais lié à votre portefeuille de manière permanente. Si vous transférez l'œuvre physique un jour à un autre collectionneur, vous pouvez aussi lui transférer le certificat numérique.

À bientôt,
Pierre — Mona Editions`,
        body: (title: string, artist: string, editionUrl: string, explorerUrl: string | null, collectionUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Certificat confirmé.</p>
        <p style="margin:0 0 16px 0;">L'œuvre <strong>« ${title} »</strong> de <strong>${artist}</strong> est désormais associée à votre portefeuille sur la blockchain Base.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${collectionUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">VOIR MA COLLECTION</a>
        </p>
        <p style="margin:24px 0 8px 0;font-size:12px;color:#78716c;letter-spacing:0.06em;text-transform:uppercase;font-weight:500;">Liens utiles</p>
        <p style="margin:0 0 6px 0;font-size:13px;color:#78716c;">
            Page de l'œuvre :
            <a href="${editionUrl}" style="color:#1c1917;text-decoration:underline;">${editionUrl}</a>
        </p>
        ${explorerUrl ? `<p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Preuve blockchain : <a href="${explorerUrl}" style="color:#1c1917;text-decoration:underline;">consulter sur Basescan</a></p>` : ''}
        <p style="margin:24px 0 0 0;font-size:13px;color:#78716c;">Le certificat est lié de manière permanente à votre portefeuille. Si vous transférez l'œuvre physique un jour, vous pouvez aussi transférer le certificat à son nouveau propriétaire.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À bientôt,<br>Pierre — Mona Editions</p>`,
    },
    de: {
        subject: (title: string) => `Ihr Zertifikat „${title}" ist bestätigt — Mona Editions`,
        text: (title: string, artist: string, editionUrl: string, explorerUrl: string | null) => `Hallo,

Ihr Zertifikat für das Werk „${title}" von ${artist} wurde erfolgreich auf der Base-Blockchain registriert.

Sie können Ihr Zertifikat jederzeit in Ihrem Bereich einsehen:
https://www.monaeditions.com/de/collector

Öffentliche Seite des Werks:
${editionUrl}
${explorerUrl ? `\nBlockchain-Transaktion (Registrierungsbeweis):\n${explorerUrl}\n` : ''}
Das Zertifikat ist nun dauerhaft mit Ihrer Wallet verknüpft. Wenn Sie das physische Werk eines Tages an einen anderen Sammler übertragen, können Sie auch das digitale Zertifikat übertragen.

Bis bald,
Pierre — Mona Editions`,
        body: (title: string, artist: string, editionUrl: string, explorerUrl: string | null, collectionUrl: string) => `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Zertifikat bestätigt.</p>
        <p style="margin:0 0 16px 0;">Das Werk <strong>„${title}"</strong> von <strong>${artist}</strong> ist nun mit Ihrer Wallet auf der Base-Blockchain verknüpft.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="${collectionUrl}" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">MEINE SAMMLUNG ANSEHEN</a>
        </p>
        <p style="margin:24px 0 8px 0;font-size:12px;color:#78716c;letter-spacing:0.06em;text-transform:uppercase;font-weight:500;">Nützliche Links</p>
        <p style="margin:0 0 6px 0;font-size:13px;color:#78716c;">
            Seite des Werks:
            <a href="${editionUrl}" style="color:#1c1917;text-decoration:underline;">${editionUrl}</a>
        </p>
        ${explorerUrl ? `<p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Blockchain-Beweis: <a href="${explorerUrl}" style="color:#1c1917;text-decoration:underline;">auf Basescan ansehen</a></p>` : ''}
        <p style="margin:24px 0 0 0;font-size:13px;color:#78716c;">Das Zertifikat ist dauerhaft mit Ihrer Wallet verknüpft. Wenn Sie das physische Werk eines Tages übertragen, können Sie auch das Zertifikat an den neuen Eigentümer übertragen.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Bis bald,<br>Pierre — Mona Editions</p>`,
    },
};

export async function sendClaimReceipt(
    to: string,
    params: {
        artworkTitle: string;
        artistName: string;
        editionId: number;
        txHash: string;
    },
    locale: Locale = 'fr',
): Promise<void> {
    const { artworkTitle, artistName, editionId, txHash } = params;
    const tpl = claimReceipt[locale];
    const editionUrl =
        locale === 'fr'
            ? `https://www.monaeditions.com/explore/edition/${editionId}`
            : `https://www.monaeditions.com/de/explore/edition/${editionId}`;
    const collectionUrl =
        locale === 'fr'
            ? 'https://www.monaeditions.com/collector'
            : 'https://www.monaeditions.com/de/collector';
    const hasTxHash = typeof txHash === 'string' && txHash.length > 0;
    const explorerUrl = hasTxHash ? `https://basescan.org/tx/${txHash}` : null;

    await send(
        to,
        tpl.subject(artworkTitle),
        shell(tpl.subject(artworkTitle), tpl.body(artworkTitle, artistName, editionUrl, explorerUrl, collectionUrl), locale),
        tpl.text(artworkTitle, artistName, editionUrl, explorerUrl),
    );
}
