import glob, os, shutil

files = sorted(glob.glob('d:/PECAthon/WhatsApp Image*.jpeg'))
html = ['<!DOCTYPE html><html><head><title>Preview</title><style>body{background:#111;color:#fff;font-family:sans-serif;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:20px}img{width:100%;height:220px;object-fit:cover;border-radius:12px;border:2px solid #333}div{text-align:center}</style></head><body>']

for i, f in enumerate(files):
    fname = os.path.basename(f)
    dest = os.path.join('d:/PECAthon/synchrotable/public', f'dish_{i+1}.jpeg')
    shutil.copyfile(f, dest)
    html.append(f'<div><img src="/dish_{i+1}.jpeg"><p>Dish {i+1}<br><small>{fname}</small></p></div>')

html.append('</body></html>')
with open('d:/PECAthon/synchrotable/public/preview.html', 'w', encoding='utf-8') as out:
    out.write('\n'.join(html))
print(f'Successfully copied {len(files)} dish images and created preview.html!')
