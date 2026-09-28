import type { Redis } from 'ioredis';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Dev/test sender: prints the email and keeps the latest one per recipient in Redis
 * (`dev:outbox:{email}`, 10 min) so E2E tests can read sign-in codes.
 */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly redis: Redis) {}

  async send(message: EmailMessage): Promise<void> {
    console.log(`\n📧 To: ${message.to}\n   Subject: ${message.subject}\n   ${message.text}\n`);
    await this.redis.set(`dev:outbox:${message.to}`, JSON.stringify(message), 'EX', 600);
  }
}

export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (!res.ok) {
      throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
    }
  }
}
