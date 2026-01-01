import { createEmailTransporter } from '../config/email.config';

export class EmailService {
  private transporter = createEmailTransporter();

  async sendTeamInvite(to: string, name: string, role: string, inviteToken: string) {
    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${inviteToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: 'You\'ve been invited to join the team',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Team Invitation</h2>
          <p>Hi ${name},</p>
          <p>You've been invited to join as a <strong>${role}</strong>.</p>
          <p>Click the link below to set your password and get started:</p>
          <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Accept Invitation
          </a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}