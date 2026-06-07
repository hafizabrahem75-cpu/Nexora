export type LangCode = "ar" | "en" | "fr" | "es" | "tr" | "de" | "hi";

export interface Translations {
  // Direction
  isRTL: boolean;

  // Navigation
  nav: {
    home: string;
    conversations: string;
    friends: string;
    profile: string;
  };

  // Common
  common: {
    save: string;
    cancel: string;
    send: string;
    delete: string;
    edit: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    ok: string;
    yes: string;
    no: string;
    search: string;
    back: string;
    done: string;
    confirm: string;
    optional: string;
    required: string;
  };

  // Greetings (time-based)
  greetings: {
    morning: string;
    afternoon: string;
    evening: string;
    night: string;
  };

  // Home screen
  home: {
    recentConversations: string;
    noConversations: string;
    startConversation: string;
    upcomingReminders: string;
    noReminders: string;
    quickActions: string;
    tasks: string;
    goals: string;
    notes: string;
    friends: string;
  };

  // Conversations screen
  conversations: {
    title: string;
    searchPlaceholder: string;
    noConversations: string;
    noConversationsHint: string;
    you: string;
    today: string;
    yesterday: string;
  };

  // Chat screen
  chat: {
    inputPlaceholder: string;
    today: string;
    yesterday: string;
    emptyTitle: string;
    emptyHint: string;
  };

  // Profile screen
  profile: {
    title: string;
    editProfile: string;
    addFriend: string;
    message: string;
    friendsCount: string;
    tasksCount: string;
    goalsCount: string;
    notesCount: string;
    bio: string;
    bioPlaceholder: string;
    name: string;
    namePlaceholder: string;
    settings: string;
    memberSince: string;
    friendRequest: string;
    requestSent: string;
    alreadyFriends: string;
    viewProfile: string;
  };

  // Settings screen
  settings: {
    title: string;

    // Sections
    account: string;
    privacy: string;
    notifications: string;
    appearance: string;
    language: string;
    support: string;
    about: string;

    // Account rows
    editProfile: string;
    changePassword: string;
    logout: string;
    deleteAccount: string;

    // Change password
    changePwTitle: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordMismatch: string;
    passwordTooShort: string;
    passwordChanged: string;
    wrongCurrentPassword: string;

    // Delete account
    deleteTitle: string;
    deleteWarning: string;
    deleteHint: string;
    deleteConfirmWord: string;

    // Privacy
    profileVisibility: string;
    messagingPrivacy: string;
    appLock: string;
    appLockSoon: string;
    visibilityEveryone: string;
    visibilityFriends: string;
    visibilityNobody: string;

    // Notifications
    messageNotifs: string;
    friendNotifs: string;

    // Appearance
    mode: string;
    dark: string;
    light: string;
    system: string;
    accentColor: string;

    // Support
    helpCenter: string;
    reportProblem: string;
    sendFeedback: string;
    suggestFeature: string;
    requestHelp: string;

    // Report/feedback modals
    reportTitle: string;
    reportPlaceholder: string;
    attachScreenshot: string;
    feedbackTitle: string;
    feedbackPlaceholder: string;
    featureTitle: string;
    featurePlaceholder: string;
    helpTitle: string;
    helpPlaceholder: string;
    submitted: string;
    submittedMsg: string;

    // About
    version: string;
    app: string;
    privacyPolicy: string;
    termsOfUse: string;

    // Footer
    madeWith: string;
  };

  // Auth screens
  auth: {
    login: string;
    register: string;
    email: string;
    password: string;
    name: string;
    forgotPassword: string;
    noAccount: string;
    haveAccount: string;
    welcomeBack: string;
    createAccount: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    namePlaceholder: string;
  };
}

const ar: Translations = {
  isRTL: true,
  nav: { home: "الرئيسية", conversations: "المحادثات", friends: "الأصدقاء", profile: "الملف" },
  common: {
    save: "حفظ", cancel: "إلغاء", send: "إرسال", delete: "حذف", edit: "تعديل",
    close: "إغلاق", loading: "جارٍ التحميل...", error: "خطأ", success: "تم",
    ok: "حسناً", yes: "نعم", no: "لا", search: "بحث", back: "رجوع", done: "تم",
    confirm: "تأكيد", optional: "اختياري", required: "مطلوب",
  },
  greetings: { morning: "صباح الخير", afternoon: "مساء الخير", evening: "مساء النور", night: "ليلة سعيدة" },
  home: {
    recentConversations: "المحادثات الأخيرة", noConversations: "لا توجد محادثات بعد",
    startConversation: "ابدأ محادثة", upcomingReminders: "التذكيرات القادمة",
    noReminders: "لا توجد تذكيرات قادمة", quickActions: "الإجراءات السريعة",
    tasks: "المهام", goals: "الأهداف", notes: "الملاحظات", friends: "الأصدقاء",
  },
  conversations: {
    title: "المحادثات", searchPlaceholder: "بحث في المحادثات...",
    noConversations: "لا توجد محادثات", noConversationsHint: "ابدأ محادثة جديدة من صفحة الأصدقاء",
    you: "أنت", today: "اليوم", yesterday: "أمس",
  },
  chat: {
    inputPlaceholder: "اكتب رسالتك...", today: "اليوم", yesterday: "أمس",
    emptyTitle: "ابدأ المحادثة", emptyHint: "أرسل رسالتك الأولى",
  },
  profile: {
    title: "الملف الشخصي", editProfile: "تعديل الملف", addFriend: "إضافة صديق",
    message: "رسالة", friendsCount: "أصدقاء", tasksCount: "مهمة",
    goalsCount: "هدف", notesCount: "ملاحظة", bio: "السيرة الذاتية",
    bioPlaceholder: "أضف نبذة عنك...", name: "الاسم", namePlaceholder: "اسمك الكامل",
    settings: "الإعدادات", memberSince: "عضو منذ", friendRequest: "طلب صداقة",
    requestSent: "تم الإرسال", alreadyFriends: "أصدقاء بالفعل", viewProfile: "عرض الملف",
  },
  settings: {
    title: "الإعدادات", account: "الحساب", privacy: "الخصوصية والأمان",
    notifications: "الإشعارات", appearance: "المظهر", language: "اللغة",
    support: "الدعم", about: "حول التطبيق",
    editProfile: "تعديل الملف الشخصي", changePassword: "تغيير كلمة المرور",
    logout: "تسجيل الخروج", deleteAccount: "حذف الحساب",
    changePwTitle: "تغيير كلمة المرور", currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة", confirmPassword: "تأكيد كلمة المرور",
    passwordMismatch: "كلمات المرور غير متطابقة", passwordTooShort: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
    passwordChanged: "تم تغيير كلمة المرور بنجاح", wrongCurrentPassword: "كلمة المرور الحالية غير صحيحة",
    deleteTitle: "حذف الحساب", deleteWarning: "هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بياناتك بشكل نهائي.",
    deleteHint: 'اكتب "حذف" للتأكيد', deleteConfirmWord: "حذف",
    profileVisibility: "ظهور الملف الشخصي", messagingPrivacy: "من يستطيع مراسلتك",
    appLock: "قفل التطبيق (قريباً)", appLockSoon: "PIN / بصمة",
    visibilityEveryone: "الجميع", visibilityFriends: "الأصدقاء فقط", visibilityNobody: "لا أحد",
    messageNotifs: "إشعارات الرسائل", friendNotifs: "إشعارات طلبات الصداقة",
    mode: "الوضع", dark: "داكن", light: "فاتح", system: "النظام", accentColor: "لون التمييز",
    helpCenter: "مركز المساعدة", reportProblem: "الإبلاغ عن مشكلة",
    sendFeedback: "إرسال ملاحظات", suggestFeature: "اقتراح ميزة", requestHelp: "طلب مساعدة",
    reportTitle: "الإبلاغ عن مشكلة", reportPlaceholder: "اشرح المشكلة التي واجهتها...",
    attachScreenshot: "إرفاق لقطة شاشة (اختياري)",
    feedbackTitle: "إرسال ملاحظات", feedbackPlaceholder: "شاركنا أفكارك أو ملاحظاتك...",
    featureTitle: "اقتراح ميزة", featurePlaceholder: "اوصف الميزة التي تريدها...",
    helpTitle: "طلب مساعدة", helpPlaceholder: "كيف يمكننا مساعدتك؟",
    submitted: "شكراً", submittedMsg: "تم إرسال رسالتك بنجاح، سنرد عليك قريباً",
    version: "الإصدار", app: "التطبيق", privacyPolicy: "سياسة الخصوصية", termsOfUse: "شروط الاستخدام",
    madeWith: "صُنع بـ ❤️ بواسطة حافظ السراء",
  },
  auth: {
    login: "تسجيل الدخول", register: "إنشاء حساب", email: "البريد الإلكتروني",
    password: "كلمة المرور", name: "الاسم الكامل", forgotPassword: "نسيت كلمة المرور؟",
    noAccount: "ليس لديك حساب؟", haveAccount: "لديك حساب بالفعل؟",
    welcomeBack: "مرحباً بعودتك", createAccount: "أنشئ حسابك",
    emailPlaceholder: "أدخل بريدك الإلكتروني", passwordPlaceholder: "أدخل كلمة المرور",
    namePlaceholder: "أدخل اسمك الكامل",
  },
};

const en: Translations = {
  isRTL: false,
  nav: { home: "Home", conversations: "Chats", friends: "Friends", profile: "Profile" },
  common: {
    save: "Save", cancel: "Cancel", send: "Send", delete: "Delete", edit: "Edit",
    close: "Close", loading: "Loading...", error: "Error", success: "Done",
    ok: "OK", yes: "Yes", no: "No", search: "Search", back: "Back", done: "Done",
    confirm: "Confirm", optional: "Optional", required: "Required",
  },
  greetings: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good night" },
  home: {
    recentConversations: "Recent conversations", noConversations: "No conversations yet",
    startConversation: "Start a conversation", upcomingReminders: "Upcoming reminders",
    noReminders: "No upcoming reminders", quickActions: "Quick actions",
    tasks: "Tasks", goals: "Goals", notes: "Notes", friends: "Friends",
  },
  conversations: {
    title: "Chats", searchPlaceholder: "Search conversations...",
    noConversations: "No conversations", noConversationsHint: "Start a new chat from the Friends page",
    you: "You", today: "Today", yesterday: "Yesterday",
  },
  chat: {
    inputPlaceholder: "Type a message...", today: "Today", yesterday: "Yesterday",
    emptyTitle: "Start the conversation", emptyHint: "Send your first message",
  },
  profile: {
    title: "Profile", editProfile: "Edit Profile", addFriend: "Add Friend",
    message: "Message", friendsCount: "friends", tasksCount: "tasks",
    goalsCount: "goals", notesCount: "notes", bio: "Bio",
    bioPlaceholder: "Add a bio...", name: "Name", namePlaceholder: "Your full name",
    settings: "Settings", memberSince: "Member since", friendRequest: "Friend Request",
    requestSent: "Request Sent", alreadyFriends: "Already Friends", viewProfile: "View Profile",
  },
  settings: {
    title: "Settings", account: "Account", privacy: "Privacy & Security",
    notifications: "Notifications", appearance: "Appearance", language: "Language",
    support: "Support", about: "About",
    editProfile: "Edit Profile", changePassword: "Change Password",
    logout: "Log Out", deleteAccount: "Delete Account",
    changePwTitle: "Change Password", currentPassword: "Current password",
    newPassword: "New password", confirmPassword: "Confirm password",
    passwordMismatch: "Passwords do not match", passwordTooShort: "Password must be at least 8 characters",
    passwordChanged: "Password changed successfully", wrongCurrentPassword: "Current password is incorrect",
    deleteTitle: "Delete Account", deleteWarning: "This action cannot be undone. All your data will be permanently deleted.",
    deleteHint: 'Type "delete" to confirm', deleteConfirmWord: "delete",
    profileVisibility: "Profile Visibility", messagingPrivacy: "Who can message you",
    appLock: "App Lock (coming soon)", appLockSoon: "PIN / Biometrics",
    visibilityEveryone: "Everyone", visibilityFriends: "Friends only", visibilityNobody: "Nobody",
    messageNotifs: "Message Notifications", friendNotifs: "Friend Request Notifications",
    mode: "Mode", dark: "Dark", light: "Light", system: "System", accentColor: "Accent Color",
    helpCenter: "Help Center", reportProblem: "Report a Problem",
    sendFeedback: "Send Feedback", suggestFeature: "Suggest a Feature", requestHelp: "Request Help",
    reportTitle: "Report a Problem", reportPlaceholder: "Describe the issue you encountered...",
    attachScreenshot: "Attach screenshot (optional)",
    feedbackTitle: "Send Feedback", feedbackPlaceholder: "Share your thoughts or observations...",
    featureTitle: "Suggest a Feature", featurePlaceholder: "Describe the feature you'd like...",
    helpTitle: "Request Help", helpPlaceholder: "How can we help you?",
    submitted: "Thank you", submittedMsg: "Your message was sent successfully. We'll get back to you soon.",
    version: "Version", app: "App", privacyPolicy: "Privacy Policy", termsOfUse: "Terms of Use",
    madeWith: "Made with ❤️ by Hafiz Al-Saraa",
  },
  auth: {
    login: "Log In", register: "Create Account", email: "Email",
    password: "Password", name: "Full Name", forgotPassword: "Forgot password?",
    noAccount: "Don't have an account?", haveAccount: "Already have an account?",
    welcomeBack: "Welcome back", createAccount: "Create your account",
    emailPlaceholder: "Enter your email", passwordPlaceholder: "Enter your password",
    namePlaceholder: "Enter your full name",
  },
};

const fr: Translations = {
  isRTL: false,
  nav: { home: "Accueil", conversations: "Chats", friends: "Amis", profile: "Profil" },
  common: {
    save: "Sauver", cancel: "Annuler", send: "Envoyer", delete: "Supprimer", edit: "Modifier",
    close: "Fermer", loading: "Chargement...", error: "Erreur", success: "Succès",
    ok: "OK", yes: "Oui", no: "Non", search: "Rechercher", back: "Retour", done: "OK",
    confirm: "Confirmer", optional: "Optionnel", required: "Requis",
  },
  greetings: { morning: "Bonjour", afternoon: "Bon après-midi", evening: "Bonsoir", night: "Bonne nuit" },
  home: {
    recentConversations: "Conversations récentes", noConversations: "Aucune conversation",
    startConversation: "Démarrer une conversation", upcomingReminders: "Rappels à venir",
    noReminders: "Aucun rappel à venir", quickActions: "Actions rapides",
    tasks: "Tâches", goals: "Objectifs", notes: "Notes", friends: "Amis",
  },
  conversations: {
    title: "Chats", searchPlaceholder: "Rechercher...",
    noConversations: "Aucune conversation", noConversationsHint: "Commencez un chat depuis la page Amis",
    you: "Vous", today: "Aujourd'hui", yesterday: "Hier",
  },
  chat: {
    inputPlaceholder: "Tapez un message...", today: "Aujourd'hui", yesterday: "Hier",
    emptyTitle: "Commencez la conversation", emptyHint: "Envoyez votre premier message",
  },
  profile: {
    title: "Profil", editProfile: "Modifier le profil", addFriend: "Ajouter un ami",
    message: "Message", friendsCount: "amis", tasksCount: "tâches",
    goalsCount: "objectifs", notesCount: "notes", bio: "Bio",
    bioPlaceholder: "Ajoutez une bio...", name: "Nom", namePlaceholder: "Votre nom complet",
    settings: "Paramètres", memberSince: "Membre depuis", friendRequest: "Demande d'ami",
    requestSent: "Demande envoyée", alreadyFriends: "Déjà amis", viewProfile: "Voir le profil",
  },
  settings: {
    title: "Paramètres", account: "Compte", privacy: "Confidentialité",
    notifications: "Notifications", appearance: "Apparence", language: "Langue",
    support: "Support", about: "À propos",
    editProfile: "Modifier le profil", changePassword: "Changer le mot de passe",
    logout: "Déconnexion", deleteAccount: "Supprimer le compte",
    changePwTitle: "Changer le mot de passe", currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe", confirmPassword: "Confirmer le mot de passe",
    passwordMismatch: "Les mots de passe ne correspondent pas", passwordTooShort: "Le mot de passe doit comporter au moins 8 caractères",
    passwordChanged: "Mot de passe modifié", wrongCurrentPassword: "Mot de passe actuel incorrect",
    deleteTitle: "Supprimer le compte", deleteWarning: "Cette action est irréversible.",
    deleteHint: 'Tapez "supprimer" pour confirmer', deleteConfirmWord: "supprimer",
    profileVisibility: "Visibilité du profil", messagingPrivacy: "Qui peut vous écrire",
    appLock: "Verrouillage (bientôt)", appLockSoon: "PIN / Biométrie",
    visibilityEveryone: "Tout le monde", visibilityFriends: "Amis seulement", visibilityNobody: "Personne",
    messageNotifs: "Notifications de messages", friendNotifs: "Notifications d'amis",
    mode: "Mode", dark: "Sombre", light: "Clair", system: "Système", accentColor: "Couleur d'accent",
    helpCenter: "Centre d'aide", reportProblem: "Signaler un problème",
    sendFeedback: "Envoyer des commentaires", suggestFeature: "Suggérer une fonctionnalité", requestHelp: "Demander de l'aide",
    reportTitle: "Signaler un problème", reportPlaceholder: "Décrivez le problème...",
    attachScreenshot: "Joindre une capture d'écran (optionnel)",
    feedbackTitle: "Commentaires", feedbackPlaceholder: "Partagez vos idées...",
    featureTitle: "Suggérer une fonctionnalité", featurePlaceholder: "Décrivez la fonctionnalité...",
    helpTitle: "Demander de l'aide", helpPlaceholder: "Comment pouvons-nous vous aider?",
    submitted: "Merci", submittedMsg: "Votre message a été envoyé avec succès.",
    version: "Version", app: "Application", privacyPolicy: "Politique de confidentialité", termsOfUse: "Conditions d'utilisation",
    madeWith: "Fait avec ❤️ par Hafiz Al-Saraa",
  },
  auth: {
    login: "Connexion", register: "Créer un compte", email: "E-mail",
    password: "Mot de passe", name: "Nom complet", forgotPassword: "Mot de passe oublié?",
    noAccount: "Pas de compte?", haveAccount: "Déjà un compte?",
    welcomeBack: "Bon retour", createAccount: "Créez votre compte",
    emailPlaceholder: "Entrez votre e-mail", passwordPlaceholder: "Entrez votre mot de passe",
    namePlaceholder: "Entrez votre nom complet",
  },
};

const es: Translations = {
  isRTL: false,
  nav: { home: "Inicio", conversations: "Chats", friends: "Amigos", profile: "Perfil" },
  common: {
    save: "Guardar", cancel: "Cancelar", send: "Enviar", delete: "Eliminar", edit: "Editar",
    close: "Cerrar", loading: "Cargando...", error: "Error", success: "Hecho",
    ok: "OK", yes: "Sí", no: "No", search: "Buscar", back: "Atrás", done: "Listo",
    confirm: "Confirmar", optional: "Opcional", required: "Requerido",
  },
  greetings: { morning: "Buenos días", afternoon: "Buenas tardes", evening: "Buenas noches", night: "Buenas noches" },
  home: {
    recentConversations: "Conversaciones recientes", noConversations: "Sin conversaciones",
    startConversation: "Iniciar conversación", upcomingReminders: "Próximos recordatorios",
    noReminders: "Sin recordatorios", quickActions: "Acciones rápidas",
    tasks: "Tareas", goals: "Metas", notes: "Notas", friends: "Amigos",
  },
  conversations: {
    title: "Chats", searchPlaceholder: "Buscar conversaciones...",
    noConversations: "Sin conversaciones", noConversationsHint: "Inicia un chat desde Amigos",
    you: "Tú", today: "Hoy", yesterday: "Ayer",
  },
  chat: {
    inputPlaceholder: "Escribe un mensaje...", today: "Hoy", yesterday: "Ayer",
    emptyTitle: "Inicia la conversación", emptyHint: "Envía tu primer mensaje",
  },
  profile: {
    title: "Perfil", editProfile: "Editar perfil", addFriend: "Agregar amigo",
    message: "Mensaje", friendsCount: "amigos", tasksCount: "tareas",
    goalsCount: "metas", notesCount: "notas", bio: "Bio",
    bioPlaceholder: "Agrega una bio...", name: "Nombre", namePlaceholder: "Tu nombre completo",
    settings: "Ajustes", memberSince: "Miembro desde", friendRequest: "Solicitud de amistad",
    requestSent: "Solicitud enviada", alreadyFriends: "Ya son amigos", viewProfile: "Ver perfil",
  },
  settings: {
    title: "Ajustes", account: "Cuenta", privacy: "Privacidad",
    notifications: "Notificaciones", appearance: "Apariencia", language: "Idioma",
    support: "Soporte", about: "Acerca de",
    editProfile: "Editar perfil", changePassword: "Cambiar contraseña",
    logout: "Cerrar sesión", deleteAccount: "Eliminar cuenta",
    changePwTitle: "Cambiar contraseña", currentPassword: "Contraseña actual",
    newPassword: "Nueva contraseña", confirmPassword: "Confirmar contraseña",
    passwordMismatch: "Las contraseñas no coinciden", passwordTooShort: "La contraseña debe tener al menos 8 caracteres",
    passwordChanged: "Contraseña cambiada", wrongCurrentPassword: "Contraseña actual incorrecta",
    deleteTitle: "Eliminar cuenta", deleteWarning: "Esta acción es irreversible.",
    deleteHint: 'Escribe "eliminar" para confirmar', deleteConfirmWord: "eliminar",
    profileVisibility: "Visibilidad del perfil", messagingPrivacy: "Quién puede escribirte",
    appLock: "Bloqueo (próximamente)", appLockSoon: "PIN / Biometría",
    visibilityEveryone: "Todos", visibilityFriends: "Solo amigos", visibilityNobody: "Nadie",
    messageNotifs: "Notificaciones de mensajes", friendNotifs: "Notificaciones de amigos",
    mode: "Modo", dark: "Oscuro", light: "Claro", system: "Sistema", accentColor: "Color de acento",
    helpCenter: "Centro de ayuda", reportProblem: "Reportar problema",
    sendFeedback: "Enviar comentarios", suggestFeature: "Sugerir función", requestHelp: "Solicitar ayuda",
    reportTitle: "Reportar problema", reportPlaceholder: "Describe el problema...",
    attachScreenshot: "Adjuntar captura (opcional)",
    feedbackTitle: "Comentarios", feedbackPlaceholder: "Comparte tus ideas...",
    featureTitle: "Sugerir función", featurePlaceholder: "Describe la función que deseas...",
    helpTitle: "Solicitar ayuda", helpPlaceholder: "¿Cómo podemos ayudarte?",
    submitted: "Gracias", submittedMsg: "Tu mensaje fue enviado exitosamente.",
    version: "Versión", app: "Aplicación", privacyPolicy: "Política de privacidad", termsOfUse: "Términos de uso",
    madeWith: "Hecho con ❤️ por Hafiz Al-Saraa",
  },
  auth: {
    login: "Iniciar sesión", register: "Crear cuenta", email: "Correo electrónico",
    password: "Contraseña", name: "Nombre completo", forgotPassword: "¿Olvidaste tu contraseña?",
    noAccount: "¿Sin cuenta?", haveAccount: "¿Ya tienes cuenta?",
    welcomeBack: "Bienvenido de vuelta", createAccount: "Crea tu cuenta",
    emailPlaceholder: "Ingresa tu correo", passwordPlaceholder: "Ingresa tu contraseña",
    namePlaceholder: "Ingresa tu nombre",
  },
};

const tr: Translations = {
  isRTL: false,
  nav: { home: "Ana Sayfa", conversations: "Sohbetler", friends: "Arkadaşlar", profile: "Profil" },
  common: {
    save: "Kaydet", cancel: "İptal", send: "Gönder", delete: "Sil", edit: "Düzenle",
    close: "Kapat", loading: "Yükleniyor...", error: "Hata", success: "Tamam",
    ok: "Tamam", yes: "Evet", no: "Hayır", search: "Ara", back: "Geri", done: "Bitti",
    confirm: "Onayla", optional: "İsteğe bağlı", required: "Gerekli",
  },
  greetings: { morning: "Günaydın", afternoon: "İyi öğleden sonralar", evening: "İyi akşamlar", night: "İyi geceler" },
  home: {
    recentConversations: "Son sohbetler", noConversations: "Henüz sohbet yok",
    startConversation: "Sohbet başlat", upcomingReminders: "Yaklaşan hatırlatmalar",
    noReminders: "Yaklaşan hatırlatma yok", quickActions: "Hızlı işlemler",
    tasks: "Görevler", goals: "Hedefler", notes: "Notlar", friends: "Arkadaşlar",
  },
  conversations: {
    title: "Sohbetler", searchPlaceholder: "Sohbet ara...",
    noConversations: "Sohbet yok", noConversationsHint: "Arkadaşlar sayfasından sohbet başlatın",
    you: "Sen", today: "Bugün", yesterday: "Dün",
  },
  chat: {
    inputPlaceholder: "Mesaj yaz...", today: "Bugün", yesterday: "Dün",
    emptyTitle: "Sohbeti başlat", emptyHint: "İlk mesajını gönder",
  },
  profile: {
    title: "Profil", editProfile: "Profili düzenle", addFriend: "Arkadaş ekle",
    message: "Mesaj", friendsCount: "arkadaş", tasksCount: "görev",
    goalsCount: "hedef", notesCount: "not", bio: "Biyografi",
    bioPlaceholder: "Biyografi ekle...", name: "Ad", namePlaceholder: "Tam adınız",
    settings: "Ayarlar", memberSince: "Üye olma tarihi", friendRequest: "Arkadaşlık isteği",
    requestSent: "İstek gönderildi", alreadyFriends: "Zaten arkadaşlar", viewProfile: "Profili gör",
  },
  settings: {
    title: "Ayarlar", account: "Hesap", privacy: "Gizlilik",
    notifications: "Bildirimler", appearance: "Görünüm", language: "Dil",
    support: "Destek", about: "Hakkında",
    editProfile: "Profili düzenle", changePassword: "Şifreyi değiştir",
    logout: "Çıkış yap", deleteAccount: "Hesabı sil",
    changePwTitle: "Şifreyi değiştir", currentPassword: "Mevcut şifre",
    newPassword: "Yeni şifre", confirmPassword: "Şifreyi onayla",
    passwordMismatch: "Şifreler eşleşmiyor", passwordTooShort: "Şifre en az 8 karakter olmalıdır",
    passwordChanged: "Şifre değiştirildi", wrongCurrentPassword: "Mevcut şifre yanlış",
    deleteTitle: "Hesabı sil", deleteWarning: "Bu işlem geri alınamaz.",
    deleteHint: '"sil" yazarak onaylayın', deleteConfirmWord: "sil",
    profileVisibility: "Profil görünürlüğü", messagingPrivacy: "Sana kim mesaj atabilir",
    appLock: "Uygulama kilidi (yakında)", appLockSoon: "PIN / Biyometri",
    visibilityEveryone: "Herkes", visibilityFriends: "Sadece arkadaşlar", visibilityNobody: "Kimse",
    messageNotifs: "Mesaj bildirimleri", friendNotifs: "Arkadaşlık bildirimleri",
    mode: "Mod", dark: "Koyu", light: "Açık", system: "Sistem", accentColor: "Vurgu rengi",
    helpCenter: "Yardım merkezi", reportProblem: "Sorun bildir",
    sendFeedback: "Geri bildirim gönder", suggestFeature: "Özellik öner", requestHelp: "Yardım iste",
    reportTitle: "Sorun bildir", reportPlaceholder: "Karşılaştığınız sorunu açıklayın...",
    attachScreenshot: "Ekran görüntüsü ekle (isteğe bağlı)",
    feedbackTitle: "Geri bildirim", feedbackPlaceholder: "Düşüncelerinizi paylaşın...",
    featureTitle: "Özellik öner", featurePlaceholder: "İstediğiniz özelliği açıklayın...",
    helpTitle: "Yardım iste", helpPlaceholder: "Size nasıl yardımcı olabiliriz?",
    submitted: "Teşekkürler", submittedMsg: "Mesajınız başarıyla gönderildi.",
    version: "Sürüm", app: "Uygulama", privacyPolicy: "Gizlilik politikası", termsOfUse: "Kullanım koşulları",
    madeWith: "❤️ ile yapıldı — Hafiz Al-Saraa",
  },
  auth: {
    login: "Giriş yap", register: "Hesap oluştur", email: "E-posta",
    password: "Şifre", name: "Tam ad", forgotPassword: "Şifremi unuttum?",
    noAccount: "Hesabınız yok mu?", haveAccount: "Hesabınız var mı?",
    welcomeBack: "Tekrar hoş geldiniz", createAccount: "Hesabınızı oluşturun",
    emailPlaceholder: "E-postanızı girin", passwordPlaceholder: "Şifrenizi girin",
    namePlaceholder: "Tam adınızı girin",
  },
};

const de: Translations = {
  isRTL: false,
  nav: { home: "Startseite", conversations: "Chats", friends: "Freunde", profile: "Profil" },
  common: {
    save: "Speichern", cancel: "Abbrechen", send: "Senden", delete: "Löschen", edit: "Bearbeiten",
    close: "Schließen", loading: "Laden...", error: "Fehler", success: "Fertig",
    ok: "OK", yes: "Ja", no: "Nein", search: "Suchen", back: "Zurück", done: "Fertig",
    confirm: "Bestätigen", optional: "Optional", required: "Erforderlich",
  },
  greetings: { morning: "Guten Morgen", afternoon: "Guten Nachmittag", evening: "Guten Abend", night: "Gute Nacht" },
  home: {
    recentConversations: "Letzte Gespräche", noConversations: "Keine Gespräche",
    startConversation: "Gespräch starten", upcomingReminders: "Bevorstehende Erinnerungen",
    noReminders: "Keine Erinnerungen", quickActions: "Schnellaktionen",
    tasks: "Aufgaben", goals: "Ziele", notes: "Notizen", friends: "Freunde",
  },
  conversations: {
    title: "Chats", searchPlaceholder: "Gespräche suchen...",
    noConversations: "Keine Gespräche", noConversationsHint: "Starte einen Chat auf der Freunde-Seite",
    you: "Du", today: "Heute", yesterday: "Gestern",
  },
  chat: {
    inputPlaceholder: "Nachricht eingeben...", today: "Heute", yesterday: "Gestern",
    emptyTitle: "Gespräch starten", emptyHint: "Sende deine erste Nachricht",
  },
  profile: {
    title: "Profil", editProfile: "Profil bearbeiten", addFriend: "Freund hinzufügen",
    message: "Nachricht", friendsCount: "Freunde", tasksCount: "Aufgaben",
    goalsCount: "Ziele", notesCount: "Notizen", bio: "Bio",
    bioPlaceholder: "Bio hinzufügen...", name: "Name", namePlaceholder: "Ihr vollständiger Name",
    settings: "Einstellungen", memberSince: "Mitglied seit", friendRequest: "Freundschaftsanfrage",
    requestSent: "Anfrage gesendet", alreadyFriends: "Bereits befreundet", viewProfile: "Profil ansehen",
  },
  settings: {
    title: "Einstellungen", account: "Konto", privacy: "Datenschutz",
    notifications: "Benachrichtigungen", appearance: "Erscheinungsbild", language: "Sprache",
    support: "Support", about: "Über",
    editProfile: "Profil bearbeiten", changePassword: "Passwort ändern",
    logout: "Abmelden", deleteAccount: "Konto löschen",
    changePwTitle: "Passwort ändern", currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort", confirmPassword: "Passwort bestätigen",
    passwordMismatch: "Passwörter stimmen nicht überein", passwordTooShort: "Passwort muss mindestens 8 Zeichen haben",
    passwordChanged: "Passwort geändert", wrongCurrentPassword: "Aktuelles Passwort ist falsch",
    deleteTitle: "Konto löschen", deleteWarning: "Diese Aktion kann nicht rückgängig gemacht werden.",
    deleteHint: '"löschen" eingeben zum Bestätigen', deleteConfirmWord: "löschen",
    profileVisibility: "Profil-Sichtbarkeit", messagingPrivacy: "Wer kann dir schreiben",
    appLock: "App-Sperre (demnächst)", appLockSoon: "PIN / Biometrie",
    visibilityEveryone: "Alle", visibilityFriends: "Nur Freunde", visibilityNobody: "Niemand",
    messageNotifs: "Nachrichtenbenachrichtigungen", friendNotifs: "Freundschaftsbenachrichtigungen",
    mode: "Modus", dark: "Dunkel", light: "Hell", system: "System", accentColor: "Akzentfarbe",
    helpCenter: "Hilfezentrum", reportProblem: "Problem melden",
    sendFeedback: "Feedback senden", suggestFeature: "Funktion vorschlagen", requestHelp: "Hilfe anfordern",
    reportTitle: "Problem melden", reportPlaceholder: "Beschreibe das Problem...",
    attachScreenshot: "Screenshot anhängen (optional)",
    feedbackTitle: "Feedback", feedbackPlaceholder: "Teile deine Gedanken...",
    featureTitle: "Funktion vorschlagen", featurePlaceholder: "Beschreibe die gewünschte Funktion...",
    helpTitle: "Hilfe anfordern", helpPlaceholder: "Wie können wir helfen?",
    submitted: "Danke", submittedMsg: "Deine Nachricht wurde erfolgreich gesendet.",
    version: "Version", app: "App", privacyPolicy: "Datenschutzrichtlinie", termsOfUse: "Nutzungsbedingungen",
    madeWith: "Mit ❤️ gemacht von Hafiz Al-Saraa",
  },
  auth: {
    login: "Anmelden", register: "Konto erstellen", email: "E-Mail",
    password: "Passwort", name: "Vollständiger Name", forgotPassword: "Passwort vergessen?",
    noAccount: "Kein Konto?", haveAccount: "Bereits ein Konto?",
    welcomeBack: "Willkommen zurück", createAccount: "Erstelle dein Konto",
    emailPlaceholder: "E-Mail eingeben", passwordPlaceholder: "Passwort eingeben",
    namePlaceholder: "Vollständigen Namen eingeben",
  },
};

const hi: Translations = {
  isRTL: false,
  nav: { home: "होम", conversations: "चैट", friends: "दोस्त", profile: "प्रोफ़ाइल" },
  common: {
    save: "सहेजें", cancel: "रद्द करें", send: "भेजें", delete: "हटाएं", edit: "संपादित करें",
    close: "बंद करें", loading: "लोड हो रहा है...", error: "त्रुटि", success: "हो गया",
    ok: "ठीक है", yes: "हाँ", no: "नहीं", search: "खोजें", back: "वापस", done: "हो गया",
    confirm: "पुष्टि करें", optional: "वैकल्पिक", required: "आवश्यक",
  },
  greetings: { morning: "सुप्रभात", afternoon: "नमस्ते", evening: "शुभ संध्या", night: "शुभ रात्रि" },
  home: {
    recentConversations: "हाल की बातचीत", noConversations: "कोई बातचीत नहीं",
    startConversation: "बातचीत शुरू करें", upcomingReminders: "आगामी अनुस्मारक",
    noReminders: "कोई अनुस्मारक नहीं", quickActions: "त्वरित क्रियाएं",
    tasks: "कार्य", goals: "लक्ष्य", notes: "नोट्स", friends: "दोस्त",
  },
  conversations: {
    title: "चैट", searchPlaceholder: "बातचीत खोजें...",
    noConversations: "कोई बातचीत नहीं", noConversationsHint: "दोस्त पेज से चैट शुरू करें",
    you: "आप", today: "आज", yesterday: "कल",
  },
  chat: {
    inputPlaceholder: "संदेश लिखें...", today: "आज", yesterday: "कल",
    emptyTitle: "बातचीत शुरू करें", emptyHint: "अपना पहला संदेश भेजें",
  },
  profile: {
    title: "प्रोफ़ाइल", editProfile: "प्रोफ़ाइल संपादित करें", addFriend: "दोस्त जोड़ें",
    message: "संदेश", friendsCount: "दोस्त", tasksCount: "कार्य",
    goalsCount: "लक्ष्य", notesCount: "नोट्स", bio: "बायो",
    bioPlaceholder: "बायो जोड़ें...", name: "नाम", namePlaceholder: "आपका पूरा नाम",
    settings: "सेटिंग्स", memberSince: "सदस्य बने", friendRequest: "मित्र अनुरोध",
    requestSent: "अनुरोध भेजा गया", alreadyFriends: "पहले से दोस्त", viewProfile: "प्रोफ़ाइल देखें",
  },
  settings: {
    title: "सेटिंग्स", account: "खाता", privacy: "गोपनीयता",
    notifications: "सूचनाएं", appearance: "दिखावट", language: "भाषा",
    support: "सहायता", about: "के बारे में",
    editProfile: "प्रोफ़ाइल संपादित करें", changePassword: "पासवर्ड बदलें",
    logout: "लॉग आउट", deleteAccount: "खाता हटाएं",
    changePwTitle: "पासवर्ड बदलें", currentPassword: "वर्तमान पासवर्ड",
    newPassword: "नया पासवर्ड", confirmPassword: "पासवर्ड की पुष्टि करें",
    passwordMismatch: "पासवर्ड मेल नहीं खाते", passwordTooShort: "पासवर्ड कम से कम 8 अक्षर का होना चाहिए",
    passwordChanged: "पासवर्ड बदल दिया गया", wrongCurrentPassword: "वर्तमान पासवर्ड गलत है",
    deleteTitle: "खाता हटाएं", deleteWarning: "यह क्रिया वापस नहीं की जा सकती।",
    deleteHint: '"हटाएं" टाइप करके पुष्टि करें', deleteConfirmWord: "हटाएं",
    profileVisibility: "प्रोफ़ाइल दृश्यता", messagingPrivacy: "आपको कौन संदेश कर सकता है",
    appLock: "ऐप लॉक (जल्द आ रहा है)", appLockSoon: "PIN / बायोमेट्रिक्स",
    visibilityEveryone: "सभी", visibilityFriends: "केवल दोस्त", visibilityNobody: "कोई नहीं",
    messageNotifs: "संदेश सूचनाएं", friendNotifs: "मित्र अनुरोध सूचनाएं",
    mode: "मोड", dark: "डार्क", light: "लाइट", system: "सिस्टम", accentColor: "एक्सेंट रंग",
    helpCenter: "सहायता केंद्र", reportProblem: "समस्या रिपोर्ट करें",
    sendFeedback: "फीडबैक भेजें", suggestFeature: "फ़ीचर सुझाएं", requestHelp: "सहायता अनुरोध",
    reportTitle: "समस्या रिपोर्ट करें", reportPlaceholder: "समस्या का वर्णन करें...",
    attachScreenshot: "स्क्रीनशॉट संलग्न करें (वैकल्पिक)",
    feedbackTitle: "फीडबैक", feedbackPlaceholder: "अपने विचार साझा करें...",
    featureTitle: "फ़ीचर सुझाएं", featurePlaceholder: "वांछित फ़ीचर का वर्णन करें...",
    helpTitle: "सहायता अनुरोध", helpPlaceholder: "हम आपकी कैसे मदद कर सकते हैं?",
    submitted: "धन्यवाद", submittedMsg: "आपका संदेश सफलतापूर्वक भेजा गया।",
    version: "संस्करण", app: "ऐप", privacyPolicy: "गोपनीयता नीति", termsOfUse: "उपयोग की शर्तें",
    madeWith: "❤️ के साथ बनाया — Hafiz Al-Saraa",
  },
  auth: {
    login: "लॉग इन", register: "खाता बनाएं", email: "ईमेल",
    password: "पासवर्ड", name: "पूरा नाम", forgotPassword: "पासवर्ड भूल गए?",
    noAccount: "खाता नहीं है?", haveAccount: "पहले से खाता है?",
    welcomeBack: "वापसी पर स्वागत है", createAccount: "अपना खाता बनाएं",
    emailPlaceholder: "अपना ईमेल दर्ज करें", passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
    namePlaceholder: "अपना पूरा नाम दर्ज करें",
  },
};

export const TRANSLATIONS: Record<LangCode, Translations> = { ar, en, fr, es, tr, de, hi };

export function getTranslations(lang: string): Translations {
  return TRANSLATIONS[(lang as LangCode)] ?? ar;
}
