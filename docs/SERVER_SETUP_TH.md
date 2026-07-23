# การเริ่ม Control Server สำหรับ Development

Control Server รุ่นเริ่มต้นผูกกับ `127.0.0.1` เท่านั้น จึงไม่เปิดรับอินเทอร์เน็ตและไม่แก้ Windows Firewall

## ทดสอบ

```text
npm run server:test
```

## เริ่มระบบภายในเครื่อง

กำหนด Environment Variables ก่อน:

```text
BOSSMASTER_SERVER_HOST=127.0.0.1
BOSSMASTER_SERVER_PORT=8787
BOSSMASTER_SERVER_DATA=<โฟลเดอร์ข้อมูลที่ไม่อยู่ใน Git>
BOSSMASTER_BOOTSTRAP_TOKEN=<ค่าสุ่มยาวสำหรับใช้ครั้งแรก>
```

จากนั้นรัน:

```text
npm run server:start
```

Health Check:

```text
GET http://127.0.0.1:8787/health
```

## ข้อห้าม

- ห้าม Commit `.env`, Token, Password, Private Key หรือฐานข้อมูล
- ห้ามเปิดพอร์ต Router/Firewall อัตโนมัติ
- ห้ามนำ Development Server ออกสู่อินเทอร์เน็ตโดยตรง
- Production ต้องใช้ HTTPS ผ่าน Reverse Proxy หรือ Secure Tunnel
- Bootstrap Super Admin ต้องทำครั้งเดียว และห้ามใช้รหัสผ่านที่เคยเปิดเผย

## งานที่ยังต้องทำก่อน Production

- Session rotation และ reuse detection
- Device registration/revocation
- Feature Flag resolution ทุกระดับ
- Invite แบบใช้ครั้งเดียว
- Offline Lease API และ key storage
- AI Proxy/BYOK policy
- Admin Dashboard
- Backup/Restore และ Monitoring
- Desktop Client integration
