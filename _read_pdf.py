import sys
from pathlib import Path
try:
    from pypdf import PdfReader
except Exception as e:
    print('IMPORT_ERROR:', e)
    raise

# 用法: python _read_pdf.py <path-to-pdf>
# 若未传参数则默认读取脚本同目录下的 业务图.pdf
if len(sys.argv) > 1:
    p = Path(sys.argv[1]).expanduser().resolve()
else:
    p = (Path(__file__).resolve().parent / '业务图.pdf').resolve()
if not p.exists():
    print(f'FILE_NOT_FOUND: {p}')
    sys.exit(1)
reader = PdfReader(str(p))
for i, page in enumerate(reader.pages[:3], start=1):
    print(f'--- PAGE {i} ---')
    text = page.extract_text() or ''
    print(text[:3000])
