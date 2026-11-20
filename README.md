# ANADynamics: Automation, Robotics & Bio-CNG Website

A multi-page website for ANADynamics, built with HTML5, CSS3 and vanilla JavaScript plus Three.js for real-time 3D. No build step.

## Pages

| Page | File | Highlights |
|------|------|-----------|
| Products | `products.html` | 7 product lines in detail (what you get, best for, enquiry), product finder, advantages and comparison |
| Home | `index.html` | 3D copper logo hero, both divisions, Bio-CNG teaser, 5-step process, why us |
| Automation & Robotics | `automation.html` | Services + pop-ups, industries, **live 3D robot cell**, process, expertise, solutions, Bio-CNG automation |
| Bio-CNG · Business Opportunity | `bio-cng.html` | Key figures, **interactive 3D Bio-CNG plant** with hotspots and gas flow, why invest, revenue, who it's for, support, project journey, brochure |
| Bio-CNG · How It Works | `how-it-works.html` | **Guided 3D tour** (9 steps, camera fly-to), 7 detailed stages, raw biogas vs Bio-CNG table, upgrading technologies, plant monitoring |
| Bio-CNG · Feedstock & Estimator | `feedstock.html` | 5 feedstock types, planning checklist, **editable output estimator** |
| Bio-CNG · Government Support | `subsidies.html` | SATAT, MNRE CFA, GOBARdhan, CBG blending obligation, FOM assistance, state incentives, approvals checklist |
| CNG Guide | `cng.html` | What CNG and Bio-CNG are, comparison tables, applications, safety, policy |
| About | `about.html` | Story, commitments, founder, education, location map |
| FAQ | `faq.html` | 14 questions with category filter |
| Contact | `contact.html` | Phones, email, address, map, enquiry form with Bio-CNG fields (land, feedstock, quantity) |
| 404 | `404.html` | Not-found page |

## 3D scenes (real-time, Three.js r147)

- `js/scene.js`: 3D copper logo (home) and robot cell (automation).
- `js/plant.js`: Bio-CNG plant. Golden-hour sky with physical sun, image-based lighting, soft shadows and procedural textures (grass, concrete, gravel, painted ribbed steel, corrugated container, straw, manure). It includes:
  - feedstock shed, shredder and mixing tank
  - two digesters with double-membrane roofs, handrails and caged ladders
  - gas holder, H₂S scrubber and stainless upgrading columns
  - "BIO-CNG PLANT" container, CBG compressor and cylinder cascade
  - dispenser canopy and tube-trailer truck
  - digestate separator, manure heap and liquid-manure tank
  - safety flare with a live flame, and a control room with the ANADynamics sign
  - yellow gas pipework on racks, and instanced trees

  Animated particles show slurry, raw biogas and Bio-CNG flowing. Numbered hotspots open info cards; tour buttons fly the camera to each unit.
- Scenes pause when off-screen or when the tab is hidden. If WebGL or the CDN is unavailable, the plant falls back to the photo and the logo falls back to the flat image.

## Before going live: please check

1. **Email address.** The site uses `anadynamics1@gmail.com`. Your brochure shows `ANADynamics@gmail.com`, which is a different inbox. Pick one and search-and-replace it in all `.html` files and in `js/site.js` (`EMAIL`).
2. **Phones:** +91 76193 60105 (from the brochure) and +91 95915 57311. Remove one if it's not needed. Uncomment the WhatsApp link in `contact.html` if applicable.
3. **Office hours** (`contact.html`), founding year / milestones (`about.html`), service area (`faq.html`).
4. **Bio-CNG support scope** on `bio-cng.html` ("How ANADynamics Supports You"): keep only the services you actually provide.
5. **Government schemes** (`subsidies.html`, `cng.html`): schemes change. Re-verify every item on the official portals before publishing and add a "last reviewed" date.
6. Replace `https://www.anadynamics.com/` (canonical links, `sitemap.xml`, `robots.txt`) with your real domain.
7. Optional: add a Formspree URL to `data-endpoint` on the contact form for direct delivery (otherwise it opens the visitor's email app).

## Performance (fast first load)

- **No boot screen.** Pages show content immediately; hero text animates in with CSS alone.
- **3D on demand** (`js/lazy3d.js`). Pages first render with a still image: the logo on Home, the plant photo on the Bio-CNG pages and a styled panel for the robot cell. Three.js is downloaded only after the page has loaded and the browser is idle, and only when the 3D area is close to scrolling into view. Pages without 3D never load it.
  - On phones and tablets, Home keeps the still logo (no 3D download).
  - On devices with data saver turned on or low memory, the 3D areas show a **Load 3D view** button instead of downloading automatically.
- **Bio-CNG plant is click-to-launch.** The Bio-CNG pages open instantly with the plant photo and a green play button. The 3D model downloads and builds only after the visitor clicks it (or a tour step). While the browser is idle, the 3D engine is quietly pre-downloaded so the click is quick.
- **Lighter 3D.** The Bio-CNG plant is built in small steps so the page stays responsive. Its static parts are merged into a few dozen meshes (instead of hundreds), and shadow and pixel resolution are lower on small screens. Its sky is now a painted gradient instead of a sky shader. Shadows are drawn once (the plant doesn't move), and idle animation is capped at 30 fps.
- **Maps load on click** ("Show map"), so Google Maps no longer slows down About and Contact.
- Fewer font files, a WebP brochure, async image decoding, no blur effects on phones, and caching headers in `netlify.toml`.

## Story & products

- **Home** tells the story in this order: hero ("Smart automation. Clean energy. One team.") → **Our Story** (4 chapters + founder card and quote) → **Our Products** (flagship Bio-CNG card + 6 product cards) → **The ANADynamics Advantage** (6 reasons + comparison table) → Bio-CNG opportunity → how it works → commitments → call to action.
- **Products page** (`products.html`) has a sticky product menu, a detailed showcase for each product, a "Which product is right for you?" finder and the comparison.
- Product text lives in one place in each file. Search for the product name to edit it.
- TODO: personalise the story chapters and the founder quote (marked in the HTML), and confirm the scope listed under each product.
- The comparison is against "typical multi-vendor setups", not named companies, and avoids unprovable claims such as "best in India". This keeps it honest and in line with advertising rules (ASCI). Add real numbers (plants delivered, customers, years) as they become available. Proof beats superlatives.

## Works on every screen

`css/responsive.css` (loaded last on every page) adapts the site to:

- **Phones:** 280 px foldables up to large Android phones, in portrait and landscape. Tables turn into stacked cards, buttons wrap, and inputs use 16 px so iOS doesn't zoom. Tap targets are at least 44 px and there are no sticky hover effects.
- **Tablets:** iPad mini/Air/Pro in portrait and landscape. The hamburger menu is used up to 1100 px, and large portrait tablets get a stacked hero.
- **Laptops:** including short screens (1280×720, 1366×768), where 3D areas are kept inside the window.
- **Large desktops, ultra-wide and 4K:** text and layout scale up at 1600, 2200 and 3000 px.
- **Notches and home indicators** (`viewport-fit=cover` + safe-area insets), high-contrast and forced-colours modes, reduced motion, and **print**.
- **3D:** the camera pulls back automatically on narrow or portrait screens so the whole plant fits. It handles rotation and resizing, and falls back to the photo if a phone runs out of graphics memory. On phones and tablets the robot cell starts with a tap.

Tested in Chrome (headless) at 18 screen sizes from 280×653 to 3840×2160 on all 11 pages: no sideways scrolling, nothing off-screen, no clipped buttons, and no overlap between the hero logo and text. The mobile menu and dropdown were checked after scrolling at every phone/tablet size, with no JavaScript errors.

## Run locally

```bash
cd anadynamics
python -m http.server 8000   # open http://localhost:8000
```

## Deploy

Netlify: drag the folder onto https://app.netlify.com/drop (`netlify.toml` sets the 404 page). Vercel and GitHub Pages also work as-is.

## Customise

| What | Where |
|------|-------|
| Colours | `css/style.css` `:root` (copper) and `css/pages.css` `:root` (`--eco` green) |
| Estimator defaults | `feedstock.html` (quantities and yields per row; methane %, recovery, days) |
| Plant hotspots and tour text | `SPOTS` array in `js/plant.js` |
| Plant layout | Sections 1–9 in `js/plant.js` (positions in metres) |
| Sky / time of day | `elev` and `azim` in `js/plant.js` |
| Navigation and footer | Generated identically in every page (search for `site-header` / `footer`) |

## Images

`assets/images/biocng-plant.jpg` is cropped from your brochure and used as the Bio-CNG photo and 3D fallback. `assets/images/biocng-brochure.jpg` is the full brochure (downloadable). For maximum realism, replace these with real photographs of your sites when available, keeping the same file names.
