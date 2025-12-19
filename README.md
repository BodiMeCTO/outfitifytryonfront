# Uniform Try On

This repository contains a mobile-first Angular 18 proof-of-concept that demonstrates an outfit creation workflow
powered by Angular Material and the provided green design palette.

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the development server

   ```bash
   npm start
   ```

   The app will be served at [http://localhost:4200](http://localhost:4200).

3. Build for production

   ```bash
   npm run build
   ```

## API configuration

Before running the app, configure the OutfitifyAPI endpoint and credentials in `src/environments/environment*.ts`.
Set `apiBaseUrl` to a reachable OutfitifyAPI URL (for example, your deployed API or `http://localhost:7071/api` if running
locally). A default of `https://outfitifyapi.azurewebsites.net/api` is provided for convenience; replace this with your
own deployment URL if needed. The app will refuse to call the API when this value is missing so you see a clear configuration
error instead of DNS failures like `ERR_NAME_NOT_RESOLVED`.

OutfitifyAPI requests include authentication headers. Update both environment files under `src/environments/` with the
credentials provided for your deployment:

- `apiAccessToken` – bearer token applied to OutfitifyAPI calls.
- `apiFunctionsKey` – optional Azure Functions key if your backend requires it. The Angular interceptor mirrors typical
  Postman setups by attaching this value in both the `x-functions-key` header **and** a `code` query parameter so the
  browser experience matches your manual testing.

### OutfitifyAPI endpoints

Use the following OutfitifyAPI endpoints (relative to `apiBaseUrl`) to wire the frontend to backend functionality:

**Authentication**

- `POST /token` – password grant for access/refresh tokens.

**Catalogue (static choices for the outfit wizard)**

- `GET /api/models` – list available model options.
- `GET /api/poses` – list pose options.
- `GET /api/backgrounds` – list background options.

**Products**

- `GET /api/products` – list products.
- `GET /api/products/{productId}` – fetch a single product.
- `POST /api/products` – create a product.
- `PUT /api/products/{productId}` – update a product.
- `DELETE /api/products/{productId}` – delete a product.
- `GET /api/products/{productId}/images` – list product images.

**Outfit requests**

- `GET /api/outfits` – list outfit generation requests.
- `POST /api/outfits` – create a new outfit request with selected assets/options.
- `GET /api/outfits/{outfitRequestId}` – fetch a specific outfit request.

**Inventory (generated assets)**

- `GET /api/inventory` – list generated inventory items.
- `POST /api/inventory/{outfitRequestId}` – create an inventory item from a completed outfit request.

**Credits**

- `GET /api/credits/balance` – retrieve current credit balance.
- `GET /api/credits/ledger` – view credit transaction history.

**Subscriptions**

- `GET /api/subscriptions` – list subscription plans.
- `POST /api/subscriptions/activate` – activate a plan (supports annual flag and Shopify charge ID).

**Shopify billing hooks**

- `POST /api/shopify/usage` – record metered/usage-based charges (e.g., credit top-ups).
- `POST /api/shopify/billing-callback` – receive billing callbacks with charge status and plan info.

### How authentication tokens work

- **Grant type and endpoint:** Use the password grant flow on `POST /connect/token` (handled by `AuthorizationController.Exchange`).
- **Request payload:** Send an `application/x-www-form-urlencoded` body with `grant_type=password`, `client_id`, `client_secret`, `username`, `password`, and `scope` (for example, `openid profile outfitify_api`).
- **Client credentials:** A default confidential client exists with `client_id=outfitify-client` and `client_secret=outfitify-client-secret`, permitted for the token endpoint, password and refresh grants, and the `outfitify_api` scope.
- **Token contents and scopes:** Successful responses include subject, email, display name, and `client_id` claims and grant the `outfitify_api` API scope (plus OpenID profile scopes when requested).
- **Lifetimes and refresh:** Access tokens last 1 hour and refresh tokens last 30 days; both flows are enabled.
- **Using tokens:** Protected endpoints expect the `outfitify_api` scope; send `Authorization: Bearer <access_token>` headers on requests.
- **Automatic storage (Postman):** The Postman collection captures `access_token`, `refresh_token`, and `expires_in` into collection variables, making follow-up authenticated calls simple.

## Garment assets

Garment placeholders are located under `src/assets/garments` and are split into `tops/` and `bottoms/` sub-folders as
required. Replace the provided SVG placeholders with your own imagery to tailor the experience.

Generated outfit mock images live in `src/assets/generated`. These are currently static placeholders that the
application references when the stubbed outfit creation API is triggered.

## Feature overview

- **Select Inspiration** – choose an image from the device gallery.
- **Garment Library** – browse curated tops and bottoms bundled with the application.
- **Size & Submit** – pick a size and trigger the (stubbed) outfit creation request.
- **Generated Gallery** – view generated images and auto-refresh the list every 30 seconds.
- **Image Review** – open a generated image to navigate, share, and download it.

The `OutfitService` centralises all shared state and includes stubbed methods where backend integrations will be added in
future iterations.
