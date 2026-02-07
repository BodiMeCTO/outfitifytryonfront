# outfitifytryonfront (TryOn)

Direct-to-consumer virtual try-on application.

## Tech Stack

- **Angular 19**
- **Angular Material** for UI components
- **TypeScript**

## Port

| Environment | URL |
|-------------|-----|
| Development | http://localhost:4203 |
| Production | https://tryon.outfitify.ai |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (port 4203)
npm start -- --port 4203

# Build for production
npm run build -- --configuration production

# Run tests
npm test
```

**Note**: Use `npm start` instead of `ng serve` - the Angular CLI is not in PATH on this machine.

## Key Features

- **Virtual Try-On**: Upload photos, select garments, generate outfits
- **Template Toggles**: Show/hide pre-loaded model and garment templates
- **User Accounts**: Email/password registration
- **Credits System**: Pay-per-generation via Stripe
- **AI Disclaimer**: All generated images include AI content disclosure
- **Watermark Download**: Download images with "AI-Generated Content" watermark

## Use Cases

- Try on clothes before purchasing online
- Vinted/resale sellers creating better product images
- Personal outfit planning

## Key Directories

```
src/app/
├── components/
│   ├── studio/           # Main try-on interface
│   ├── outfit-gallery/   # User's generated outfits
│   ├── image-review/     # View single outfit detail (with watermark download)
│   ├── billing/          # Credit purchase (Stripe)
│   └── shared/
│       └── ai-disclaimer/  # AI content disclosure
├── services/
│   ├── outfit.service.ts   # Outfit generation & polling
│   └── auth.service.ts     # User authentication
└── environments/
```

## Template Visibility Toggles

Both models and garments have toggle buttons to show/hide pre-loaded templates:

- **Model templates**: `studio.showTemplates` in localStorage
- **Garment templates**: `studio.showTemplateGarments` in localStorage
- Defaults to `true` (visible) on first visit
- Template items have `isTemplate: true` flag from API

## Environment Configuration

This is the **PRODUCTION** server.

### API URL Configuration

File: `src/environments/environment.ts`

```typescript
export const environment = {
  production: true,

  // ============================================================
  // API URL CONFIGURATION
  // ============================================================
  // PRODUCTION (default on this server):
  apiBaseUrl: 'https://api.outfitify.ai/',
  // For LOCAL development, comment out production and uncomment localhost:
  // apiBaseUrl: 'http://localhost:5042/',

  apiAccessToken: '',
  apiFunctionsKey: ''
};
```

### Deploy to Production

```bash
# Build and deploy directly to IIS folder (C:\WebSites\tryon.outfitify.ai)
npm run build
```

The build output is configured in `angular.json` to deploy directly to the IIS website folder.

### To Switch to Local Development (if needed)

1. Open `src/environments/environment.ts`
2. Comment out the production line
3. Uncomment the localhost line:

```typescript
// apiBaseUrl: 'https://api.outfitify.ai/',
apiBaseUrl: 'http://localhost:5042/',
```

## Stripe Billing URLs

The API has these URLs configured for TryOn billing redirects:
- Success: `https://tryon.outfitify.ai/billing/success`
- Cancel: `https://tryon.outfitify.ai/billing/cancel`
- Portal: `https://tryon.outfitify.ai/billing`

## Legacy Files

- `src/environments/environment.development.ts` - Old config file pointing to port 44383 (unused)

## Difference from LookBook

| Feature | TryOn | LookBook |
|---------|-------|----------|
| Template toggles | Yes | No |
| Collections | No | Yes |
| Public sharing | No | Yes |
| Watermark download | Yes | No |

## Authentication

- Uses Bearer token authentication
- Email/password signup and login
- Token stored in localStorage (24h expiry)
- HTTP interceptor attaches token to API requests

## Typography System

The app uses a strict 3-role typography system based on Inter font. Use the mixins from `_tokens.scss` instead of hardcoding font values.

### Typography Roles

| Role | Mixin | Usage | Style |
|------|-------|-------|-------|
| Section Headers | `@include type-section-header` | "Your Outfit", "Upload Photos" | Medium 500, sentence case, 16-18px |
| UI Labels | `@include type-ui-label` | Buttons, tabs, badges, chips | Medium 500, UPPERCASE, 12px, +5% letter-spacing |
| Body Text | `@include type-body` | Instructions, descriptions | Regular 400, sentence case, 14px |

### Available Mixins

```scss
@use '../../../styles/tokens' as *;

// Section headers
@include type-section-header;    // 16px, scales to 18px on desktop
@include type-section-header-lg; // 18px, scales to 20px on desktop

// UI labels (clickable elements)
@include type-ui-label;          // 12px uppercase
@include type-ui-label-lg;       // 14px uppercase

// Body text
@include type-body;              // 14px
@include type-body-sm;           // 12px (captions, hints)
@include type-body-lg;           // 16px
```

### Key Principle

> If it's clickable or functional → use `type-ui-label`. No exceptions.

This removes role confusion and creates visual consistency across the app.

## Button System

Use the consolidated button mixins from `_tokens.scss` instead of custom button styles per component.

### Button Mixins

```scss
@use '../../../styles/tokens' as *;

// Pre-composed styles (use these for most cases):
@include btn-icon-ghost;      // Icon-only, subtle (archive, info buttons)
@include btn-icon-outline;    // Icon-only, gold border
@include btn-action-outline;  // Icon+text, gold border (most action buttons)
@include btn-action-filled;   // Icon+text, gold background (primary CTAs)
@include btn-action-subtle;   // Icon+text, light gold background
@include btn-navigation;      // Circular prev/next buttons
@include btn-tab;             // Category tabs/chips

// Or compose your own:
.my-button {
  @include btn-base;          // Always include first
  @include btn-icon-text;     // Type: icon, icon-text, text, nav
  @include btn-outline;       // Variant: ghost, outline, filled, subtle
  @include btn-size-md;       // Size: sm, md, lg
}
```

### Button Variants

| Variant | Use Case | Appearance |
|---------|----------|------------|
| `ghost` | Tertiary actions (archive, clear) | Subtle border, muted text |
| `outline` | Secondary actions (share, download) | Gold border, gold text |
| `filled` | Primary CTAs (Generate, Create) | Gold background |
| `subtle` | Soft emphasis | Light gold background |

## Related Repos

- **OutfitifyAPI**: Backend API (port 5042)
- **OutfitifyAdminFront**: Admin panel (port 4201)
- **OutfitifyStoreFront**: Brand storefront (port 4202)
- **LookBook**: Consumer outfit catalog (port 4200)
