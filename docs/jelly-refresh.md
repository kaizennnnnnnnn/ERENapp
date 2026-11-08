# Jelly art and fridge refresh

Six transparent pixel-food sprites generated with the built-in image tool (one call per asset), then mechanically trimmed and exported at 256 x 256 with nearest-neighbour scaling. No outside plates, faces or scenery. Originals remain in the generated-image library.

## Assets

- `public/jelly/jelly_super.png`: one rainbow-layer star pudding, replacing the five-image clipped composite.
- `public/jelly/jelly_red.png`: strawberry heart mould.
- `public/jelly/jelly_green.png`: apple mould with a leaf and apple slice.
- `public/jelly/jelly_purple.png`: grape scalloped mould.
- `public/jelly/jelly_yellow.png`: lemon flower mould.
- `public/jelly/jelly_orange.png`: mango cushion mould.

## Feeding

Super Jelly is a virtual fridge shelf backed by the existing personal `jelly_progress.supers` count, not a second stock entry in `food_by_user`. The Parlour links to the kitchen. Fridge feeding uses the existing recoverable atomic RPC and celebrates only confirmed receipts, including the fifth-feed coat.

`migration_super_jelly_snacks.sql` adds one random Cookie, Donut, Choco Donut, Honey Glazed or Sakura to the actor's personal fridge in the same transaction. Each is equally likely. Recovery returns the same snack without awarding another. Pre-rollout receipts remain version 1 and receive no backpay; the client does not invent a snack for these or for an older server.

## Verification

- Production build and TypeScript passed.
- 227 disposable-database scenarios with the snack patch; 150 original feed scenarios without it.
- 10 real-hook saved-feed client tests, 16 reward-indicator tests and 12 ordinary-food client tests.
- UI checks for all five snack reveals, asleep/loading/busy states, empty stock and receipt recovery.
- Browser checks at 390x844 and 360x740: Parlour to kitchen, fridge feed, snack added and fed, missing update, fifth-feed lost reply recovered after reload with zero stock and coat unlock.
- Review screenshots: `review-pictures/jelly-refresh/` (ignored). Preview backend is disposable and does not contact the hosted database.

## Prompt Set

### Super Jelly

Use case: stylized-concept. Production food sprite for Eren, a cozy pixel-art cat-care game. Create ONE Super Jelly: a small, delicious five-lobed star-shaped gelatin pudding viewed from the front with a gentle view down onto its top. It is ONE coherent dessert, NOT five desserts or a collage. Soft rounded star silhouette, squat and plump. Five distinct clean HORIZONTAL translucent fruit layers (strawberry rose, mango gold, apple mint, pale sky blue, grape lavender) wrapping naturally around the entire mould. A tiny ivory cream star at the center of the top, a small red berry beside it. Crisp handcrafted 16-bit pixel-game food art, stepped warm dark outlines, controlled visible pixel clusters, restrained shading and a few broad glassy highlights. Appetizing and cute, clearly readable at 64 pixels. Keep the silhouette simple and the layers wide; no tiny intricate decorations. Entire single object centered on a square canvas, occupies about 76 percent of width, generous transparent margins. Genuinely transparent background with alpha. No plate, bowl, floor, table, cast shadow outside the object, text, labels, faces, animals, characters, crowns, glow, floating particles, checkerboard or duplicate objects. No smooth 3D rendering, vector style or painted scenery.

### red

Use case: stylized-concept. ONE production food sprite for Eren, a cozy pixel-art cat-care game. Front view with gentle view down onto the top, entire single gelatin dessert centered on square canvas. Subject: Strawberry Wobble: strawberry-rose red translucent jelly in a soft heart-shaped mould, squat and plump with two or three gentle vertical flutes. One small whole strawberry with a green calyx nestled at the top. Rich berry-red body with broad pale pink highlights.. Crisp handcrafted 16-bit pixel-game food art, stepped warm dark outline, visible controlled pixel clusters, restrained small palette, appetizing and cute. Match a polished cozy pixel-game inventory, not smooth 3D or a vector icon. Jelly should look softly translucent with a few broad glassy highlights, not see-through scenery. Strong simple silhouette, readable at 56 pixels; the fruit topper is small and secondary. Body and topper together occupy about 76 percent of the square with generous clear margins. Genuinely transparent background with real alpha. No plate, bowl, wrapper, floor, cast shadow outside the object, text, labels, faces, animals, characters, glow, floating particles, checkerboard, extra dessert copies, collage or comparison panels.

### green

Use case: stylized-concept. ONE production food sprite for Eren, a cozy pixel-art cat-care game. Front view with gentle view down onto the top, entire single gelatin dessert centered on square canvas. Subject: Apple Fizz: apple-green translucent jelly in a small round domed mould, plump with four soft vertical flutes and a gently scalloped foot. One small crisp pale-green apple wedge with a dark green peel and a single leaf at the top. Fresh mint and lime-green shading.. Crisp handcrafted 16-bit pixel-game food art, stepped warm dark outline, visible controlled pixel clusters, restrained small palette, appetizing and cute. Match a polished cozy pixel-game inventory, not smooth 3D or a vector icon. Jelly should look softly translucent with a few broad glassy highlights, not see-through scenery. Strong simple silhouette, readable at 56 pixels; the fruit topper is small and secondary. Body and topper together occupy about 76 percent of the square with generous clear margins. Genuinely transparent background with real alpha. No plate, bowl, wrapper, floor, cast shadow outside the object, text, labels, faces, animals, characters, glow, floating particles, checkerboard, extra dessert copies, collage or comparison panels.

### purple

Use case: stylized-concept. ONE production food sprite for Eren, a cozy pixel-art cat-care game. Front view with gentle view down onto the top, entire single gelatin dessert centered on square canvas. Subject: Grape Dream: grape-purple translucent jelly in a low wide scalloped pudding mould with five rounded flutes. A compact cluster of three little purple grapes and one small green leaf on top. Lavender highlights and restrained plum shadows.. Crisp handcrafted 16-bit pixel-game food art, stepped warm dark outline, visible controlled pixel clusters, restrained small palette, appetizing and cute. Match a polished cozy pixel-game inventory, not smooth 3D or a vector icon. Jelly should look softly translucent with a few broad glassy highlights, not see-through scenery. Strong simple silhouette, readable at 56 pixels; the fruit topper is small and secondary. Body and topper together occupy about 76 percent of the square with generous clear margins. Genuinely transparent background with real alpha. No plate, bowl, wrapper, floor, cast shadow outside the object, text, labels, faces, animals, characters, glow, floating particles, checkerboard, extra dessert copies, collage or comparison panels.

### yellow

Use case: stylized-concept. ONE production food sprite for Eren, a cozy pixel-art cat-care game. Front view with gentle view down onto the top, entire single gelatin dessert centered on square canvas. Subject: Lemon Pop: lemon-yellow translucent jelly in a round daisy-shaped mould, squat and plump with six rounded lobes. One small lemon wedge with a pale interior and golden rind perched at the top. Buttery yellow highlights and warm golden shadows.. Crisp handcrafted 16-bit pixel-game food art, stepped warm dark outline, visible controlled pixel clusters, restrained small palette, appetizing and cute. Match a polished cozy pixel-game inventory, not smooth 3D or a vector icon. Jelly should look softly translucent with a few broad glassy highlights, not see-through scenery. Strong simple silhouette, readable at 56 pixels; the fruit topper is small and secondary. Body and topper together occupy about 76 percent of the square with generous clear margins. Genuinely transparent background with real alpha. No plate, bowl, wrapper, floor, cast shadow outside the object, text, labels, faces, animals, characters, glow, floating particles, checkerboard, extra dessert copies, collage or comparison panels.

### orange

Use case: stylized-concept. ONE production food sprite for Eren, a cozy pixel-art cat-care game. Front view with gentle view down onto the top, entire single gelatin dessert centered on square canvas. Subject: Mango Sunset: mango-orange translucent jelly in a small rounded-square cushion mould with soft rounded corners and two broad vertical side flutes. Two little bright golden mango cubes and one tiny green leaf on top. Apricot highlights and rich amber-orange shadows.. Crisp handcrafted 16-bit pixel-game food art, stepped warm dark outline, visible controlled pixel clusters, restrained small palette, appetizing and cute. Match a polished cozy pixel-game inventory, not smooth 3D or a vector icon. Jelly should look softly translucent with a few broad glassy highlights, not see-through scenery. Strong simple silhouette, readable at 56 pixels; the fruit topper is small and secondary. Body and topper together occupy about 76 percent of the square with generous clear margins. Genuinely transparent background with real alpha. No plate, bowl, wrapper, floor, cast shadow outside the object, text, labels, faces, animals, characters, glow, floating particles, checkerboard, extra dessert copies, collage or comparison panels.

