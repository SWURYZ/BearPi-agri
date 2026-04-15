from pathlib import Path
try:
    from pypdf import PdfReader
except Exception as e:
    print('IMPORT_ERROR:', e)
    raise
p = Path(r'd:\Desktop\大三下\学校实习\code\Dapeng\业务图.pdf')
reader = PdfReader(str(p))
for i, page in enumerate(reader.pages[:3], start=1):
    print(f'--- PAGE {i} ---')
    text = page.extract_text() or ''
    print(text[:3000])
