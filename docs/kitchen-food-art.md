# Kitchen Food Artwork

Generated on 2026-10-27 with the built-in image generation tool. Seven remaining block-style food icons were replaced by detailed 2D pixel-game pictures matching the existing kitchen food. Existing food art and all prices, feeding stats and item keys are unchanged.

## Production Assets

The new files are `public/food/{treat,sausage,cream,milk,cheese,yogurt,cookie}.png`. Each has real alpha transparency and is normalized with the existing `scripts/normalize_food_art.py` pipeline: 128-pixel square canvas, geometric-mean content target 100 pixels, maximum side 124 pixels, alpha-based centering. Only these seven files were normalized. Original generated PNGs remain in the local generated-images library.

All known foods now render through the shared `FoodIcon` catalogue path. Food sprites and donuts now use art version 6 after the follow-up [food silhouette refresh](food-silhouette-refresh.md); the unchanged energy cans retain their generated version and moving effects.

## Retired Duplicates

The owner approved removing generic Fish and Sushi from sale, keeping Sardine and the dedicated Nigiri, Temaki and Maki dishes. `RETIRED_SHOP_FOODS` maps the two legacy keys to their picture replacements. Legacy inventory is not migrated, deleted or combined: existing food remains visible, giftable and edible under its original key and feeding stats. Only the shop filter and new daily-menu choices exclude the two retired keys. The wish system already requests a specific food only when it is owned, so stored legacy food can still satisfy its original wish. Chicken drumsticks, whole roast chicken, fish-shaped biscuits and chocolate-chip cookies are distinct foods and remain on sale.

## Verification

Run `node scripts/check_kitchen_food.cjs` and `npx tsc --noEmit`. The focused check executes the real catalogue declarations, verifies all known food pictures, unique shop entries, legacy-stock support, daily-menu availability, two kitchen-only donuts and the retained special-can effects. Browser captures are kept locally in `review-pictures/kitchen-food-refresh/` at 390 and 360 pixels wide. The separate kitchen preview uses an isolated mock wallet and fridge, not production data.

## Prompt Set

### cookie

Source file: `exec-66fe17ea-234e-4951-8dc5-f8388d07f432.png` in `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/`.

Use case: stylized-concept. Production asset: ONE isolated chocolate-chip cookie food icon for Eren, a cozy 2D pixel-art cat-care game. A round golden-butter baked cookie, thick visible crumb edge, uneven handmade scalloped outline, big irregular dark chocolate chunks, a few tiny warm highlight clusters. Front view with a gentle view down onto its top, the cookie lying at a slight angle. Handcrafted detailed 16-bit pixel-game food art, crisp stepped dark warm-brown outlines, carefully shaded visible pixel clusters, restrained small palette, appetizing and cute, readable at 62 pixels. NOT a vector icon, not smooth 3D, not a photograph or painterly illustration. Single cookie centered, fills about 78 percent of a square canvas, entire cookie visible with generous transparent margin. Genuinely transparent background and real alpha everywhere outside the cookie. No plate, floor, scenery, cast shadow outside the object, text, label, faces, hands, cats, characters, duplicate copies, comparison panels, checkerboard pattern, glow or decorative particles.

### treat

Source file: `exec-0f0254af-208d-4dad-8221-f255619fd79e.png` in `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/`.

Use case: stylized-concept. Production asset: ONE isolated cat-treat food icon for Eren, a cozy 2D pixel-art cat-care game. Three small salmon-pink crunchy cat treats in a compact overlapping cluster: the main treat is a rounded paw-shaped biscuit with a pale pink embossed paw pad, with two smaller heart-shaped treats partly behind. They are clearly pink pet treats, not a fish-shaped biscuit, not kibble and not a chocolate cookie. Warm rose edges and tiny pale highlights give them tasty crumbly thickness. Front view, gentle top-down angle. Detailed handcrafted 16-bit pixel-game food art, crisp stepped warm-brown outlines, coherent visible pixel clusters, restrained palette, cute and appetizing, readable at 62 pixels. No smooth 3D or vector look. Compact centered cluster occupies about 78 percent of square canvas, entirely visible with transparent margins. Genuinely transparent background, real alpha. No plate, packaging, text, label, floor, cast shadow, characters, faces, comparison panels, checkerboard background, glow or decorative particles.

### sausage

Source file: `exec-6b6d4dbd-f45e-46b6-9c29-c228692c67e9.png` in `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/`.

Use case: stylized-concept. Production asset: ONE isolated cooked sausage food icon for Eren, a cozy 2D pixel-art cat-care game. A single plump reddish-brown grilled sausage link, gently curved, clearly tied small rounded ends, three diagonal caramel-brown grill marks, one warm glistening highlight along its curved top. Substantial visible cooked skin and darker underside. Front view with gentle view down, lie diagonally with whole item visible. Detailed handcrafted 16-bit pixel-game food art with crisp stepped dark warm-brown outlines and clear shaded pixel clusters, restrained palette, appetizing and cute, readable at 62 pixels. Not a flat vector, no smooth 3D, no photograph. Center on a square canvas, entire silhouette fits within 78 percent of canvas with transparent margins. Genuinely transparent background and real alpha. No plate, fork, garnish, extra sausages, floor, scenery, cast shadow outside the object, text, label, faces, characters, checkerboard, glow or effects.

### cream

Source file: `exec-9c1690ce-7330-42fb-9409-3b0ef088df33.png` in `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/`.

Use case: stylized-concept. Production asset: ONE isolated cream food icon for Eren, a cozy 2D pixel-art cat-care game. A small open lavender ceramic ramekin filled with thick ivory cream, with a soft rounded swirl at the top. Low wide bowl shape, short visible purple sides, cream rim, two tiny ceramic highlight clusters and shaded base; the food is visibly creamy, not ice cream and not a tall yogurt carton. Front view with a gentle view down into the bowl, centered and entirely visible. Detailed handcrafted 16-bit pixel-game food art, crisp stepped warm dark outlines, rich but restrained pixel-cluster shading, cute and appetizing and legible at 62 pixels. Not smooth 3D, vector or photographic. One object takes about 78 percent of a square canvas with transparent padding. Real transparent background and alpha outside the object. No spoon, plate, packaging, labels, lettering, faces, cats, table, floor, external cast shadow, multiple versions, checkerboard, glow or sparkles.

### milk

Source file: `exec-423a1750-6850-41b4-8b08-9c82d3c2cf27.png` in `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/`.

Use case: stylized-concept. Production asset: ONE isolated milk bottle food icon for Eren, a cozy 2D pixel-art cat-care game. One short friendly clear glass milk bottle filled with opaque creamy-white milk, rounded shoulders, small sky-blue metal cap, a simple pale-blue label with a tiny white milk-drop symbol only, absolutely no writing. The bottle has restrained glass highlights and subtle cool-gray pixel shading so white milk reads clearly on transparency. Whole bottle front view, slight view down on the blue cap. Detailed handcrafted 16-bit pixel-game food art with crisp stepped warm dark outlines and carefully shaded pixel clusters, readable at 62 pixels, not a flat vector, smooth 3D or photograph. Centered on square canvas, fills about 78 percent of height, all edges visible with transparent margin. Genuine alpha-transparent background. No floor, table, outside cast shadow, extra props, multiple bottles, words, characters, faces, checkerboard or decorative effects.

### cheese

Source file: `exec-fbb41f26-6293-44e0-8fcf-bc5571a573ab.png` in `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/`.

Use case: stylized-concept. Production asset: ONE isolated cheddar cheese wedge food icon for Eren, a cozy 2D pixel-art cat-care game. One chunky golden-yellow triangular cheddar wedge, visible top and front cut face, three irregular round holes, slightly darker orange rind along the back, a few butter-yellow highlight clusters and warm orange underside shadows. Low front three-quarter view with a gentle view down onto its top. Appetizing handmade detailed 16-bit pixel-game food art with crisp stepped warm-brown outlines and coherent visible pixel clusters, restrained palette, cute and legible at 62 pixels. Not smooth 3D, flat vector or photographic. Entire centered wedge fills about 78 percent of square canvas, plenty of transparent margin. Genuinely transparent background with real alpha outside object. No plate, knife, crackers, garnish, floor, scenery, external cast shadow, text, label, faces, characters, duplicate wedges, checkerboard, glow or particles.

### yogurt

Source file: `exec-d8a9587f-eb3c-42f6-9cc6-ff33f68834ea.png` in `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/`.

Use case: stylized-concept. Production asset: ONE isolated strawberry yogurt food icon for Eren, a cozy 2D pixel-art cat-care game. One small open pink yogurt cup, foil lid peeled back and still attached at the rear, smooth pale-strawberry yogurt visible inside with a little swirl. Tapered short cup with coral-pink side stripe, ivory rim, a tiny simple strawberry motif on the cup, no lettering at all. Slight view down onto the yogurt and lid while keeping front of cup visible. Detailed handcrafted 16-bit pixel-game food art, crisp stepped warm dark outlines and controlled visible pixel-cluster shading, cute and appetizing, legible at 62 pixels. Not smooth 3D, vector or photographic. One compact centered complete cup on square canvas occupying about 78 percent of height with generous transparent margins. Genuinely transparent alpha background. No spoon, plate, loose berries or extra props, text, floor, table, external cast shadow, faces, cats, characters, duplicate cups, checkerboard, glow or particles.
