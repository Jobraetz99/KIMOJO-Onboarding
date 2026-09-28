import { useEffect, useMemo, useRef, useState } from 'react'
import ReactWebChat, { createDirectLine, createStore } from 'botframework-webchat'
import { RefreshCw } from 'lucide-react'
import { msalInstance } from '@/services/authConfig'

/**
 * Eigener Chat-Canvas für einen Copilot-Studio-Agenten.
 *
 * Statt den fertigen iframe zu laden, holt diese Komponente selbst ein
 * Direct-Line-Token und beantwortet die Anmeldekarte des Agenten still mit dem
 * Entra-Token, mit dem der Mitarbeiter ohnehin schon in der App angemeldet ist
 * (SSO). Klappt die stille Token-Ausgabe nicht, wird die Anmeldekarte ganz
 * normal angezeigt – der Chat funktioniert dann mit einem zusätzlichen Klick.
 */
export default function CopilotChat({ helper, user, onFailure }) {
  const [directLine, setDirectLine] = useState(null)
  const ssoTokenRef   = useRef(null)
  const directLineRef = useRef(null)

  const userId = useMemo(() => {
    const raw = user?.id || user?.mail || user?.userPrincipalName || ''
    // Direct Line akzeptiert nur [a-zA-Z0-9_], max. 64 Zeichen, Präfix "dl_"
    return `dl_${raw.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 64)
  }, [user])

  const userName = user?.displayName || 'Mitarbeiter'

  // Anmeldekarte des Agenten still mit dem App-Token beantworten
  const store = useMemo(
    () =>
      createStore({}, ({ dispatch }) => next => action => {
        // Copilot Studio antwortet erst, wenn der Canvas die Unterhaltung
        // ausdrücklich startet – der fertige iframe macht das intern.
        if (action.type === 'DIRECT_LINE/CONNECT_FULFILLED') {
          dispatch({
            type: 'WEB_CHAT/SEND_EVENT',
            payload: { name: 'startConversation', type: 'event', value: { text: 'hallo' } },
          })
        }

        if (action.type !== 'DIRECT_LINE/INCOMING_ACTIVITY') return next(action)

        const activity = action.payload?.activity
        const card = activity?.attachments?.find(
          a => a.contentType === 'application/vnd.microsoft.card.oauth'
        )
        const resource = card?.content?.tokenExchangeResource

        if (
          activity?.from?.role !== 'bot' ||
          !resource?.id ||
          !ssoTokenRef.current ||
          !directLineRef.current
        ) {
          return next(action)
        }

        directLineRef.current
          .postActivity({
            type:  'invoke',
            name:  'signin/tokenExchange',
            value: {
              id:             resource.id,
              connectionName: card.content.connectionName,
              token:          ssoTokenRef.current,
            },
            from: { id: userId, name: userName, role: 'user' },
          })
          .subscribe({
            // Tausch abgelehnt → Karte doch anzeigen, damit der Nutzer manuell kann
            error: () => next(action),
          })

        return // Karte verschlucken, solange der Tausch läuft
      }),
    [userId, userName]
  )

  useEffect(() => {
    let cancelled = false

    async function connect() {
      // 1. Entra-Token für den Agenten still besorgen (optional – nur für SSO)
      if (helper.ssoScope) {
        try {
          const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
          const result = await msalInstance.acquireTokenSilent({
            scopes: [helper.ssoScope],
            account,
          })
          ssoTokenRef.current = result.accessToken
        } catch {
          ssoTokenRef.current = null // kein SSO → Anmeldekarte im Chat
        }
      }

      // 2. Direct-Line-Token des Agenten holen
      const response = await fetch(helper.tokenUrl)
      if (!response.ok) throw new Error(`Token-Endpunkt antwortete ${response.status}`)
      const { token } = await response.json()
      if (!token) throw new Error('Kein Direct-Line-Token erhalten')

      if (cancelled) return
      const dl = createDirectLine({ token })
      directLineRef.current = dl
      setDirectLine(dl)
    }

    connect().catch(onFailure)

    return () => {
      cancelled = true
      directLineRef.current?.end?.()
    }
  }, [helper.tokenUrl, helper.ssoScope, onFailure])

  if (!directLine) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <RefreshCw size={20} className="text-ink-faint animate-spin" />
        <p className="text-ink-muted font-body text-sm">{helper.label} wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0">
      <ReactWebChat
        directLine={directLine}
        store={store}
        userID={userId}
        username={userName}
        locale="de-DE"
        styleOptions={STYLE_OPTIONS}
      />
    </div>
  )
}

const STYLE_OPTIONS = {
  backgroundColor:            'transparent',
  bubbleBackground:           '#F4F4F5',
  bubbleBorderRadius:         16,
  bubbleBorderWidth:          0,
  bubbleFromUserBackground:   '#18181B',
  bubbleFromUserTextColor:    '#FFFFFF',
  bubbleFromUserBorderRadius: 16,
  bubbleFromUserBorderWidth:  0,
  bubbleTextColor:            '#18181B',
  hideUploadButton:           true,
  sendBoxBorderTop:           'solid 1px #F0F0F0',
  sendBoxHeight:              52,
  rootHeight:                 '100%',
  rootWidth:                  '100%',
}
