// Configuration complète du webchat custom - VERSION ESPAGNOL (ES)
window.initCustomWebchat({
    clientId: "a8557c16-495c-460f-9c15-0b9b565b96cf",
    configuration: {
        // === Identité du bot ===
        botName: "Asistente Digital BAYROL",
        botAvatar: "https://files.bpcontent.cloud/2025/05/22/08/20250522085831-DG5V39VT.png",
        botDescription: "¿Tienes preguntas sobre el mantenimiento de tu piscina o sobre los productos BAYROL? Estoy aquí para ayudarte. Si lo deseas, también puedo enviar tu consulta a nuestro servicio de atención al cliente para una ayuda más personalizada.",

        // === Composer (zone de saisie) ===
        composerPlaceholder: "¡Hola! ¿En qué puedo ayudarte?",
        allowFileUpload: true,

        // === Thème ===
        color: "#009aa6",
        variant: "soft",
        headerVariant: "glass",
        themeMode: "light",
        fontFamily: "Roboto Condensed",
        radius: 1,

        // === Footer ===
        footer: "",
        // === Liens dans le header ===
        website: {},
        email: {},
        phone: {},
        termsOfService: {},
        privacyPolicy: {},

        // === Fonctionnalités ===
        feedbackEnabled: true,
        soundEnabled: false,

        // === Message de réflexion par défaut ===
        defaultThinkingMessage: "Pensando...",

        // === Navigation header (optionnel) ===
        headerAvatarLink: "https://www.bayrol.es",
        mobileCloseRedirectUrl: "https://www.bayrol.es",

        // === Message proactif (bulle automatique) ===
        proactiveMessageEnabled: false,
        proactiveBubbleMessage: "¡Hola! 👋 ¿En qué puedo ayudarte?",
        proactiveBubbleTriggerType: "afterDelay",
        proactiveBubbleDelayTime: 5,

        // === Bouton flottant (FAB) ===
        fabImage: "https://files.bpcontent.cloud/2025/05/27/14/20250527142606-PXAKY6YR.png",

        // === Stylesheet personnalisée ===
        additionalStylesheetUrl: "https://files.bpcontent.cloud/2025/05/22/08/20250522085818-PQGM1TKG.css"
    }
});

