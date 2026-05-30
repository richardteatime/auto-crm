@echo off
cd /d C:\Users\franc\Desktop\SARCONX-OS\auto-crm
node --env-file=.env.local --import tsx mcp-server\crm-server.ts
