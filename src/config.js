// ─── Azure / MSAL ────────────────────────────────────────────────────────────
export const AZURE_CONFIG = {
  clientId:    import.meta.env.VITE_AZURE_CLIENT_ID  ?? 'c30faa1a-4045-4931-9dfd-6b8f012bde1d',
  tenantId:    import.meta.env.VITE_AZURE_TENANT_ID  ?? '3e5c8d47-8ccc-42f6-877d-0d0e72972e39',
  redirectUri: window.location.origin,
}

// ─── Microsoft Graph / SharePoint ────────────────────────────────────────────
export const GRAPH_CONFIG = {
  scopes: [
    'User.Read',
    'Sites.ReadWrite.All',
    'Files.Read.All',
    'offline_access',
  ],
  // SharePoint site is resolved dynamically on first load via hostname + path
  sharePointHostname: import.meta.env.VITE_SHAREPOINT_HOSTNAME ?? 'kimojophysiotherapie.sharepoint.com',
  sharePointSitePath: import.meta.env.VITE_SHAREPOINT_SITE_PATH ?? '/sites/MitarbeiterOnboardingSeite',
  // List name (decoded): "Checkliste  Praktikanten"  (double space intentional)
  checklistListName:  decodeURIComponent(
    import.meta.env.VITE_CHECKLIST_LIST_NAME ?? 'Checkliste%20%20Onboarding'
  ),
}

// ─── SharePoint column internal names ────────────────────────────────────────
// Verify these in: SharePoint → List Settings → each column → "Column name" (internal name in URL)
export const SP_COLUMNS = {
  title:           'Title',          // Aufgabe (usually mapped to Title)
  aufgabe:         'Aufgabe',        // Task title (if separate from Title)
  mitarbeiter:     'Mitarbeiter',    // Person field – filter by this
  faelligkeit:     'F_x00e4_lligkeit', // "Fälligkeit" – SharePoint encodes umlauts
  verantwortlich:  'Verantwortlich', // Person or text field
  status:          'Status',         // Choice: Offen | Erledigt
  relevantLink:    'Relevanter_x0020_Link', // Hyperlink field ("Relevanter Link")
}

// Status-Werte exakt wie in SharePoint definiert
export const SP_STATUS = {
  offen:    'Offen',
  erledigt: 'Erledigt',
}

// ─── Claude / KI-Assistent ───────────────────────────────────────────────────
export const AI_CONFIG = {
  // OPTION A: Direkte Claude-API (nur für Entwicklung / interne Apps)
  //   → API-Key in VITE_CLAUDE_API_KEY (nie in Git committen)
  // OPTION B: Backend-Proxy (empfohlen für Produktion)
  //   → Proxy-URL in VITE_CLAUDE_PROXY_URL eintragen
  apiKey:    import.meta.env.VITE_CLAUDE_API_KEY  ?? '',
  proxyUrl:  import.meta.env.VITE_CLAUDE_PROXY_URL ?? '/api/claude',
  model: 'claude-sonnet-4-5',
}
