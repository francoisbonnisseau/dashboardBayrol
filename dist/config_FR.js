window.initCustomWebchat({
  clientId: "9f8071db-dd35-4cef-beb9-25610968c22b",
  configuration: {
    // Identité BAYROL
    botName: "Assistant digital Bayrol",
    botAvatar: "https://files.bpcontent.cloud/2025/07/03/08/20250703081111-XRZRAKW4.png",
    botDescription: "Cet assistant utilise l’IA et peut se tromper. En l’utilisant, vous acceptez nos conditions d’utilisation.",
    headerAvatarLink: "https://www.bayrol.fr",

    // Écran d’accueil
    welcomeLogo: "https://files.bpcontent.cloud/2025/07/03/08/20250703081111-XRZRAKW4.png",
    welcomeHeading: "Comment puis-je vous aider aujourd’hui ?",
    welcomeDescription: "Cet assistant utilise l’IA et peut se tromper. En l’utilisant, vous acceptez nos [conditions d’utilisation](https://www.bayrol.fr/politique-de-confidentialite).",
    welcomeInfoUrl: "https://www.bayrol.fr/politique-de-confidentialite",
    conversationStarters: [
      {
        id: "chloration-choc",
        title: "Comment faire une chloration choc",
        icon: "message-circle"
      },
      {
        id: "tac-debut-saison",
        title: "Est-ce qu’il faut ajuster le TAC en début de saison",
        icon: "message-circle"
      },
      {
        id: "installer-automatic",
        title: "Comment installer l’application de l’automatic",
        icon: "message-circle"
      }
    ],

    // Composer
    composerPlaceholder: "Que cherchez-vous ...",
    allowFileUpload: true,
    // Bloque un nouvel envoi uniquement tant que Botpress n'a pas encore répondu.
    disableSendButton: true,
    // Place le haut de chaque nouveau message au début de la zone de lecture.
    autoScrollToNewMessage: true,
    themeToggleEnabled: true,
    cameraCaptureEnabled: true,
    voiceInputEnabled: true,
    emojiPickerEnabled: false,

    // Thème : passer à "dark" pour la variante sombre Figma
    color: "#57929f",
    variant: "soft",
    headerVariant: "solid",
    themeMode: "light",
    persistThemeMode: true,
    fontFamily: "Roboto Condensed",
    radius: 1,

    // Navigation du header
    fullscreenRedirectUrl: "https://www.bayrol.fr/assistant",
    fullscreenRedirectTarget: "_blank",
    mobileCloseRedirectUrl: "https://www.bayrol.fr",

    // Activité des outils : l’historique reste visible jusqu’au prochain message utilisateur
    defaultThinkingMessage: "Réflexion...",
    toolActivityIcons: {
      searchKnowledge: {
        icon: "book-open",
        matchMessages: ["consulte les informations BAYROL", "base de connaissance"]
      },
      analyzeDocument: {
        icon: "image",
        matchMessages: ["analyse votre document", "analyse de l’image"]
      },
      webSearch: {
        icon: "globe",
        matchMessages: ["recherche web"]
      },
      findResellers: {
        icon: "map",
        matchMessages: ["cherche des revendeurs"]
      },
      calculatePoolVolume: {
        icon: "calculator",
        matchMessages: ["calcule le volume"]
      },
      sendEmail: {
        icon: "mail",
        matchMessages: ["transfère votre demande"]
      }
    },

    feedbackEnabled: true,
    soundEnabled: true,
    footer: "",
    sourcesHeading: "Pour aller plus loin :",

    labels: {
      fullscreen: "Ouvrir l’assistant en plein écran",
      soundOn: "Activer le son",
      soundOff: "Désactiver le son",
      newConversation: "Nouvelle conversation",
      close: "Fermer le chat",
      confirmNewConversationTitle: "Commencer une nouvelle conversation ?",
      confirmNewConversationDescription: "La conversation actuelle restera disponible jusqu’au rechargement de la page.",
      confirm: "Nouvelle conversation",
      cancel: "Annuler",
      feedbackTitle: "Aidez-nous à nous améliorer",
      feedbackPlaceholder: "Dites-nous ce qui n’a pas fonctionné…",
      feedbackConfirm: "Envoyer le feedback",
      feedbackCancel: "Annuler",
      feedbackPositive: "Réponse utile",
      feedbackNegative: "Réponse à améliorer",
      camera: "Prendre une photo",
      microphoneStart: "Enregistrer un message vocal",
      microphoneStop: "Arrêter l’enregistrement",
      themeLight: "Activer le thème clair",
      themeDark: "Activer le thème sombre"
    },

    // Message proactif
    proactiveMessageEnabled: false,
    proactiveBubbleMessage: "Bonjour ! Comment puis-je vous aider ?",
    proactiveBubbleTriggerType: "afterDelay",
    proactiveBubbleDelayTime: 5,

    // Bouton flottant
    fabImage: "https://www.bayrol.fr/sites/bayrol/files/2025-07/Assistant-Bubble.png"
  }
})
