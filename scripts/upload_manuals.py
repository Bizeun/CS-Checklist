"""
Script to upload manual files (조치/셋업 매뉴얼) to Firebase Storage
and register their metadata in Firestore so the web app can list them.

Usage:
    1. Put your manual files into the folders:
         manuals/조치/   <- 조치 매뉴얼 (troubleshooting manuals)
         manuals/셋업/   <- 셋업 매뉴얼 (setup manuals)
    2. Run:
         FIREBASE_CREDENTIALS_PATH=firebase-credentials.json uv run python scripts/upload_manuals.py

Re-running the script re-scans the folders and replaces the manual list,
so it is safe to add/remove files and run it again.
"""
import os
import json
import mimetypes
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore, storage

# 매뉴얼 폴더 구조: 폴더명 -> 카테고리 키
CATEGORY_FOLDERS = {
    '조치': 'troubleshooting',
    '셋업': 'setup',
}

MANUALS_DIR = 'manuals'
STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', 'lgensol-nnd-cschecklist.firebasestorage.app')


def init_firebase():
    """Initialize Firebase Admin SDK with Storage bucket."""
    if not firebase_admin._apps:
        cred_json = os.environ.get('FIREBASE_CREDENTIALS')
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
        else:
            cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH', 'firebase-credentials.json')
            if not os.path.exists(cred_path):
                raise Exception(f"Firebase credentials not found at {cred_path}")
            cred = credentials.Certificate(cred_path)

        firebase_admin.initialize_app(cred, {'storageBucket': STORAGE_BUCKET})

    return firestore.client(), storage.bucket()


def scan_local_manuals():
    """Scan the manuals/ folder and return file info grouped by category."""
    if not os.path.isdir(MANUALS_DIR):
        # 폴더가 없으면 만들어주고 안내
        for folder in CATEGORY_FOLDERS:
            os.makedirs(os.path.join(MANUALS_DIR, folder), exist_ok=True)
        print(f"'{MANUALS_DIR}/' 폴더를 생성했습니다.")
        print("매뉴얼 파일을 아래 폴더에 넣고 다시 실행하세요:")
        for folder in CATEGORY_FOLDERS:
            print(f"  - {MANUALS_DIR}/{folder}/")
        return None

    files = []
    for folder, category in CATEGORY_FOLDERS.items():
        folder_path = os.path.join(MANUALS_DIR, folder)
        if not os.path.isdir(folder_path):
            os.makedirs(folder_path, exist_ok=True)
            continue

        for filename in sorted(os.listdir(folder_path)):
            file_path = os.path.join(folder_path, filename)
            if filename.startswith('.') or not os.path.isfile(file_path):
                continue
            files.append({
                'local_path': file_path,
                'filename': filename,
                'category': category,
            })

    return files


def upload_manuals(db, bucket, files):
    """Upload files to Firebase Storage and save metadata to Firestore."""
    manuals = []

    for f in files:
        storage_path = f"manuals/{f['category']}/{f['filename']}"
        blob = bucket.blob(storage_path)

        content_type, _ = mimetypes.guess_type(f['filename'])
        print(f"  Uploading: {f['local_path']}  ->  {storage_path}")
        blob.upload_from_filename(f['local_path'], content_type=content_type)
        blob.make_public()

        ext = os.path.splitext(f['filename'])[1].lower().lstrip('.')
        size_bytes = os.path.getsize(f['local_path'])

        manuals.append({
            'filename': f['filename'],
            'category': f['category'],
            'url': blob.public_url,
            'file_type': ext,                  # pdf, docx, xlsx, pptx, png ...
            'size_bytes': size_bytes,
            'uploaded_at': datetime.now(timezone.utc).isoformat(),
        })

    # Firestore에 메타데이터 저장 (전체 교체 방식)
    doc_ref = db.collection('config').document('manuals')
    doc_ref.set({
        'items': manuals,
        'lastUpdated': firestore.SERVER_TIMESTAMP,
    })

    return manuals


def main():
    files = scan_local_manuals()
    if files is None:
        return
    if not files:
        print("업로드할 파일이 없습니다. manuals/조치/ 또는 manuals/셋업/ 폴더에 파일을 넣어주세요.")
        return

    print(f"발견된 매뉴얼 파일: {len(files)}개")

    print("Firebase 초기화 중...")
    db, bucket = init_firebase()

    print("업로드 중...")
    manuals = upload_manuals(db, bucket, files)

    print(f"\n완료! {len(manuals)}개 매뉴얼이 업로드되었습니다.")
    by_category = {}
    for m in manuals:
        by_category.setdefault(m['category'], []).append(m['filename'])
    for category, names in by_category.items():
        print(f"\n[{category}]")
        for name in names:
            print(f"  - {name}")


if __name__ == '__main__':
    main()
