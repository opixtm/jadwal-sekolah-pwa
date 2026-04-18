import subprocess
import os
import json
import re

def parse_doc(file_path):
    print(f"Parsing {file_path}...")
    result = subprocess.run(['textutil', '-convert', 'txt', '-stdout', file_path], capture_output=True, text=True)
    lines = result.stdout.strip().split('\n')
    
    jadwal = []
    current_minggu = ""
    current_dates = ""
    
    rows = []
    current_row = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Match Minggu X (...)
        match = re.match(r'(Minggu\s+[IVX]+)\s*\((.*?)\)', line, re.IGNORECASE)
        if match:
            # save previous row if exists
            if current_row:
                rows.append((current_minggu, current_dates, current_row))
                current_row = []
            current_minggu = match.group(1).strip()
            current_dates = match.group(2).strip()
            continue
            
        # Is this a sequence number? (1, 2, 3...)
        if line.isdigit() and len(line) <= 2:
            # save previous row if exists
            if current_row:
                rows.append((current_minggu, current_dates, current_row))
            current_row = [line]
            continue
            
        if current_row:
            current_row.append(line)

    if current_row:
         rows.append((current_minggu, current_dates, current_row))
         
         
    # Now parse the rows into structured data
    for minggu, dates, row_data in rows:
        if len(row_data) >= 3:
            no = row_data[0]
            kode = row_data[1]
            # Sometime kode has multiple lines or materi has multiple.
            # Usually: No, Kode, Materi, Dosen 1, Dosen 2...
            # But wait, what if kode is split?
            # E.g. KP 1.2 A
            materi = row_data[2]
            dosen = " | ".join(row_data[3:])
            
            jadwal.append({
                "minggu": minggu,
                "rentang_tanggal": dates,
                "no": no,
                "kode": kode,
                "materi": materi,
                "dosen": dosen
            })
            
    return jadwal

if __name__ == "__main__":
    import sys
    path = '/Users/opixtm/Downloads/JADWAL/kuliah/jadwal 2023.doc'
    data = parse_doc(path)
    out_path = '/Users/opixtm/Downloads/JADWAL/kuliah_parsed.json'
    with open(out_path, 'w') as f:
        json.dump(data, f, indent=4)
        
    print(f"Data saved to {out_path} ({len(data)} items)")
