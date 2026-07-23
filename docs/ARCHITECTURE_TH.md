# สถาปัตยกรรม BOSSMASTER

ระบบแบ่งเป็นสามส่วนเพื่อให้เครื่อง Super Admin ไม่ต้องเปิดตลอดเวลา:

1. **Desktop Client** — แชท, Notepad, Code Workspace, Batch และข้อมูลในเครื่อง
2. **Control Server** — บัญชี, Session, อุปกรณ์, สิทธิ์, Feature Flags, Quota และ Offline Lease
3. **AI Connection** — Central Proxy, BYOK หรือ Local AI ตามนโยบายที่ Super Admin อนุญาต

Desktop Client ต้องไม่เชื่อมผ่าน IP บ้านหรือเครื่อง Super Admin โดยตรง ใน Production ให้ Control Server อยู่บน Cloud/VPS ที่มี Domain และ HTTPS

## สถานะปัจจุบัน

- Desktop Build Ready
- Control Server Foundation พร้อมทดสอบภายในเครื่อง
- Internet Production Pending

ยังไม่ถือว่า Internet Production Ready จนกว่าจะมี Cloud/VPS, HTTPS, Production Secret, External Client Test, Live API Test, Backup/Restore และ Monitoring จริง

## Offline

Offline Lease ใช้ลายเซ็น Ed25519 โดย Private Key อยู่บน Server และ Desktop มีเฉพาะ Public Key ค่าเริ่มต้นที่แนะนำคือ 24 ชั่วโมง เมื่อ Lease หมดอายุให้เปิดอ่านและ Export ได้ แต่หยุดงานออนไลน์ใหม่

การระงับผู้ใช้ที่ไม่ได้เชื่อมต่อ Server จะมีผลเมื่อ Client ติดต่อ Server อีกครั้งหรือ Lease หมดอายุ
