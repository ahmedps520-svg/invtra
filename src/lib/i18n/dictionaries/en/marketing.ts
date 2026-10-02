/** Long-form legal section: a heading, paragraphs and an optional bullet list. */
export type LegalSection = { id: string; heading: string; body: string[]; list?: string[]; after?: string[] };

export const marketing = {
  meta: {
    homeTitle: "INVTRA — Your Invitation. Reimagined.",
    homeDescription:
      "Create beautiful digital invitations, send them directly through WhatsApp, and let every guest receive their own personalised invitation and QR code.",
    designsTitle: "Invitation designs",
    designsDescription:
      "Seven signature invitation designs for weddings, engagements and celebrations — in Arabic, English or both, delivered to every guest on WhatsApp.",
    pricingTitle: "Pricing",
    pricingDescription:
      "Simple, one-time pricing per event. WhatsApp messaging included, a personal QR code for every guest, and three free test sends to your own number.",
    privacyTitle: "Privacy Policy",
    privacyDescription: "How INVTRA handles your account, your event and your guests' information.",
    termsTitle: "Terms of Service",
    termsDescription: "The terms for using INVTRA to create and send digital invitations.",
  },

  nav: {
    skip: "Skip to content",
    home: "INVTRA home",
    primary: "Main",
    menu: "Menu",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },

  footer: {
    tagline: "Premium digital invitations, delivered personally to every guest through WhatsApp.",
    explore: "Explore",
    account: "Account",
    legal: "Legal",
    contact: "Contact",
    contactBody: "Questions, custom events or press — we answer every message.",
    createAccount: "Create an account",
    trademark:
      "WhatsApp is a trademark of Meta Platforms, Inc. INVTRA is an independent service built on the official WhatsApp Business Platform.",
  },

  hero: {
    eyebrow: "Digital invitations · Delivered on WhatsApp",
    titleLine1: "Your Invitation.",
    titleLine2: "Reimagined.",
    subtitle:
      "Create beautiful digital invitations, send them directly through WhatsApp, and let every guest receive their own personalized invitation.",
    primary: "Create an Invitation",
    secondary: "Explore Designs",
    assurances: ["Official WhatsApp Business Platform", "No app or sign-up for guests", "Arabic & English"],
  },

  demo: {
    label:
      "Example: a guest receives an invitation on WhatsApp, taps Accept Invitation, and instantly receives a personal invitation with their own QR code.",
    sender: "INVTRA",
    senderStatus: "Business account",
    today: "Today",
    message:
      "Dear Khalid, you are warmly invited to celebrate the wedding of Ahmed & Sara on Saturday, 12 December 2026.\n\nWould you like to accept this invitation?",
    footer: "Sent with INVTRA",
    accept: "Accept Invitation",
    decline: "Decline",
    delivery: "Thank you for accepting! Here is your personal invitation. Please present your QR code at the entrance.",
    view: "View Invitation",
    time1: "7:02 PM",
    time2: "7:03 PM",
    typeMessage: "Message",
    floatingLabel: "Personal invitation · Khalid Al Hashimi",
  },

  journey: {
    eyebrow: "The guest journey",
    title: "One seamless journey",
    steps: [
      { title: "Create", body: "Design an invitation that feels unmistakably yours." },
      { title: "Invite", body: "Send it to every guest directly on WhatsApp." },
      { title: "Accept", body: "Guests reply with a single, graceful tap." },
      { title: "Receive", body: "Each guest gets a personal invitation and QR code." },
      { title: "Scan", body: "Codes are checked in at the door in seconds." },
      { title: "Celebrate", body: "You focus on the moment, not the guest list." },
    ],
  },

  how: {
    eyebrow: "How it works",
    title: "Five steps. One unforgettable invitation.",
    body: "No templates to wrestle with and no lists to chase. INVTRA guides you from the first detail to the moment every guest is holding their invitation.",
    cta: "Start creating",
    steps: [
      { title: "Create your event", body: "Add the occasion, date, venue and hosts — in Arabic, English or both." },
      {
        title: "Design your invitation",
        body: "Choose an INVTRA design and refine its colours, fonts and wording, or upload your own artwork.",
      },
      {
        title: "Add your guests",
        body: "Import a spreadsheet or add guests one by one, with the number of seats each invitation admits.",
      },
      { title: "Preview", body: "See exactly what each guest receives, and send yourself a free test on WhatsApp." },
      { title: "Send", body: "Deliver every invitation through WhatsApp and watch the replies arrive in real time." },
    ],
  },

  designs: {
    eyebrow: "Invitation designs",
    title: "Designed like fine stationery.",
    body: "Seven signature designs, each shown exactly as your guests will receive it. Every design works in Arabic, English or both.",
    cta: "Explore all designs",
    previous: "Previous designs",
    next: "More designs",
  },

  whatsapp: {
    eyebrow: "WhatsApp invitations",
    title: "Delivered where your guests already are.",
    body: "Invitations are sent through the official WhatsApp Business Platform, so they arrive like a personal note — an elegant image and two simple choices.",
    points: [
      {
        title: "Official WhatsApp Business Platform",
        body: "Sent with Meta-approved message templates from INVTRA's business account — never from a personal phone.",
      },
      { title: "Accept or decline in one tap", body: "Guests respond right in the chat. No links to copy, no forms to fill." },
      { title: "Nothing to install", body: "Guests need no app and no account — only WhatsApp." },
      {
        title: "Gracious either way",
        body: "A decline receives a polite thank-you. An acceptance receives a personal invitation and QR code.",
      },
    ],
    illustration: {
      message: "Dear Noura, you are warmly invited to celebrate the wedding of Ahmed & Sara…",
      accept: "Accept Invitation",
      decline: "Decline",
      ifAccept: "If they accept",
      acceptReply: "Thank you for accepting! Here is your personal invitation.",
      view: "View Invitation",
      ifDecline: "If they decline",
      declineReply: "Thank you for letting us know. We'll miss you!",
      noQr: "No QR code is sent",
    },
  },

  qr: {
    eyebrow: "Personalized QR codes",
    title: "One guest. One code.",
    body: "Every guest receives a QR code that belongs to them alone — never one universal code shared by everyone. It opens their personal invitation and carries the seats you reserved for them.",
    points: [
      { title: "Unique to every guest", body: "Each code is tied to a single guest and the number of seats on their invitation." },
      { title: "Opens their invitation", body: "Scanning reveals the guest's personal invitation website, with every detail of the day." },
      { title: "Every scan recorded", body: "See when invitations are opened and when codes are scanned." },
      { title: "Check-in at the door", body: "Scan a guest's code at the entrance and check them in with a tap." },
    ],
    card: {
      label: "Personal invitation",
      guest: "Khalid Al Hashimi",
      admits: "Admits 2",
      scan: "Scan at the entrance",
      others: ["Noura Al Mansouri", "Omar Haddad"],
      qrLabel: "Example of a personal QR code",
    },
  },

  rsvp: {
    eyebrow: "RSVP & event management",
    title: "Every response, beautifully in order.",
    body: "Follow acceptances, declines and pending replies as they happen, then welcome guests at the door — all from one calm, clear dashboard.",
    points: [
      { title: "Live responses", body: "Your guest list updates the moment someone taps a button." },
      { title: "Views & scans", body: "Know who has opened their invitation and who has arrived." },
      { title: "Gentle reminders", body: "Resend the invitation to guests who haven't replied yet." },
      { title: "Export anytime", body: "Download your guest list and responses as a spreadsheet." },
    ],
    vignette: {
      label: "Example of the INVTRA event dashboard",
      event: "The Wedding of Ahmed & Sara",
      date: "Saturday, 12 December 2026",
      live: "Live",
      guests: "Guests",
      accepted: "Accepted",
      declined: "Declined",
      pending: "Pending",
      views: "Invitation views",
      scans: "QR scans",
      responses: "Responses",
      responded: "{percent}% responded",
      activity: "Recent activity",
      feed: [
        { name: "Khalid Al Hashimi", action: "accepted the invitation", time: "2 min ago", tone: "sage" },
        { name: "Noura Al Mansouri", action: "viewed her invitation", time: "8 min ago", tone: "bronze" },
        { name: "Omar Haddad", action: "declined with thanks", time: "21 min ago", tone: "rosewood" },
        { name: "Layla Haddad", action: "scanned her QR code", time: "1 hr ago", tone: "slate" },
      ],
    },
  },

  bilingual: {
    eyebrow: "Arabic & English",
    title: "Fluent in both of your languages.",
    body: "INVTRA is bilingual from the ground up — never translated as an afterthought. Choose Arabic, English, or a single invitation that carries both.",
    points: [
      { title: "True right-to-left", body: "Arabic invitations are composed right-to-left, set in proper Arabic typefaces." },
      { title: "Each guest in their language", body: "Guests can receive their WhatsApp message in Arabic or English." },
      { title: "Arabic or Latin numerals", body: "Dates and times appear exactly the way your family expects." },
      { title: "One bilingual card", body: "Arabic and English held in perfect balance on a single design." },
    ],
    arabicCard: "Arabic invitation",
    englishCard: "English invitation",
    bilingualCard: "Bilingual invitation",
  },

  pricing: {
    eyebrow: "Pricing",
    title: "Simple pricing, per event.",
    body: "Pay once for each event — no subscriptions and no per-message fees. WhatsApp messaging is included.",
    perEvent: "per event",
    oneTime: "One-time payment",
    tailored: "Tailored",
    tailoredNote: "Quoted for your event",
    recommended: "Recommended",
    guestsUpTo: "Up to {count} guests",
    cta: "Get started",
    contactCta: "Contact us",
    contactSubject: "Custom event enquiry",
    plans: {
      BASIC: {
        tagline: "For intimate gatherings and family occasions.",
        features: [
          "Standard INVTRA designs",
          "Upload your own design",
          "Music and photo gallery on the invitation",
          "WhatsApp delivery with Accept & Decline",
          "A personal QR code for every guest",
          "RSVP tracking and door check-in",
        ],
      },
      PREMIUM: {
        tagline: "For weddings and celebrations where every detail matters.",
        features: [
          "All premium designs — Luxury, Traditional & Bilingual",
          "Everything in Basic",
          "Priority support",
        ],
      },
      CUSTOM: {
        tagline: "For large events and bespoke requirements.",
        features: [
          "More than 500 guests",
          "Advanced customisation",
          "Help preparing your guest list and design",
          "A dedicated point of contact",
        ],
      },
    },
    included: "Every plan includes WhatsApp messaging, a personal invitation website for each guest, and Arabic & English.",
    testSends: "Every event includes {count} free test sends to your own WhatsApp number — see exactly what your guests receive before you choose a plan.",
  },

  faq: {
    eyebrow: "Questions",
    title: "Frequently asked questions",
    body: "Can't find what you're looking for? Write to us at {email} and we'll gladly help.",
    items: [
      {
        q: "Do you use the official WhatsApp?",
        a: "Yes. Every invitation is sent through the official WhatsApp Business Platform from Meta, using message templates that Meta has approved. Messages come from INVTRA's business account — never from a personal phone or unofficial automation.",
      },
      {
        q: "Do my guests need to download an app or create an account?",
        a: "No. Guests receive the invitation in WhatsApp and simply tap Accept Invitation or Decline. Their personal invitation opens in any browser — there is nothing to install and nothing to sign up for.",
      },
      {
        q: "What happens if a guest declines?",
        a: "They receive a short, gracious thank-you message and their reply appears in your dashboard straight away. Guests who decline are not sent a QR code or a personal invitation.",
      },
      {
        q: "Can I upload my own design?",
        a: "Yes. Upload your own invitation artwork and INVTRA adds each guest's personal QR code to it — or choose one of our designs and personalise its colours, fonts and wording.",
      },
      {
        q: "Do you support Arabic and bilingual invitations?",
        a: "Fully. Invitations can be in Arabic, English or both, with true right-to-left layouts, Arabic typefaces and your choice of Arabic or Latin numerals. Each guest can receive their WhatsApp message in Arabic or English.",
      },
      {
        q: "How do you handle my guests' privacy?",
        a: "Guest phone numbers are used only to deliver your invitations — never shared, never sold and never used for marketing. You can delete an event at any time; deleted events and their guest data are permanently purged after 30 days.",
      },
      {
        q: "What if event details change after I've sent the invitations?",
        a: "Edit the details in your dashboard and INVTRA regenerates the invitation. You can then send the update to every guest who has accepted — their personal link and QR code stay the same.",
      },
      {
        q: "How does the QR code work?",
        a: "Every guest receives their own unique code — never one universal code for everyone. Scanning it opens that guest's personal invitation website, and at the entrance you can check them in with a tap while signed in as the host.",
      },
      {
        q: "Can I try it before I pay?",
        a: "Yes. Every event includes 3 free test sends to your own WhatsApp number, so you can experience the full flow — message, Accept, personal invitation and QR code — before choosing a plan.",
      },
      {
        q: "Which plan do I need?",
        a: "Basic covers up to 100 guests with our standard designs. Premium covers up to 500 guests and adds every premium design and priority support. Music, a photo gallery and uploading your own design are included in every plan. For larger events or bespoke requirements, choose Custom and we'll prepare a quote. Plans are paid once per event.",
      },
    ],
  },

  cta: {
    eyebrow: "Begin",
    title: "Your guests deserve an invitation worth remembering.",
    body: "Create your invitation today and send yourself a free test on WhatsApp in minutes.",
    primary: "Create an Invitation",
    secondary: "View pricing",
  },

  designsPage: {
    eyebrow: "The collection",
    title: "Invitation designs",
    body: "Each design is rendered live, exactly as it will reach your guests. Switch the language to see how every design carries Arabic, English, or both.",
    languageLabel: "Preview language",
    preview: "Preview",
    use: "Use this design",
    designedFor: "Designed for {language}",
    previewOf: "{name} invitation design",
    ownTitle: "Prefer your own artwork?",
    ownBody: "Upload the invitation you already have — INVTRA adds each guest's personal QR code and delivers it on WhatsApp.",
    ownCta: "Start with your design",
    ownSample: { names: "Layla & Omar", line: "are getting married", date: "14 · 02 · 2027", caption: "Scan for your invitation", label: "Example of an uploaded design with a personal QR code added" },
  },

  pricingPage: {
    eyebrow: "Pricing",
    title: "One event. One simple price.",
    body: "Choose the plan that fits your guest list. You pay once per event, and WhatsApp messaging is always included.",
    includedTitle: "Included with every event",
    included: [
      { title: "WhatsApp delivery", body: "Sent through the official WhatsApp Business Platform, messaging included." },
      { title: "A QR code per guest", body: "Unique, personal codes — never one shared code for everyone." },
      { title: "Invitation website", body: "Each guest's own page with every detail of the day." },
      { title: "RSVP dashboard", body: "Live acceptances, declines, views and scans in one place." },
      { title: "Door check-in", body: "Scan codes at the entrance and see who has arrived." },
      { title: "Arabic & English", body: "True right-to-left layouts and bilingual invitations." },
    ],
    questions: "Have a question first?",
    questionsBody: "Read the frequently asked questions or write to us — we reply personally.",
    readFaq: "Read the FAQ",
  },

  legal: {
    eyebrow: "Legal",
    updatedLabel: "Last updated",
    updated: "2 October 2026",
    contents: "On this page",
    questions: "Questions about this page? Write to {email}.",
    privacy: {
      title: "Privacy Policy",
      intro: [
        "INVTRA provides a service for designing digital invitations and delivering them to guests through WhatsApp. This policy explains what information we process, why we process it, and the choices you have.",
        "We have kept it short and plain on purpose. If anything is unclear, write to us and we will explain.",
      ],
      sections: [
        {
          id: "information",
          heading: "Information we process",
          body: ["We only process the information needed to create your invitations and deliver them to your guests:"],
          list: [
            "Account information — your name, email address, language preference, an optional phone number, and your password, which is stored only as a secure hash.",
            "Event information — the details you enter for your event, such as names, dates, venue and wording, and any images, music or files you upload.",
            "Guest information you provide — your guests' names, WhatsApp numbers, the number of seats on each invitation and any notes you add.",
            "Responses and activity — whether a guest accepted or declined, when a message was delivered, when an invitation was viewed or its QR code scanned, and door check-ins. We record these without storing guests' IP addresses.",
            "Payment information — purchases are handled by our payment provider. We never see or store full card numbers.",
          ],
        },
        {
          id: "use",
          heading: "How we use it",
          body: ["We use this information to:"],
          list: [
            "deliver the invitations you send and show each guest their personal invitation and QR code;",
            "collect RSVPs and show them to you in your dashboard;",
            "run your account — sign-in, password resets, security and support;",
            "keep INVTRA reliable and protect it against abuse such as spam.",
          ],
          after: [
            "We do not sell personal information. We never use guest phone numbers for marketing, and we never message a guest about anything other than the invitation you sent them.",
          ],
        },
        {
          id: "providers",
          heading: "WhatsApp and other service providers",
          body: [
            "Invitations are delivered through the WhatsApp Business Platform operated by Meta Platforms, which processes guests' phone numbers and message content in order to deliver each message. Meta's own terms and privacy policy apply to WhatsApp itself.",
            "We also rely on carefully chosen providers for hosting, databases, file storage, email and payments. They process data only on our behalf and only to provide their service to us.",
          ],
        },
        {
          id: "cookies",
          heading: "Cookies",
          body: [
            "We use two cookies, and only two: a session cookie that keeps you signed in, and a language cookie that remembers whether you prefer Arabic or English. We do not use advertising or third-party tracking cookies.",
          ],
        },
        {
          id: "retention",
          heading: "Retention and deletion",
          body: ["You stay in control of your data:"],
          list: [
            "You can delete an event at any time. Deleted events — including guest lists, responses and uploaded files — are permanently purged after 30 days.",
            "You can delete your account from your account settings, which removes your account and all of your events.",
            "Password reset links expire after one hour.",
          ],
          after: ["We may keep limited records where the law requires it, for example records of payments."],
        },
        {
          id: "security",
          heading: "Security",
          body: [
            "All traffic to INVTRA is encrypted in transit. Passwords are stored only as salted hashes, never in readable form. Each guest reaches their invitation through a unique, randomly generated link, and your dashboard is accessible only from your account.",
          ],
        },
        {
          id: "hosts",
          heading: "Your responsibility as a host",
          body: [
            "You provide your guests' details to us. By sending invitations, you confirm that you know each guest, that you are genuinely inviting them, and that they would expect to hear from you about your event.",
          ],
        },
        {
          id: "guests",
          heading: "If you received an invitation",
          body: [
            "Your name and number were added by the host who invited you. If you would like your details corrected or removed, ask the host or write to us at hello@invtra.store and we will help.",
          ],
        },
        {
          id: "rights",
          heading: "Your rights",
          body: [
            "You can ask to access, correct, export or delete your personal information. Most of this you can do yourself from your dashboard and settings; for anything else, contact us and we will respond promptly.",
          ],
        },
        {
          id: "changes",
          heading: "Changes to this policy",
          body: [
            "If we make meaningful changes, we will update this page and, where appropriate, let account holders know by email.",
          ],
        },
      ] as LegalSection[],
    },
    terms: {
      title: "Terms of Service",
      intro: [
        "These terms govern your use of INVTRA. By creating an account or sending invitations, you agree to them. We have written them to be fair and easy to read.",
      ],
      sections: [
        {
          id: "service",
          heading: "The service",
          body: [
            "INVTRA lets you design digital invitations, send them to your guests through WhatsApp, collect their replies, and welcome them at the door with personal QR codes.",
          ],
        },
        {
          id: "account",
          heading: "Your account",
          body: [
            "You must be at least 18 years old and provide accurate information. Keep your password safe — you are responsible for activity on your account. Tell us straight away if you believe someone else has accessed it.",
          ],
        },
        {
          id: "consent",
          heading: "Consent to message your guests",
          body: [
            "You may only send invitations to people you know, whom you are genuinely inviting, and who would expect to hear from you. You are responsible for having the right to share their names and numbers with us for this purpose.",
          ],
        },
        {
          id: "acceptable-use",
          heading: "Acceptable use",
          body: ["INVTRA is for invitations only. You agree not to:"],
          list: [
            "send spam, marketing or promotional messages of any kind;",
            "message people who are not invited to your event;",
            "send content that is unlawful, hateful, harassing or misleading;",
            "upload content you do not have the right to use;",
            "attempt to access other people's data, disrupt the service or probe its security;",
            "break WhatsApp's Business and Commerce policies.",
          ],
          after: ["We may pause sending or suspend an account that breaks these rules, to protect guests and the service."],
        },
        {
          id: "payments",
          heading: "Plans and payments",
          body: [
            "Plans are bought per event as a one-time payment; the price is always shown before you pay. WhatsApp messaging for your plan's guest allowance is included. Every event includes 3 free test sends to your own number before you buy.",
            "Because messages go out as soon as you send them, payments are non-refundable once invitations have been sent, except where the law requires otherwise. If something goes wrong on our side, contact us and we will make it right.",
          ],
        },
        {
          id: "delivery",
          heading: "Message delivery",
          body: [
            "We send messages through the WhatsApp Business Platform. Delivery also depends on Meta and on each guest: a number may not use WhatsApp, a guest may have chosen not to receive business messages, or Meta may limit delivery. We show you the status of every message, but we cannot guarantee that each one is delivered or read.",
          ],
        },
        {
          id: "content",
          heading: "Your content",
          body: [
            "Everything you upload remains yours. You give us permission to store, process and display it only as needed to provide INVTRA to you and your guests. INVTRA's designs remain ours, and you are welcome to use them for your invitations.",
          ],
        },
        {
          id: "availability",
          heading: "Availability and changes",
          body: [
            "We work hard to keep INVTRA available and reliable, but the service is provided as it is, and we cannot promise it will never be interrupted. We may improve or change features over time.",
          ],
        },
        {
          id: "liability",
          heading: "Liability",
          body: [
            "To the extent the law allows, INVTRA is not liable for indirect or consequential losses, and our total liability for any event is limited to the amount you paid for that event. Nothing in these terms limits rights you have under consumer law.",
          ],
        },
        {
          id: "ending",
          heading: "Ending your use",
          body: [
            "You can delete your events or your account at any time from your dashboard. We may suspend or close accounts that break these terms, with notice where that is reasonable.",
          ],
        },
        {
          id: "changes",
          heading: "Changes to these terms",
          body: [
            "We may update these terms from time to time. Meaningful changes will be announced on this page and by email to account holders. Continuing to use INVTRA after a change means you accept the updated terms.",
          ],
        },
      ] as LegalSection[],
    },
  },
};
