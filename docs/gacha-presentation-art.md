# Gacha Presentation Artwork

Generated with the built-in image tool. Final production assets live in `public/gacha/presentation/`. The original machine paintings are unchanged. PNG sources remain in the local generated-images library; WebP export is format conversion only. Atlas rectangles are read from alpha bounds and used at render time, not painted over.

## Shared Scene Prompt

Use case: stylized-concept. Asset type: square production game background for a reward reveal in Eren, a cosy pixel-art cat-care game. A carefully drawn detailed-but-readable 16-bit pixel-art interior, stepped pixel edges, restrained pixel shading, warm domestic lighting, charming handmade materials. Not vector art, not 3D render, not painterly blur, not a UI mockup. Square image. Front-facing camera, very slight downward view of the foreground standing surface. Keep the entire central 50 percent of the image from 15 to 85 percent height free of objects, characters, text or decoration so a tall cat sprite can be composited there. The standing surface crosses the full width at 74 percent image height; its horizontal top is clearly visible throughout the lower quarter. The place where a cat's feet will stand is at 84 percent height, centred. Put scene-specific props at the far left and far right only. No cats, people, silhouettes, monsters, food items in the centre, flowers, grass, sunburst rays, glowing particles, gradients, logos, text, border or watermark. The scene must feel like a small well-loved room in the same house, not a shop or outdoor world. Full bleed, no surrounding card.

### food

Scene: a compact home cafe and snack pantry. Dusty teal wall, shelves at the far edges with glass jars and folded napkins, small pastel pink ceramic details, a little framed print high at the left. Foreground is a cherry-pink and ivory tiled cafe counter with a pale peach paper placemat lying flat at centre. The empty centre wall is muted mint. Pink, teal, warm white and small honey-wood details, not an orange or brown dominated room.

### animal

Scene: a cosy costume dressing corner. Soft lilac wall, a small wardrobe rail with folded colourful fabrics and empty wooden hangers at far left, a narrow sewing shelf with thread spools and a little mirror at far right. Small closed curtains only at the outermost edges, centre entirely unobstructed. The foreground is pale wooden floor with a flat blush pink fabric rug. Lilac, muted coral, sage and honey wood, clear light centre.

### foodsuits

Scene: a home bakery costume workbench, like a cosy kitchen corner. Soft blue-green rectangular wall tiles, a shelf at the far left with a rolling pin and two jars, a stand mixer only at far right, copper utensils tucked near the upper edges. The foreground standing surface is a low pale wooden worktop with an ivory-and-coral checked cloth flat at the centre. Pale blue-green, coral, warm white and tiny copper details. Plenty of light, uncluttered empty centre.

### creatures

Scene: a windowless home reading nook for creature costumes. Mossy sage wall, a little bookshelf at far right with books and an unlit simple table lamp, potted trailing plants at the outer left edge, small shell and feather curios on an edge shelf. The foreground is warm wooden floor with a flat round woven sage-and-peach rug centred under the future cat. Sage green, muted peach, soft ivory and walnut accents. No windows, no forest outside, no characters.

## Shared Box Atlas Prompt

Use case: stylized-concept. Asset type: ONE transparent pixel-art sprite atlas for a hinged gift box used in a game animation. Square atlas with TWO separate unlabelled components in exactly two equal horizontal cells: the TOP HALF contains only the detached closed LID, the BOTTOM HALF contains only the matching OPEN EMPTY BOX BODY with NO LID attached. Both components centred horizontally, same apparent width and scale, isolated on true transparent alpha with at least 6 percent clear padding around each cell. Nothing crosses the halfway line. Camera: almost front-facing with a shallow view down onto the top, not isometric. The box is wide and low, width about twice its height. Lid is a solid shallow rectangular cap with clear top plane and narrow front fascia, not a flat polygon. Body is a real three-sided container with thick front wall, side planes, deep empty interior visible above the front rim and a straight hinge along the rear rim. Keep all edges rigid, stepped pixel outlines. Handcrafted rich 16-bit pixel game art, crisp material details, small edge highlights, restrained shaded clusters. The lid and body must clearly belong together, viewed from exactly the same angle. NO contents, no characters, cats, animals, hands, floor, ground shadow, background, floating sparkles, text, labels, UI borders or watermark. No glossy 3D rendering, no vector shapes. This is a production sprite atlas, not a design sheet with annotations.

### common

COMMON SNACK CARTON. Warm ivory printed paperboard with a very simple coral bakery stripe, visible paper folds and a small flat mint paw sticker on the front wall. Pale peach empty interior. Modest, charming, everyday packaging. No ribbon, metal trim or gold.

### rare

RARE SNACK GIFT CARTON. Pale mint sturdy paperboard, cream piping, fine coral gingham band, a raised leaf-green paw seal on the front wall. Patterned mint-and-ivory lid with a narrow fabric pull tab at its front. Pale ivory empty interior. More special than ordinary paper, still simple and legible.

### epic

EPIC PATISSERIE GIFT BOX. A rigid dusty-rose and deep berry presentation box with fabric-like paper texture, a beautiful cream satin ribbon laid across the lid only, a little embossed brass paw medallion and subtle floral stitch motifs on the front wall, thin antique-gold edge piping. Warm ivory empty lining. Richer crafted material and proper depth, not busy or glittery.

### legendary

LEGENDARY KEEPSAKE GIFT CASE. A rigid emerald-teal presentation chest with tasteful gold foil filigree at the corners, small brass corner protectors, a sculpted gold paw clasp at the front, an ivory inset on the lid with a tiny crown motif. Pale warm velvet empty interior. Beautiful precious collectible packaging, restrained detail large enough to see at 220px. No gems floating outside or magic effects.

## Serving Set Atlas

Use case: stylized-concept. Asset type: ONE transparent game sprite atlas, square, two separate unlabelled components in two equal horizontal cells. TOP HALF: a detached closed serving cloche lid, centred, about 80 percent of cell width. BOTTOM HALF: the matching wide low ceramic serving tray, centred and the SAME apparent width, carrying a small neatly folded coral-and-ivory checked fabric costume bundle tied with a sage ribbon. No characters or faces in the bundle. Keep clear transparent padding around both components and do not cross the halfway line. Almost front-facing camera, shallow view down at the top. Detailed cosy 16-bit pixel-art prop, crisp stepped pixel outlines and restrained shaded clusters, same quality as a carefully illustrated home bakery game, not a smooth vector or 3D render. Lid is pale mint glazed ceramic with ivory inset panels, a small round simple brass handle, clear material highlights and believable domed volume, its opaque front hides all contents when aligned on the tray. Tray is ivory porcelain with a muted mint double rim, slim visible side thickness and a coral checked folded napkin underneath. NO cat, person, hands, text, labels, surrounding scenery, ground, cast shadow, particles, sparkles or watermark. Truly transparent alpha background. Large clean shapes readable at 240 pixels wide.
