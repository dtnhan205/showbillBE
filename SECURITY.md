# Security Improvements & Best Practices

## Tổng quan các cải thiện bảo mật

### 1. Rate Limiting ✅
- **Upload endpoints**: Giới hạn 10 uploads mỗi 15 phút cho mỗi user
- **Bulk upload**: Giới hạn 5 lần mỗi giờ
- **Profile update**: Giới hạn 10 lần mỗi 5 phút
- **API endpoints**: Giới hạn 100 requests mỗi 15 phút
- **Admin API**: Giới hạn 200 requests mỗi 15 phút
- **Register**: Giới hạn 5 accounts mỗi 15 phút
- **Forgot password**: Giới hạn 3 requests mỗi 15 phút

### 2. File Upload Security ✅
- **File type validation**: Chỉ chấp nhận jpeg, jpg, png, gif, webp
- **Magic bytes validation**: Kiểm tra magic bytes để đảm bảo file thực sự là image
- **File size limits**: 
  - Avatar: 5MB
  - Banner: 10MB
  - Products: 50MB
- **Filename sanitization**: Loại bỏ ký tự nguy hiểm trong filename
- **Extension validation**: Chỉ giữ lại extension hợp lệ
- **Concurrent upload protection**: Rate limiting ngăn spam upload

### 3. Security Headers (Helmet) ✅
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security (HSTS)
- Cross-Origin Resource Policy

### 4. CORS Configuration ✅
- Chỉ cho phép origins được cấu hình trong `ALLOWED_ORIGINS`
- Development mode cho phép localhost
- Credentials được bật cho authenticated requests

### 5. Input Validation & Sanitization ✅
- DisplayName: Tối đa 100 ký tự
- Bio: Tối đa 500 ký tự
- AvatarFrame: Validate format và package requirements
- Password: Tối thiểu 6 ký tự
- Email: Regex validation
- Query parameters: Sanitized và validated

### 6. Error Handling ✅
- Centralized error handler
- Không leak thông tin nhạy cảm trong production
- Detailed logging trong development
- Proper error messages cho client

### 7. Authentication & Authorization ✅
- JWT token validation
- Account status check (isActive)
- Role-based access control (super admin)
- Token expiration handling

## Cấu hình Environment Variables

Thêm vào `.env`:

```env
# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com

# Security
NODE_ENV=production
JWT_SECRET=your-very-strong-secret-key-minimum-32-characters

# Rate Limiting (optional, defaults are set)
UPLOAD_RATE_LIMIT_WINDOW_MS=900000
UPLOAD_RATE_LIMIT_MAX=10
```

## Kiểm tra khi deploy

1. ✅ Đảm bảo `JWT_SECRET` đủ mạnh (tối thiểu 32 ký tự)
2. ✅ Cấu hình `ALLOWED_ORIGINS` với domain thực tế
3. ✅ Đặt `NODE_ENV=production`
4. ✅ Kiểm tra file permissions cho thư mục `uploads/`
5. ✅ Giới hạn disk space cho uploads
6. ✅ Setup monitoring cho rate limit violations
7. ✅ Backup database thường xuyên
8. ✅ Log rotation cho application logs

## Xử lý khi nhiều người upload cùng lúc

- Rate limiting ngăn spam từ cùng một user/IP
- File size limits giới hạn dung lượng mỗi upload
- Concurrent uploads được xử lý bởi Express và Multer
- Database operations sử dụng Mongoose (có connection pooling)
- File system operations được xử lý tuần tự (không có race condition)

## Lưu ý quan trọng

1. **Disk Space**: Monitor disk usage của thư mục `uploads/`. Cân nhắc cleanup old files.
2. **Memory**: Multer sử dụng disk storage, không load toàn bộ file vào memory.
3. **Concurrent Requests**: Express xử lý concurrent requests tốt, nhưng cần đảm bảo server có đủ resources.
4. **Database**: Mongoose connection pool mặc định là 5, có thể tăng nếu cần.

## Monitoring & Alerts

Nên setup monitoring cho:
- Rate limit violations
- Upload errors
- Disk space usage
- Database connection pool
- Server memory/CPU usage

