/**
 * Script để test gửi email
 * Chạy: node scripts/test-email.js
 */

require('dotenv').config();
const { sendWelcomeEmail } = require('../services/emailService');

async function testEmail() {
  console.log('=== Testing Email Service ===\n');
  
  // Kiểm tra biến môi trường
  console.log('Environment Variables:');
  console.log('GMAIL_USER:', process.env.GMAIL_USER ? '✓ Set' : '✗ Not set');
  console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('SMTP_HOST:', process.env.SMTP_HOST || 'Not set');
  console.log('SMTP_PORT:', process.env.SMTP_PORT || 'Not set');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');
  console.log('');

  // Test email
  const testEmail = process.argv[2] || 'test@example.com';
  const testUsername = process.argv[3] || 'TestUser';

  console.log(`Sending test email to: ${testEmail}`);
  console.log(`Username: ${testUsername}\n`);

  try {
    const result = await sendWelcomeEmail(testEmail, testUsername);
    
    if (result.success) {
      console.log('✓ Email sent successfully!');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('✗ Failed to send email');
      console.log('Error:', result.message || result.error);
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Full error:', error);
  }
}

testEmail().then(() => {
  console.log('\n=== Test completed ===');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});

