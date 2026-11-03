@echo off
cd /d "%~dp0backend"
set LOG=%~dp0crear-bd.log
echo === %date% %time% === > "%LOG%"
where node >> "%LOG%" 2>&1
node crear-bd.js >> "%LOG%" 2>&1
if errorlevel 1 goto fin
echo --- SEED --- >> "%LOG%"
call npm run seed >> "%LOG%" 2>&1
:fin
echo FIN >> "%LOG%"
type "%LOG%"
timeout /t 5
