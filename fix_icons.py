import os

def fix_icons(content):
    return content.replace('<span class="material-symbols-outlined">', '<span class="material-symbols-outlined" aria-hidden="true" translate="no" data-nosnippet>')

for root, dirs, files in os.walk('frontend'):
    if 'node_modules' in root or 'dist' in root:
        continue
    for file in files:
        if file.endswith('.html'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = fix_icons(content)
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
