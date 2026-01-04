// Configuration complète du webchat custom
window.initCustomWebchat({
    clientId: "9f8071db-dd35-4cef-beb9-25610968c22b",
    configuration: {
        // === Identité du bot ===
        botName: "Assistant Digital BAYROL",
        botAvatar: "https://files.bpcontent.cloud/2025/07/03/08/20250703081111-XRZRAKW4.png", // URL de l'avatar du bot (optionnel)
        botDescription: "Vous avez des questions générales sur l'entretien de la piscine ou sur les produits BAYROL ? Je suis là pour vous aider. Je peux aussi transmettre votre demande à notre service client BAYROL si vous souhaitez une aide plus personnalisée. J'utilise l’intelligence artificielle pour vous assister, mais il peut m'arriver de me tromper. Veillez toujours à suivre les instructions indiquées sur l’emballage du produit.",

        // === Composer (zone de saisie) ===
        composerPlaceholder: "Posez-moi votre question. Je suis prêt !",
        allowFileUpload: true,

        // === Thème ===
        color: "#00a1b1",
        variant: "soft", // "solid" ou "soft"
        headerVariant: "glass", // "solid" ou "glass"
        themeMode: "light", // "light" ou "dark"
        fontFamily: "Roboto Condensed", // "rubik", "inter", "ibm", "fira"
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
        // Affiché à la place du typing indicator quand le bot réfléchit
        defaultThinkingMessage: "Réflexion...",

        // === Navigation header (optionnel) ===
        headerAvatarLink: "https://www.example.com", // URL ouverte dans un nouvel onglet au clic sur l'avatar
        mobileCloseRedirectUrl: "https://www.example.com", // URL de redirection au clic sur la croix (mobile uniquement)

        // === Message proactif (bulle automatique) ===
        proactiveMessageEnabled: true,
        proactiveBubbleMessage: "Hi! 👋 Comment puis-je vous aider ?",
        proactiveBubbleTriggerType: "afterDelay", // "afterDelay", "onScroll", "never"
        proactiveBubbleDelayTime: 5, // secondes avant affichage

        // === Bouton flottant (FAB) ===
        fabImage: "https://www.bayrol.fr/sites/bayrol/files/2025-07/Assistant-Bubble.png"
    }
});
