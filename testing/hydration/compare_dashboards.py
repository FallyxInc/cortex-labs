#!/usr/bin/env python3
"""
Script to compare hydration dashboard files between two folders.
Compares dashboard .js files and reports differences in resident data.
"""

import os
import json
import re
import argparse
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any
from collections import defaultdict


def extract_json_from_js(file_path: Path) -> List[Dict[str, Any]]:
    """Extract JSON data from a JavaScript dashboard file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the hydrationData array
        # Match: const hydrationData = [...]
        match = re.search(r'const\s+hydrationData\s*=\s*(\[.*?\]);', content, re.DOTALL)
        if match:
            json_str = match.group(1)
            # Clean up trailing commas if any
            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)
            return json.loads(json_str)
        else:
            print(f"Warning: Could not find hydrationData in {file_path}")
            return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from {file_path}: {e}")
        return []
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []


def get_dashboard_files(folder_path: Path) -> Dict[str, Path]:
    """Get all dashboard .js files from a folder (recursively)."""
    dashboard_files = {}
    
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.endswith('.js') and 'dashboard' in file.lower():
                file_path = Path(root) / file
                # Use relative path from folder_path as key
                rel_path = file_path.relative_to(folder_path)
                dashboard_files[str(rel_path)] = file_path
    
    return dashboard_files


def compare_resident_data(resident1: Dict, resident2: Dict, name: str) -> List[str]:
    """Compare two resident records and return list of differences."""
    differences = []
    
    # Fields to compare
    fields = ['goal', 'data', 'source', 'missed3Days', 'ipc_found', 'infection', 'infection_type']
    
    for field in fields:
        val1 = resident1.get(field)
        val2 = resident2.get(field)
        
        # Handle float comparison
        if isinstance(val1, float) and isinstance(val2, float):
            if abs(val1 - val2) > 0.01:  # Allow small floating point differences
                differences.append(f"  {field}: {val1} vs {val2}")
        elif val1 != val2:
            differences.append(f"  {field}: {val1} vs {val2}")
    
    return differences


def compare_dashboards(folder1: Path, folder2: Path) -> None:
    """Compare dashboard files between two folders."""
    print(f"Comparing dashboard files:")
    print(f"  Folder 1: {folder1}")
    print(f"  Folder 2: {folder2}")
    print("=" * 80)
    
    # Get all dashboard files from both folders
    files1 = get_dashboard_files(folder1)
    files2 = get_dashboard_files(folder2)
    
    # Find common files and files only in one folder
    all_files = set(files1.keys()) | set(files2.keys())
    common_files = set(files1.keys()) & set(files2.keys())
    only_in_folder1 = set(files1.keys()) - set(files2.keys())
    only_in_folder2 = set(files2.keys()) - set(files1.keys())
    
    print(f"\nFile Summary:")
    print(f"  Total unique files: {len(all_files)}")
    print(f"  Common files: {len(common_files)}")
    print(f"  Only in folder 1: {len(only_in_folder1)}")
    print(f"  Only in folder 2: {len(only_in_folder2)}")
    
    if only_in_folder1:
        print(f"\nFiles only in folder 1:")
        for file in sorted(only_in_folder1):
            print(f"  - {file}")
    
    if only_in_folder2:
        print(f"\nFiles only in folder 2:")
        for file in sorted(only_in_folder2):
            print(f"  - {file}")
    
    # Compare common files
    print(f"\n{'=' * 80}")
    print("Comparing common files:")
    print(f"{'=' * 80}")
    
    total_differences = 0
    
    for file_key in sorted(common_files):
        file1_path = files1[file_key]
        file2_path = files2[file_key]
        
        data1 = extract_json_from_js(file1_path)
        data2 = extract_json_from_js(file2_path)
        
        # Create dictionaries keyed by resident name
        residents1 = {r['name']: r for r in data1}
        residents2 = {r['name']: r for r in data2}
        
        all_residents = set(residents1.keys()) | set(residents2.keys())
        common_residents = set(residents1.keys()) & set(residents2.keys())
        only_in_file1 = set(residents1.keys()) - set(residents2.keys())
        only_in_file2 = set(residents2.keys()) - set(residents1.keys())
        
        file_differences = []
        
        # Check for different resident counts
        if len(data1) != len(data2):
            file_differences.append(f"  Different resident counts: {len(data1)} vs {len(data2)}")
        
        # Check for missing residents
        if only_in_file1:
            file_differences.append(f"  Residents only in folder 1 ({len(only_in_file1)}):")
            for name in sorted(only_in_file1):
                file_differences.append(f"    - {name}")
        
        if only_in_file2:
            file_differences.append(f"  Residents only in folder 2 ({len(only_in_file2)}):")
            for name in sorted(only_in_file2):
                file_differences.append(f"    - {name}")
        
        # Compare common residents
        resident_differences = []
        for name in sorted(common_residents):
            diff = compare_resident_data(residents1[name], residents2[name], name)
            if diff:
                resident_differences.append(f"  {name}:")
                resident_differences.extend(diff)
        
        if resident_differences:
            file_differences.append(f"  Data differences ({len(resident_differences)} residents):")
            file_differences.extend(resident_differences)
        
        # Print results for this file
        if file_differences:
            total_differences += 1
            print(f"\n📄 {file_key}")
            print("-" * 80)
            for line in file_differences:
                print(line)
        else:
            print(f"\n✅ {file_key} - No differences")
    
    # Summary
    print(f"\n{'=' * 80}")
    print("Summary:")
    print(f"  Files with differences: {total_differences} / {len(common_files)}")
    if total_differences == 0 and len(only_in_folder1) == 0 and len(only_in_folder2) == 0:
        print("  ✅ All files match!")
    else:
        print("  ⚠️  Differences found")


def main():
    parser = argparse.ArgumentParser(
        description='Compare hydration dashboard files between two folders'
    )
    parser.add_argument(
        'folder1',
        type=str,
        help='Path to first folder containing dashboard files'
    )
    parser.add_argument(
        'folder2',
        type=str,
        nargs='?',
        help='Path to second folder containing dashboard files (optional, defaults to output/)'
    )
    
    args = parser.parse_args()
    
    folder1 = Path(args.folder1).expanduser().resolve()
    if not folder1.exists():
        print(f"Error: Folder 1 does not exist: {folder1}")
        return
    
    if args.folder2:
        folder2 = Path(args.folder2).expanduser().resolve()
    else:
        # Default to output folder relative to folder1
        folder2 = folder1.parent / 'output'
    
    if not folder2.exists():
        print(f"Error: Folder 2 does not exist: {folder2}")
        return
    
    compare_dashboards(folder1, folder2)


if __name__ == '__main__':
    main()

