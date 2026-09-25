import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Email delivery adapter boundary.
 *
 * Providers are isolated behind this interface so swapping (SMTP -> SES ->
 * SendGrid -> console) never touches business code.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Development/default adapter: writes the message to the application log. */
class ConsoleEmailAdapter implements EmailAdapter {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<void> {
    logger.info('email_outbound', {
      adapter: this.name,
      to: message.to,
      subject: message.subject,
      textLength: message.text.length,
      hasHtml: Boolean(message.html),
    });
  }
}

/**
 * SMTP adapter loaded lazily so the `nodemailer` dependency is only evaluated
 * when SMTP delivery is actually configured.
 */
class SmtpEmailAdapter implements EmailAdapter {
  readonly name = 'smtp';

  private transporter: import('nodemailer').Transporter | null = null;

  private async getTransporter(): Promise<import('nodemailer').Transporter> {
    if (this.transporter) return this.transporter;

    if (!env.SMTP_HOST || !env.SMTP_PORT) {
      throw new Error(
        'EMAIL_DRIVER=smtp requires SMTP_HOST and SMTP_PORT to be configured',
      );
    }

    const nodemailer = await import('nodemailer');
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    });
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    const transporter = await this.getTransporter();
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
  }
}

let adapter: EmailAdapter | null = null;

export function getEmailAdapter(): EmailAdapter {
  if (!adapter) {
    adapter = env.EMAIL_DRIVER === 'smtp' ? new SmtpEmailAdapter() : new ConsoleEmailAdapter();
  }
  return adapter;
}

/**
 * Sends an email without ever failing the caller's business transaction:
 * delivery problems are logged and surfaced through observability instead.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    await getEmailAdapter().send(message);
    return true;
  } catch (error) {
    logger.error('email_send_failed', {
      adapter: getEmailAdapter().name,
      to: message.to,
      subject: message.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Test helper. */
export function setEmailAdapter(next: EmailAdapter | null): void {
  adapter = next;
}
