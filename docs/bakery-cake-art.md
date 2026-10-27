# Bakery Cake Artwork

## What Changed

The bakery had eight pastry definitions, but the same 12x12 layered-cake SVG was recolored for every item. This replaces that placeholder with eight individual pastry pictures, adds four creative cakes, and gives all 12 a larger stable 104px art area in the existing Meadow cake menu. The room painting, baker sprite, donut counter, donut machine and original eight prices are unchanged.

New designs:

| ID | Name | Coins | Design |
| --- | --- | ---: | --- |
| honey_hive | Honey Hive | 180 | Graduated honey layers, honeycomb and sugar bees |
| moonbeam | Moonbeam Cake | 200 | Teal frosting, gold stars and a white-chocolate crescent |
| moss_cottage | Moss Cottage | 190 | Pistachio dome, mushroom roof and chocolate door |
| lily_pond | Lily Pond | 170 | Aqua jelly pond, water lily and a fondant frog |

## Artwork Pipeline

Built-in image generation tool, generated 2026-10-27. Twelve independent transparent-background calls, one per pastry, no supplied reference images. Final production files: `public/cakes/{strawberry,chocolate,vanilla,matcha,blueberry,macaron,tiramisu,royal,honey_hive,moonbeam,moss_cottage,lily_pond}.png`. Each is RGBA 128x128, alpha-centered through the existing `normalise()` in `scripts/normalize_food_art.py`. This is only mechanical cropping/resizing/centering; the generated artwork itself was not redrawn with scripts. Original outputs remain in the local generated-image library.

`cakeArt(id)` supplies the separate versioned `/cakes/<id>.png?v=1` URLs. `CakeSprite` shares them between the 96px menu art and 80px sell-animation art. Fixed image dimensions prevent loading/layout shifts. The white miniature plate discs and shared SVG are removed. Names, descriptions, coin labels, keyboard focus and existing affordability/busy disabling are preserved.

The owner confirmed that cakes should be real fridge foods. Each pastry now has a stable `CakeKey` (`cake_<id>`) and hunger/happiness/weight values in the shared cake catalogue. Purchases use the existing personal `food_by_user` JSONB pile, with no new table, column, RLS change or migration. Cake IDs are visible in the fridge's Cakes category, feeding tray, food-stat cards and gift pickers. `foodArt(cakeFoodId)` resolves to the same `cakeArt` URL as the bakery; no duplicate PNGs are stored under `public/food`.

The old kitchen `cake` slice remains a separate existing food. Bakery cakes are excluded from kitchen sales and kitchen daily menus; the 50-item kitchen shelf remains unchanged. Existing food stock is not migrated or deleted.

`purchaseCakeFood` confirms the saved-stock boolean from `addManyToMyFood` before calling `spendCoins`. A failed stock write removes that helper's optimistic increment without charging. A failed payment rolls back the saved pastry. The menu stays open and displays a retry error on either failure. The original donut checkout path is unchanged. This uses the repository's existing absolute-value writes, not a new atomic database transaction.

## Checks

Run `node scripts/check_cakes.cjs`, `node scripts/check_kitchen_food.cjs`, `python scripts/check_cake_art.py` (Pillow required) and `npx tsc --noEmit`. The focused checks verify unique catalogue IDs/names/art, the eight original prices, the four additions, all 12 PNGs and both render sizes, closed/affordable/unaffordable/busy menu states, the shared fly-up asset path, and 36 successful/failed-stock/failed-payment checkout cases. Kitchen checks cover all 89 inventory foods, cake metadata/feeding-stat parity, all gift-picker keys, bakery-only sale exclusion and the unchanged 50-item kitchen shelf.

Local phone-review screenshots and the full artwork contact sheet are in ignored `review-pictures/bakery-cakes/`. Browser tests use isolated mock preview coins and food storage, not the production database. Existing native touch-drag feeding is not automated by this browser tool. The existing JSONB storage mechanism was checked against the local migration and [Supabase's JSON data guidance](https://supabase.com/docs/guides/database/json); no Supabase API or schema changes are needed.

Browser verification bought all 12 pastries through the real bakery menu, taking the mock balance from 100000 to 98295 (1705 total). The kitchen read one of each from the same isolated saved pile, retained all 12 after reload, and allowed all 12 to be carried on the feeding tray at both phone widths. Separate 30-coin and failed-stock/failed-payment fixtures verified disabled purchase buttons, visible retry errors, unchanged balances and no unwanted cake stock. The external preview's existing styled-jsx attribute warnings are not production errors.

## Exact Generation Prompts

### strawberry

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-b65b411e-d9e6-4c1f-b282-0ac6a36c5273.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: A small round strawberry shortcake, two pale golden sponge layers separated by thick fresh ivory cream and visible strawberry pieces, clean cream sides with a subtle soft-pink frosting top, four large whipped cream dollops alternating with whole red strawberries and green tops. Cake body is round, not a wedge. The frosting, sponge and fruit are distinct large readable shapes, not dense little speckles.

### chocolate

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-adb5f79f-f08b-4838-8a5b-234ff5ab3c40.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One tall triangular slice of chocolate fudge cake with three dark cocoa sponge layers and two thick pale-chocolate frosting bands. Glossy dark ganache drips over the front edge, one generous dark-chocolate curl and a small chocolate rosette on the top, large clear layered side, rich warm brown palette. No whole round cake, no cherries, berries or gold.

### vanilla

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-52db8db4-f55c-4f1d-81b4-8807bc9c31db.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One vanilla cupcake in a short pink fluted paper liner, warm golden sponge visible above the rim, a generous tall ivory buttercream swirl, a few chunky pastel pink, yellow, mint and lavender sprinkles embedded in the frosting and one little red cherry with short brown stem. Single cupcake, balanced broad bottom and rounded piped top.

### matcha

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-b8b06ab2-72a1-4839-84c6-9fcc86648555.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One thick short matcha Swiss roll slice with green tea sponge, a large clean ivory cream spiral visible across the front circular cut face, short cylindrical roll body visible behind the slice toward the right, one low cream dollop and two small green tea leaves on top. Pale sage highlights and rich moss-green sponge contour, unmistakable cream spiral; not a layered cake wedge.

### blueberry

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-f859b603-e123-4bbb-b679-6961e6d605b4.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One individual low round blueberry custard tart, golden scalloped fluted pastry shell with visible buttery sides, ivory custard just inside the rim, six plump oversized blue-purple blueberries piled neatly over the custard with tiny restrained pale highlights. One small mint leaf tucked among the berries, no loose berries outside the tart. Deep blue fruit, not blue frosting.

### macaron

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-30a37511-c229-4e5a-b9cd-43a551ca01ba.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: A compact tower of exactly three thick almond macarons stacked neatly: rose pink at the bottom, pale lemon yellow in the middle, soft lavender on top. Each has readable rounded domed shells, ruffled feet and a thick contrasting ivory cream center. Gently offset but balanced, full stack visible. No plate, extra cookies, garnish or ribbon.

### tiramisu

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-bb5c0c27-0cf5-4d8b-83b6-504ebd8cceb4.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One neat rectangular tiramisu slice with two dark coffee-soaked ladyfinger sponge bands alternating with generous ivory mascarpone layers. Thick cocoa-dusted flat top with one small cream rosette and two little coffee beans seated on top. Clearly rectangular slice with a visible front and side, restrained ivory, cocoa and warm coffee palette, no pink frosting.

### royal

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-4f87496e-53dc-481f-b576-9b2496e05e64.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One elegant compact two-tier royal celebration cake, both tiers covered in ivory frosting, rich gold piping around each edge, restrained gold-leaf patches on the upper tier and a tiny edible gold crown sitting directly on top. Warm ivory body contrasts with caramel-gold trim. A few large scalloped frosting swags, rich but readable, not overdecorated, no jewelry or props beside it.

### honey_hive

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-382177ce-dab6-4103-9ea0-140a750e80a8.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One whimsical honey-hive cake: a squat rounded beehive dome made from three graduated golden honey sponge tiers, thick amber honey drip frosting, a simple small fondant honeycomb patch on the side, two tiny sugar bee decorations resting against the cake itself, and an ivory whipped-cream tuft on top. Bees are clearly edible sugar decorations, not real flying insects. No floating bees, plates, flowers, detached props or outside drips. Cute distinctive honey-gold silhouette.

### moonbeam

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-3f8d5202-988c-47f1-a701-cfcea3ee2651.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One whimsical Moonbeam cake, a compact round two-layer cake with midnight-teal frosting, a clearly visible pale-vanilla sponge band at the base, a large ivory white-chocolate crescent moon standing directly on top at the rear, three chunky tiny gold star sprinkles pressed into the frosting and soft aqua piped edge. Refined teal, ivory and gold palette, sweet magical bakery item, no purple gradient, no floating objects, no glow, no stars outside cake.

### moss_cottage

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-0a18eff5-a44c-4426-8200-19818267a3a2.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One whimsical Moss Cottage cake: a compact moss-green domed sponge cake covered in pistachio crumb frosting, a small fondant red mushroom cap with five ivory spots forming a little roof on top, a chocolate arched door pressed into the front face and two tiny ivory sugar-stone steps attached at its bottom. All elements are edible cake decoration, not an actual house in a landscape. Cute fairy-cottage silhouette with red roof, sage body and cocoa door. No landscape, floor, separate mushrooms, trees or external props.

### lily_pond

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-98b0a4db-ce1c-4965-84b4-407c468d41f9.png`.

Use case: stylized-concept. Asset: one isolated bakery pastry sprite for Eren, a cozy 2D pixel-art care game. Handcrafted 16-bit food-game artwork, visible crisp stepped dark warm-brown contours, deliberate square pixel shading clusters, small readable shapes, appetizing colors and restrained glossy highlights. Gently elevated three-quarter front view so both the top and side read. Compact centered complete silhouette on a square canvas with transparent margins, ready to normalize to 128px and display at 80px. Cute, polished, tactile pastry. Not a photograph, smooth 3D render, vector or painting. Real alpha-transparent background, no scenery, ground, external cast shadow, plate, board, cake stand, utensils, packaging, text, labels, candles, floating particles, decorative props outside the pastry, duplicate mini copies, panels or comparison sheets.
Subject: One whimsical Lily Pond cake: a small round pistachio layer cake with pale sage piped sides, a flat aqua-blue jelly pond surface inset in the top frosting, two simple green fondant lily pads, one small ivory sugar water lily and a tiny round mint-green fondant frog resting on the back edge. The frog is an obvious edible sugar decoration, not a real animal. Large clean shapes, pastel aqua and sage with pink flower center. No external water, plate, scene, landscape, floating lily pads or separate props.

