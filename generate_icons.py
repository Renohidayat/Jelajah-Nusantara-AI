from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size-1, size-1], fill='#D95E39')
    cx, cy = size/2, size/2
    r = size * 0.25
    
    draw.ellipse([cx-r, cy-size*0.1-r, cx+r, cy-size*0.1+r], fill='white')
    draw.polygon([cx-r, cy-size*0.1, cx+r, cy-size*0.1, cx, cy+size*0.35], fill='white')
    draw.ellipse([cx-r*0.4, cy-size*0.1-r*0.4, cx+r*0.4, cy-size*0.1+r*0.4], fill='#D95E39')
    
    img.save(filename)

create_icon(32, 'frontend/public/favicon.ico')
create_icon(192, 'frontend/public/icon-192.png')
create_icon(512, 'frontend/public/icon-512.png')
create_icon(180, 'frontend/public/apple-touch-icon.png')
