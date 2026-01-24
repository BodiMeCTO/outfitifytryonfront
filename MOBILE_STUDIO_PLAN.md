# Mobile Studio Overhaul Plan

## Current State
- Vertical scrolling through all sections (Model, Pose, Background, Aspect Ratio, Garments)
- Fixed footer with icon summary + generate button
- User scrolls through everything linearly

## Proposed New Design

### Layout Structure (Top to Bottom)

```
+------------------------------------------+
|  SELECTED ITEMS BAR (sticky)             |
|  [model] [top] [bottom] [jacket]  ->     |
+------------------------------------------+
|                                          |
|                                          |
|     CONTENT AREA (scrollable)            |
|     2 items per row grid                 |
|                                          |
|                                          |
+------------------------------------------+
|  SECTION TABS                            |
|  [Model] [Pose] [BG] [Ratio] [Clothes]   |
+------------------------------------------+
|  GENERATE BUTTON                         |
|  [======= Generate Outfit =======]       |
+------------------------------------------+
```

### Why This Layout?
1. **Tabs at bottom** - Easier thumb reach on mobile
2. **Selected items at top** - Always visible, shows what you're building
3. **Generate at very bottom** - Natural primary action placement
4. **Content in middle** - Maximum scroll area for browsing options

---

## Section Details

### 1. Selected Items Bar (Sticky Top)
- Horizontal scrollable row of thumbnails
- Shows all selected items across all categories
- Each thumbnail has:
  - Small type indicator (Model/Top/Pose/etc)
  - Tap to remove (X overlay on tap)
- When empty: "Tap below to build your outfit"
- Collapses to smaller height when empty

### 2. Section Tabs (Bottom Navigation)
Five tabs with icons + short labels:

| Tab | Icon | Label |
|-----|------|-------|
| Model | person | Model |
| Pose | accessibility_new | Pose |
| Background | wallpaper | Scene |
| Aspect Ratio | aspect_ratio | Ratio |
| Garments | checkroom | Clothes |

- Active tab has gold highlight/underline
- Badge shows count of selections (e.g., "2" on Clothes tab)

### 3. Content Area (Per Section)

#### Model Section
- 2-column grid of model images
- Each card shows full image
- Selected models have gold border + checkmark
- "Upload" card at top or bottom
- Template toggle at top

#### Pose Section
- 2-column grid of pose options
- Each shows pose name
- "Original" option at top (keep current pose)
- Selected has gold border

#### Background Section
- Category pills at top (Studio, Urban, Nature, etc.)
- 2-column grid of presets within category
- "Original" option to keep existing
- Custom prompt input at bottom

#### Aspect Ratio Section
- Simple list or grid of options
- Visual preview of each ratio
- Original, 1:1, 2:3, 3:4, 9:16

#### Garments Section (Complex)
**Sub-navigation:**
```
[All] [Tops] [Bottoms] [Full] [Jackets] [Shoes] [Acc]
```

- "All" shows everything in one grid
- Category tabs filter to specific type
- Each shows badge with selection count
- 2-column grid of garments
- "Add Garment" card at top

---

## Interaction Flow

### Selecting an Item
1. User taps item in grid
2. Item gets gold border + checkmark
3. Thumbnail appears in Selected Items Bar at top
4. Subtle animation (slide in from bottom)

### Removing an Item
1. User taps thumbnail in Selected Items Bar
2. X overlay appears, confirm tap removes
3. Or: long-press to remove immediately
4. Item in grid loses selected state

### Switching Sections
1. Tap section tab at bottom
2. Content area transitions (fade or slide)
3. Previous scroll position remembered per section

### Generating
1. Generate button shows credit cost
2. Disabled until Model + Garment selected
3. Tap triggers generation
4. Navigates to gallery

---

## Technical Implementation

### New Components Needed
1. `MobileStudioComponent` or refactor existing with mobile-specific template
2. `MobileSectionTabs` - Bottom tab navigation
3. `MobileSelectedBar` - Top selection summary
4. `MobileContentGrid` - 2-column grid for each section

### State Management
- `activeSection: 'model' | 'pose' | 'background' | 'ratio' | 'garments'`
- `garmentSubCategory: 'all' | 'tops' | 'bottoms' | ...`
- Existing selection state from OutfitService remains unchanged

### CSS Approach
- Use `@include lg` breakpoint to show/hide
- Desktop: existing layout unchanged
- Mobile: new tab-based layout

### Template Structure
```html
<!-- Mobile Layout (hidden on desktop) -->
<div class="mobile-studio">
  <!-- Sticky selected items bar -->
  <div class="mobile-selected-bar">...</div>

  <!-- Content area with section views -->
  <div class="mobile-content">
    <div class="section-view" *ngIf="activeSection === 'model'">...</div>
    <div class="section-view" *ngIf="activeSection === 'pose'">...</div>
    <!-- etc -->
  </div>

  <!-- Bottom tabs -->
  <div class="mobile-section-tabs">...</div>

  <!-- Generate button -->
  <div class="mobile-generate">...</div>
</div>

<!-- Desktop Layout (hidden on mobile) -->
<div class="desktop-studio">
  <!-- Existing layout -->
</div>
```

---

## Garments Sub-Categories Detail

### Tab Bar Within Garments Section
```
+------------------------------------------+
| [All] [Tops(2)] [Bottoms(1)] [Full] ...  |
+------------------------------------------+
```

- Horizontal scrollable if needed
- Badge shows selection count per category
- "All" shows unified grid with category labels on items

### Grid View
- 2 columns
- Each card shows:
  - Garment image
  - Category badge (Top, Bottom, etc.)
  - Selected state (gold border + check)

---

## Edge Cases

### Empty States
- No models uploaded: Show upload prompt
- No garments: Show "Add your first garment"
- Category empty: "No [category] garments yet"

### Max Selection Limits
- Models: Max 5 (show warning when reached)
- Garments per category: Enforce existing limits
- Show limit indicator: "2/2 Tops selected"

### Tutorial Integration
- Tutorial highlights should work with new layout
- Step 1: Highlight Model tab + content
- Step 2: Highlight Garments tab + content

---

## Animation Suggestions

### Tab Switching
- Content fades out/in (150ms)
- Or slides left/right based on tab direction

### Selection
- Thumbnail slides up into Selected Bar
- Grid item pulses gold briefly

### Removal
- Thumbnail shrinks and fades out
- Grid item's check fades out

---

## Open Questions

1. Should "Upload" actions be floating buttons or inline cards?
2. Should we persist last active section between visits?
3. How prominent should the credit cost display be?
4. Should tapping a selected item in grid deselect (like desktop) or scroll to it in Selected Bar?
