import os
from PIL import Image, ImageOps, ImageDraw

# Mapping dishes to our menu items:
dish_mapping = {
    'pizza': 'd:/PECAthon/synchrotable/public/dish_8.jpeg',        # Wood-fired Margherita
    'pasta': 'd:/PECAthon/synchrotable/public/dish_5.jpeg',        # Truffle Tagliatelle
    'dessert': 'd:/PECAthon/synchrotable/public/dish_2.jpeg',      # Chocolate Lava Cake
    'burger': 'd:/PECAthon/synchrotable/public/dish_6.jpeg',       # Double Smash Cheeseburger
    'calamari': 'd:/PECAthon/synchrotable/public/dish_4.jpeg',     # Crispy Fries / Calamari
    'sandwich': 'd:/PECAthon/synchrotable/public/dish_7.jpeg',     # Club Sandwich
    'noodles': 'd:/PECAthon/synchrotable/public/dish_3.jpeg',      # Spicy Noodles
    'latte': 'd:/PECAthon/synchrotable/public/dish_11.jpeg',       # Cafe Latte
    'chai': 'd:/PECAthon/synchrotable/public/dish_9.jpeg',         # Masala Chai
    'hotchoco': 'd:/PECAthon/synchrotable/public/dish_10.jpeg',    # Hot Chocolate
    'brownie': 'd:/PECAthon/synchrotable/public/dish_12.jpeg',     # Brownie a la mode
    'sundae': 'd:/PECAthon/synchrotable/public/dish_1.jpeg',       # Strawberry Sundae
}

output_dir = 'd:/PECAthon/synchrotable/public/food/top'
os.makedirs(output_dir, exist_ok=True)

for key, src_path in dish_mapping.items():
    if not os.path.exists(src_path):
        continue
    img = Image.open(src_path).convert('RGBA')
    
    # Square center crop
    min_dim = min(img.size)
    left = (img.width - min_dim) // 2
    top = (img.height - min_dim) // 2
    img_cropped = img.crop((left, top, left + min_dim, top + min_dim))
    img_resized = img_cropped.resize((500, 500), Image.Resampling.LANCZOS)
    
    # Make circular plate with subtle ceramic rim
    mask = Image.new('L', (500, 500), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((8, 8, 492, 492), fill=255)
    
    plate = Image.new('RGBA', (500, 500), (0, 0, 0, 0))
    plate.paste(img_resized, (0, 0), mask=mask)
    
    # Add a subtle porcelain rim border
    plate_draw = ImageDraw.Draw(plate)
    plate_draw.ellipse((8, 8, 492, 492), outline=(255, 255, 255, 120), width=3)
    plate_draw.ellipse((10, 10, 490, 490), outline=(0, 0, 0, 80), width=2)
    
    out_path = os.path.join(output_dir, f'{key}.png')
    plate.save(out_path, format='PNG')
    print(f'Processed {key} -> {out_path}')

# Also update burrata, salmon, steak with corresponding new high-res dishes:
# e.g. pasta -> pasta.png, pizza -> pizza.png, dessert -> dessert.png, calamari -> calamari.png
# steak -> burger.png or sandwich.png
# salmon -> noodles.png or burger.png
shutil_copies = [
    ('d:/PECAthon/synchrotable/public/food/top/burger.png', 'd:/PECAthon/synchrotable/public/food/top/steak.png'),
    ('d:/PECAthon/synchrotable/public/food/top/sandwich.png', 'd:/PECAthon/synchrotable/public/food/top/burrata.png'),
    ('d:/PECAthon/synchrotable/public/food/top/noodles.png', 'd:/PECAthon/synchrotable/public/food/top/salmon.png'),
]
import shutil
for src, dst in shutil_copies:
    if os.path.exists(src):
        shutil.copyfile(src, dst)
        print(f'Updated {dst} from {src}')

print('All food circular plates created successfully!')
