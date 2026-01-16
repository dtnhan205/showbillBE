# Hướng dẫn cấu hình Environment Variables

## Tạo file .env

Tạo file `.env` trong thư mục `showbillBE/` với nội dung sau:

```env
# Database
MONGO_URI=mongodb://localhost:27017/showbill

# JWT Secret
JWT_SECRET=your-secret-key-here

# Server Port
PORT=5000

# Bank Transaction API Configuration (apicanhan.com)
# URL của API lấy lịch sử giao dịch ngân hàng
# Mặc định: https://apicanhan.com/api/mbbankv3
BANK_API_URL=https://apicanhan.com/api/mbbankv3

# API Key từ apicanhan.com
BANK_API_KEY=your-apicanhan-api-key-here

# Username tài khoản ngân hàng
BANK_API_USERNAME=your-bank-username-here

# Password tài khoản ngân hàng
BANK_API_PASSWORD=your-bank-password-here

# Thời gian timeout cho API request (milliseconds)
BANK_API_TIMEOUT=10000
```

## Các biến môi trường cho Bank Transaction API

### Bắt buộc:
- `BANK_API_URL`: URL endpoint của API lấy lịch sử giao dịch
  - Ví dụ: `https://api.bank.com/v1/transactions`
  - Ví dụ: `https://api.vietqr.io/v2/transactions`

### Tùy chọn (tùy theo API bạn sử dụng):

1. **Bearer Token Authentication:**
   ```env
   BANK_API_KEY=your-bearer-token-here
   ```

2. **Basic Authentication:**
   ```env
   BANK_API_USERNAME=your-username
   BANK_API_PASSWORD=your-password
   ```

3. **API Secret (cho signature):**
   ```env
   BANK_API_SECRET=your-api-secret-here
   ```

4. **Timeout:**
   ```env
   BANK_API_TIMEOUT=10000  # milliseconds (mặc định: 10000)
   ```

## Ví dụ cấu hình cho apicanhan.com API

### Cấu hình cho MBBank
```env
BANK_API_URL=https://apicanhan.com/api/mbbankv3
BANK_API_KEY=befca1aff068131318ac71958a6fd142
BANK_API_USERNAME=your-mbbank-username
BANK_API_PASSWORD=your-mbbank-password
BANK_API_TIMEOUT=15000
```

**Lưu ý:**
- `BANK_API_KEY`: Lấy từ apicanhan.com
- `BANK_API_USERNAME`: Username đăng nhập MBBank
- `BANK_API_PASSWORD`: Password đăng nhập MBBank
- `accountNo` sẽ được tự động lấy từ số tài khoản trong database

## Lưu ý

1. **Không commit file `.env` vào git** - file này chứa thông tin nhạy cảm
2. File `.env` đã được thêm vào `.gitignore`
3. Sử dụng `.env.example` hoặc file này làm template
4. Sau khi cấu hình, restart server để áp dụng thay đổi

## Format Response API (apicanhan.com)

API apicanhan.com trả về format như sau:

```json
{
  "status": "success",
  "message": "Thành công",
  "transactions": [
    {
      "transactionID": "FT26016409877420",
      "amount": "70000",
      "description": "CUSTOMER...chuyentien...",
      "transactionDate": "16/01/2026 16:24:34",
      "type": "IN"
    }
  ]
}
```

Service sẽ tự động:
- Parse response và convert `amount` từ string sang number
- Extract nội dung chuyển khoản từ `description`
- Chỉ xử lý giao dịch loại "IN" (tiền vào)
- So khớp với payment dựa trên `amount` và `transferContent` trong `description`

