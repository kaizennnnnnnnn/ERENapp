# Food Silhouette Refresh

## Audit And Direction

Reviewed all 77 inventory foods: 38 active ordinary foods, two retired aliases, 27 donuts and ten Purrbolt drinks. The previous seven-food completion remains intact. Large pale serving plates made several older dishes read as similar white ovals and reduced the food's visible area at 62px. Thirteen dishes have new food-first sprites. The remaining 62 unique pictures were retained because their silhouettes already identify their food or container clearly.

- Remove presentation plates, boards, separate sides and utensils from solid food.
- Use one compact complete food silhouette; show a few large defining ingredients rather than many tiny garnishes.
- Keep necessary serving vessels for broth, stew and loose mixed dishes, but simplify their rims and ornament.
- Retain transparent backgrounds, centered 128px production canvases and the existing size-normalization pipeline.
- No changes to stored item keys, stock, prices, food stats, daily-menu availability, rewards or special-can effects.

## Full Catalogue Decisions

| Group | Retained | Redesigned |
| --- | --- | --- |
| Dry | Kibble, Cat Treat, Biscuit | None |
| Seafood | Tuna Can, Shrimp, Salmon, Sardine | None |
| Meat | Chicken drumstick, Sausage | Steak: meat and butter only, no platter |
| Dairy | Cream, Milk, Cheese, Yogurt, Egg | None |
| Sweets | Cake, Cookie, Jelly Caka | None |
| Italian | Pizza, Lasagna | Carbonara: pasta nest; Risotto: mushroom rice mound |
| Sushi | Nigiri, Temaki, Maki | None |
| Asian | None | Ramen: plain red bowl; Pad Thai: compact takeaway carton; Gyoza: three standalone dumplings; Soup Buns: low open bamboo basket, no lid |
| Balkan | Doner | Cevapi: sausages tucked in flatbread; Sarma: standalone cabbage rolls |
| World | Tacos, Wrap | Paella: shallow pan with larger toppings; Stew: small plain cooking crock; Meatballs: three sauced meatballs; Roast Chicken: whole roast, no board |
| Donuts | All 27 existing designs, including the two sold in the kitchen | None |
| Energy | All ten Purrbolt cans and moving special-edition effects | None |
| Legacy | Fish still aliases Sardine; Sushi still aliases Nigiri | Neither returned to the shop |

## Production And Verification

Assets: `public/food/{steak,carbonara,risotto,gyoza,cevapi,sarma,meatballs,roast_chicken,ramen,pad_thai,paella,stew,xiaolongbao}.png`.

Generated with the built-in image generation tool on 2026-10-27, true alpha transparency requested. Only the 13 selected files were passed through the existing `normalise()` function in `scripts/normalize_food_art.py`. This mechanically trims alpha padding, resizes and centers; it does not draw or erase image content. Original generated outputs remain in the local generated-images library. `FOOD_ART_V` is 6 so existing phones request the updated pictures; can artwork and its independent version are unchanged.

Checks: `node scripts/check_kitchen_food.cjs`, `npx tsc --noEmit` and `python scripts/check_food_silhouettes.py` (Pillow required). The last checks dimensions, actual transparency, visible bounds, centering, connected silhouettes and unique content. Local review pictures are in `review-pictures/food-silhouettes/`. Browser review uses the real kitchen component with isolated mock wallet/fridge data, not the production database.

Browser verification covered all five changed shop categories, the lower rows of longer shelves, all 13 selected-food tray pictures and the five corresponding fridge categories at 390x844 and 360x740. No missing food images or horizontal overflow occurred. A mock Steak purchase reduced the test balance from 100000 to 99970 and increased its fridge stock from two to three. Actual touch-drag feeding was not automated. The external esbuild preview emits its existing styled-jsx attribute warnings; no production UI code or backend behavior was changed.

## Generation Prompts

Each entry below is the exact full prompt for its separate built-in generation call. No reference images were supplied.

### steak

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-5d691974-c826-4b44-9a33-7da390153604.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: A single thick juicy cooked beef steak, rounded irregular cut, dark caramel-brown crosshatched grill marks and rosy warm-brown side edge, one tiny melting butter square on top. The meat itself fills the silhouette. NO plate, platter, board, tomatoes, salad, loose herbs or side dishes.

### carbonara

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-4604c9bd-a254-4eb9-98ea-1936ce37def9.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: A compact rounded nest of golden spaghetti carbonara, looping thick strands coated in ivory sauce, a few chunky browned pancetta pieces, fine cream-yellow parmesan highlight pixels and pepper specks. Read as carbonara, not tomato pasta. A substantial self-contained pasta mound with dark gold shaded underside. NO plate, bowl, container, fork, raw egg yolk, salad or garnish surrounding it.

### risotto

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-8a4896ea-fb33-4a86-9190-590d6f2fbe74.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: A compact creamy golden mushroom risotto mound, low domed shape with distinct chunky short rice-grain clusters, three warm brown mushroom slices integrated into the top, subtle parmesan-yellow highlights. Thick creamy rice, not long spaghetti or paella. Self-contained food pickup silhouette with clearly defined rounded base. NO plate, bowl, bread, tomatoes, vegetables beside the mound or loose garnish.

### gyoza

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-7631f9df-b73d-4159-b382-87cf28f60e87.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: Three plump golden pan-fried gyoza dumplings in a close compact overlapping fan. Distinct curved half-moon shapes, clear pinched pleats along the top seams, pale ivory dough and toasted golden bottoms; one foremost dumpling shows its caramelized crispy underside. NO plate, bowl, sauce cup, chopsticks, herbs or scattered ingredients.

### cevapi

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-433d3802-3c9c-4f9d-bdee-c95527d0bb8c.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: Four short chunky grilled cevapi sausages tucked together into an open folded golden somun flatbread pocket, two tiny violet onion curls visible inside the bread. The bread wraps naturally around their lower halves, showing the four charred reddish-brown sausages clearly. Compact appetizing handheld silhouette. NO plate, board, loose side salad, knife, fork or surrounding garnish. Not a hotdog in a long bun.

### sarma

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-acf1d381-3faa-4f14-bd77-a1ba90a399f5.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: Three tightly rolled stuffed cabbage rolls close together in a compact triangular cluster, warm sage and olive-green translucent cabbage leaves, readable folds and seams, a spoonful of thick red-orange tomato sauce coating their bases, one cut end showing a few rice grains. No floating liquid, no loose background sauce. NO plate, bowl, bread, garnish or cutlery.

### meatballs

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-69b9a1a4-9ad9-4d05-bf2a-ee87fc18b414.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: Three plump browned meatballs in a tight triangular cluster, chunky glossy brick-red tomato sauce clinging to them, little warm highlights and tiny green herb pixels on the meatballs only. Compact clear individual round forms, no soup, no red puddle. NO plate, bowl, pasta, bread, utensil or scattered side garnish.

### roast_chicken

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-cea03890-3401-4ebd-a285-68e402858806.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: One plump whole roast chicken with tucked wings and two small drumsticks, glossy golden roasted skin, amber pixel shading, simple caramelized highlights. Charming compact whole roast silhouette, clearly distinct from a single drumstick. NO board, plate, platter, vegetables, herbs, citrus, loose garnish or steam.

### ramen

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-230f0170-748a-4f05-b24e-f33795c90f04.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: One compact deep coral-red ramen bowl with short visible ceramic sides and a plain ivory rim. The surface is mostly FOOD: golden curled noodles in amber broth, half an egg with orange yolk, one pink spiral fishcake, a small dark nori rectangle and two short spring-onion accents. Close-framed bowl, chunky simplified toppings and crisp pixel shading. NO patterned bowl borders, chopsticks, spoon, plate, side dishes or steam floating outside it.

### pad_thai

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-6e6f5451-6720-4be5-96ea-0aaab729535c.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: A small squat open kraft takeaway noodle carton, two folded short flaps at the rear, filled generously above the rim with orange-brown flat pad-thai noodles. One coral shrimp, a few pale bean-sprout strands, three peanut clusters and one small green lime wedge tucked into the noodles. Most of silhouette is the food. Muted tan carton, no print. NO bowl, plate, chopsticks, handle, separate lime or scattered garnish.

### paella

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-0a47ce38-ab79-4bf3-98b1-7515ef8feb67.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: A compact shallow charcoal cast-iron paella pan with two tiny stub handles and minimal thin visible pan rim, brimming with saffron-yellow rice, two coral shrimp, two dark open mussels, three green pea clusters and two red pepper strips. Rice dominates the silhouette, pan is a slim frame only. Chunky readable pixels, not intricate tiny scattered ingredients. NO plate under pan, cutlery, separate garnish, steam, lettering or ornamented container.

### stew

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-4f3bb90d-b385-462a-9e72-011c0c65af33.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: A small squat warm brick-red cooking crock with a tiny side handle, simple pale rim, filled to the top with thick glossy brown stew. Clearly visible three chunky beef cubes, two orange carrot pieces and two pale golden potato cubes, no tiny peas everywhere. Food surface dominates, pot low and compact, simple broad pixel shapes. NO plate, spoon, ladle, saucer, side dishes, floating steam, patterned crock or scenery.

### xiaolongbao

Source: `C:/Users/Lenovo/.codex/generated_images/019e97b4-0449-7fa0-a2e0-51cbf0e76694/exec-116ccb39-76dc-4475-980c-71cf1958826e.png`.

Use case: stylized-concept. Production asset for Eren, a cozy 2D pixel-art care game: one isolated FOOD sprite, not a scene. Handcrafted 16-bit food-game artwork with crisp visible square pixel clusters, clear 1-2 pixel warm dark-brown contour at final 128px size, compact readable shapes, restrained highlights and warm shading, appetizing and cute. Slight overhead three-quarter front view, consistent gently elevated camera. Pixel art, not smooth 3D, not vector, not photorealistic, not painterly. Entire compact object centered on square canvas, occupying about 80 percent, all edges visible with transparent margins. Real alpha-transparent background. No ground plane, external cast shadow, utensils, scenery, text, lettering, logos, faces, characters, extra props, decorative sparkles, comparison panels, duplicate mini versions, checkered background. Food is the visual subject, not tableware.
Subject: A low round honey-brown bamboo steamer basket containing three plump ivory xiaolongbao soup buns, each with a clear pinched pleated top and soft golden shading. Buns fill most of sprite, front bun larger and two tucked behind. Basket has one simple woven band and a small visible rim, NO lid anywhere, no stacked steamer, no plate, sauce cup, chopsticks, utensils, garnish, steam or separate props.

