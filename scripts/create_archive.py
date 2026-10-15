import os
import zipfile
import sys

def create_cardiovision_zip():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    output_zip = os.path.join(base_dir, "CardioVisionAI.zip")
    
    # Exclude patterns
    exclude_dirs = {
        "node_modules",
        ".venv",
        "venv",
        ".git",
        "__pycache__",
        ".pytest_cache",
        ".vite",
        ".idea",
        ".vscode"
    }
    
    exclude_extensions = {".pyc", ".pyo"}
    
    print(f"Creating archive: {output_zip} from {base_dir}")
    
    total_files = 0
    total_size = 0
    
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(base_dir):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if file == "CardioVisionAI.zip":
                    continue
                ext = os.path.splitext(file)[1].lower()
                if ext in exclude_extensions:
                    continue
                
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, base_dir)
                
                zipf.write(full_path, rel_path)
                total_files += 1
                total_size += os.path.getsize(full_path)
    
    zip_size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    print(f"Archive successfully created: {output_zip}")
    print(f"Total files archived: {total_files}")
    print(f"Uncompressed size: {total_size / (1024 * 1024):.2f} MB")
    print(f"Compressed archive size: {zip_size_mb:.2f} MB")
    
    # Verify archive
    with zipfile.ZipFile(output_zip, "r") as test_zip:
        ret = test_zip.testzip()
        if ret is not None:
            print(f"CRC check failed on: {ret}")
            sys.exit(1)
        else:
            print("Archive integrity verified (testzip passed with zero errors).")

if __name__ == "__main__":
    create_cardiovision_zip()
