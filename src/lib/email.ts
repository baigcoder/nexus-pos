import nodemailer from 'nodemailer'

function createTransporter() {
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT) || 587
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host || !user || !pass) {
        throw new Error('SMTP configuration missing. Check SMTP_HOST, SMTP_USER, SMTP_PASS env vars.')
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: true,
        },
    })
}

export interface StaffInviteEmailData {
    email: string
    name: string
    restaurantName: string
    tempPin: string
    loginUrl: string
    role: string
}

export async function sendStaffInviteEmail(data: StaffInviteEmailData): Promise<void> {
    const { email, name, restaurantName, tempPin, loginUrl, role } = data

    if (!email) {
        throw new Error('Recipient email is required')
    }

    const transporter = createTransporter()

    const subject = `You've been invited to join ${restaurantName}`

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f97316; margin: 0;">OrderFlow</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <h2 style="margin-top: 0; color: #111827;">Hi ${name},</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          You've been invited to join <strong>${restaurantName}</strong> as a <strong>${role}</strong>.
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Use the temporary PIN below to log in and set up your account:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background: #fff7ed; border: 2px dashed #f97316; border-radius: 10px; padding: 18px 36px;">
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 6px;">${tempPin}</p>
          </div>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 8px;">This PIN is temporary and will expire once you complete your setup.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; display: inline-block;">Log In & Set Up Account</a>
        </div>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 24px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Next steps:</p>
          <ol style="margin: 0; padding-left: 18px; color: #4b5563; font-size: 14px; line-height: 1.7;">
            <li>Click the button above or go to <strong>${loginUrl}</strong></li>
            <li>Enter your email address</li>
            <li>Enter the temporary PIN shown above</li>
            <li>Create your own 4-digit PIN</li>
            <li>Complete your profile</li>
          </ol>
        </div>
      </div>
      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px;">
        If you did not expect this invitation, please ignore this email or contact your manager.
      </p>
    </div>
    `

    const text = `
Hi ${name},

You've been invited to join ${restaurantName} as a ${role}.

Your temporary login PIN is: ${tempPin}

Login here: ${loginUrl}

Next steps:
1. Go to ${loginUrl}
2. Enter your email address
3. Enter the temporary PIN: ${tempPin}
4. Create your own 4-digit PIN
5. Complete your profile

This PIN is temporary and will expire once you complete your setup.

If you did not expect this invitation, please ignore this email or contact your manager.
    `.trim()

    const info = await transporter.sendMail({
        from: `"OrderFlow" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        text,
        html,
    })

    console.log(`[EMAIL] Invite sent to ${email}. Message ID: ${info.messageId}`)
}

export interface PinResetEmailData {
    email: string
    name: string
    restaurantName: string
    tempPin: string
    loginUrl: string
}

export async function sendPinResetEmail(data: PinResetEmailData): Promise<void> {
    const { email, name, restaurantName, tempPin, loginUrl } = data

    if (!email) {
        throw new Error('Recipient email is required')
    }

    const transporter = createTransporter()

    const subject = `PIN Reset Request - ${restaurantName}`

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f97316; margin: 0;">OrderFlow</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <h2 style="margin-top: 0; color: #111827;">Hi ${name},</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          We received a request to reset your PIN for <strong>${restaurantName}</strong>.
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Use the temporary PIN below to log in and create a new permanent PIN:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background: #fff7ed; border: 2px dashed #f97316; border-radius: 10px; padding: 18px 36px;">
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 6px;">${tempPin}</p>
          </div>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 8px;">This temporary PIN will expire once you log in and set a new PIN.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; display: inline-block;">Log In & Reset PIN</a>
        </div>
        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-top: 24px; border: 1px solid #fee2e2;">
          <p style="margin: 0; font-weight: 600; color: #991b1b; font-size: 14px;">Didn't request this?</p>
          <p style="margin: 4px 0 0 0; color: #7f1d1d; font-size: 13px;">If you didn't request a PIN reset, please contact your manager immediately. Someone may be trying to access your account.</p>
        </div>
      </div>
      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px;">
        This is an automated message from OrderFlow. Please do not reply to this email.
      </p>
    </div>
    `

    const text = `
Hi ${name},

We received a request to reset your PIN for ${restaurantName}.

Your temporary reset PIN is: ${tempPin}

Login here: ${loginUrl}

This temporary PIN will expire once you log in and set a new PIN.

Didn't request this?
If you didn't request a PIN reset, please contact your manager immediately.

This is an automated message from OrderFlow.
    `.trim()

    const info = await transporter.sendMail({
        from: `"OrderFlow" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        text,
        html,
    })

    console.log(`[EMAIL] PIN reset sent to ${email}. Message ID: ${info.messageId}`)
}
