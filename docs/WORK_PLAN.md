# แผนพัฒนาต่อจาก Alpha

## เสร็จแล้วใน 0.2.x
- Streaming OpenAI/Gemini
- Stop generation
- PDF/DOCX reader
- Code Workspace: folder tree, diff, backup, syntax check, ZIP export
- Batch schema mapper, column mapping, validation rules per field
- Retry only failed field
- Multi-user management: Owner/Admin/User/Viewer
- Per-user budget and provider permission
- Audit log page
- Backup/restore UI

## 0.3.0
- Writer Workspace เป็นเมนูแยก
- อัปโหลด TXT/MD/CSV/JSON/XLSX/XLSM/ZIP หลังติดตั้ง
- ไม่ฝังชุดข้อมูล WorkPad, Keyword, Tag, Prompt หรือ API Key ในตัวติดตั้ง
- สุ่ม Focus/Supporting Keywords/Tags/Categories แบบมี Seed
- Structured Post, Validator, Draft และ Export XLSX/CSV/JSON/Markdown
- UI Smoke Test ด้วยฐานข้อมูลทดสอบแยกจากข้อมูลจริง

## งานระยะถัดไปก่อน 1.0.0
- Windows installer verification
- Resume after crash and Windows restart
- Long-running job hardening
- Signed release และระบบอัปเดต
- Control Server/License/Sync แบบ production (ยังไม่ใช้ในรุ่น Standalone)
