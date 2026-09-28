import { PublicClientApplication } from '@azure/msal-browser'
import { AZURE_CONFIG, GRAPH_CONFIG } from '@/config'

export const msalConfig = {
  auth: {
    clientId:    AZURE_CONFIG.clientId,
    authority:   `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}`,
    redirectUri: AZURE_CONFIG.redirectUri,
  },
  cache: {
    cacheLocation:          'localStorage',
    storeAuthStateInCookie: false,
  },
}

export const loginRequest = {
  scopes: GRAPH_CONFIG.scopes,
}

// Single shared instance – used by both MsalProvider AND graphService
export const msalInstance = new PublicClientApplication(msalConfig)
