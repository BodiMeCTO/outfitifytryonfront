export const environment = {
  production: false,

  // ============================================================
  // API URL CONFIGURATION
  // ============================================================
  // For LOCAL development, use localhost:
  apiBaseUrl: 'http://localhost:5042/',
  // For PRODUCTION, uncomment the line below and comment out localhost:
  // apiBaseUrl: 'https://api.outfitify.ai/',

  /**
   * Bearer token used for OutfitifyAPI requests. Replace with a real token in deployment.
   */
  apiAccessToken: '',
  /**
   * Optional Azure Functions key used by OutfitifyAPI. Leave blank if not required.
   */
  apiFunctionsKey: ''
};
