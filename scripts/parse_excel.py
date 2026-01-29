"""
Script to parse the Excel checklist and initialize Firebase with the checklist structure.
Run this once to set up the checklist items in Firebase.
"""
import openpyxl
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
from dotenv import load_dotenv

load_dotenv()

def init_firebase():
    """Initialize Firebase Admin SDK"""
    if not firebase_admin._apps:
        cred_path = os.environ.get('FIREBASE_CREDENTIALS')
        if cred_path:
            cred_dict = json.loads(cred_path)
            cred = credentials.Certificate(cred_dict)
        else:
            cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH', 'firebase-credentials.json')
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            else:
                raise Exception("Firebase credentials not found")
        
        firebase_admin.initialize_app(cred)
    return firestore.client()

def parse_excel(file_path):
    """Parse Excel file and extract checklist items"""
    workbook = openpyxl.load_workbook(file_path)
    sheet = workbook.active

    items = []

    for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        if not row:
            continue

        # New Column Mapping (Modified for EN support):
        # Col 0: Process
        # Col 1: Vision Type
        # Col 2: Category
        # Col 3: Item (KR)
        # Col 4: Item (EN)  <-- Added
        # Col 5: Period     <-- Shifted

        process_val = str(row[0]).strip() if len(row) > 0 and row[0] else ''
        vision_type_val = str(row[1]).strip() if len(row) > 1 and row[1] else ''
        category_val = str(row[2]).strip() if len(row) > 2 and row[2] else ''
        item_text_kr = str(row[3]).strip() if len(row) > 3 and row[3] else ''
        item_text_en = str(row[4]).strip() if len(row) > 4 and row[4] else ''
        period_val = row[5] if len(row) > 5 else None

        if not item_text_kr:
            continue

        try:
            period_days = int(period_val)
            if period_days <= 0:
                period_days = 1
        except (TypeError, ValueError):
            period_days = 1

        item = {
            'id': f'item_{row_idx}',
            'process': process_val or 'General',
            'equipment': vision_type_val or 'General',
            'category': category_val or 'General',
            'item': item_text_kr,      # Default (KR)
            'item_en': item_text_en,   # English
            'text': item_text_kr,      # Backwards compatibility
            'periodDays': period_days,
            'order': row_idx - 2
        }
        items.append(item)

    return items

def upload_to_firebase(db, items):
    """Upload checklist items to Firebase"""
    doc_ref = db.collection('config').document('checklist_items')
    doc_ref.set({
        'items': items,
        'lastUpdated': firestore.SERVER_TIMESTAMP
    })
    print(f"Uploaded {len(items)} checklist items to Firebase")

def main():
    excel_path = 'CS_Checklist.xlsx'
    
    if not os.path.exists(excel_path):
        print(f"Error: Excel file not found at {excel_path}")
        return
    
    print("Parsing Excel file...")
    items = parse_excel(excel_path)
    print(f"Found {len(items)} checklist items")
    
    print("Initializing Firebase...")
    db = init_firebase()
    
    print("Uploading to Firebase...")
    upload_to_firebase(db, items)
    
    print("\nSetup complete!")
    print("You can now use the web UI to manage your checklist.")

if __name__ == '__main__':
    main()


