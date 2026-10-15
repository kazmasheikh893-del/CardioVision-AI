$ErrorActionPreference = "Stop"
pytest
npm test
npm run build
python scripts\verify_api.py
Write-Host "All tests and builds passed successfully!" -ForegroundColor Green

