// controllers/contactController.js
const { sendContactEmail } = require('../services/emailService');

/**
 * POST /api/contact
 * Nhận tin nhắn từ form liên hệ và gửi email
 * Yêu cầu: Đăng nhập và email phải trùng với email tài khoản
 */
exports.sendContactMessage = async (req, res) => {
  try {
    // Kiểm tra đã đăng nhập chưa (middleware protect đã kiểm tra, nhưng double check)
    if (!req.admin) {
      return res.status(401).json({
        message: 'Vui lòng đăng nhập để gửi tin nhắn',
      });
    }

    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc (Họ tên, Email, Tin nhắn)',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = String(email).trim().toLowerCase();
    
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        message: 'Địa chỉ email không hợp lệ',
      });
    }

    // QUAN TRỌNG: Kiểm tra email trong form phải trùng với email tài khoản đã đăng nhập
    const adminEmail = String(req.admin.email).trim().toLowerCase();
    if (trimmedEmail !== adminEmail) {
      return res.status(403).json({
        message: 'Email trong form phải trùng với email tài khoản của bạn. Vui lòng sử dụng email đã đăng ký.',
      });
    }

    // Validate length
    const trimmedName = String(name).trim();
    const trimmedMessage = String(message).trim();
    const trimmedSubject = subject ? String(subject).trim() : '';

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({
        message: 'Họ và tên phải từ 2 đến 100 ký tự',
      });
    }

    if (trimmedEmail.length > 255) {
      return res.status(400).json({
        message: 'Email quá dài',
      });
    }

    if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
      return res.status(400).json({
        message: 'Tin nhắn phải từ 10 đến 2000 ký tự',
      });
    }

    if (trimmedSubject.length > 200) {
      return res.status(400).json({
        message: 'Chủ đề không được vượt quá 200 ký tự',
      });
    }

    // Sanitize input để tránh XSS (basic)
    const sanitizeHtml = (str) => {
      return String(str)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    };

    // Gửi email
    const emailResult = await sendContactEmail(
      trimmedEmail,
      sanitizeHtml(trimmedName),
      trimmedSubject ? sanitizeHtml(trimmedSubject) : null,
      sanitizeHtml(trimmedMessage)
    );

    if (!emailResult.success) {
      console.error('[contactController] Failed to send email:', emailResult.error);
      return res.status(500).json({
        message: 'Không thể gửi tin nhắn. Vui lòng thử lại sau hoặc liên hệ trực tiếp qua email.',
      });
    }

    console.log('[contactController] Contact message sent successfully from:', trimmedEmail);

    res.json({
      message: 'Tin nhắn đã được gửi thành công! Chúng tôi sẽ phản hồi sớm nhất có thể.',
      success: true,
    });
  } catch (err) {
    console.error('[contactController] Error:', err);
    res.status(500).json({
      message: 'Lỗi máy chủ. Vui lòng thử lại sau.',
    });
  }
};

