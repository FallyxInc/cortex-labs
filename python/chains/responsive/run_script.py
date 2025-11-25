import schedule
import time
import subprocess
import re  
import os  
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from homes_db import HOME_TO_CHAIN, CHAINS, supports_follow_up

# Function: Run each script in order for a specific home
# Usage: python3 run_script.py [home_id]

def extract_info_from_filename(filename):
    match = re.search(r'(?P<dashboard>[\w_]+)_(?P<month>\d{2})-(?P<day>\d{2})-(?P<year>\d{4})', filename)
    if match:
        month_number = match.group('month')
        day = match.group('day')
        year = match.group('year')
        return month_number, day, year
    return None, None, None

def run_scraping_bot(home_id):
    """Run extraction scripts for a specific home."""
    if not home_id:
        print("Error: Home ID is required")
        print("Usage: python3 run_script.py [home_id]")
        print(f"Available homes: {', '.join(CHAINS['responsive']['homes'])}")
        return
    
    if home_id not in CHAINS['responsive']['homes']:
        print(f"Error: {home_id} is not a valid home for Responsive chain")
        print(f"Available homes: {', '.join(CHAINS['responsive']['homes'])}")
        return
    
    print(f"Processing files for home: {home_id}")
    
    # Set environment variable for home_id
    os.environ['HOME_ID'] = home_id
    
    # Run scripts in order
    subprocess.run(["python3", "getExcelInfo.py", home_id])
    time.sleep(10)
    subprocess.run(["python3", "getPdfInfo.py", home_id])
    time.sleep(10)
    subprocess.run(["python3", "getBe.py", home_id])
    time.sleep(5)
    subprocess.run(["python3", "update.py", home_id])
    time.sleep(10)
    subprocess.run(["python3", "upload_to_dashboard.py", home_id])
    print(f"All scripts executed successfully for {home_id}.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Error: Home ID is required")
        print("Usage: python3 run_script.py [home_id]")
        print(f"Available homes: {', '.join(CHAINS['responsive']['homes'])}")
        sys.exit(1)
    
    home_id = sys.argv[1]
    run_scraping_bot(home_id)
