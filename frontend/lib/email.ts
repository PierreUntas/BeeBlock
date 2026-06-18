/**
 * Transactional emails for the subscription system.
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

function shell(title: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
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
                            Mona Editions — certification d'œuvres d'art<br>
                            <a href="https://www.monaeditions.com" style="color:#78716c;text-decoration:underline;">monaeditions.com</a>
                            ·
                            <a href="https://www.monaeditions.com/artist/subscription" style="color:#78716c;text-decoration:underline;">Gérer mon abonnement</a>
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

// ---- Email templates ------------------------------------------------------

/** Sent after a successful first subscription to Atelier. */
export async function sendWelcomeAtelier(to: string): Promise<void> {
    const subject = "Bienvenue dans l'Atelier — Mona Editions";
    const text = `Bonjour,

Votre abonnement à l'Atelier de Mona Editions est maintenant actif.

Vous pouvez désormais certifier jusqu'à 50 œuvres par fenêtre glissante de 30 jours.

Votre espace : https://www.monaeditions.com/artist/subscription
Créer une œuvre : https://www.monaeditions.com/artist/editions/create

Si vous avez la moindre question, répondez à cet email — je vous lirai personnellement.

À très vite,
Pierre`;
    const body = `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Bienvenue dans l'<em style="color:#78716c;">Atelier</em>.</p>
        <p style="margin:0 0 16px 0;">Votre abonnement est maintenant actif. Vous pouvez certifier jusqu'à <strong>50 œuvres par fenêtre glissante de 30 jours</strong>.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="https://www.monaeditions.com/artist/editions/create" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">
                CERTIFIER UNE ŒUVRE
            </a>
        </p>
        <p style="margin:24px 0 0 0;font-size:13px;color:#78716c;">Si vous avez la moindre question, vous pouvez répondre à cet email — je vous lirai personnellement.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À très vite,<br>Pierre</p>
    `;
    await send(to, subject, shell(subject, body), text);
}

/** Sent when the artist cancels — accessing the service stops at periodEnd. */
export async function sendSubscriptionCanceled(to: string, periodEnd: Date | null): Promise<void> {
    const subject = "Confirmation d'annulation — Mona Editions";
    const formattedEnd = periodEnd
        ? periodEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'la fin de votre période en cours';
    const text = `Bonjour,

Votre demande d'annulation a bien été prise en compte.

Vous conservez l'accès à l'Atelier jusqu'au ${formattedEnd}. Vous basculerez ensuite automatiquement sur le palier Découverte.

Les œuvres que vous avez déjà certifiées restent votre propriété et continuent d'exister sur la blockchain de manière permanente, indépendamment de votre statut d'abonnement.

Vous pouvez réactiver l'Atelier à tout moment :
https://www.monaeditions.com/artist/subscription

À bientôt,
Pierre`;
    const body = `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Votre annulation est confirmée.</p>
        <p style="margin:0 0 16px 0;">Vous conservez l'accès à l'Atelier jusqu'au <strong>${formattedEnd}</strong>, puis vous basculerez sur le palier Découverte.</p>
        <p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Les œuvres déjà certifiées restent votre propriété et continuent d'exister sur la blockchain de manière permanente, indépendamment de votre abonnement.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="https://www.monaeditions.com/artist/subscription" style="display:inline-block;background:#f5f3ef;color:#1c1917;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #d6d0c8;">
                MON ABONNEMENT
            </a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À bientôt,<br>Pierre</p>
    `;
    await send(to, subject, shell(subject, body), text);
}

/** Sent when Stripe reports a failed renewal payment. */
export async function sendPaymentFailed(to: string): Promise<void> {
    const subject = "Échec de paiement — Mona Editions";
    const text = `Bonjour,

Le paiement de votre abonnement Atelier a échoué.

Stripe va automatiquement retenter le prélèvement plusieurs fois sur les 21 prochains jours. Pour éviter la suspension de votre abonnement, mettez à jour votre moyen de paiement dès maintenant :

https://www.monaeditions.com/artist/subscription

Si rien n'est fait à l'issue de ces 21 jours, votre abonnement sera automatiquement résilié et vous basculerez sur le palier Découverte. Vos œuvres déjà certifiées resteront évidemment intactes sur la blockchain.

À très vite,
Pierre`;
    const body = `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;color:#991b1b;">Échec de paiement.</p>
        <p style="margin:0 0 16px 0;">Le prélèvement de votre abonnement Atelier n'a pas pu aboutir. Stripe va retenter automatiquement plusieurs fois sur les 21 prochains jours.</p>
        <p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">Pour éviter la suspension de votre abonnement, mettez à jour votre moyen de paiement dès maintenant.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="https://www.monaeditions.com/artist/subscription" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">
                METTRE À JOUR MA CARTE
            </a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">Vos œuvres déjà certifiées resteront évidemment intactes sur la blockchain, quel que soit le résultat.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À très vite,<br>Pierre</p>
    `;
    await send(to, subject, shell(subject, body), text);
}

/**
 * Sent to a collector right after they successfully claim a certificate.
 * Confirms what they received and points them to their collection page.
 */
export async function sendClaimReceipt(
    to: string,
    params: {
        artworkTitle: string;
        artistName: string;
        editionId: number;
        txHash: string;
    },
): Promise<void> {
    const { artworkTitle, artistName, editionId, txHash } = params;
    const subject = `Votre certificat « ${artworkTitle} » est confirmé — Mona Editions`;
    const editionUrl = `https://www.monaeditions.com/explore/edition/${editionId}`;
    const hasTxHash = typeof txHash === 'string' && txHash.length > 0;
    const explorerUrl = hasTxHash ? `https://basescan.org/tx/${txHash}` : null;

    const text = `Bonjour,

Votre certificat pour l'œuvre « ${artworkTitle} » de ${artistName} a bien été réceptionné sur la blockchain Base.

Vous pouvez consulter votre certificat à tout moment depuis votre espace :
https://www.monaeditions.com/collector

Page publique de l'œuvre :
${editionUrl}
${explorerUrl ? `\nTransaction blockchain (preuve d'enregistrement) :\n${explorerUrl}\n` : ''}
Le certificat est désormais lié à votre portefeuille de manière permanente. Si vous transférez l'œuvre physique un jour à un autre collectionneur, vous pouvez aussi lui transférer le certificat numérique.

À bientôt,
Pierre — Mona Editions`;

    const explorerHtml = explorerUrl
        ? `<p style="margin:0 0 16px 0;font-size:13px;color:#78716c;">
            Preuve blockchain :
            <a href="${explorerUrl}" style="color:#1c1917;text-decoration:underline;">consulter sur Basescan</a>
        </p>`
        : '';

    const body = `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Certificat confirmé.</p>
        <p style="margin:0 0 16px 0;">L'œuvre <strong>« ${artworkTitle} »</strong> de <strong>${artistName}</strong> est désormais associée à votre portefeuille sur la blockchain Base.</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="https://www.monaeditions.com/collector" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">
                VOIR MA COLLECTION
            </a>
        </p>
        <p style="margin:24px 0 8px 0;font-size:12px;color:#78716c;letter-spacing:0.06em;text-transform:uppercase;font-weight:500;">Liens utiles</p>
        <p style="margin:0 0 6px 0;font-size:13px;color:#78716c;">
            Page de l'œuvre :
            <a href="${editionUrl}" style="color:#1c1917;text-decoration:underline;">${editionUrl}</a>
        </p>
        ${explorerHtml}
        <p style="margin:24px 0 0 0;font-size:13px;color:#78716c;">Le certificat est lié de manière permanente à votre portefeuille. Si vous transférez l'œuvre physique un jour, vous pouvez aussi transférer le certificat à son nouveau propriétaire.</p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À bientôt,<br>Pierre — Mona Editions</p>
    `;
    await send(to, subject, shell(subject, body), text);
}

/** Sent when the artist manually renews an Atelier cycle ahead of time. */
export async function sendRenewalConfirmation(to: string, periodEnd: Date | null): Promise<void> {
    const subject = "Nouvelle période ouverte — Mona Editions";
    const formattedEnd = periodEnd
        ? periodEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : null;
    const text = `Bonjour,

Votre nouvelle période d'abonnement Atelier est ouverte. Votre quota est remis à zéro : 50 nouvelles œuvres certifiables.${formattedEnd ? `

Période en cours jusqu'au ${formattedEnd}.` : ''}

Créer une œuvre : https://www.monaeditions.com/artist/editions/create

À très vite,
Pierre`;
    const body = `
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:normal;">Nouvelle période ouverte.</p>
        <p style="margin:0 0 16px 0;">Votre quota Atelier est remis à zéro : <strong>50 nouvelles œuvres certifiables</strong>.${formattedEnd ? ` Période en cours jusqu'au <strong>${formattedEnd}</strong>.` : ''}</p>
        <p style="margin:24px 0;text-align:center;">
            <a href="https://www.monaeditions.com/artist/editions/create" style="display:inline-block;background:#1c1917;color:#fafaf8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:0.06em;border:1px solid #1c1917;">
                CERTIFIER UNE ŒUVRE
            </a>
        </p>
        <p style="margin:16px 0 0 0;font-size:13px;color:#78716c;">À très vite,<br>Pierre</p>
    `;
    await send(to, subject, shell(subject, body), text);
}
