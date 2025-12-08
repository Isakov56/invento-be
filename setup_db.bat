@echo off
echo Setting up PostgreSQL password...
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -p 5432 -c "ALTER USER postgres WITH PASSWORD 'postgres123';"
echo.
echo Verifying database exists...
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -p 5432 -c "\l" | findstr retail_pos_db
echo.
echo Done!
pause
