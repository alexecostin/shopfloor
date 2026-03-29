import { Resend } from 'resend';
import logger from './logger.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const EMAIL_FROM = process.env.EMAIL_FROM || 'notificari@shopfloor.ro';
export const NOTIFICATIONS_ENABLED = process.env.NOTIFICATIONS_ENABLED !== 'false';

export { resend, logger };
