export const environment = {
  production: true,

  // ============================================================
  // API URL CONFIGURATION
  // ============================================================
  // PRODUCTION (default on this server):
  apiBaseUrl: 'https://api.outfitify.ai/',
  // For LOCAL development, comment out production and uncomment localhost:
  // apiBaseUrl: 'http://localhost:5042/',

  /**
   * Bearer token used for OutfitifyAPI requests. Replace with a real token in deployment.
   */
  apiAccessToken: '',
  /**
   * Optional Azure Functions key used by OutfitifyAPI. Leave blank if not required.
   */
  apiFunctionsKey: ''
};
