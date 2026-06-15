/**
 * Office-use card copy for landing i18n (en / pl / de).
 * Loaded before landing.js; applied on language change.
 */
(function () {
  const COPY = {
    en: {
      website_report: {
        tag: "Website",
        title: "Fetch data from a website",
        quote:
          "Go to the supplier website, download this month's CSV report and save it to billing.",
        flow: [
          "Browser opens the URL and logs in (password vault).",
          'Click "Download report" → file lands in <code>output/billing/</code>.',
          "Health checks expected file size and date.",
        ],
        badgeAuto: "auto",
        badgeHuman: null,
        snippet:
          "browser://chrome/page/open → extract_dom → download\nworkflow://office/supplier-report/monthly\nhealth://agent/desktop-operator.local",
      },
      portal_zus_form: {
        tag: "Portal · login",
        title: "Log in and complete a portal task",
        quote:
          "Log into the client portal, fill the ZUS form and submit — show a preview first.",
        flow: [
          "Playwright fills login/password from vault (Marta never sees the password in chat).",
          'Dry-run: form screenshot → <code>human://marta/approve/portal/zus-form</code>.',
          "After human approve: submit + PDF confirmation in process artifacts.",
        ],
        badgeAuto: null,
        badgeHuman: "Marta preview",
        snippet:
          "workflow://portal/zus-form/dry-run   # screenshot + plan\nhuman://marta/approve/portal/zus-form\nworkflow://portal/zus-form/send",
      },
      erp_subiekt: {
        tag: "Windows · UI",
        title: "Desktop tasks in ERP / Subiekt",
        quote: "Open Subiekt, paste Excel data into the invoice and save as draft.",
        flow: [
          "UI Automation focuses the app window (<code>pcwin://</code>).",
          "Click fields, paste from file, save — step-by-step with log.",
          "If the window does not open: incident + ticket instead of silent fail.",
        ],
        badgeAuto: "auto",
        badgeHuman: null,
        snippet:
          "pcwin://window/Subiekt GT/focus\npcwin://control/NumerFaktury/set_text\npcwin://control/Zapisz/click",
      },
      invoice_batch_woo: {
        tag: "Invoices",
        title: "Issue, review and send invoices",
        quote:
          "Issue invoices for WooCommerce orders, show the list for approval and send only approved ones.",
        flow: [
          "Agent <code>invoices-agent.local</code> fetches orders (API or ERP).",
          "Generates PDF/XML — chat preview: number, amount, customer.",
          "<code>human://marta/approve/invoices/batch</code> → e-mail / KSeF / ERP send.",
        ],
        badgeAuto: null,
        badgeHuman: "list approval",
        snippet:
          'urish ask "issue yesterday invoices and show preview"\n→ workflow://invoices/batch/dry-run\n→ human://marta/approve/invoices/batch\n→ view://process/agent/invoices-agent.local/latest',
      },
      bank_batch: {
        tag: "Online bank",
        title: "Bank transfer on the website",
        quote: "Prepare supplier transfers from the list — stop before authorization.",
        flow: [
          "Browser: bank login, fill transfers from file.",
          "System stops on the authorization screen — <strong>on purpose</strong>.",
          '<code>human://marta/input/bank-token</code> → then agent clicks "Confirm".',
        ],
        badgeAuto: null,
        badgeHuman: "token · 2FA",
        snippet:
          "workflow://bank/batch-transfer/dry-run\n# STOP before authorization — waits for Marta\nhuman://marta/input/bank-token\nworkflow://bank/batch-transfer/confirm",
      },
      android_2fa: {
        tag: "Android · token",
        title: "Phone approval (2FA)",
        quote: "The bank waits for app confirmation — show me the phone screen.",
        flow: [
          "ADB: phone screenshot + banking app UI dump.",
          'Chat preview: "Confirm transfer 12,450 PLN?"',
          "<code>human://marta/approve/android-token</code> → agent detects success and finishes in web bank.",
        ],
        badgeAuto: null,
        badgeHuman: "tap on phone",
        snippet:
          "android://device/pixel-7/screenshot\nhuman://marta/approve/android-token\n# Marta taps manually; agent waits for bank DOM",
      },
    },
    pl: {
      website_report: {
        tag: "Strona WWW",
        title: "Pobierz dane ze strony",
        quote:
          "Wejdź na stronę dostawcy, pobierz raport CSV za ten miesiąc i zapisz w rozliczeniach.",
        flow: [
          "Przeglądarka otwiera URL i loguje się (z sejfu haseł).",
          'Klik „Pobierz raport” → plik trafia do <code>output/rozliczenia/</code>.',
          "Health sprawdza, czy plik ma oczekiwany rozmiar i datę.",
        ],
        badgeAuto: "automat",
        snippet:
          "browser://chrome/page/open → extract_dom → download\nworkflow://office/supplier-report/monthly\nhealth://agent/desktop-operator.local",
      },
      portal_zus_form: {
        tag: "Portal · logowanie",
        title: "Zaloguj się i wykonaj zadanie w portalu",
        quote:
          "Zaloguj się do portalu klienta, uzupełnij formularz ZUS i wyślij — najpierw pokaż podgląd.",
        flow: [
          "Playwright wypełnia login/hasło z vault (Marta nie widzi hasła w chacie).",
          "Dry-run: screenshot formularza → <code>human://marta/approve/portal/zus-form</code>.",
          "Po human approve: submit + potwierdzenie PDF w artefaktach procesu.",
        ],
        badgeHuman: "podgląd Marty",
        snippet:
          "workflow://portal/zus-form/dry-run   # screenshot + plan\nhuman://marta/approve/portal/zus-form\nworkflow://portal/zus-form/send",
      },
      erp_subiekt: {
        tag: "Windows · okna",
        title: "Zadania okienkowe w ERP / Subiekcie",
        quote: "Otwórz Subiekta, wklej dane z Excela do faktury i zapisz jako szkic.",
        flow: [
          "UI Automation fokusuje okno programu (<code>pcwin://</code>).",
          "Klik w pola, wklejenie z pliku, zapis — krok po kroku z logiem.",
          "Gdy okno się nie otworzy: incident + ticket zamiast cichego failu.",
        ],
        badgeAuto: "automat",
        snippet:
          "pcwin://window/Subiekt GT/focus\npcwin://control/NumerFaktury/set_text\npcwin://control/Zapisz/click",
      },
      invoice_batch_woo: {
        tag: "Faktury",
        title: "Wystaw, przejrzyj, wyślij fakturę",
        quote:
          "Wystaw faktury za zamówienia z WooCommerce, pokaż listę do akceptacji i wyślij tylko zatwierdzone.",
        flow: [
          "Agent <code>invoices-agent.local</code> pobiera zamówienia (API lub ERP).",
          "Generuje PDF/XML — widok w chacie: numer, kwota, kontrahent.",
          "<code>human://marta/approve/invoices/batch</code> → wysyłka e-mail / KSeF / ERP.",
        ],
        badgeHuman: "akceptacja listy",
        snippet:
          'urish ask "wystaw faktury za wczoraj i pokaż podgląd"\n→ workflow://invoices/batch/dry-run\n→ human://marta/approve/invoices/batch\n→ view://process/agent/invoices-agent.local/latest',
      },
      bank_batch: {
        tag: "Bank online",
        title: "Przelew na stronie banku",
        quote: "Przygotuj przelewy do dostawców z listy — zatrzymaj się przed autoryzacją.",
        flow: [
          "Przeglądarka: logowanie do banku, wypełnienie przelewów z pliku.",
          "System zatrzymuje się na ekranie autoryzacji — <strong>celowo</strong>.",
          "<code>human://marta/input/bank-token</code> → potem agent klika „Zatwierdź”.",
        ],
        badgeHuman: "token · 2FA",
        snippet:
          "workflow://bank/batch-transfer/dry-run\n# STOP przed autoryzacją — czeka na Martę\nhuman://marta/input/bank-token\nworkflow://bank/batch-transfer/confirm",
      },
      android_2fa: {
        tag: "Android · token",
        title: "Akceptacja na telefonie (2FA)",
        quote: "Bank czeka na potwierdzenie w aplikacji — pokaż mi ekran telefonu.",
        flow: [
          "ADB: screenshot telefonu + dump UI aplikacji bankowej.",
          "Chat pokazuje podgląd: „Potwierdź przelew 12 450 zł?”",
          "<code>human://marta/approve/android-token</code> → agent wykrywa sukces i kończy w banku WWW.",
        ],
        badgeHuman: "klik na telefonie",
        snippet:
          "android://device/pixel-7/screenshot\nhuman://marta/approve/android-token\n# Marta klika ręcznie; agent czeka na DOM banku",
      },
    },
    de: {
      website_report: {
        tag: "Website",
        title: "Daten von der Website holen",
        quote:
          "Geh zur Lieferanten-Website, lade den CSV-Monatsbericht herunter und speichere ihn in der Abrechnung.",
        flow: [
          "Browser öffnet URL und meldet sich an (Passwort-Tresor).",
          'Klick „Bericht herunterladen“ → Datei landet in <code>output/abrechnung/</code>.',
          "Health prüft erwartete Dateigröße und Datum.",
        ],
        badgeAuto: "auto",
        snippet:
          "browser://chrome/page/open → extract_dom → download\nworkflow://office/supplier-report/monthly\nhealth://agent/desktop-operator.local",
      },
      portal_zus_form: {
        tag: "Portal · Login",
        title: "Im Portal anmelden und Aufgabe erledigen",
        quote:
          "Im Kundenportal anmelden, ZUS-Formular ausfüllen und senden — zuerst Vorschau zeigen.",
        flow: [
          "Playwright füllt Login/Passwort aus Vault (Marta sieht kein Passwort im Chat).",
          "Dry-run: Formular-Screenshot → <code>human://marta/approve/portal/zus-form</code>.",
          "Nach Human Approve: Submit + PDF-Bestätigung in Prozess-Artefakten.",
        ],
        badgeHuman: "Martas Vorschau",
        snippet:
          "workflow://portal/zus-form/dry-run   # screenshot + plan\nhuman://marta/approve/portal/zus-form\nworkflow://portal/zus-form/send",
      },
      erp_subiekt: {
        tag: "Windows · UI",
        title: "Desktop-Aufgaben in ERP / Subiekt",
        quote: "Subiekt öffnen, Excel-Daten in Rechnung einfügen und als Entwurf speichern.",
        flow: [
          "UI Automation fokussiert App-Fenster (<code>pcwin://</code>).",
          "Felder klicken, aus Datei einfügen, speichern — Schritt für Schritt mit Log.",
          "Fenster öffnet nicht: Incident + Ticket statt stillem Fehler.",
        ],
        badgeAuto: "auto",
        snippet:
          "pcwin://window/Subiekt GT/focus\npcwin://control/NumerFaktury/set_text\npcwin://control/Zapisz/click",
      },
      invoice_batch_woo: {
        tag: "Rechnungen",
        title: "Rechnung erstellen, prüfen, senden",
        quote:
          "Rechnungen für WooCommerce-Bestellungen erstellen, Liste zur Freigabe zeigen, nur Freigegebene senden.",
        flow: [
          "Agent <code>invoices-agent.local</code> holt Bestellungen (API oder ERP).",
          "Erzeugt PDF/XML — Chat-Vorschau: Nummer, Betrag, Kunde.",
          "<code>human://marta/approve/invoices/batch</code> → E-Mail / KSeF / ERP.",
        ],
        badgeHuman: "Listenfreigabe",
        snippet:
          'urish ask "Rechnungen für gestern erstellen und Vorschau zeigen"\n→ workflow://invoices/batch/dry-run\n→ human://marta/approve/invoices/batch\n→ view://process/agent/invoices-agent.local/latest',
      },
      bank_batch: {
        tag: "Online-Bank",
        title: "Überweisung auf der Bank-Website",
        quote: "Lieferantenüberweisungen vorbereiten — vor Autorisierung stoppen.",
        flow: [
          "Browser: Bank-Login, Überweisungen aus Datei ausfüllen.",
          "System stoppt am Autorisierungsbildschirm — <strong>absichtlich</strong>.",
          "<code>human://marta/input/bank-token</code> → dann Agent klickt „Bestätigen“.",
        ],
        badgeHuman: "Token · 2FA",
        snippet:
          "workflow://bank/batch-transfer/dry-run\n# STOP vor Autorisierung — wartet auf Marta\nhuman://marta/input/bank-token\nworkflow://bank/batch-transfer/confirm",
      },
      android_2fa: {
        tag: "Android · Token",
        title: "Freigabe am Telefon (2FA)",
        quote: "Bank wartet auf App-Bestätigung — zeig mir den Telefonbildschirm.",
        flow: [
          "ADB: Telefon-Screenshot + Banking-App UI-Dump.",
          "Chat-Vorschau: „Überweisung 12.450 PLN bestätigen?“",
          "<code>human://marta/approve/android-token</code> → Agent erkennt Erfolg und beendet Web-Bank.",
        ],
        badgeHuman: "Tippen am Telefon",
        snippet:
          "android://device/pixel-7/screenshot\nhuman://marta/approve/android-token\n# Marta tippt manuell; Agent wartet auf Bank-DOM",
      },
    },
  };

  function _quoteMarks(lang) {
    const open = lang === "pl" || lang === "de" ? "„" : "“";
    const close = lang === "pl" || lang === "de" ? "”" : "”";
    return { open, close };
  }

  function _applyOfficeCardCopy(cardEl, card, lang) {
    const tagEl = cardEl.querySelector(".integration-tag");
    const titleEl = cardEl.querySelector(".office-use-head h3");
    const quoteEl = cardEl.querySelector(".office-chat-quote");
    const flowEls = cardEl.querySelectorAll(".office-flow li");
    const autoBadge = cardEl.querySelector(".office-badge.auto");
    const humanBadge = cardEl.querySelector(".office-badge.human");
    const snippetEl = cardEl.querySelector(".integration-snippet");
    if (tagEl && card.tag) tagEl.textContent = card.tag;
    if (titleEl && card.title) titleEl.textContent = card.title;
    if (quoteEl && card.quote) {
      const cleaned = card.quote.replace(/^["“„']+|["”„']+$/g, "");
      const { open, close } = _quoteMarks(lang);
      quoteEl.textContent = `${open}${cleaned}${close}`;
    }
    if (card.flow) {
      flowEls.forEach((li, index) => {
        if (card.flow[index]) li.innerHTML = card.flow[index];
      });
    }
    if (autoBadge && card.badgeAuto) autoBadge.textContent = card.badgeAuto;
    if (humanBadge && card.badgeHuman) humanBadge.textContent = card.badgeHuman;
    if (snippetEl && card.snippet) snippetEl.textContent = card.snippet;
  }

  function applyOfficeCardI18n(lang) {
    const cards = COPY[lang] || COPY.en;
    document.querySelectorAll("[data-office-card]").forEach((cardEl) => {
      const id = cardEl.getAttribute("data-office-card");
      const card = cards[id];
      if (!card) return;
      _applyOfficeCardCopy(cardEl, card, lang);
    });
  }

  window.TaskinityOfficeCards = { apply: applyOfficeCardI18n, copy: COPY };
})();
