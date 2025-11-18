# Excel Parser Script

## Usage

```bash
python scripts/parse_excel.py
```

## Excel File Format

The script expects `MILS_CellTracking_CS_CheckList.xlsx` to contain **four columns** with headers on row 1:

| Column | Header    | Type     | Notes                                |
|--------|-----------|----------|--------------------------------------|
| A      | Process   | Text     | Required; defaults to `General`      |
| B      | Equipment | Text     | Required; defaults to `General`      |
| C      | Item      | Text     | Required checklist description       |
| D      | Period    | Integer  | Number of days between checks (1=Daily) |

Additional columns are ignored.

### Example:

| Process | Equipment     | Item                    | Period |
|---------|---------------|-------------------------|--------|
| Mixing  | Reactor A     | Inspect agitator seals  | 1      |
| Mixing  | Reactor A     | Verify temp sensors     | 7      |
| Packing | Conveyor Line | Clean photo-eye lenses  | 3      |

## Customization

If your Excel file has a different structure, edit `scripts/parse_excel.py` and adjust the indices inside `parse_excel()`.

## Notes

- The script skips empty rows
- Row 1 is assumed to be headers and is skipped
- Each item gets a unique ID based on its row number
- Items are ordered by their position in the Excel file
- `periodDays` defaults to 1 if missing or invalid
- `process`, `equipment`, and `item` values are trimmed strings


