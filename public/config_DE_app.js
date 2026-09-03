window.initCustomWebchat({
  clientId: "c3f97ef2-d480-4998-9ad3-e76fa8b2f256",
  configuration: {
    // Affichage natif dans la WebView de l'application
    displayMode: "fullpage",
    fullpageMaxContentWidth: 760,
    fullpageConversationMaxWidth: 1280,
    fullpageIncomingMessageMaxWidth: 840,
    fullpageOutgoingMessageMaxWidth: 560,

    // BAYROL-Identität
    botName: "Digitaler Assistent BAYROL",
    botAvatar: "https://files.bpcontent.cloud/2025/07/01/07/20250701075253-KRYCA5NI.png",
    botDescription: "Dieser Assistent nutzt KI und kann Fehler machen. Mit seiner Nutzung akzeptieren Sie unsere Datenschutzerklärung.",
    headerAvatarLink: "https://www.bayrol.de",

    // Startbildschirm
    welcomeLogo: "https://files.bpcontent.cloud/2025/07/01/07/20250701075253-KRYCA5NI.png",
    welcomeHeading: "Wie kann ich Ihnen heute helfen?",
    welcomeDescription: "Dieser Assistent nutzt KI und kann Fehler machen. Mit seiner Nutzung akzeptieren Sie unsere [Datenschutzerklärung](https://www.bayrol.de/datenschutz).",
    welcomeInfoUrl: "https://www.bayrol.de/datenschutz",
    // BEGIN MANAGED CONVERSATION STARTERS
    conversationStarters: [
      {
        id: "chloration-choc",
        title: "Wie führe ich eine Stoßchlorung durch?",
        icon: "message-circle"
      },
      {
        id: "tac-debut-saison",
        title: "Muss der TAC-Wert zu Beginn der Saison angepasst werden?",
        icon: "message-circle"
      },
      {
        id: "installer-automatic",
        title: "Wie installiere ich die Automatic-App?",
        icon: "message-circle"
      }
    ],
    // END MANAGED CONVERSATION STARTERS

    // Eingabefeld
    composerPlaceholder: "Wonach suchen Sie …",
    allowFileUpload: true,
    disableSendButton: true,
    autoScrollToNewMessage: true,
    themeToggleEnabled: true,
    cameraCaptureEnabled: true,
    voiceInputEnabled: false,
    emojiPickerEnabled: false,

    // Theme
    color: "#57929f",
    variant: "soft",
    headerVariant: "solid",
    themeMode: "light",
    persistThemeMode: true,
    fontFamily: "Roboto Condensed",
    radius: 1,

    // Navigation im Header
    fullscreenRedirectUrl: "https://www.bayrol.de/assistant",
    fullscreenRedirectTarget: "_blank",

    // Ouverture des liens dans le navigateur externe de l’application
    externalLinkMode: 'system',

    // Tool-Aktivität: Der Verlauf bleibt bis zur nächsten Nachricht des Nutzers sichtbar
    defaultThinkingMessage: "Denken...",
    toolActivityIcons: {
      searchKnowledge: {
        icon: "book-open",
        matchMessages: ["ruft BAYROL-Informationen ab", "Ich suche nach Informationen"]
      },
      analyzeDocument: {
        icon: "image",
        matchMessages: ["Ich leite Ihre Anfrage weiter", "analysiert das Bild"]
      },
      webSearch: {
        icon: "globe",
        matchMessages: ["Ich starte eine Websuche"]
      },
      findResellers: {
        icon: "map",
        matchMessages: ["Ich suche Fachhaendler in Ihrer Naehe"]
      },
      calculatePoolVolume: {
        icon: "calculator",
        matchMessages: ["Ich berechne Ihr Poolvolumen"]
      },
      sendEmail: {
        icon: "mail",
        matchMessages: ["leitet Ihre Anfrage weiter"]
      }
    },

    feedbackEnabled: true,
    soundEnabled: true,
    footer: "",
    sourcesHeading: "Weitere Informationen:",

    labels: {
      fullscreen: "Assistenten im Vollbild öffnen",
      soundOn: "Ton einschalten",
      soundOff: "Ton ausschalten",
      newConversation: "Neue Unterhaltung",
      close: "Chat schließen",
      confirmNewConversationTitle: "Neue Unterhaltung beginnen?",
      confirmNewConversationDescription: "Die aktuelle Unterhaltung bleibt bis zum Neuladen der Seite verfügbar.",
      confirm: "Neue Unterhaltung",
      cancel: "Abbrechen",
      feedbackTitle: "Helfen Sie uns, besser zu werden",
      feedbackPlaceholder: "Sagen Sie uns, was nicht funktioniert hat …",
      feedbackConfirm: "Feedback senden",
      feedbackCancel: "Abbrechen",
      feedbackPositive: "Hilfreiche Antwort",
      feedbackNegative: "Antwort verbessern",
      camera: "Foto aufnehmen",
      microphoneStart: "Sprachnachricht aufnehmen",
      microphoneStop: "Aufnahme beenden",
      themeLight: "Helles Design aktivieren",
      themeDark: "Dunkles Design aktivieren"
    },

    // Proaktive Nachricht
    proactiveMessageEnabled: false,
    proactiveBubbleMessage: "Hallo! Wie kann ich Ihnen helfen?",
    proactiveBubbleTriggerType: "afterDelay",
    proactiveBubbleDelayTime: 5,

    // Schwebender Button
    fabImage: "https://files.bpcontent.cloud/2025/06/26/16/20250626165810-TMOVCUT3.png"
  }
})
