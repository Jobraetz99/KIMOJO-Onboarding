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
// tokenUrl  → Direct-Line-Token-Endpunkt des Agenten. Damit läuft der Chat in
//             einem eigenen Canvas, der den MSAL-Token der App per SSO
//             weiterreicht – der Mitarbeiter muss sich also nicht nochmal
//             anmelden. Voraussetzung: im Agenten "Einmaliges Anmelden" aktiv
//             und die App-Client-ID als autorisierte Clientanwendung in der
//             App-Registrierung des Agenten hinterlegt.
//             Aufbau: https://{env-host}/powervirtualagents/botsbyschema/{schema}/directline/token
//             Den env-host liefert Copilot Studio → Kanäle → Web-App →
//             "Verbindungszeichenfolge".
// ssoScope  → Scope der App-Registrierung des Agenten, für den die App still
//             einen Token holt (api://{client-id}/{scope}).
// embedUrl  → Fallback ohne SSO: der fertige Copilot-Studio-iframe. Wird nur
//             benutzt, wenn tokenUrl leer ist oder der SSO-Chat scheitert.
// teamsUrl  → Letzter Fallback: öffnet den Agenten in Teams (neuer Tab).
// Alle leer = Kachel wird ausgeblendet.
export const PROZESSHELFER = {
  kimojo: {
    label:    'KIMOJO Prozesshelfer',
    tokenUrl: 'https://be8da6d2efc9e5849d0ac7a9ba5544.48.environment.api.powerplatform.com/powervirtualagents/botsbyschema/cr161_KIMOJOProzesshelfer/directline/token?api-version=2022-03-01-preview',
    // Vorübergehend leer: die stille Weitergabe wurde offenbar von Copilot
    // Studio verworfen, ohne dass es auffiel – der Agent antwortete dann ohne
    // SharePoint-Zugriff. Leer heisst: Anmeldekarte im Chat anklicken.
    // Wieder auf 'api://e0c892aa-a475-481d-921c-32f4c068bf32/copilot.studio.scope'
    // setzen, sobald die Ursache gefunden ist.
    ssoScope: '',
    embedUrl: 'https://copilotstudio.microsoft.com/environments/be8da6d2-efc9-e584-9d0a-c7a9ba554448/bots/cr161_KIMOJOProzesshelfer/webchat?__version__=2',
    teamsUrl: 'https://teams.microsoft.com/l/app/?titleId=T_b062d7dc-312d-2127-97d6-78082d204ca6',
  },
  phfip: {
    label:    'PfFiP Prozesshelfer',
    tokenUrl: '',
    ssoScope: '',
    embedUrl: '',
    teamsUrl: 'https://teams.microsoft.com/l/app/?titleId=T_4e43d23d-e77f-d463-04eb-a2b77755c01a',
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
