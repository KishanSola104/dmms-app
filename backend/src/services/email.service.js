const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const { createTransporter } = require('../config/mailer');

class EmailService {
  /**
   * Send Email with HTML template
   */
  
static async sendMail({ to, subject, html }) {
    try {
        const transporter = createTransporter();

        const sender = process.env.SMTP_EMAIL;

        if (!sender) {
            throw new Error("SMTP_EMAIL is not configured.");
        }

        const info = await transporter.sendMail({
            from: `"DMMS Portal" <${sender}>`,
            to,
            subject,
            html
        });

        console.log(
            `[EmailService] Email sent successfully to: ${to} (MessageID: ${info.messageId})`
        );

        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {

        const errorDetails = `${error.message || ""} ${error.response || ""}`;

        // Gmail daily sending limit
        const quotaExceeded =
            Number(error.responseCode) === 550 &&
              /5\.4\.5|Daily user sending limit exceeded/i.test(errorDetails);

        if (quotaExceeded) {
            console.error(
                `[EmailService] Gmail daily sending limit exceeded. Email to ${to} was not sent.`
            );

            return {
                success: false,
                code: "EMAIL_DAILY_LIMIT_EXCEEDED",
                retryable: false,
                message: "Daily email sending limit exceeded. Try again after the quota resets."
            };
        }

        console.error(
            `[EmailService] Failed to send email to ${to}: ${error.message}`
        );

        return {
            success: false,
            code: "EMAIL_SEND_FAILED",
            retryable: false,
            message: "Unable to send email."
        };
    }
}


  /**
   * Send School Credentials Email
   */
  static async sendSchoolCredentials({ schoolEmail, schoolName, schoolId, schoolPassword }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginUrl = `${frontendUrl}/school-login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Digital Marksheet Management System</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">School Registration Confirmation &amp; Credentials</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Dear Management of <strong>${schoolName}</strong>,</p>
          <p>Congratulations! Your school has been successfully registered on the DMMS platform.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #1e3a8a;">School Portal Credentials</h3>
            <p style="margin: 6px 0;"><strong>School Name:</strong> ${schoolName}</p>
            <p style="margin: 6px 0;"><strong>School ID:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 15px; font-weight: bold;">${schoolId}</span></p>
            <p style="margin: 6px 0;"><strong>School Password:</strong> <span style="font-family: monospace; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 15px; font-weight: bold;">${schoolPassword}</span></p>
          </div>

          <h4 style="color: #1e293b; margin-bottom: 8px;">Instructions for Accessing Your School:</h4>
          <ol style="padding-left: 20px; margin-top: 4px;">
            <li>Visit the DMMS School Login page by clicking the button below.</li>
            <li>Enter your School ID and School Password.</li>
            <li>Once authenticated, staff members and administrators can proceed to User Login.</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to School Login</a>
          </div>

          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            <em>Security Notice: Please keep these credentials confidential. Only authorized school administrators should have access to the School Password.</em>
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0;">Designed and Developed by <strong>Shreeji IT Solutions PVT. LTD.</strong></p>
          <p style="margin: 4px 0 0;">&copy; Digital Marksheet Management System</p>
        </div>
      </div>
    `;

    return await this.sendMail({
      to: schoolEmail,
      subject: `[DMMS] School Registration Credentials - ${schoolName} (${schoolId})`,
      html
    });
  }

  /**
   * Send Initial Administrator Credentials Email
   */
  static async sendAdminCredentials({ adminEmail, adminName, schoolName, schoolId, adminId, adminPassword }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginUrl = `${frontendUrl}/school-login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f766e; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Digital Marksheet Management System</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Administrator Account Credentials</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Dear <strong>${adminName}</strong>,</p>
          <p>You have been assigned as the <strong>School Administrator</strong> for <strong>${schoolName}</strong> on the DMMS platform.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0f766e;">Your Administrator Login Details</h3>
            <p style="margin: 6px 0;"><strong>School Name:</strong> ${schoolName}</p>
            <p style="margin: 6px 0;"><strong>School ID:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${schoolId}</span></p>
            <p style="margin: 6px 0;"><strong>Admin User ID:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 15px; font-weight: bold;">${adminId}</span></p>
            <p style="margin: 6px 0;"><strong>Initial Password:</strong> <span style="font-family: monospace; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 15px; font-weight: bold;">${adminPassword}</span></p>
          </div>

          <h4 style="color: #1e293b; margin-bottom: 8px;">Login Instructions:</h4>
          <ol style="padding-left: 20px; margin-top: 4px;">
            <li>First, authenticate the school using the <strong>School ID</strong> and <strong>School Password</strong>.</li>
            <li>On the subsequent User Login page, select role <strong>School Administrator</strong>.</li>
            <li>Enter your <strong>Admin User ID</strong> (or registered email) and initial password.</li>
            <li><strong>Important:</strong> Upon your first login, you will be prompted to set a new personal password.</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Access DMMS Portal</a>
          </div>

          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            <em>Security Warning: Never share your personal administrator password with anyone.</em>
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0;">Designed and Developed by <strong>Shreeji IT Solutions PVT. LTD.</strong></p>
          <p style="margin: 4px 0 0;">&copy; Digital Marksheet Management System</p>
        </div>
      </div>
    `;

    return await this.sendMail({
      to: adminEmail,
      subject: `[DMMS] School Administrator Credentials - ${adminName} (${adminId})`,
      html
    });
  }

  /**
   * Send School Forgot Password Email
   */
  static async sendSchoolResetPassword({ schoolEmail, schoolName, schoolId, tempPassword }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginUrl = `${frontendUrl}/school-login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #b91c1c; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">DMMS Security Notice</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Temporary School Password Reset</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello,</p>
          <p>A password reset was requested for school <strong>${schoolName}</strong> (School ID: <code>${schoolId}</code>).</p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #b91c1c;">${tempPassword}</span></p>
          </div>

          <p>You can use this temporary password to authenticate your school. Upon login, your School Administrator should update this password immediately.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #b91c1c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to School Login</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
          &copy; Digital Marksheet Management System | Shreeji IT Solutions PVT. LTD.
        </div>
      </div>
    `;

    return await this.sendMail({
      to: schoolEmail,
      subject: `[DMMS] Temporary School Password Reset - ${schoolId}`,
      html
    });
  }

  /**
   * Send User Forgot Password Email
   */
  static async sendUserResetPassword({ userEmail, userName, userId, tempPassword }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginUrl = `${frontendUrl}/user-login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4338ca; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">DMMS Password Reset</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">User Account Temporary Password</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Dear <strong>${userName}</strong>,</p>
          <p>A temporary password has been generated for your account (User ID: <code>${userId}</code>).</p>
          
          <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #4338ca;">${tempPassword}</span></p>
          </div>

          <p>Please log in using this temporary password. You will be required to change your password immediately upon login before accessing your dashboard.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #4338ca; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to User Login</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
          &copy; Digital Marksheet Management System | Shreeji IT Solutions PVT. LTD.
        </div>
      </div>
    `;

    return await this.sendMail({
      to: userEmail,
      subject: `[DMMS] Account Password Reset - ${userId}`,
      html
    });
  }

  /**
   * Send User Welcome Credentials Email (Module 2)
   */
  static async sendUserCredentials({ userEmail, userName, schoolName, schoolId, userId, tempPassword, roleName }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginUrl = `${frontendUrl}/school-login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Digital Marksheet Management System</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Welcome to ${schoolName}</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Dear <strong>${userName}</strong>,</p>
          <p>An account has been created for you as <strong>${roleName}</strong> at <strong>${schoolName}</strong> on the DMMS platform.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #1e3a8a;">Your Login Credentials</h3>
            <p style="margin: 6px 0;"><strong>School ID:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${schoolId}</span></p>
            <p style="margin: 6px 0;"><strong>User ID:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 15px; font-weight: bold;">${userId}</span></p>
            <p style="margin: 6px 0;"><strong>Temporary Password:</strong> <span style="font-family: monospace; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 15px; font-weight: bold;">${tempPassword}</span></p>
          </div>

          <h4 style="color: #1e293b; margin-bottom: 8px;">Login Instructions:</h4>
          <ol style="padding-left: 20px; margin-top: 4px;">
            <li>First, authenticate your school portal using the <strong>School ID</strong> and school password.</li>
            <li>On the User Login page, select your role: <strong>${roleName}</strong>.</li>
            <li>Enter your <strong>User ID</strong> (or email) and the temporary password above.</li>
            <li><strong>Mandatory:</strong> You will be required to choose a new permanent password on your first login.</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Access DMMS Portal</a>
          </div>

          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            <em>Security Warning: Please do not share your temporary password. Set your new password immediately.</em>
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0;">Designed and Developed by <strong>Shreeji IT Solutions PVT. LTD.</strong></p>
          <p style="margin: 4px 0 0;">&copy; Digital Marksheet Management System</p>
        </div>
      </div>
    `;

    return await this.sendMail({
      to: userEmail,
      subject: `[DMMS] Account Credentials - ${userName} (${userId})`,
      html
    });
  }

  /**
   * Send Admin Confirmation Code (OTP) for Sensitive Actions (Module 2)
   */
  static async sendAdminConfirmationOtp({ adminEmail, adminName, schoolName, action, targetUserName, code }) {
    const isDelete = action === 'DELETE_USER';
    const actionTitle = isDelete ? 'User Account Deletion' : 'User Account Deactivation';
    const actionColor = isDelete ? '#dc2626' : '#ea580c';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${actionColor}; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 22px;">Security Confirmation Required</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${actionTitle} Request</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Dear Administrator <strong>${adminName}</strong>,</p>
          <p>You have initiated an administrative action to <strong>${isDelete ? 'permanently DELETE' : 'DEACTIVATE'}</strong> the user account for <strong>${targetUserName}</strong> in <strong>${schoolName}</strong>.</p>
          
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #991b1b; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Your One-Time Confirmation Code</p>
            <div style="font-family: monospace; font-size: 32px; font-weight: bold; color: ${actionColor}; letter-spacing: 6px;">
              ${code}
            </div>
            <p style="margin: 8px 0 0; font-size: 12px; color: #7f1d1d;">This code is valid for 10 minutes and can only be used once.</p>
          </div>

          <p style="font-size: 13px; color: #64748b;">
            If you did not initiate this request, please change your administrator password immediately and contact support.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 12px; color: #64748b;">
          &copy; Digital Marksheet Management System | Shreeji IT Solutions PVT. LTD.
        </div>
      </div>
    `;

    return await this.sendMail({
      to: adminEmail,
      subject: `[DMMS Security Code] ${actionTitle} Confirmation (${code})`,
      html
    });
  }
}

module.exports = EmailService;
