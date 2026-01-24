export const environment = {
  production: true,
  // Set this to the OutfitifyAPI base URL (e.g. https://your-api-host)
  //apiBaseUrl: 'https://outfitifyapi.azurewebsites.net',
  //apiBaseUrl: 'https://localhost:44383',
  apiBaseUrl: 'http://localhost:5042/',
  /**
   * Bearer token used for OutfitifyAPI requests. Replace with a real token in deployment.
   */
  apiAccessToken: '',
  /**
   * Optional Azure Functions key used by OutfitifyAPI. Leave blank if not required.
   */
  apiFunctionsKey: ''
};
