// Configuration complète du webchat custom - VERSION ALLEMAND (DE)
window.initCustomWebchat({
    clientId: "c3f97ef2-d480-4998-9ad3-e76fa8b2f256",
    configuration: {
        // === Identité du bot ===
        botName: "Digitaler Assistent BAYROL",
        botAvatar: "https://files.bpcontent.cloud/2025/07/01/07/20250701075253-KRYCA5NI.png",
        botDescription: "Haben Sie allgemeine Fragen zur Poolpflege oder zu BAYROL-Produkten? Ich bin gerne für Sie da. Wenn Sie eine persönlichere Unterstützung wünschen, kann ich Ihre Anfrage auch an unseren BAYROL-Kundendienst weiterleiten.",

        // === Composer (zone de saisie) ===
        composerPlaceholder: "Tippen Sie hier Ihre Frage ein …",
        allowFileUpload: false,

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
        showPoweredBy: true,
        soundEnabled: false,

        // === Message de réflexion par défaut ===
        defaultThinkingMessage: "Denken...",

        // === Navigation header (optionnel) ===
        headerAvatarLink: "https://www.example.com",
        mobileCloseRedirectUrl: "https://www.example.com",

        // === Message proactif (bulle automatique) ===
        proactiveMessageEnabled: true,
        proactiveBubbleMessage: "Hallo! 👋 Wie kann ich Ihnen helfen?",
        proactiveBubbleTriggerType: "afterDelay",
        proactiveBubbleDelayTime: 5,

        // === Bouton flottant (FAB) ===
        fabImage: "https://files.bpcontent.cloud/2025/06/26/16/20250626165810-TMOVCUT3.png",

        // === Stylesheet personnalisée ===
        additionalStylesheetUrl: "https://files.bpcontent.cloud/2025/06/10/19/20250610192013-GCPI8Q3O.css"
    }
});
