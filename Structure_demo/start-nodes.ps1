# Run this script to start all 6 storage nodes

# Create data directories
New-Item -ItemType Directory -Force -Path ".\storage-node\data\node-4001" | Out-Null
New-Item -ItemType Directory -Force -Path ".\storage-node\data\node-4002" | Out-Null
New-Item -ItemType Directory -Force -Path ".\storage-node\data\node-4003" | Out-Null
New-Item -ItemType Directory -Force -Path ".\storage-node\data\node-4004" | Out-Null
New-Item -ItemType Directory -Force -Path ".\storage-node\data\node-4005" | Out-Null
New-Item -ItemType Directory -Force -Path ".\storage-node\data\node-4006" | Out-Null

Write-Host "Starting 6 storage nodes..." -ForegroundColor Green

# Start each node in a new window
Start-Process -FilePath "cmd" -ArgumentList "/k", "cd storage-node && set PORT=4001 && set NODE_ID=node-4001 && npx ts-node src/index.ts" -WorkingDirectory $PSScriptRoot
Start-Process -FilePath "cmd" -ArgumentList "/k", "cd storage-node && set PORT=4002 && set NODE_ID=node-4002 && npx ts-node src/index.ts" -WorkingDirectory $PSScriptRoot
Start-Process -FilePath "cmd" -ArgumentList "/k", "cd storage-node && set PORT=4003 && set NODE_ID=node-4003 && npx ts-node src/index.ts" -WorkingDirectory $PSScriptRoot
Start-Process -FilePath "cmd" -ArgumentList "/k", "cd storage-node && set PORT=4004 && set NODE_ID=node-4004 && npx ts-node src/index.ts" -WorkingDirectory $PSScriptRoot
Start-Process -FilePath "cmd" -ArgumentList "/k", "cd storage-node && set PORT=4005 && set NODE_ID=node-4005 && npx ts-node src/index.ts" -WorkingDirectory $PSScriptRoot
Start-Process -FilePath "cmd" -ArgumentList "/k", "cd storage-node && set PORT=4006 && set NODE_ID=node-4006 && npx ts-node src/index.ts" -WorkingDirectory $PSScriptRoot

Write-Host "Storage nodes started on ports 4001-4006" -ForegroundColor Green
Write-Host "Check health: curl http://localhost:4001/health" -ForegroundColor Cyan
