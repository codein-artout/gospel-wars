import type { EmailConfig } from 'next-auth/providers/email';

/**
 * Magic-link provider. With EMAIL_SERVER set it sends through SMTP (nodemailer); without it,
 * the sign-in link is printed to the server console, so local development needs no mail setup.
 */
export function magicLinkProvider(): EmailConfig {
  return {
    id: 'email',
    type: 'email',
    name: 'Email',
    from: process.env.EMAIL_FROM ?? 'Gospel Wars <no-reply@gospelwars.local>',
    maxAge: 24 * 60 * 60,
    server: process.env.EMAIL_SERVER,
    options: {},
    async sendVerificationRequest({ identifier, url, provider }) {
      if (!process.env.EMAIL_SERVER) {
        console.log(`\n[auth] Magic link for ${identifier}:\n${url}\n`);
        return;
      }
      const { createTransport } = await import('nodemailer');
      const transport = createTransport(process.env.EMAIL_SERVER);
      await transport.sendMail({
        to: identifier,
        from: provider.from,
        subject: 'Sign in to Gospel Wars',
        text: `Sign in to Gospel Wars:\n${url}\n\nIf you did not ask for this, ignore this email.`,
        html: `<p>Sign in to Gospel Wars:</p><p><a href="${encodeURI(url)}">Sign in</a></p><p>If you did not ask for this, ignore this email.</p>`,
      });
    },
  };
}
