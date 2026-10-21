# Sprite artwork

AgentEmpires uses original generated raster artwork inspired by classic medieval isometric strategy games. These are not extracted Age of Empires assets. Created with the built-in image generation tool on 2026-10-21, then integrated as layered SVG image sprites. No image-generation service is used by the running application.

## Files

- `environment.png`: 1254 × 1254 RGBA; town center, cottage, pines, wheat farm. Source regions are defined in `src/Settlement.tsx`.
- `villagers.png`: 1536 × 1024 RGBA; four columns and two rows of villager poses. Background RGB values may remain under transparent alpha; always preserve the alpha channel.
- `meadow.png`: 1254 × 1254 grass texture, clipped into each hex tile at runtime.

The originals are preserved without destructive cropping. The renderer uses atlas view boxes, a colored selection ring per villager, harness borders and banners, two-pose hammer/walk cycles, and carrying poses for gathering. Pause and reduced-motion preferences apply to animation. The small pose set is an initial art pass, not a full directional animation library. Buildings grow decoratively with event counts; workers still correspond to observed agents.

Non-building work follows a repeated, staggered round trip from the hall to the farm or forest. The outbound trip uses alternating walking frames, the villager pauses at the resource, and the return shows a basket or timber bundle. This is a visual metaphor for work observed in a local CLI journal; the route does not reveal private prompt content.

## Generation prompts

### Environment

```text
Use case: stylized-concept
Asset type: production 2D game environment sprite atlas for AgentEmpires.
Primary request: an original medieval real-time-strategy sprite sheet with the visual fidelity and isometric camera of classic Age of Empires II. Detailed pre-rendered-looking 2D sprites, realistic small-scale proportions, crisp readable forms, no thick outlines, no toy or cartoon look.
Composition: square 1024x1024 transparent canvas, precise 2 by 2 grid of four equally sized 512x512 cells. Each sprite entirely inside its own cell with at least 35px transparent margin. No grid lines. Each object centered horizontally and its ground contact at local y=440. Uniform orthographic isometric 30-degree view, lit from upper left. Objects occupy roughly 400px width.
Top left cell: medieval timber and limestone town center, steep weathered terracotta roof, small turret, arched entry, modest courtyard steps, intricate beams and masonry, muted blue cloth banner. No terrain platform.
Top right cell: rustic thatched cottage and tiny timber lean-to, barrels and woodpile beside wall. No terrain platform.
Bottom left cell: dense small cluster of three Scots pine trees, realistic irregular needle foliage and brown trunks, tallest tree toward back, no terrain platform.
Bottom right cell: small isometric rectangular wheat farm patch with golden crop rows, earth furrows, low weathered wooden fence and a small haystack.
Textures: individual stone blocks, aged timbers, mottled clay roofing, fine foliage. Restrained earthy olive, ochre, terracotta, grey stone. Bright enough to read against a dark forest UI.
Constraints: genuine alpha transparency between and around all objects, gentle translucent contact shadows only. No labels, no typography, no watermark, no user interface, no characters. Every sprite stays within its cell. This is game art to be cropped at exact 512px grid boundaries.
```

### Villagers

```text
Use case: stylized-concept
Asset type: animated villager production sprite sheet for AgentEmpires.
Primary request: one consistent medieval male villager in eight animation poses, in the realistic pre-rendered 2D isometric strategy-game style of classic Age of Empires II. Fine textured linen cream shirt, muted brown vest, leather belt, dark wool trousers, worn boots, small green cloth sash. Natural human anatomy, no big head, no cartoon outlines. Orthographic camera above at 30 degrees, facing southeast/right in all frames. Lighting upper-left.
Composition: 1536x1024 landscape transparent canvas, EXACT 4 columns by 2 rows, each cell 384x512. Place the same villager at exactly the same scale and ground baseline local y=450 in every cell, centered x=192. Each full figure roughly 290px tall, enough margin for tools. Grid cells completely independent, nothing crosses boundaries.
Top row left to right: standing idle, walking left leg forward, walking legs passing, walking right leg forward.
Bottom row left to right: holding a wood-handled hammer lifted high ready to strike, hammer lowered to waist strike pose, carrying a small bundle of cut timber, carrying a wicker basket.
No tree stumps, no environments, no terrain, no ground platform, no labels, no text, no grid lines, no watermark. Real alpha transparency surrounding every figure with only subtle contact shadow at feet. Production sprites, small-scale readable silhouettes and consistent character design across frames.
```

### Villager transparency refinement

```text
Use case: background-extraction
Asset type: production 4-column 2-row villager sprite atlas.
Edit target: the villager sprite sheet just generated.
Remove ALL brown and black background and the brown halos between and around the eight figures. Output genuine RGBA alpha transparency with clean cutout edges. Keep all eight figures, the same exact poses, clothes, tools, positions, scale, cell layout, canvas dimensions, and realistic rendering unchanged. Do not draw a checkerboard. Do not add any ground or shadow behind them. Absolutely transparent pixels between figures, including gaps between legs and arms.
```

### Terrain

```text
Use case: stylized-concept
Asset type: seamless ground texture for a medieval 2D isometric RTS map, AgentEmpires.
Primary request: classic Age of Empires II style realistic painted grass terrain. Square 1024x1024 overhead orthographic texture covering the whole canvas edge to edge. Fine mottled olive and warm meadow-green grass, tiny ochre dry patches and sparse tiny pebbles. Gentle variations in short grass, earthy slightly desaturated colors. Fine texture visible at small sizes. No large objects, no shrubs, no trees, no flowers, no path, no buildings, no shadows, no perspective horizon, no grid, no hexagon, no text. Even diffuse daylight. Seamless tileable appearance on all edges. Opaque texture, no transparency.
```

