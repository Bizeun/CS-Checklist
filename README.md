# CS Checklist - Daily Tracking Web App

A web-based checklist application for tracking daily tasks. Built with Python (FastAPI), Firebase, and deployed on Vercel.

---

## Version Updates

### Version 0.1.0 (2026-01-30)

#### New Features
- **Photo Upload**: Upload images for each checklist item (Firebase Storage)
- **Notes System**: Add comments/notes to any task
- **Multi-language Support**: Toggle between 한글 ⟷ English
- **Calendar Summary**: Monthly view with completion tracking
- **Enhanced UI**: Gradient tags for 양극(red)/음극(blue) with bold borders
- **Auto-save**: Toggle checked items without manual submit

#### Improvements
- Added 4 Vision Types: 공통, 통합, NG mark, 포일, 탈리(Delamination)
- Priority sorting: 정합성 items always appear first
- Filter labels now translate with language selection
- Reduced line options from 10 to 4 (Line #1-4)
- Better loading screen with gradient background and pulse animation

#### Bug Fixes
- Fixed photo upload timestamp serialization error
- Fixed filter not showing 공통 items when specific Vision Type selected
- Improved checklist item persistence

---

## Current Features

- Daily checklist tracking with progress stats
- Multi-user support (each user can mark their own checks)
- Date-based tracking with period-based filtering
- Advanced filters (Process, Vision Type, Category, Frequency)
- Bilingual UI (한글/English)
- Photo uploads with gallery view
- Task notes and comments
- Calendar summary view
- Firebase Firestore + Storage
- Vercel deployment

## Quick Start

### Prerequisites
- Python 3.10+ | Firebase project | Vercel account

### Setup (5 steps)

1. **Firebase Setup**
   - Enable Firestore Database
   - Enable Storage (for photos)
   - Download service account JSON → save as `firebase-credentials.json`

2. **Install & Generate Checklist**
   ```bash
   pip install -r requirements.txt
   python create_new_excel.py          # Generate Excel template
   python scripts/parse_excel.py       # Upload to Firebase
   ```

3. **Local Dev**
   ```bash
   uvicorn api.index:app --reload
   # Visit http://localhost:8000
   ```

4. **Deploy to Vercel**
   - Set environment variables:
     - `FIREBASE_CREDENTIALS_BASE64` = Base64 of credentials JSON
     - `FIREBASE_STORAGE_BUCKET` = `your-project-id.firebasestorage.app`
   ```bash
   git push origin main  # Auto-deploy
   ```

5. **Done!** 

## Project Structure

```
api/index.py              # FastAPI backend
static/                   # Frontend (HTML/CSS/JS)
scripts/parse_excel.py    # Excel → Firebase uploader
create_new_excel.py       # Generate checklist template
vercel.json              # Deployment config
```

## How to Use

**Daily Checklist**
1. Enter name → Select line (#1-4) → Pick date
2. Use filters to focus on specific tasks
3. Click items to check/uncheck
4. Add 📝 notes or 📷 photos as needed
5. Hit **Submit** to save
6. Toggle 한글 ⟷ EN anytime

**Summary View**
- Click "View Summary" for calendar
- Green = Done | Yellow = In Progress | Red = Incomplete

**Download**
- Click "Download Checklist" for CSV export

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Photo upload fails | Enable Firebase Storage → Set `FIREBASE_STORAGE_BUCKET` env var → Redeploy |
| Firebase not connecting | Check `FIREBASE_CREDENTIALS_BASE64` in Vercel (no line breaks!) |
| No checklist items | Run `python scripts/parse_excel.py` to upload items |
| Items don't save | Click "Submit" button → Check browser console for errors |

## License

MIT
