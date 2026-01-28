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

### Build for Production

```bash
npm run build -- --configuration production
```

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

## Related Repos

- **OutfitifyAPI**: Backend API (port 5042)
- **OutfitifyAdminFront**: Admin panel (port 4201)
- **OutfitifyStoreFront**: Brand storefront (port 4202)
- **LookBook**: Consumer outfit catalog (port 4200)
