# Hướng dẫn cấu hình Email Service

## Bước 1: Cài đặt package

**QUAN TRỌNG:** Bạn cần cài đặt nodemailer trước:

```bash
cd showbillBE
npm install nodemailer
```

Hoặc nếu bạn đang ở thư mục gốc:
```bash
npm install nodemailer --prefix showbillBE
```

## Cấu hình Email

Thêm các biến môi trường sau vào file `.env`:

### Cách 1: Sử dụng Gmail (Khuyến nghị)

1. Bật xác thực 2 bước cho tài khoản Gmail của bạn
2. Tạo App Password:
   - Vào [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Tạo App Password mới cho "Mail"
   - Copy password (16 ký tự)

3. Thêm vào `.env`:
```env
# Gmail Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Email từ (có thể để trống, sẽ dùng GMAIL_USER)
EMAIL_FROM=noreply@showbill.com

# URL frontend (để tạo link trong email)
FRONTEND_URL=http://localhost:3000
```

### Cách 2: Sử dụng SMTP Server riêng

```env
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false  # true cho port 465, false cho 587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password

# Email từ
EMAIL_FROM=noreply@showbill.com

# URL frontend
FRONTEND_URL=http://localhost:3000
```

### Cách 3: Development (Test Account)

Nếu không cấu hình, hệ thống sẽ sử dụng test account trong môi trường development (không gửi email thật).

## Kiểm tra cấu hình

### Kiểm tra logs khi khởi động server

Khi bạn khởi động server, bạn sẽ thấy một trong các thông báo sau:

- ✅ `[emailService] Email service configured successfully` - Email đã được cấu hình đúng
- ⚠️ `[emailService] Email service NOT configured` - Chưa cấu hình email

### Test gửi email

Chạy script test để kiểm tra:

```bash
cd showbillBE
node scripts/test-email.js your-email@gmail.com YourUsername
```

Script này sẽ:
- Kiểm tra các biến môi trường
- Gửi email test đến địa chỉ bạn chỉ định
- Hiển thị kết quả và lỗi (nếu có)

### Kiểm tra logs khi đăng ký

Khi có người đăng ký, kiểm tra console logs:
- `[register] Attempting to send welcome email to: ...` - Đang cố gắng gửi email
- `[register] Welcome email sent successfully: ...` - Email đã gửi thành công
- `[register] Failed to send welcome email: ...` - Có lỗi khi gửi email

## Troubleshooting

### Không nhận được email?

1. **Kiểm tra nodemailer đã cài chưa:**
   ```bash
   cd showbillBE
   npm list nodemailer
   ```
   Nếu không có, cài đặt: `npm install nodemailer`

2. **Kiểm tra biến môi trường:**
   - Mở file `.env` trong thư mục `showbillBE`
   - Đảm bảo có `GMAIL_USER` và `GMAIL_APP_PASSWORD`
   - Khởi động lại server sau khi thay đổi `.env`

3. **Kiểm tra App Password:**
   - App Password phải là 16 ký tự (không có khoảng trắng)
   - Đảm bảo đã bật 2-Step Verification
   - Tạo App Password mới nếu cần

4. **Kiểm tra logs:**
   - Xem console khi khởi động server
   - Xem console khi có người đăng ký
   - Chạy script test để xem lỗi chi tiết

5. **Kiểm tra spam folder:**
   - Email có thể vào thư mục Spam/Junk
   - Kiểm tra cả Promotions tab (nếu dùng Gmail)

## Lưu ý

- Email được gửi bất đồng bộ, không chặn quá trình đăng ký
- Nếu gửi email thất bại, đăng ký vẫn thành công (chỉ log lỗi)
- Đảm bảo App Password của Gmail được bảo mật, không commit vào git

