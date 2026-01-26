const nodemailer = require('nodemailer');

// Tạo transporter với cấu hình từ environment variables
const createTransporter = () => {
  // Nếu có cấu hình SMTP riêng
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === 'true', // true cho 465, false cho các port khác
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Mặc định sử dụng Gmail với OAuth2 hoặc App Password
  // Nếu có GMAIL_USER và GMAIL_APP_PASSWORD
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // App Password từ Google Account
      },
    });
  }

  // Fallback: sử dụng test account (chỉ dùng cho development)
  if (process.env.NODE_ENV === 'development') {
    console.warn('[emailService] Using test account. Set up GMAIL_USER and GMAIL_APP_PASSWORD for production.');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'test@ethereal.email',
        pass: 'test',
      },
    });
  }

  console.warn('[emailService] Email transporter not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD or SMTP settings in .env file.');
  return null;
};

const transporter = createTransporter();

// Log cấu hình khi khởi động
if (transporter) {
  console.log('[emailService] Email service configured successfully');
} else {
  console.warn('[emailService] Email service NOT configured. Emails will not be sent.');
  console.warn('[emailService] To configure: Add GMAIL_USER and GMAIL_APP_PASSWORD to .env file');
}

/**
 * Gửi email chào mừng khi đăng ký thành công
 * @param {string} to - Email người nhận
 * @param {string} username - Tên người dùng
 */
const sendWelcomeEmail = async (to, username) => {
  console.log('[emailService] Attempting to send welcome email to:', to);
  
  if (!transporter) {
    console.warn('[emailService] Email transporter not configured. Skipping email send.');
    console.warn('[emailService] Please configure GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    console.log('[emailService] Sending email from:', process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@showbill.com');
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@showbill.com',
      to: to,
      subject: 'Chào mừng đến với ShowBill! 🎉',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Chào mừng đến với ShowBill</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .content {
              background: white;
              border-radius: 8px;
              padding: 30px;
              margin-top: 20px;
            }
            h1 {
              color: white;
              margin: 0 0 10px 0;
              font-size: 28px;
              text-align: center;
            }
            .subtitle {
              color: rgba(255, 255, 255, 0.9);
              text-align: center;
              margin-bottom: 20px;
              font-size: 16px;
            }
            .welcome-text {
              font-size: 18px;
              color: #333;
              margin-bottom: 20px;
            }
            .info-box {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              font-weight: 600;
              text-align: center;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 14px;
              color: #666;
              text-align: center;
            }
            .highlight {
              color: #667eea;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Chào mừng đến với ShowBill!</h1>
            <p class="subtitle">Cảm ơn bạn đã đăng ký tài khoản</p>
            
            <div class="content">
              <p class="welcome-text">Xin chào <span class="highlight">${username}</span>,</p>
              
              <p>Chúng tôi rất vui mừng được chào đón bạn tham gia cộng đồng ShowBill!</p>
              
              <div class="info-box">
                <strong>📋 Tài khoản của bạn đã được tạo thành công:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Tên đăng nhập: <strong>${username}</strong></li>
                  <li>Email: <strong>${to}</strong></li>
                </ul>
              </div>
              
              <p>Bạn có thể bắt đầu sử dụng các tính năng của ShowBill ngay bây giờ:</p>
              <ul style="margin: 15px 0; padding-left: 20px;">
                <li>Quản lý sản phẩm và danh mục</li>
                <li>Theo dõi đơn hàng và thanh toán</li>
                <li>Truy cập bảng điều khiển quản trị</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">
                  Truy cập ShowBill ngay
                </a>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi.
              </p>
            </div>
            
            <div class="footer">
              <p>Trân trọng,<br><strong>Đội ngũ ShowBill</strong></p>
              <p style="font-size: 12px; color: #999; margin-top: 10px;">
                Email này được gửi tự động, vui lòng không trả lời email này.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Chào mừng đến với ShowBill! 🎉

Xin chào ${username},

Chúng tôi rất vui mừng được chào đón bạn tham gia cộng đồng ShowBill!

Tài khoản của bạn đã được tạo thành công:
- Tên đăng nhập: ${username}
- Email: ${to}

Bạn có thể bắt đầu sử dụng các tính năng của ShowBill ngay bây giờ.

Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi.

Trân trọng,
Đội ngũ ShowBill
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[emailService] Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[emailService] Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email reset password với mã OTP
 * @param {string} to - Email người nhận
 * @param {string} resetToken - Mã token để reset password
 * @param {string} username - Tên người dùng
 */
const sendResetPasswordEmail = async (to, resetToken, username) => {
  console.log('[emailService] Attempting to send reset password email to:', to);
  
  if (!transporter) {
    console.warn('[emailService] Email transporter not configured. Skipping email send.');
    console.warn('[emailService] Please configure GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@showbill.com',
      to: to,
      subject: '🔐 Đặt lại mật khẩu ShowBill',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Đặt lại mật khẩu ShowBill</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .content {
              background: white;
              border-radius: 8px;
              padding: 30px;
              margin-top: 20px;
            }
            h1 {
              color: white;
              margin: 0 0 10px 0;
              font-size: 28px;
              text-align: center;
            }
            .subtitle {
              color: rgba(255, 255, 255, 0.9);
              text-align: center;
              margin-bottom: 20px;
              font-size: 16px;
            }
            .welcome-text {
              font-size: 18px;
              color: #333;
              margin-bottom: 20px;
            }
            .token-box {
              background: #f8f9fa;
              border: 2px dashed #667eea;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .token {
              font-size: 32px;
              font-weight: 800;
              color: #667eea;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
              margin: 10px 0;
              word-break: break-all;
            }
            .button {
              display: inline-block;
              padding: 14px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              font-weight: 600;
              text-align: center;
              font-size: 16px;
            }
            .warning-box {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
              font-size: 14px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 14px;
              color: #666;
              text-align: center;
            }
            .highlight {
              color: #667eea;
              font-weight: 600;
            }
            .info-text {
              font-size: 14px;
              color: #666;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔐 Đặt lại mật khẩu</h1>
            <p class="subtitle">Yêu cầu đặt lại mật khẩu của bạn</p>
            
            <div class="content">
              <p class="welcome-text">Xin chào <span class="highlight">${username}</span>,</p>
              
              <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
              
              <div class="token-box">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #333;">Mã đặt lại mật khẩu của bạn:</p>
                <div class="token">${resetToken}</div>
                <p class="info-text">Mã này có hiệu lực trong 15 phút</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">
                  Đặt lại mật khẩu ngay
                </a>
              </div>
              
              <div class="warning-box">
                <strong>⚠️ Lưu ý quan trọng:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Mã này chỉ có hiệu lực trong <strong>15 phút</strong></li>
                  <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
                  <li>Không chia sẻ mã này với bất kỳ ai</li>
                </ul>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi.
              </p>
            </div>
            
            <div class="footer">
              <p>Trân trọng,<br><strong>Đội ngũ ShowBill</strong></p>
              <p style="font-size: 12px; color: #999; margin-top: 10px;">
                Email này được gửi tự động, vui lòng không trả lời email này.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Đặt lại mật khẩu ShowBill 🔐

Xin chào ${username},

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.

Mã đặt lại mật khẩu của bạn: ${resetToken}

Mã này có hiệu lực trong 15 phút.

Hoặc truy cập link sau để đặt lại mật khẩu:
${resetUrl}

⚠️ Lưu ý quan trọng:
- Mã này chỉ có hiệu lực trong 15 phút
- Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này
- Không chia sẻ mã này với bất kỳ ai

Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi.

Trân trọng,
Đội ngũ ShowBill
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[emailService] Reset password email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[emailService] Error sending reset password email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email liên hệ từ form contact
 * @param {string} fromEmail - Email người gửi
 * @param {string} name - Tên người gửi
 * @param {string} subject - Chủ đề (optional)
 * @param {string} message - Nội dung tin nhắn
 * @param {string} toEmail - Email người nhận (mặc định là admin email)
 */
const sendContactEmail = async (fromEmail, name, subject, message, toEmail = null) => {
  console.log('[emailService] Attempting to send contact email from:', fromEmail);
  
  if (!transporter) {
    console.warn('[emailService] Email transporter not configured. Skipping email send.');
    return { success: false, message: 'Email service not configured' };
  }

  const recipientEmail = toEmail || process.env.CONTACT_EMAIL || process.env.GMAIL_USER || process.env.EMAIL_FROM || 'support@showbill.com';

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@showbill.com',
      to: recipientEmail,
      replyTo: fromEmail, // Cho phép reply trực tiếp về email người gửi
      subject: subject ? `[ShowBill Contact] ${subject}` : '[ShowBill Contact] Tin nhắn mới từ khách hàng',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tin nhắn liên hệ từ ShowBill</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: #ffffff;
              border-radius: 12px;
              padding: 30px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .info-section {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .info-row {
              margin-bottom: 10px;
            }
            .info-label {
              font-weight: 600;
              color: #555;
              display: inline-block;
              width: 100px;
            }
            .message-section {
              background: #ffffff;
              border: 2px solid #e9ecef;
              border-radius: 8px;
              padding: 20px;
              margin-top: 20px;
            }
            .message-title {
              font-weight: 600;
              color: #333;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .message-content {
              color: #555;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              text-align: center;
              color: #888;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Tin nhắn mới từ khách hàng</h1>
            </div>
            
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">Tên:</span>
                <span>${name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email:</span>
                <span><a href="mailto:${fromEmail}">${fromEmail}</a></span>
              </div>
              ${subject ? `
              <div class="info-row">
                <span class="info-label">Chủ đề:</span>
                <span>${subject}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Thời gian:</span>
                <span>${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
              </div>
            </div>
            
            <div class="message-section">
              <div class="message-title">Nội dung tin nhắn:</div>
              <div class="message-content">${message.replace(/\n/g, '<br>')}</div>
            </div>
            
            <div class="footer">
              <p>Email này được gửi tự động từ form liên hệ ShowBill</p>
              <p>Bạn có thể reply trực tiếp email này để phản hồi khách hàng.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Tin nhắn mới từ khách hàng - ShowBill

Thông tin người gửi:
- Tên: ${name}
- Email: ${fromEmail}
${subject ? `- Chủ đề: ${subject}\n` : ''}
- Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

Nội dung tin nhắn:
${message}

---
Email này được gửi tự động từ form liên hệ ShowBill
Bạn có thể reply trực tiếp email này để phản hồi khách hàng.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[emailService] Contact email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[emailService] Error sending contact email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email xác nhận thanh toán thành công
 * @param {string} toEmail - Email người nhận (admin đã thanh toán)
 * @param {string} username - Tên người dùng
 * @param {string} packageType - Loại gói đã mua
 * @param {number} amount - Số tiền đã thanh toán
 * @param {Date} expiryDate - Ngày hết hạn gói
 * @param {string} transferContent - Mã nội dung chuyển khoản
 */
const sendPaymentSuccessEmail = async (toEmail, username, packageType, amount, expiryDate, transferContent) => {
  console.log('[emailService] Attempting to send payment success email to:', toEmail);
  
  if (!transporter) {
    console.warn('[emailService] Email transporter not configured. Skipping email send.');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    // Format ngày hết hạn
    const expiryDateStr = expiryDate.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    // Format số tiền
    const amountFormatted = new Intl.NumberFormat('vi-VN').format(amount);

    // Tên gói với format đẹp
    const packageNameMap = {
      basic: 'Basic',
      pro: 'Pro',
      premium: 'Premium',
      vip: 'VIP',
    };
    const packageDisplayName = packageNameMap[packageType.toLowerCase()] || packageType.toUpperCase();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@showbill.com',
      to: toEmail,
      subject: `✅ Thanh toán thành công - Gói ${packageDisplayName} ShowBill`,
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thanh toán thành công</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: #ffffff;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px;
              border-radius: 8px;
              margin-bottom: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
            }
            .success-icon {
              font-size: 48px;
            }
            .content {
              margin-bottom: 30px;
            }
            .info-card {
              background: #f8f9fa;
              border-left: 4px solid #10b981;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
              padding-bottom: 12px;
              border-bottom: 1px solid #e9ecef;
            }
            .info-row:last-child {
              margin-bottom: 0;
              padding-bottom: 0;
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #555;
            }
            .info-value {
              color: #333;
              font-weight: 700;
            }
            .package-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              font-weight: 700;
              font-size: 18px;
            }
            .amount {
              color: #10b981;
              font-size: 24px;
              font-weight: 900;
            }
            .expiry-date {
              color: #f59e0b;
              font-weight: 700;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              text-align: center;
              color: #888;
              font-size: 12px;
            }
            .note {
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 8px;
              padding: 15px;
              margin-top: 20px;
              color: #856404;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>
                <span class="success-icon">✅</span>
                <span>Thanh toán thành công!</span>
              </h1>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
                Xin chào <strong>${username}</strong>,
              </p>
              
              <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
                Cảm ơn bạn đã thanh toán! Gói của bạn đã được kích hoạt thành công.
              </p>
              
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Gói đã mua:</span>
                  <span class="package-badge">${packageDisplayName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Số tiền:</span>
                  <span class="info-value amount">${amountFormatted} VNĐ</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Mã giao dịch:</span>
                  <span class="info-value">${transferContent}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Ngày hết hạn:</span>
                  <span class="info-value expiry-date">${expiryDateStr}</span>
                </div>
              </div>
              
              <div class="note">
                <strong>📌 Lưu ý:</strong><br>
                Gói của bạn sẽ tự động hết hạn vào ngày ${expiryDateStr}. 
                Bạn có thể gia hạn hoặc nâng cấp gói bất cứ lúc nào trong phần quản lý gói.
              </div>
            </div>
            
            <div class="footer">
              <p>Email này được gửi tự động từ hệ thống ShowBill</p>
              <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc form liên hệ.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Thanh toán thành công - ShowBill ✅

Xin chào ${username},

Cảm ơn bạn đã thanh toán! Gói của bạn đã được kích hoạt thành công.

Thông tin giao dịch:
- Gói đã mua: ${packageDisplayName}
- Số tiền: ${amountFormatted} VNĐ
- Mã giao dịch: ${transferContent}
- Ngày hết hạn: ${expiryDateStr}

Lưu ý: Gói của bạn sẽ tự động hết hạn vào ngày ${expiryDateStr}. 
Bạn có thể gia hạn hoặc nâng cấp gói bất cứ lúc nào trong phần quản lý gói.

---
Email này được gửi tự động từ hệ thống ShowBill
Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[emailService] Payment success email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[emailService] Error sending payment success email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi email thông báo tài khoản bị tạm khóa
 * @param {string} toEmail - Email người nhận (admin bị khóa)
 * @param {string} username - Tên người dùng
 * @param {string} reason - Lý do khóa (optional)
 */
const sendAccountLockedEmail = async (toEmail, username, reason = null) => {
  console.log('[emailService] Attempting to send account locked email to:', toEmail);
  
  if (!transporter) {
    console.warn('[emailService] Email transporter not configured. Skipping email send.');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@showbill.com',
      to: toEmail,
      subject: '⚠️ Tài khoản ShowBill của bạn đã bị tạm khóa',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tài khoản bị tạm khóa</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: #ffffff;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              color: white;
              padding: 30px;
              border-radius: 8px;
              margin-bottom: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
            }
            .warning-icon {
              font-size: 48px;
            }
            .content {
              margin-bottom: 30px;
            }
            .alert-box {
              background: #fef2f2;
              border-left: 4px solid #ef4444;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .alert-title {
              font-weight: 700;
              color: #dc2626;
              font-size: 18px;
              margin-bottom: 10px;
            }
            .alert-text {
              color: #991b1b;
              line-height: 1.8;
            }
            .info-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .info-item {
              margin-bottom: 12px;
              padding-bottom: 12px;
              border-bottom: 1px solid #e9ecef;
            }
            .info-item:last-child {
              margin-bottom: 0;
              padding-bottom: 0;
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #555;
              display: block;
              margin-bottom: 4px;
            }
            .info-value {
              color: #333;
            }
            .action-box {
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 8px;
              padding: 20px;
              margin-top: 20px;
            }
            .action-title {
              font-weight: 700;
              color: #856404;
              margin-bottom: 10px;
            }
            .action-text {
              color: #856404;
              line-height: 1.8;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              text-align: center;
              color: #888;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>
                <span class="warning-icon">⚠️</span>
                <span>Tài khoản bị tạm khóa</span>
              </h1>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
                Xin chào <strong>${username}</strong>,
              </p>
              
              <div class="alert-box">
                <div class="alert-title">Thông báo quan trọng</div>
                <div class="alert-text">
                  Tài khoản ShowBill của bạn đã bị tạm khóa bởi quản trị viên hệ thống.
                  ${reason ? `<br><br><strong>Lý do:</strong> ${reason}` : ''}
                </div>
              </div>
              
              <div class="info-section">
                <div class="info-item">
                  <span class="info-label">Tài khoản:</span>
                  <span class="info-value">${username}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${toEmail}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Thời gian:</span>
                  <span class="info-value">${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                </div>
              </div>
              
              <div class="action-box">
                <div class="action-title">📞 Bạn cần làm gì?</div>
                <div class="action-text">
                  Để mở khóa tài khoản, vui lòng liên hệ với quản trị viên hệ thống qua:<br>
                  • Email: support@showbill.com<br>
                  • Zalo: 0342031354<br>
                  • Hoặc sử dụng form liên hệ trên website
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>Email này được gửi tự động từ hệ thống ShowBill</p>
              <p>Nếu bạn cho rằng đây là lỗi, vui lòng liên hệ ngay với chúng tôi.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Tài khoản ShowBill của bạn đã bị tạm khóa ⚠️

Xin chào ${username},

Thông báo quan trọng:
Tài khoản ShowBill của bạn đã bị tạm khóa bởi quản trị viên hệ thống.
${reason ? `\nLý do: ${reason}\n` : ''}

Thông tin tài khoản:
- Tài khoản: ${username}
- Email: ${toEmail}
- Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

Bạn cần làm gì?
Để mở khóa tài khoản, vui lòng liên hệ với quản trị viên hệ thống qua:
- Email: support@showbill.com
- Zalo: 0342031354
- Hoặc sử dụng form liên hệ trên website

---
Email này được gửi tự động từ hệ thống ShowBill
Nếu bạn cho rằng đây là lỗi, vui lòng liên hệ ngay với chúng tôi.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[emailService] Account locked email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[emailService] Error sending account locked email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kiểm tra xem email service có được cấu hình không
 */
const isConfigured = () => {
  return transporter !== null;
};

module.exports = {
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendContactEmail,
  sendPaymentSuccessEmail,
  sendAccountLockedEmail,
  isConfigured,
};

