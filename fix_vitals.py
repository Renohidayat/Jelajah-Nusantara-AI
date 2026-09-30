import os

def fix_html(content):
    # Add preconnect if not exists
    preconnect_str = """    <link rel="preconnect" href="https://images.unsplash.com" />
    <link rel="preconnect" href="https://unpkg.com" crossorigin />
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />"""
    
    if '<link rel="preconnect" href="https://images.unsplash.com" />' not in content and '<link rel="preconnect" href="https://fonts.googleapis.com" />' in content:
        content = content.replace(
            '<link rel="preconnect" href="https://fonts.googleapis.com" />',
            preconnect_str + '\n    <link rel="preconnect" href="https://fonts.googleapis.com" />'
        )

    # Defer Chart.js
    if '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>' in content:
        content = content.replace(
            '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>',
            '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js" defer></script>'
        )

    # Defer Leaflet
    if '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>' in content:
        content = content.replace(
            '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>',
            '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>'
        )
        
    # Fetchpriority high for hero image
    if '<img class="hero-img"' in content and 'fetchpriority="high"' not in content:
        content = content.replace('<img class="hero-img"', '<img class="hero-img" fetchpriority="high"')
        
    return content

for root, dirs, files in os.walk('frontend'):
    if 'node_modules' in root or 'dist' in root:
        continue
    for file in files:
        if file.endswith('.html'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = fix_html(content)
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
