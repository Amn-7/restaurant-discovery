import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
const fromNumber = process.env.TWILIO_FROM_NUMBER ?? '';

if (!accountSid || !authToken || !fromNumber) {
  console.warn('[sms] Twilio credentials missing; SMS disabled.');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendOrderStatusSms(to: string, body: string) {
  if (!client) return;
  await client.messages.create({ to, from: fromNumber, body });
}