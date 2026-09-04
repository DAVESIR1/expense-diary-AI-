#!/usr/bin/env python3
"""
Generate professional financial app icons for Expense Diary AI:
- Modern financial ledger aesthetic: stylized ledger book, golden bookmark ribbon,
  subtle upward wealth growth chevron, and embossed currency symbol.
- Android adaptive icon vector drawables (foreground + background).
- Monochrome notification vector drawable.
- All mipmap density PNGs (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi).
- PWA icons (192, 512, maskable).
Pure Python with standard library (zlib, struct, math) - zero external dependencies!
"""

import os
import zlib
import struct
import math

def write_png(filename, width, height, rgba_buffer):
    """Write raw RGBA buffer (bytes of length width * height * 4) to PNG file."""
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT chunk
    # Raw scanlines with filter byte 0
    raw_data = bytearray()
    row_pitch = width * 4
    for y in range(height):
        raw_data.append(0) # Filter byte 0 (None)
        raw_data.extend(rgba_buffer[y * row_pitch : (y + 1) * row_pitch])
        
    compressed_data = zlib.compress(bytes(raw_data), 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed_data)
    png += struct.pack('>I', len(compressed_data)) + b'IDAT' + compressed_data + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)

def render_icon(size, is_round=False, is_foreground_only=False):
    """Render the high-end financial ledger icon at given resolution."""
    buf = bytearray(size * size * 4)
    
    # Color palette
    # Background: Emerald 900 -> Emerald 800 gradient
    # Ledger book: Warm Cream #FAF8F5 with Slate 800 spine / borders
    # Bookmark ribbon: Amber 500 #F59E0B
    # Growth curve: Emerald 500 #10B981
    # Currency symbol: Emerald 800 #065F46
    
    center = size / 2.0
    scale = size / 108.0 # Standard 108dp base
    
    for y in range(size):
        ny = y / size # 0.0 to 1.0
        row_offset = y * size * 4
        for x in range(size):
            nx = x / size
            dx = x - center
            dy = y - center
            dist = math.sqrt(dx * dx + dy * dy)
            px = row_offset + (x * 4)
            
            # 1. Background layer
            if is_foreground_only:
                r, g, b, a = 0, 0, 0, 0
            else:
                # Rounded square or circle
                max_radius = size * 0.48
                corner_radius = size * 0.22
                
                # Check bounds
                if is_round:
                    if dist > max_radius:
                        # Outside circle
                        edge = dist - max_radius
                        if edge < 1.0:
                            alpha = int((1.0 - edge) * 255)
                        else:
                            alpha = 0
                    else:
                        alpha = 255
                else:
                    # Squircle / rounded rect
                    # Distance from center box
                    box_w = max_radius - corner_radius
                    cx = max(0.0, abs(dx) - box_w)
                    cy = max(0.0, abs(dy) - box_w)
                    cdist = math.sqrt(cx * cx + cy * cy)
                    if cdist > corner_radius:
                        edge = cdist - corner_radius
                        alpha = int(max(0.0, 1.0 - edge) * 255)
                    else:
                        alpha = 255
                
                if alpha > 0:
                    # Gradient background: Top Emerald #064E3B -> Bottom Emerald #022C22
                    grad_t = ny + (dx / size) * 0.2
                    r_bg = int(6 + 8 * (1.0 - grad_t))
                    g_bg = int(78 - 34 * grad_t)
                    b_bg = int(59 - 25 * grad_t)
                    r, g, b, a = r_bg, g_bg, b_bg, alpha
                else:
                    r, g, b, a = 0, 0, 0, 0

            # 2. Financial Ledger Book Silhouette
            # Scale coordinates into 108x108 space
            sx = x / scale
            sy = y / scale
            
            # Book Cover: 26 <= sx <= 82, 22 <= sy <= 86
            book_left = 28.0
            book_right = 80.0
            book_top = 22.0
            book_bottom = 86.0
            book_rad = 6.0
            
            in_book = False
            if (book_left <= sx <= book_right) and (book_top <= sy <= book_bottom):
                # Check rounded corners of book
                bcx = max(0.0, max(book_left + book_rad - sx, sx - (book_right - book_rad)))
                bcy = max(0.0, max(book_top + book_rad - sy, sy - (book_bottom - book_rad)))
                bdist = math.sqrt(bcx * bcx + bcy * bcy)
                if bdist <= book_rad:
                    in_book = True
                    
            if in_book:
                # Spine on left: 28 to 38
                is_spine = (sx <= 37.0)
                
                if is_spine:
                    # Deep Emerald spine with golden line
                    # Spine color: #047857
                    br, bg, bb = 4, 120, 87
                    if 35.5 <= sx <= 37.0:
                        # Gold divider seam
                        br, bg, bb = 245, 158, 11
                else:
                    # Book face: Pristine soft ivory/cream #FAF8F5 with subtle warm shading
                    br, bg, bb = 250, 248, 245
                    
                    # Golden bookmark ribbon hanging from top: sx 42..48, sy 22..40
                    if 42.0 <= sx <= 48.0 and 22.0 <= sy <= 40.0:
                        # V-notch at bottom of ribbon
                        notch_depth = 4.0
                        ribbon_end = 40.0 - abs(sx - 45.0) * (notch_depth / 3.0)
                        if sy <= ribbon_end:
                            br, bg, bb = 245, 158, 11 # Amber 500
                            
                    # Upward Wealth Arc / Chevron in middle right:
                    # Arc centered around (58, 62), pointing up to (68, 48)
                    # Chevron arrow:
                    # Line 1: (48, 66) to (60, 52)
                    # Line 2: (60, 52) to (74, 66)
                    # Thickness 4
                    # Let's draw modern financial upward bars (3 growth bars):
                    # Bar 1: sx 48..53, sy 62..72
                    if 46.0 <= sx <= 51.0 and 64.0 <= sy <= 74.0:
                        br, bg, bb = 52, 211, 153 # Emerald 400
                    # Bar 2: sx 54..59, sy 56..74
                    elif 53.0 <= sx <= 58.0 and 58.0 <= sy <= 74.0:
                        br, bg, bb = 16, 185, 129 # Emerald 500
                    # Bar 3: sx 62..67, sy 48..74
                    elif 60.0 <= sx <= 65.0 and 50.0 <= sy <= 74.0:
                        br, bg, bb = 5, 150, 105 # Emerald 600
                    # Upward arrow head above bar 3:
                    elif (sx >= 67.0 and sx <= 73.0 and sy >= 44.0 and sy <= 74.0):
                        br, bg, bb = 4, 120, 87 # Emerald 700
                    
                    # Rupee / Currency stylized crest at top center of book (sx 54..68, sy 32..44):
                    # Rupee horizontal bar 1: sy 34, sx 54..66
                    if (33.0 <= sy <= 35.0 and 55.0 <= sx <= 66.0) or \
                       (37.0 <= sy <= 39.0 and 55.0 <= sx <= 64.0):
                        br, bg, bb = 31, 41, 55 # Slate 800
                    # Rupee loop & stem
                    elif (33.0 <= sy <= 42.0 and 55.0 <= sx <= 57.5):
                        br, bg, bb = 31, 41, 55
                    elif (33.0 <= sy <= 41.0 and 61.0 <= sx <= 64.0):
                        br, bg, bb = 31, 41, 55
                    elif (40.0 <= sy <= 46.0 and abs(sx - (55.0 + (sy - 40.0) * 1.5)) <= 1.2):
                        br, bg, bb = 31, 41, 55

                # Blend book pixel onto background
                if is_foreground_only:
                    r, g, b, a = br, bg, bb, 255
                else:
                    r, g, b = br, bg, bb
            
            buf[px] = r
            buf[px + 1] = g
            buf[px + 2] = b
            buf[px + 3] = a
            
    return bytes(buf)

def write_xml(filename, content):
    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')

def generate_all():
    print("Generating Android mipmap icons, vector drawables, and PWA icons...")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, '..'))
    res_dir = os.path.join(project_root, 'android', 'app', 'src', 'main', 'res')
    
    # 1. Android mipmap densities (square & round)
    densities = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    
    for folder, dim in densities.items():
        dir_path = os.path.join(res_dir, folder)
        os.makedirs(dir_path, exist_ok=True)
        
        # Standard icon
        sq_buf = render_icon(dim, is_round=False)
        write_png(os.path.join(dir_path, 'ic_launcher.png'), dim, dim, sq_buf)
        
        # Round icon
        rd_buf = render_icon(dim, is_round=True)
        write_png(os.path.join(dir_path, 'ic_launcher_round.png'), dim, dim, rd_buf)
        
        # Foreground icon for adaptive
        fg_buf = render_icon(dim, is_round=False, is_foreground_only=True)
        write_png(os.path.join(dir_path, 'ic_launcher_foreground.png'), dim, dim, fg_buf)
        
        print(f"  ✓ {folder} ({dim}x{dim}) generated")

    # 2. PWA Web icons
    pwa_targets = [
        (os.path.join(project_root, 'public', 'icon-192.png'), 192, False),
        (os.path.join(project_root, 'public', 'icon-512.png'), 512, False),
        (os.path.join(project_root, 'public', 'icon-maskable-192.png'), 192, True),
        (os.path.join(project_root, 'public', 'icon-maskable-512.png'), 512, True),
    ]
    
    for p, dim, is_mask in pwa_targets:
        buf = render_icon(dim, is_round=is_mask)
        write_png(p, dim, dim, buf)
        print(f"  ✓ {os.path.basename(p)} ({dim}x{dim}) generated")

    # 3. Android Vector Drawables and XMLs
    # Notification Icon (Monochrome white on transparent)
    ic_notif_xml = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M18,2H6C4.9,2 4,2.9 4,4v16c0,1.1 0.9,2 2,2h12c1.1,0 2,-0.9 2,-2V4C20,2.9 19.1,2 18,2z M12,10l-2,-1.5L8,10V4h4V10z M18,20H6V4h1v8l3,-2.25L13,12V4h5V20z" />
</vector>'''
    write_xml(os.path.join(res_dir, 'drawable', 'ic_notification.xml'), ic_notif_xml)
    print("  ✓ drawable/ic_notification.xml generated")

    # Adaptive Icon Foreground Vector
    ic_fg_xml = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#33000000"
        android:pathData="M32,29 C30,29 28,31 28,34 L28,80 C28,83 30,85 32,85 L76,85 C79,85 81,83 81,80 L81,34 C81,31 79,29 76,29 Z" />
    <path
        android:fillColor="#FAF8F5"
        android:pathData="M33,26 C30.8,26 29,27.8 29,30 L29,76 C29,78.2 30.8,80 33,80 L75,80 C77.2,80 79,78.2 79,76 L79,30 C79,27.8 77.2,26 75,26 Z" />
    <path
        android:fillColor="#047857"
        android:pathData="M33,26 C30.8,26 29,27.8 29,30 L29,76 C29,78.2 30.8,80 33,80 L38,80 L38,26 Z" />
    <path
        android:fillColor="#F59E0B"
        android:pathData="M37,26 L38.5,26 L38.5,80 L37,80 Z" />
    <path
        android:fillColor="#F59E0B"
        android:pathData="M43,26 L49,26 L49,42 L46,39 L43,42 Z" />
    <path
        android:fillColor="#34D399"
        android:pathData="M47,65 L52,65 L52,74 L47,74 Z" />
    <path
        android:fillColor="#10B981"
        android:pathData="M54,58 L59,58 L59,74 L54,74 Z" />
    <path
        android:fillColor="#059669"
        android:pathData="M61,50 L66,50 L66,74 L61,74 Z" />
    <path
        android:strokeColor="#047857"
        android:strokeWidth="2"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M47,61 L54,54 L61,56 L70,44 M65,44 L70,44 L70,49" />
    <path
        android:strokeColor="#1F2937"
        android:strokeWidth="1.8"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M54,34 L66,34 M54,38 L64,38 M58,34 L58,43 C63,43 63,38 58,38 L66,48" />
</vector>'''
    write_xml(os.path.join(res_dir, 'drawable', 'ic_launcher_foreground.xml'), ic_fg_xml)
    write_xml(os.path.join(res_dir, 'drawable-v24', 'ic_launcher_foreground.xml'), ic_fg_xml)
    print("  ✓ drawable/ic_launcher_foreground.xml generated")

    # Adaptive Icon Background Vector
    ic_bg_xml = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#064E3B"
        android:pathData="M0,0h108v108h-108z" />
    <path
        android:fillColor="#0D047857"
        android:pathData="M0,0 L108,0 L108,54 L0,54 Z" />
</vector>'''
    write_xml(os.path.join(res_dir, 'drawable', 'ic_launcher_background.xml'), ic_bg_xml)
    print("  ✓ drawable/ic_launcher_background.xml generated")

    # Adaptive Icon Background Color Resource
    ic_bg_val_xml = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#064E3B</color>
</resources>'''
    write_xml(os.path.join(res_dir, 'values', 'ic_launcher_background.xml'), ic_bg_val_xml)
    print("  ✓ values/ic_launcher_background.xml generated")

    # Adaptive Icon Root XMLs
    ic_adapt_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>'''
    write_xml(os.path.join(res_dir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), ic_adapt_xml)
    write_xml(os.path.join(res_dir, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), ic_adapt_xml)
    print("  ✓ mipmap-anydpi-v26/ic_launcher.xml generated")
        
    print("All icons and drawables successfully generated!")

if __name__ == '__main__':
    generate_all()
