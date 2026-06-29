import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Mona Editions Contact <contact@monaeditions.com>',
      to: ['contact@monaeditions.com'],
      replyTo: email,
      subject: `[Mona Editions Contact] ${safeSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1c1917; border-bottom: 1px solid #d6d0c8; padding-bottom: 10px;">
            Nouveau message de contact
          </h2>

          <div style="margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Nom:</strong> ${safeName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${safeEmail}</p>
            <p style="margin: 5px 0;"><strong>Sujet:</strong> ${safeSubject}</p>
          </div>

          <div style="margin: 20px 0; padding: 15px; background: #f5f3ef; border-left: 3px solid #1c1917;">
            <h3 style="margin-top: 0; color: #78716c;">Message:</h3>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #d6d0c8; font-size: 12px; color: #a8a29e;">
            <p>Mona Editions - Plateforme de certification d'œuvres d'art</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
