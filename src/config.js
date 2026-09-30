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

// ─── Prozesshelfer (Copilot Studio Agents) ───────────────────────────────────
// Auswahl erfolgt nach E-Mail-Domain (siehe detectLocation in graphService).
//
// tokenUrl  → Direct-Line-Token-Endpunkt des Agenten für den eigenen Chat-Canvas.
// ssoScope  → Scope der App-Registrierung des Agenten (api://{client-id}/{scope}).
// embedUrl  → Fallback ohne SSO: der fertige Copilot-Studio-iframe.
// openUrl   → Agent in einem neuen Tab öffnen.
// Alle leer = Kachel wird ausgeblendet.
//
// tokenUrl und embedUrl sind für KIMOJO bewusst leer (Stand 30.09.2026): der
// eingebettete Chat verbindet und antwortet zwar, findet aber keine
// SharePoint-Inhalte – die Suche kommt leer zurück und der Agent erfindet die
// Antwort. Durchgeprüft und ausgeschlossen: Graph-Berechtigungen samt
// Administratorzustimmung, Bereiche, Verbundanmeldeinformationen, Token-
// Austausch-URL, Veröffentlichung, Indizierung der Quellen. Über den
// M365-Copilot-Kanal liefert derselbe Agent korrekte Antworten mit Quellen,
// deshalb vorerst openUrl. Die alten Werte stehen in der Git-Historie.
export const PROZESSHELFER = {
  kimojo: {
    label:    'KIMOJO Prozesshelfer',
    tokenUrl: '',
    ssoScope: '',
    embedUrl: '',
    openUrl:  'https://m365.cloud.microsoft/chat/resolve/T_67c2dc96-5f98-66cf-8cb1-41168c6db444',
  },
  phfip: {
    label:    'PfFiP Prozesshelfer',
    tokenUrl: '',
    ssoScope: '',
    embedUrl: '',
    openUrl:  'https://teams.microsoft.com/l/app/?titleId=T_4e43d23d-e77f-d463-04eb-a2b77755c01a',
  },
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
