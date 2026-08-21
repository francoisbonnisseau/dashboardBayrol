window.initCustomWebchat({
  clientId: "a8557c16-495c-460f-9c15-0b9b565b96cf",
  configuration: {
    // Affichage natif dans la WebView de l'application
    displayMode: "fullpage",
    fullpageMaxContentWidth: 760,
    fullpageConversationMaxWidth: 1280,
    fullpageIncomingMessageMaxWidth: 840,
    fullpageOutgoingMessageMaxWidth: 560,

    // Identidad BAYROL
    botName: "Asistente Digital BAYROL",
    botAvatar: "https://files.bpcontent.cloud/2025/05/22/08/20250522085831-DG5V39VT.png",
    botDescription: "Este asistente utiliza IA y puede cometer errores. Al utilizarlo, acepta nuestra política de privacidad.",
    headerAvatarLink: "https://www.bayrol.es",

    // Pantalla de inicio
    welcomeLogo: "https://files.bpcontent.cloud/2025/05/22/08/20250522085831-DG5V39VT.png",
    welcomeHeading: "¿Cómo puedo ayudarle hoy?",
    welcomeDescription: "Este asistente utiliza IA y puede cometer errores. Al utilizarlo, acepta nuestra [política de privacidad](https://www.bayrol.es/datos-privados).",
    welcomeInfoUrl: "https://www.bayrol.es/datos-privados",
    conversationStarters: [
      {
        id: "chloration-choc",
        title: "¿Cómo realizo una cloración de choque?",
        icon: "message-circle"
      },
      {
        id: "tac-debut-saison",
        title: "¿Es necesario ajustar la alcalinidad (TAC) al comienzo de la temporada?",
        icon: "message-circle"
      },
      {
        id: "installer-automatic",
        title: "¿Cómo instalo la aplicación Automatic?",
        icon: "message-circle"
      }
    ],

    // Campo de entrada
    composerPlaceholder: "¿Qué está buscando …?",
    allowFileUpload: true,
    disableSendButton: true,
    autoScrollToNewMessage: true,
    themeToggleEnabled: true,
    cameraCaptureEnabled: true,
    voiceInputEnabled: false,
    emojiPickerEnabled: false,

    // Tema
    color: "#57929f",
    variant: "soft",
    headerVariant: "solid",
    themeMode: "light",
    persistThemeMode: true,
    fontFamily: "Roboto Condensed",
    radius: 1,

    // Navegación del encabezado
    fullscreenRedirectUrl: "https://www.bayrol.es/assistant",
    fullscreenRedirectTarget: "_blank",
    mobileCloseRedirectUrl: "https://www.bayrol.es",

    // Actividad de las herramientas: el historial permanece visible hasta el siguiente mensaje del usuario
    defaultThinkingMessage: "Pensando...",
    toolActivityIcons: {
      searchKnowledge: {
        icon: "book-open",
        matchMessages: ["Estoy consultando la informacion de BAYROL", "base de conocimientos"]
      },
      analyzeDocument: {
        icon: "image",
        matchMessages: ["Estoy analizando su documento", "analiza la imagen"]
      },
      webSearch: {
        icon: "globe",
        matchMessages: ["Inicio una busqueda web"]
      },
      findResellers: {
        icon: "map",
        matchMessages: ["Estoy buscando distribuidores cerca de usted"]
      },
      calculatePoolVolume: {
        icon: "calculator",
        matchMessages: ["Calculo el volumen de su piscina"]
      },
      sendEmail: {
        icon: "mail",
        matchMessages: ["Estoy reenviando su solicitud"]
      }
    },

    feedbackEnabled: true,
    soundEnabled: true,
    footer: "",
    sourcesHeading: "Para saber más:",

    labels: {
      fullscreen: "Abrir el asistente en pantalla completa",
      soundOn: "Activar el sonido",
      soundOff: "Desactivar el sonido",
      newConversation: "Nueva conversación",
      close: "Cerrar el chat",
      confirmNewConversationTitle: "¿Iniciar una nueva conversación?",
      confirmNewConversationDescription: "La conversación actual estará disponible hasta que se vuelva a cargar la página.",
      confirm: "Nueva conversación",
      cancel: "Cancelar",
      feedbackTitle: "Ayúdenos a mejorar",
      feedbackPlaceholder: "Díganos qué no ha funcionado…",
      feedbackConfirm: "Enviar comentarios",
      feedbackCancel: "Cancelar",
      feedbackPositive: "Respuesta útil",
      feedbackNegative: "Respuesta que se puede mejorar",
      camera: "Hacer una foto",
      microphoneStart: "Grabar un mensaje de voz",
      microphoneStop: "Detener la grabación",
      themeLight: "Activar el tema claro",
      themeDark: "Activar el tema oscuro"
    },

    // Mensaje proactivo
    proactiveMessageEnabled: false,
    proactiveBubbleMessage: "¡Hola! ¿En qué puedo ayudarte?",
    proactiveBubbleTriggerType: "afterDelay",
    proactiveBubbleDelayTime: 5,

    // Botón flotante
    fabImage: "https://files.bpcontent.cloud/2025/05/27/14/20250527142606-PXAKY6YR.png"
  }
})
