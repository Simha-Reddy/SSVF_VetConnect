@echo off
REM Create virtual environment
python -m venv venv

REM Activate virtual environment
call venv\Scripts\activate

REM Install requirements
pip install --upgrade pip
pip install -r requirements.txt

echo.
echo Virtual environment is ready and requirements are installed.
echo To activate later, run: venv\Scripts\activate
pause