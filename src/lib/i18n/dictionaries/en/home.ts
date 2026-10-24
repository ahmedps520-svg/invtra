/**
 * Copy for the redesigned marketing pages (homepage sections, quiz, comparison, design pages).
 * Statements that depend on how invitations are sent have a `cloud` (INVTRA's WhatsApp Business
 * number) and an `own` (the host's own WhatsApp) version; pages pick one from the server's setup.
 */
export const home = {
  hero: {
    quiz: "Find your invitation",
    example: "Example",
    stageLabel: "Example: a sealed invitation opens and arrives on WhatsApp, addressed to one guest by name.",
  },

  studio: {
    title: "Make it personal",
    body: "Type a guest's name — their invitation and their own QR code change with it.",
    name: "Who are you inviting?",
    namePlaceholder: "A guest's name",
    seats: "Seats",
    fewer: "Fewer seats",
    more: "More seats",
    occasion: "Occasion",
    occasions: { WEDDING: "Wedding", NEWBORN: "Newborn", RAMADAN: "Ramadan", BIRTHDAY: "Birthday", CORPORATE: "Corporate" },
    language: "Language",
    languages: { AR: "AR", EN: "EN", BILINGUAL: "Bilingual" },
    numerals: "Numerals",
    numeralsNote: "Numerals apply to Arabic text.",
    design: "Design",
    qrNote: "The QR code opens a sample guest page.",
    start: "Start with this design",
  },

  proof: {
    label: "INVTRA in numbers",
    designs: { value: "16", label: "invitation designs" },
    occasions: { value: "11", label: "occasions" },
    test: {
      cloud: { value: "3", label: "free test sends to your phone" },
      own: { value: "Free", label: "preview before you pay" },
    },
    noApp: { value: "No app", label: "for guests — just WhatsApp" },
    purge: { value: "30 days", label: "and deleted data is gone for good" },
  },

  story: {
    paths: "What happens when a guest taps…",
    acceptPath: "Accept",
    declinePath: "Decline",
    replay: "Replay",
    ownTitle: "Sent from your own WhatsApp.",
  },

  checkin: {
    title: "Door check-in",
    aim: "Point the camera at a guest's code",
    checkedIn: "Checked in",
    arrived: "Arrived",
    of: "of {total}",
    guest: "Khalid Al Hashimi",
    seats: "Admits 2",
    label: "Example: a guest's personal QR code is scanned at the door and they are checked in.",
  },

  rsvp: {
    example: "Example event",
    remind: { cloud: "Remind {count} guests who haven't replied", own: "Resend to {count} guests who haven't replied" },
    reminded: { cloud: "Reminder sent to {count} guests", own: "{count} messages ready to send from your WhatsApp" },
    ring: "responded",
  },

  bilingual: {
    flips: { EN: "English", AR: "العربية", BILINGUAL: "Bilingual" },
    label: "Example: one invitation shown in English, Arabic and both languages together.",
  },

  upload: {
    yours: "Your artwork",
    stamped: "+ each guest's QR",
    label: "Example: an uploaded invitation design receives a personal QR code.",
  },

  designs: {
    showAll: "Show all {n} designs",
    showFewer: "Show fewer",
    filters: "Filter designs",
    occasion: "Occasion",
    style: "Style",
    styles: { classic: "Classic", luxe: "Gold & luxe", floral: "Floral", playful: "Playful", heritage: "Heritage" },
    language: "Made for",
    languages: { EN: "English", AR: "Arabic", BILINGUAL: "Bilingual" },
    premium: "Premium only",
    all: "All",
    clear: "Clear filters",
    count: "{n} designs",
    none: "No design matches every filter.",
    previous: "Previous design",
    next: "Next design",
    goTo: "Go to design {n}",
    open: "Open {name}",
  },

  occasions: {
    goTo: "Go to occasion {n}",
    bodies: {
      wedding: "Timeless designs for the biggest day — royal crowns, gold and emerald.",
      engagement: "Soft florals and flowing script for the first celebration together.",
      "henna-night": "Mandalas and warm terracotta inspired by traditional henna art.",
      newborn: "Teddy bears and soft colours to welcome your little one — and invite visitors.",
      "baby-shower": "Clouds, balloons and pastels for the newest member of the family.",
      aqiqah: "Gentle, moonlit designs to give thanks for your child's arrival.",
      birthday: "Confetti, colour and a little sparkle for milestones big and small.",
      graduation: "Clean, confident designs to celebrate the cap and gown.",
      anniversary: "Blossoming designs to celebrate the years together.",
      "ramadan-eid": "Lanterns and crescent moons for ghabgas, iftars and Eid gatherings.",
      corporate: "Launches, gala dinners and conferences — with check-in at the door.",
    } as Record<string, string>,
    cta: "See designs",
    previous: "Previous occasion",
    next: "Next occasion",
    any: { title: "Any gathering", body: "Launches, gala dinners, reunions — if it's worth gathering for, it's worth a proper invitation." },
  },

  quiz: {
    banner: {
      eyebrow: "Thirty seconds",
      title: "Not sure where to start?",
      body: "Answer four quick questions and we'll match you with designs — and the plan that fits your list.",
    },
    title: "Find your invitation",
    step: "Question {n} of {total}",
    close: "Close",
    back: "Back",
    restart: "Start again",
    questions: {
      occasion: "What are you celebrating?",
      guests: "How many guests are you inviting?",
      language: "Which language should it speak?",
      style: "Which style feels like you?",
    },
    guests: [
      { value: 50, label: "Up to 50" },
      { value: 100, label: "Up to 100" },
      { value: 250, label: "Up to 250" },
      { value: 500, label: "Up to 500" },
      { value: 1000, label: "More than 500" },
    ],
    languages: { AR: "Arabic", EN: "English", BILINGUAL: "Both, side by side" },
    styles: {
      classic: { label: "Classic", body: "Quiet, timeless, beautifully set" },
      luxe: { label: "Gold & luxe", body: "Deep colours and gold detail" },
      floral: { label: "Floral", body: "Soft petals and blossoms" },
      playful: { label: "Playful", body: "Teddies, clouds and confetti" },
      heritage: { label: "Heritage", body: "Arabesques, lanterns and henna" },
    },
    result: {
      eyebrow: "Your match",
      title: "Designs chosen for you",
      plan: "Your plan",
      reasons: {
        basic: "Up to 100 guests — Standard covers your whole list.",
        premiumGuests: "More than 100 guests — Premium covers up to 500.",
        premiumDesign: "{design} is a Premium design, so it comes with Premium.",
        custom: "More than 500 guests — we'll tailor a Custom plan for you.",
      },
      start: "Start with this design",
      test: { cloud: "Send yourself a free test", own: "Preview it free" },
      testNote: {
        cloud: "Every event includes 3 free test sends to your own WhatsApp.",
        own: "See exactly what each guest receives before you pay.",
      },
      contact: "Talk to us about a Custom plan",
    },
  },

  compare: {
    eyebrow: "Why INVTRA",
    title: "Printed cards, a PDF in the group, or INVTRA?",
    body: "An honest comparison — each has its place.",
    columns: { paper: "Printed cards", pdf: "A PDF in a WhatsApp group", invtra: "INVTRA" },
    marks: { yes: "Yes", partly: "Partly", no: "No" },
    rows: [
      {
        label: "Personal to each guest",
        paper: { mark: "yes", text: "Names written by hand" },
        pdf: { mark: "no", text: "One file for everyone" },
        invtra: { mark: "yes", text: "Their name, seats and own QR code" },
      },
      {
        label: "Replies (RSVP)",
        paper: { mark: "partly", text: "Phone calls to follow up" },
        pdf: { mark: "no", text: "Scattered across chats" },
        invtra: { mark: "yes", text: "One tap, tracked live" },
      },
      {
        label: "Door check-in",
        paper: { mark: "partly", text: "A printed list at the door" },
        pdf: { mark: "no", text: "Not possible" },
        invtra: { mark: "yes", text: "Scan each guest's code" },
      },
      {
        label: "Changing details after sending",
        paper: { mark: "no", text: "Reprint and redeliver" },
        pdf: { mark: "partly", text: "Send a new file — the old one keeps circulating" },
        invtra: { mark: "yes", text: "Edit once — every guest's page updates" },
      },
      {
        label: "Arabic & English",
        paper: { mark: "partly", text: "If your designer sets both" },
        pdf: { mark: "partly", text: "If your designer sets both" },
        invtra: { mark: "yes", text: "Built in, with true right-to-left" },
      },
      {
        label: "Cost as the list grows",
        paper: { mark: "no", text: "Grows with every card printed and delivered" },
        pdf: { mark: "yes", text: "Free" },
        invtra: { mark: "yes", text: "One price per event — up to 100 or 500 guests" },
      },
      {
        label: "Nothing for guests to install",
        paper: { mark: "yes", text: "Nothing to install" },
        pdf: { mark: "yes", text: "Just WhatsApp" },
        invtra: { mark: "yes", text: "Just WhatsApp and a browser" },
      },
    ],
  },

  pricing: {
    slider: "How many guests?",
    guests: "{n} guests",
    over: "More than 500 guests",
    fits: "{plan} fits your list",
    test: { cloud: "3 free test sends", own: "Free preview before you pay" },
    includedTitle: "Included in every plan",
    included: {
      first: { cloud: "WhatsApp messaging included", own: "A ready-to-send WhatsApp message for every guest" },
      rest: [
        "A personal invitation page for every guest",
        "A unique QR code per guest",
        "Accept or decline in one tap",
        "Live RSVP dashboard and reminders",
        "Door check-in",
        "Arabic, English or both",
        "Music and photo gallery",
        "Upload your own design",
      ],
    },
  },

  manifesto: {
    eyebrow: "What we believe",
    text: "An invitation is the first moment of the celebration. It should feel written for one person — because it is. So every guest receives their own: their name, their seats, their code, in the language closest to their heart.",
  },

  cta: {
    body: {
      cloud: "Create your invitation today and send yourself a free test on WhatsApp in minutes.",
      own: "Create your invitation today and preview it free before you pay.",
    },
    test: {
      cloud: { title: "Send yourself a free test", body: "Receive the message, tap Accept and get your own QR code — on your phone, before you pay.", note: "3 free test sends per event" },
      own: { title: "See it before you pay", body: "Design your invitation and preview exactly what each guest receives — before you pay a riyal.", note: "Free preview" },
    },
  },

  footer: {
    product: "Product",
    occasions: "Occasions",
    designs: "Designs",
    company: "Company",
    allDesigns: "All designs",
    uploadOwn: "Upload your own",
    quiz: "Find your invitation",
    builtBy: "Designed & built by",
    language: "Language",
  },

  header: {
    language: "Language",
  },

  design: {
    eyebrow: "Invitation design",
    premium: "Premium design",
    included: "Included in every plan",
    suits: "Made for",
    languageLabel: "Preview language",
    start: "Start with this design",
    guestPage: "See the guest page",
    similar: "Similar designs",
    all: "All designs",
    previewLabel: "{name} invitation design in {language}",
  },

  occasionPage: {
    preview: "Make it personal",
    wording: "Wording ideas",
    wordingBody: "Every design comes with wording for the occasion — edit it freely, in Arabic, English or both.",
  },
};
