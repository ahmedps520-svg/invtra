import type { EventType } from "@prisma/client";
import type { ThemeKey } from "@/lib/themes/registry";

/**
 * Landing pages for each occasion (/invitations/<slug>, Arabic at /ar/invitations/<slug>).
 * Written for people searching for that kind of invitation — server-rendered, never sent
 * to the browser as a dictionary.
 */
export interface OccasionCopy {
  /** Short label for navigation ("Weddings"). */
  nav: string;
  /** <title> (brand is appended). */
  title: string;
  description: string;
  h1: string;
  intro: string;
  points: { title: string; body: string }[];
  faq: { q: string; a: string }[];
}

export interface OccasionPage {
  slug: string;
  type: EventType;
  /** Design shown in the page's hero and share image. */
  theme: ThemeKey;
  related: string[];
  en: OccasionCopy;
  ar: OccasionCopy;
}

export const OCCASION_PAGES: OccasionPage[] = [
  {
    slug: "wedding",
    type: "WEDDING",
    theme: "luxury",
    related: ["engagement", "henna-night", "anniversary"],
    en: {
      nav: "Weddings",
      title: "Digital Wedding Invitations on WhatsApp",
      description:
        "Elegant digital wedding invitations sent on WhatsApp. Each guest gets a personal invitation, a unique QR code for the entrance and a one-tap RSVP — in Arabic, English or both.",
      h1: "Digital wedding invitations, delivered on WhatsApp",
      intro:
        "Send every guest a beautiful wedding invitation they can accept with a single tap. INVTRA delivers it through the official WhatsApp Business Platform and gives each guest their own invitation page and entry QR code.",
      points: [
        { title: "A personal invitation for every guest", body: "Each guest receives the invitation addressed to them, with how many people it admits and their own QR code for the door." },
        { title: "RSVPs that arrive on their own", body: "Guests tap Accept or Decline in WhatsApp. Your guest list updates instantly — no chasing replies one by one." },
        { title: "Check-in at the entrance", body: "Scan each guest's QR code at the hall to welcome them and see who has arrived, live." },
      ],
      faq: [
        { q: "Can I send a wedding invitation in Arabic and English?", a: "Yes. Choose Arabic, English or a single bilingual invitation, with proper right-to-left Arabic typography. Each guest can receive the WhatsApp message in their own language." },
        { q: "Can I use the wedding card I already designed?", a: "Yes. Upload your own artwork and INVTRA adds each guest's personal QR code to it before sending." },
        { q: "How do guests reply?", a: "They tap Accept Invitation or Decline in WhatsApp. Guests who accept instantly receive their personal invitation and QR code; guests who decline receive a polite thank-you." },
      ],
    },
    ar: {
      nav: "الأعراس",
      title: "دعوات زواج إلكترونية عبر واتساب",
      description:
        "دعوات زفاف إلكترونية أنيقة تُرسل عبر واتساب. يتلقى كل ضيف دعوة باسمه ورمز QR خاصًا للدخول وردًّا بضغطة واحدة — بالعربية أو الإنجليزية أو كلتيهما.",
      h1: "دعوات زواج إلكترونية تصل عبر واتساب",
      intro:
        "أرسل لكل ضيف دعوة زفاف راقية يقبلها بضغطة واحدة. تُرسل إنفترا الدعوة عبر منصة واتساب للأعمال الرسمية، ويحصل كل ضيف على صفحة دعوة خاصة ورمز QR للدخول.",
      points: [
        { title: "دعوة شخصية لكل ضيف", body: "يتلقى كل ضيف دعوة باسمه، مع عدد الأشخاص المسموح لهم ورمز QR خاص به للدخول." },
        { title: "ردود تصلك تلقائيًا", body: "يضغط الضيف «قبول» أو «اعتذار» في واتساب، فتتحدّث قائمة ضيوفك فورًا دون متابعة كل شخص على حدة." },
        { title: "تسجيل الحضور عند المدخل", body: "امسح رمز كل ضيف عند القاعة للترحيب به ومعرفة من حضر لحظة بلحظة." },
      ],
      faq: [
        { q: "هل يمكن إرسال دعوة الزواج بالعربية والإنجليزية؟", a: "نعم. اختر العربية أو الإنجليزية أو دعوة واحدة ثنائية اللغة بخطوط عربية صحيحة من اليمين إلى اليسار، ويمكن أن يتلقى كل ضيف رسالة واتساب بلغته." },
        { q: "هل يمكنني استخدام بطاقة العرس التي صممتها مسبقًا؟", a: "نعم. ارفع تصميمك وستضيف إنفترا رمز QR الشخصي لكل ضيف قبل الإرسال." },
        { q: "كيف يرد الضيوف؟", a: "يضغطون «قبول الدعوة» أو «اعتذار» في واتساب. من يقبل يتلقى فورًا دعوته الشخصية ورمز QR، ومن يعتذر يتلقى رسالة شكر لطيفة." },
      ],
    },
  },
  {
    slug: "engagement",
    type: "ENGAGEMENT",
    theme: "romantic",
    related: ["wedding", "henna-night", "anniversary"],
    en: {
      nav: "Engagements",
      title: "Engagement Party Invitations on WhatsApp",
      description:
        "Beautiful engagement invitations sent on WhatsApp, with one-tap RSVP and a personal QR code for every guest. Romantic, classic and Arabic designs.",
      h1: "Engagement invitations as lovely as the moment",
      intro:
        "Share your news with an invitation that feels personal. Pick a romantic design, add your names and the date, and INVTRA sends each guest their own invitation on WhatsApp.",
      points: [
        { title: "Designs made for two names", body: "Romantic, classic and Arabic designs that place your names beautifully, with an ampersand that feels hand-set." },
        { title: "Everyone's answer in one place", body: "See who has accepted, declined or not replied yet, and gently resend to those who haven't answered." },
        { title: "Ready for the wedding, too", body: "Keep your guest list and design — sending the wedding invitation later takes minutes." },
      ],
      faq: [
        { q: "Can guests bring someone with them?", a: "You decide how many people each invitation admits. It appears on the guest's invitation and their QR code." },
        { q: "Can I add a map to the venue?", a: "Yes. Paste a Google Maps, Apple Maps or Waze link and guests can open directions from their invitation page." },
        { q: "Is there an app for guests to install?", a: "No. Everything happens in WhatsApp and the browser — nothing to download and no account to create." },
      ],
    },
    ar: {
      nav: "الخطوبة",
      title: "دعوات خطوبة إلكترونية عبر واتساب",
      description: "دعوات خطوبة جميلة تُرسل عبر واتساب، مع رد بضغطة واحدة ورمز QR شخصي لكل ضيف. تصاميم رومانسية وكلاسيكية وعربية.",
      h1: "دعوات خطوبة بجمال اللحظة",
      intro: "شارك خبركم السعيد بدعوة تشعر الضيف بأنها له وحده. اختر تصميمًا رومانسيًا، وأضف الأسماء والتاريخ، وتتكفّل إنفترا بإرسال دعوة خاصة لكل ضيف عبر واتساب.",
      points: [
        { title: "تصاميم مهيأة لاسمين", body: "تصاميم رومانسية وكلاسيكية وعربية تضع الاسمين في أجمل صورة." },
        { title: "كل الردود في مكان واحد", body: "اعرف من قبل ومن اعتذر ومن لم يرد بعد، وأعد الإرسال بلطف لمن لم يرد." },
        { title: "جاهزة للعرس أيضًا", body: "احتفظ بقائمة الضيوف والتصميم، فإرسال دعوة الزواج لاحقًا لا يستغرق سوى دقائق." },
      ],
      faq: [
        { q: "هل يمكن للضيف إحضار مرافق؟", a: "أنت من يحدد عدد الأشخاص لكل دعوة، ويظهر ذلك في دعوة الضيف ورمز QR الخاص به." },
        { q: "هل يمكن إضافة خريطة للمكان؟", a: "نعم. الصق رابط خرائط Google أو Apple أو Waze ليفتح الضيف الاتجاهات من صفحة دعوته." },
        { q: "هل يحتاج الضيوف إلى تثبيت تطبيق؟", a: "لا. كل شيء يتم في واتساب والمتصفح، دون تنزيل أو إنشاء حساب." },
      ],
    },
  },
  {
    slug: "henna-night",
    type: "HENNA",
    theme: "henna",
    related: ["wedding", "engagement", "ramadan-eid"],
    en: {
      nav: "Henna nights",
      title: "Henna Night Invitations on WhatsApp",
      description:
        "Henna night invitations with traditional mandala designs, sent on WhatsApp in Arabic or English — with one-tap RSVP and a QR code for every guest.",
      h1: "Henna night invitations, rooted in tradition",
      intro:
        "Invite the women of the family and friends to the henna night with a design inspired by traditional henna art — warm terracotta, mandalas and delicate paisleys.",
      points: [
        { title: "Inspired by henna art", body: "Our Henna design is drawn with mandalas and paisleys, in palettes from terracotta to rose and gold." },
        { title: "Arabic first", body: "Set beautifully in Arabic typefaces, with English or both languages when you need them." },
        { title: "A private guest list", body: "Only the guests you invite receive a personal invitation and entry code — perfect for ladies-only evenings." },
      ],
      faq: [
        { q: "Can I write my own wording?", a: "Yes. Edit the opening line, the invitation text and the closing message in Arabic and English in the live editor." },
        { q: "Can I add a dress code?", a: "Yes. Add a dress code and any notes — they appear on each guest's invitation page." },
        { q: "Can I send the henna night and wedding invitations separately?", a: "Yes. Create each event separately with its own design, guest list and replies." },
      ],
    },
    ar: {
      nav: "ليالي الحناء",
      title: "دعوات ليلة الحناء عبر واتساب",
      description: "دعوات ليلة الحناء بتصاميم نقوش تقليدية، تُرسل عبر واتساب بالعربية أو الإنجليزية، مع رد بضغطة واحدة ورمز QR لكل ضيفة.",
      h1: "دعوات ليلة الحناء بروح التراث",
      intro: "ادعي الأهل والصديقات إلى ليلة الحناء بتصميم مستوحى من فن الحناء التقليدي: ألوان دافئة وزخارف ونقوش رقيقة.",
      points: [
        { title: "مستوحاة من نقش الحناء", body: "تصميم «حناء» مرسوم بزخارف ونقوش، بألوان من الطيني إلى الوردي والذهبي." },
        { title: "العربية أولًا", body: "خطوط عربية أنيقة، مع الإنجليزية أو اللغتين معًا عند الحاجة." },
        { title: "قائمة ضيوف خاصة", body: "لا يتلقى الدعوة ورمز الدخول إلا من تدعوهن — مثالية للأمسيات النسائية." },
      ],
      faq: [
        { q: "هل يمكنني كتابة نص الدعوة بنفسي؟", a: "نعم. عدّلي الافتتاحية ونص الدعوة والختام بالعربية والإنجليزية في المحرر المباشر." },
        { q: "هل يمكن إضافة قواعد اللباس؟", a: "نعم. أضيفي قواعد اللباس وأي ملاحظات لتظهر في صفحة دعوة كل ضيفة." },
        { q: "هل يمكن إرسال دعوة الحناء ودعوة العرس بشكل منفصل؟", a: "نعم. أنشئي كل مناسبة على حدة بتصميمها وقائمة ضيوفها وردودها." },
      ],
    },
  },
  {
    slug: "newborn",
    type: "NEWBORN",
    theme: "teddy",
    related: ["baby-shower", "aqiqah", "birthday"],
    en: {
      nav: "New baby & hospital visits",
      title: "New Baby & Hospital Visit Invitations on WhatsApp",
      description:
        "Welcome your newborn with a sweet digital invitation — teddy bears, moons and clouds. Invite family and friends to visit at the hospital or at home, with replies on WhatsApp.",
      h1: "Welcome your little one — and invite visitors with love",
      intro:
        "Share the joy of your new baby and let family and friends know when to visit, at the hospital or at home. Choose a soft design with teddy bears, moons or clouds, and INVTRA sends every guest their own invitation on WhatsApp.",
      points: [
        { title: "Baby designs with heart", body: "Teddy bears and balloons, moonlit skies, soft clouds and a lullaby crib mobile — in baby blue, blush, mint or lavender." },
        { title: "Visiting hours made easy", body: "Share the hospital, room number and visiting times, with a map link. Guests confirm in one tap, so you know who's coming." },
        { title: "Gentle on new parents", body: "No phone calls to return: replies, directions and reminders are handled for you while you rest." },
      ],
      faq: [
        { q: "Can I invite people to visit at the hospital?", a: "Yes. Add the hospital name, suite or room number and visiting hours. Each guest sees them on their invitation, with directions." },
        { q: "Can I use the baby's name before it's announced?", a: "It's your choice — use the baby's name, or a line like \"our little one\" until you're ready to share it." },
        { q: "Is there an Arabic version?", a: "Yes. Every baby design works in Arabic, English or both, with wording written for welcoming a newborn." },
      ],
    },
    ar: {
      nav: "استقبال المولود وزيارات المستشفى",
      title: "دعوات استقبال المولود وزيارة المستشفى عبر واتساب",
      description: "رحّب بمولودك بدعوة إلكترونية لطيفة — دببة وأقمار وغيوم. ادعُ الأهل والأصدقاء للزيارة في المستشفى أو المنزل، مع الردود عبر واتساب.",
      h1: "رحّب بمولودك وادعُ الزوّار بكل حب",
      intro: "شارك فرحة المولود الجديد وأخبر الأهل والأصدقاء بموعد الزيارة في المستشفى أو المنزل. اختر تصميمًا هادئًا بالدببة أو الأقمار أو الغيوم، وتُرسل إنفترا لكل ضيف دعوته الخاصة عبر واتساب.",
      points: [
        { title: "تصاميم مواليد مليئة بالحب", body: "دببة وبالونات، وسماء يضيئها القمر، وغيوم ناعمة، ودوّارة مهد — بألوان الأزرق والوردي والنعناعي والبنفسجي." },
        { title: "مواعيد زيارة واضحة", body: "شارك اسم المستشفى ورقم الغرفة وأوقات الزيارة مع رابط الخريطة، ويؤكد الضيف حضوره بضغطة واحدة." },
        { title: "راحة للوالدين", body: "لا اتصالات تحتاج إلى رد: الردود والاتجاهات والتذكيرات تتم عنكم بينما ترتاحون." },
      ],
      faq: [
        { q: "هل يمكن دعوة الأهل للزيارة في المستشفى؟", a: "نعم. أضف اسم المستشفى ورقم الجناح أو الغرفة وأوقات الزيارة، فتظهر في دعوة كل ضيف مع الاتجاهات." },
        { q: "هل يجب كتابة اسم المولود؟", a: "الأمر يعود إليك — اكتب اسم المولود، أو عبارة مثل «مولودنا» حتى تحب الإعلان عنه." },
        { q: "هل تتوفر نسخة عربية؟", a: "نعم. كل تصاميم المواليد تعمل بالعربية أو الإنجليزية أو كلتيهما، بصياغة مكتوبة لاستقبال المولود." },
      ],
    },
  },
  {
    slug: "baby-shower",
    type: "BABY_SHOWER",
    theme: "clouds",
    related: ["newborn", "aqiqah", "birthday"],
    en: {
      nav: "Baby showers",
      title: "Baby Shower Invitations on WhatsApp",
      description:
        "Cute baby shower invitations with clouds, teddy bears and balloons — sent on WhatsApp with one-tap RSVP and a personal invitation page for every guest.",
      h1: "Baby shower invitations as sweet as the guest of honour",
      intro:
        "Celebrate the mum-to-be with an invitation full of clouds, balloons and pastel colours. Guests reply in WhatsApp, and you always know how many are coming.",
      points: [
        { title: "Pastel designs, your colours", body: "Clouds, teddy bears and balloons in baby blue, blush, mint or butter yellow — or any colours you like." },
        { title: "Know your numbers", body: "See accepted and declined guests and the total attending, so planning the cake and the games is easy." },
        { title: "Photos and music", body: "Add a photo gallery and a song to the invitation page (music never plays until the guest presses play)." },
      ],
      faq: [
        { q: "Can I keep the baby's gender a surprise?", a: "Of course — choose a neutral palette like mint or butter yellow, or reveal it with blue or blush." },
        { q: "Can I send reminders?", a: "Yes. Resend the invitation to guests who haven't replied yet with one button." },
        { q: "Can I host it for someone else?", a: "Yes. The invitation can be from friends or family — just write the hosts' names the way you'd like them shown." },
      ],
    },
    ar: {
      nav: "حفلات استقبال المواليد",
      title: "دعوات حفل استقبال المولود (بيبي شاور) عبر واتساب",
      description: "دعوات بيبي شاور لطيفة بالغيوم والدببة والبالونات، تُرسل عبر واتساب مع رد بضغطة واحدة وصفحة دعوة شخصية لكل ضيف.",
      h1: "دعوات استقبال المولود بلطف ضيفه المنتظر",
      intro: "احتفلوا بالأم المنتظرة بدعوة مليئة بالغيوم والبالونات والألوان الهادئة. يرد الضيوف عبر واتساب، وتعرفون دائمًا عدد الحضور.",
      points: [
        { title: "ألوان ناعمة بذوقك", body: "غيوم ودببة وبالونات بالأزرق الفاتح أو الوردي أو النعناعي أو الأصفر الهادئ — أو أي ألوان تحبونها." },
        { title: "اعرفوا عدد الحضور", body: "شاهدوا من قبل ومن اعتذر وإجمالي الحضور، ليسهل التخطيط للكعكة والفقرات." },
        { title: "صور وموسيقى", body: "أضيفوا معرض صور وأغنية إلى صفحة الدعوة (لا تعمل الموسيقى إلا عندما يضغط الضيف تشغيل)." },
      ],
      faq: [
        { q: "هل يمكن إبقاء جنس المولود مفاجأة؟", a: "بالتأكيد — اختاروا لونًا محايدًا كالنعناعي أو الأصفر، أو أعلنوه بالأزرق أو الوردي." },
        { q: "هل يمكن إرسال تذكير؟", a: "نعم. أعيدوا إرسال الدعوة لمن لم يرد بضغطة زر." },
        { q: "هل يمكن تنظيمه لشخص آخر؟", a: "نعم. يمكن أن تكون الدعوة من الصديقات أو العائلة — اكتبوا أسماء الداعين كما تحبون." },
      ],
    },
  },
  {
    slug: "aqiqah",
    type: "AQIQAH",
    theme: "moonlight",
    related: ["newborn", "baby-shower", "ramadan-eid"],
    en: {
      nav: "Aqiqah",
      title: "Aqiqah Invitations on WhatsApp",
      description:
        "Aqiqah invitation cards in Arabic and English with moonlit, gentle designs — sent on WhatsApp with one-tap RSVP and a QR code for every guest.",
      h1: "Aqiqah invitations to give thanks together",
      intro:
        "Invite family and friends to celebrate the blessing of your child. Choose a moonlit or traditional design, write your wording in Arabic, English or both, and INVTRA delivers each invitation on WhatsApp.",
      points: [
        { title: "Graceful, meaningful designs", body: "Moonlight, Lullaby and traditional Arabic designs, with wording written for an aqiqah." },
        { title: "Arabic done properly", body: "Real Arabic typefaces, right-to-left layout and your choice of Arabic or Latin numerals." },
        { title: "Know how many to cater for", body: "Every reply updates your total attending, so the lunch or dinner is planned with confidence." },
      ],
      faq: [
        { q: "Can I invite men's and women's majlis separately?", a: "Yes. Create two events — each with its own guest list, venue and timing — or use groups to organise one list." },
        { q: "Can I add the programme?", a: "Yes. Add times for the reception, prayers and lunch; guests see them on their invitation page." },
        { q: "Can I send it in Arabic only?", a: "Yes. Choose Arabic and everything — the card, the WhatsApp messages and the invitation page — is in Arabic." },
      ],
    },
    ar: {
      nav: "العقيقة",
      title: "دعوات العقيقة عبر واتساب",
      description: "بطاقات دعوة عقيقة بالعربية والإنجليزية بتصاميم هادئة يضيئها القمر، تُرسل عبر واتساب مع رد بضغطة واحدة ورمز QR لكل ضيف.",
      h1: "دعوات عقيقة لنشكر الله معًا",
      intro: "ادعُ الأهل والأصدقاء للاحتفال بنعمة المولود. اختر تصميمًا يضيئه القمر أو تصميمًا تقليديًا، واكتب صياغتك بالعربية أو الإنجليزية أو كلتيهما، وتصل كل دعوة عبر واتساب.",
      points: [
        { title: "تصاميم راقية ذات معنى", body: "تصاميم «ضوء القمر» و«التهويدة» والتصاميم العربية التقليدية، بصياغة مكتوبة للعقيقة." },
        { title: "عربية متقنة", body: "خطوط عربية حقيقية واتجاه من اليمين إلى اليسار، مع اختيار الأرقام العربية أو اللاتينية." },
        { title: "اعرف عدد الحضور", body: "كل رد يحدّث إجمالي الحضور، فتخطط للغداء أو العشاء بثقة." },
      ],
      faq: [
        { q: "هل يمكن دعوة مجلس الرجال والنساء بشكل منفصل؟", a: "نعم. أنشئ مناسبتين لكل منهما قائمة ضيوف ومكان وموعد، أو استخدم المجموعات لتنظيم قائمة واحدة." },
        { q: "هل يمكن إضافة البرنامج؟", a: "نعم. أضف مواعيد الاستقبال والدعاء والغداء لتظهر في صفحة دعوة كل ضيف." },
        { q: "هل يمكن إرسالها بالعربية فقط؟", a: "نعم. اختر العربية ليكون كل شيء — البطاقة ورسائل واتساب وصفحة الدعوة — بالعربية." },
      ],
    },
  },
  {
    slug: "birthday",
    type: "BIRTHDAY",
    theme: "confetti",
    related: ["graduation", "baby-shower", "anniversary"],
    en: {
      nav: "Birthdays",
      title: "Birthday Party Invitations on WhatsApp",
      description:
        "Fun, stylish birthday invitations for kids and grown-ups — confetti, teddy bears or elegant designs — sent on WhatsApp with one-tap RSVP.",
      h1: "Birthday invitations that get everyone excited",
      intro:
        "From a first birthday to a milestone fortieth, send an invitation that sets the mood. Pick confetti and colour or something elegant, and let guests reply in WhatsApp.",
      points: [
        { title: "For every age", body: "Teddy and clouds for little ones, confetti for parties, and refined designs for milestone celebrations." },
        { title: "Replies without the group chat", body: "Each guest answers privately with one tap — no lost messages in a busy group." },
        { title: "Countdown to the day", body: "Every invitation page shows a live countdown, the venue map and your programme." },
      ],
      faq: [
        { q: "Can parents reply for children?", a: "Yes. Send the invitation to a parent's WhatsApp and set how many people it admits." },
        { q: "Can I invite people from different countries?", a: "Yes. Guests receive the invitation on WhatsApp wherever they are; times are shown in your event's time zone." },
        { q: "Can I change the date after sending?", a: "Yes. Edit the details and send the update to everyone who accepted — their link and QR code stay the same." },
      ],
    },
    ar: {
      nav: "أعياد الميلاد",
      title: "دعوات عيد ميلاد إلكترونية عبر واتساب",
      description: "دعوات عيد ميلاد مرحة وأنيقة للصغار والكبار — قصاصات ملونة أو دببة أو تصاميم راقية — تُرسل عبر واتساب مع رد بضغطة واحدة.",
      h1: "دعوات عيد ميلاد تُفرح الجميع",
      intro: "من عيد الميلاد الأول إلى الأربعين، أرسل دعوة تصنع الأجواء. اختر القصاصات الملونة أو تصميمًا راقيًا، ودع الضيوف يردون عبر واتساب.",
      points: [
        { title: "لكل الأعمار", body: "دببة وغيوم للصغار، وقصاصات ملونة للحفلات، وتصاميم راقية للمناسبات المميزة." },
        { title: "ردود دون مجموعات", body: "يرد كل ضيف بشكل خاص بضغطة واحدة، دون أن تضيع الرسائل في مجموعة مزدحمة." },
        { title: "عدّ تنازلي لليوم الكبير", body: "تعرض كل صفحة دعوة عدًّا تنازليًا وخريطة المكان وبرنامج الحفل." },
      ],
      faq: [
        { q: "هل يمكن للوالدين الرد عن الأطفال؟", a: "نعم. أرسل الدعوة إلى واتساب أحد الوالدين وحدد عدد الأشخاص المسموح لهم." },
        { q: "هل يمكن دعوة أشخاص من دول مختلفة؟", a: "نعم. يتلقى الضيوف الدعوة عبر واتساب أينما كانوا، وتظهر الأوقات بتوقيت مناسبتك." },
        { q: "هل يمكن تغيير الموعد بعد الإرسال؟", a: "نعم. عدّل التفاصيل وأرسل التحديث لكل من قبل الدعوة — ويبقى الرابط ورمز QR كما هما." },
      ],
    },
  },
  {
    slug: "graduation",
    type: "GRADUATION",
    theme: "modern",
    related: ["birthday", "corporate", "anniversary"],
    en: {
      nav: "Graduations",
      title: "Graduation Party Invitations on WhatsApp",
      description: "Celebrate the graduate with a modern digital invitation sent on WhatsApp — one-tap RSVP, a personal QR code and a live countdown for every guest.",
      h1: "Graduation invitations worth celebrating",
      intro: "Years of hard work deserve a proper celebration. Send family and friends a modern invitation, and see who's coming as the replies arrive.",
      points: [
        { title: "Modern and bold", body: "Clean, contemporary designs — or confetti for a party mood — personalised with the graduate's name." },
        { title: "Share the programme", body: "Dinner, speeches and photos: add the schedule so guests know what to expect." },
        { title: "Welcome guests by name", body: "Each guest's QR code lets you check them in at the door and see the room fill up." },
      ],
      faq: [
        { q: "Can I invite a large number of guests?", a: "Yes. Import your guest list from Excel or CSV — the Premium plan covers up to 500 guests, and larger events are quoted." },
        { q: "Do guests need to save my number?", a: "No. Messages arrive from INVTRA's verified WhatsApp Business account." },
        { q: "Can I add photos?", a: "Yes. Add a photo gallery and a cover photo to the invitation page." },
      ],
    },
    ar: {
      nav: "حفلات التخرج",
      title: "دعوات حفل تخرج إلكترونية عبر واتساب",
      description: "احتفل بالخريج بدعوة إلكترونية عصرية تُرسل عبر واتساب — رد بضغطة واحدة ورمز QR شخصي وعدّ تنازلي لكل ضيف.",
      h1: "دعوات تخرج تليق بالإنجاز",
      intro: "سنوات من الجهد تستحق احتفالًا يليق بها. أرسل للأهل والأصدقاء دعوة عصرية، وتابع الحضور مع وصول الردود.",
      points: [
        { title: "عصرية وجريئة", body: "تصاميم معاصرة نظيفة — أو قصاصات ملونة لأجواء احتفالية — باسم الخريج." },
        { title: "شارك البرنامج", body: "العشاء والكلمات والصور: أضف الفقرات ليعرف الضيوف ما ينتظرهم." },
        { title: "استقبل الضيوف بأسمائهم", body: "رمز QR لكل ضيف يتيح تسجيل حضوره عند الباب ومتابعة امتلاء القاعة." },
      ],
      faq: [
        { q: "هل يمكن دعوة عدد كبير من الضيوف؟", a: "نعم. استورد قائمة الضيوف من Excel أو CSV — تغطي الباقة المميّزة حتى 500 ضيف، والمناسبات الأكبر بعرض سعر خاص." },
        { q: "هل يحتاج الضيوف إلى حفظ رقمي؟", a: "لا. تصل الرسائل من حساب واتساب للأعمال الموثّق الخاص بإنفترا." },
        { q: "هل يمكن إضافة صور؟", a: "نعم. أضف معرض صور وصورة غلاف إلى صفحة الدعوة." },
      ],
    },
  },
  {
    slug: "anniversary",
    type: "ANNIVERSARY",
    theme: "garden",
    related: ["wedding", "engagement", "birthday"],
    en: {
      nav: "Anniversaries",
      title: "Anniversary Party Invitations on WhatsApp",
      description: "Elegant anniversary invitations — from a first year to a golden fiftieth — sent on WhatsApp with one-tap RSVP and a QR code for every guest.",
      h1: "Anniversary invitations to celebrate the years together",
      intro: "Gather the people who have shared your journey. Choose a blossoming garden design or timeless luxury, and INVTRA delivers each invitation personally on WhatsApp.",
      points: [
        { title: "Timeless designs", body: "Garden blossoms, classic luxury and royal designs for silver and golden anniversaries." },
        { title: "Your story, your words", body: "Write your own invitation text and add photos from over the years to the invitation page." },
        { title: "Easy for every generation", body: "Guests just tap a button in WhatsApp — no links to copy and nothing to install." },
      ],
      faq: [
        { q: "Can our children send the invitation for us?", a: "Yes. Anyone can create the event and write the invitation from the family." },
        { q: "Can I include a gallery of photos?", a: "Yes. Upload photos to a gallery shown on each guest's invitation page." },
        { q: "Is there a surprise-party option?", a: "Invitations go only to the guests you add, so the couple won't see it unless you invite them." },
      ],
    },
    ar: {
      nav: "ذكرى الزواج",
      title: "دعوات ذكرى الزواج عبر واتساب",
      description: "دعوات أنيقة لذكرى الزواج — من السنة الأولى إلى اليوبيل الذهبي — تُرسل عبر واتساب مع رد بضغطة واحدة ورمز QR لكل ضيف.",
      h1: "دعوات ذكرى الزواج للاحتفال بسنوات العمر معًا",
      intro: "اجمع من شاركوكم رحلتكم. اختر تصميم الحديقة المزهرة أو الفخامة الكلاسيكية، وتصل كل دعوة شخصيًا عبر واتساب.",
      points: [
        { title: "تصاميم خالدة", body: "أزهار الحديقة والفخامة الكلاسيكية والتصاميم الملكية لليوبيل الفضي والذهبي." },
        { title: "قصتكم بكلماتكم", body: "اكتبوا نص الدعوة بأنفسكم وأضيفوا صورًا من السنين إلى صفحة الدعوة." },
        { title: "سهلة لكل الأجيال", body: "يكفي أن يضغط الضيف زرًا في واتساب — لا روابط لنسخها ولا شيء لتثبيته." },
      ],
      faq: [
        { q: "هل يمكن لأبنائنا إرسال الدعوة عنا؟", a: "نعم. يمكن لأي شخص إنشاء المناسبة وكتابة الدعوة باسم العائلة." },
        { q: "هل يمكن إضافة معرض صور؟", a: "نعم. ارفعوا الصور لتظهر في معرض داخل صفحة دعوة كل ضيف." },
        { q: "هل يمكن تنظيم حفلة مفاجئة؟", a: "تُرسل الدعوات فقط إلى الضيوف الذين تضيفونهم، فلن يراها الزوجان إلا إذا دعوتموهما." },
      ],
    },
  },
  {
    slug: "ramadan-eid",
    type: "RAMADAN",
    theme: "lantern",
    related: ["aqiqah", "corporate", "henna-night"],
    en: {
      nav: "Ramadan & Eid",
      title: "Ramadan Ghabga, Iftar & Eid Invitations on WhatsApp",
      description:
        "Ramadan and Eid invitations with lanterns and crescent moons — for ghabgas, iftars, suhoors and Eid gatherings — sent on WhatsApp in Arabic and English.",
      h1: "Ramadan & Eid invitations, glowing with lanterns",
      intro:
        "Bring family, friends and colleagues together for a ghabga, iftar or Eid gathering. Choose our Lantern design or a traditional Arabic one, and send every guest their own invitation on WhatsApp.",
      points: [
        { title: "Lanterns and crescents", body: "A Ramadan design with hanging lanterns, a crescent moon and a starry night — in midnight, plum, emerald or ivory." },
        { title: "Perfect for majlis and offices", body: "Family ghabgas, company iftars and Eid lunches — each with its own guest list and replies." },
        { title: "Arabic wording ready", body: "\"Ramadan Kareem — you are warmly invited…\" written in Arabic and English, and fully editable." },
      ],
      faq: [
        { q: "Can I send iftar invitations for my company?", a: "Yes. Add your logo, invite colleagues and clients, and check guests in at the door with their QR codes." },
        { q: "Can I host several gatherings during Ramadan?", a: "Yes. Create a separate event for each night — your guest list can be imported again in seconds." },
        { q: "Does the time show correctly for the evening?", a: "Yes. Times are shown in your event's time zone, including gatherings that continue past midnight." },
      ],
    },
    ar: {
      nav: "رمضان والعيد",
      title: "دعوات الغبقة الرمضانية والإفطار والعيد عبر واتساب",
      description: "دعوات رمضان والعيد بالفوانيس والأهلّة — للغبقات والإفطار والسحور وتجمعات العيد — تُرسل عبر واتساب بالعربية والإنجليزية.",
      h1: "دعوات رمضان والعيد تضيئها الفوانيس",
      intro: "اجمع الأهل والأصدقاء والزملاء في غبقة أو إفطار أو تجمع عيد. اختر تصميم «الفانوس» أو تصميمًا عربيًا تقليديًا، وأرسل لكل ضيف دعوته الخاصة عبر واتساب.",
      points: [
        { title: "فوانيس وأهلّة", body: "تصميم رمضاني بفوانيس معلّقة وهلال وسماء مرصّعة بالنجوم — بالكحلي أو الأرجواني أو الزمردي أو العاجي." },
        { title: "مثالية للمجالس والشركات", body: "غبقات عائلية وإفطارات الشركات وغداء العيد — لكل منها قائمة ضيوف وردود." },
        { title: "صياغة عربية جاهزة", body: "«رمضان كريم — نتشرف بدعوتكم…» مكتوبة بالعربية والإنجليزية وقابلة للتعديل بالكامل." },
      ],
      faq: [
        { q: "هل يمكن إرسال دعوات إفطار لشركتي؟", a: "نعم. أضف شعار شركتك، وادعُ الزملاء والعملاء، وسجّل حضورهم عند الباب برموز QR." },
        { q: "هل يمكن تنظيم أكثر من تجمع خلال رمضان؟", a: "نعم. أنشئ مناسبة لكل ليلة، ويمكن استيراد قائمة الضيوف مجددًا في ثوانٍ." },
        { q: "هل يظهر الوقت بشكل صحيح للسهرات؟", a: "نعم. تظهر الأوقات بتوقيت مناسبتك، بما في ذلك التجمعات التي تمتد بعد منتصف الليل." },
      ],
    },
  },
  {
    slug: "corporate",
    type: "CORPORATE",
    theme: "modern",
    related: ["ramadan-eid", "graduation", "anniversary"],
    en: {
      nav: "Corporate events",
      title: "Corporate Event Invitations with QR Check-in",
      description:
        "Professional corporate event invitations on WhatsApp — launches, gala dinners and conferences — with RSVP tracking, your logo and QR code check-in at the door.",
      h1: "Corporate event invitations with RSVP and QR check-in",
      intro:
        "Invite clients, partners and teams to launches, gala dinners and conferences. INVTRA sends branded invitations on WhatsApp, tracks every reply and checks guests in with a scan.",
      points: [
        { title: "Your brand on every invitation", body: "Add your logo, colours and fonts in the live editor — or upload your own invitation artwork." },
        { title: "Guest lists at scale", body: "Import from Excel or CSV, organise by group and see opens, replies and QR scans in real time." },
        { title: "Fast entry", body: "Each guest's unique QR code is scanned at reception — no printed lists, no queues." },
      ],
      faq: [
        { q: "Can we invite more than 500 guests?", a: "Yes. Choose Custom and we'll prepare a quote and help prepare your guest list and design." },
        { q: "Is guest data kept private?", a: "Guest numbers are used only to deliver your invitations — never shared or used for marketing — and deleted events are purged after 30 days." },
        { q: "Can we export the responses?", a: "Yes. Download the guest list with replies, attendance and check-ins as a spreadsheet at any time." },
      ],
    },
    ar: {
      nav: "فعاليات الشركات",
      title: "دعوات فعاليات الشركات مع تسجيل الحضور برمز QR",
      description: "دعوات احترافية لفعاليات الشركات عبر واتساب — حفلات الإطلاق والعشاء الرسمي والمؤتمرات — مع متابعة الردود وشعارك وتسجيل الحضور برمز QR.",
      h1: "دعوات فعاليات الشركات مع الردود وتسجيل الحضور",
      intro: "ادعُ العملاء والشركاء وفرق العمل إلى حفلات الإطلاق والعشاء الرسمي والمؤتمرات. ترسل إنفترا دعوات بهويتك عبر واتساب، وتتابع كل رد، وتسجّل الحضور بمسح الرمز.",
      points: [
        { title: "هويتك في كل دعوة", body: "أضف شعارك وألوانك وخطوطك في المحرر المباشر — أو ارفع تصميم دعوتك الخاص." },
        { title: "قوائم ضيوف كبيرة", body: "استورد من Excel أو CSV، ونظّم الضيوف في مجموعات، وتابع الفتح والردود والمسح لحظة بلحظة." },
        { title: "دخول سريع", body: "يُمسح رمز QR الفريد لكل ضيف عند الاستقبال — دون قوائم مطبوعة أو طوابير." },
      ],
      faq: [
        { q: "هل يمكن دعوة أكثر من 500 ضيف؟", a: "نعم. اختر الباقة الخاصة وسنعدّ لك عرض سعر ونساعدك في تجهيز قائمة الضيوف والتصميم." },
        { q: "هل تبقى بيانات الضيوف خاصة؟", a: "تُستخدم أرقام الضيوف فقط لإيصال دعواتك — لا تُشارك ولا تُستخدم للتسويق — وتُحذف بيانات المناسبات المحذوفة بعد 30 يومًا." },
        { q: "هل يمكن تصدير الردود؟", a: "نعم. نزّل قائمة الضيوف مع الردود والحضور وتسجيل الدخول كجدول بيانات في أي وقت." },
      ],
    },
  },
];

export function getOccasionPage(slug: string): OccasionPage | undefined {
  return OCCASION_PAGES.find((p) => p.slug === slug);
}

/** The hub page (/invitations) — aimed at "event invitations", "e-invites", "online invitations". */
export const INVITATIONS_HUB = {
  en: {
    title: "Digital Event Invitations & E-Invites for Every Occasion",
    description:
      "Online event invitations delivered on WhatsApp — weddings, newborns and hospital visits, baby showers, aqiqah, birthdays, graduations, Ramadan & Eid and corporate events. Personal QR codes, one-tap RSVP, Arabic & English.",
    eyebrow: "Event invitations",
    h1: "Digital invitations for every event",
    intro:
      "INVTRA turns any occasion into a beautiful digital invitation that every guest receives personally on WhatsApp — with their own invitation page, a one-tap reply and a QR code for the door.",
    choose: "Choose your occasion",
    why: "Why hosts choose INVTRA",
    reasons: [
      { title: "Delivered where guests already are", body: "Invitations arrive in WhatsApp through the official WhatsApp Business Platform — no apps, emails or spam folders." },
      { title: "One tap to reply", body: "Accept or Decline buttons right in the message. Your guest list updates the moment someone answers." },
      { title: "A QR code for every guest", body: "Unique entry codes — never one shared code — so you can welcome each guest and see who has arrived." },
      { title: "Arabic & English", body: "Every design works in Arabic, English or both, with real right-to-left typography." },
    ],
  },
  ar: {
    title: "دعوات إلكترونية لجميع المناسبات عبر واتساب",
    description:
      "دعوات مناسبات إلكترونية تصل عبر واتساب — الأعراس واستقبال المواليد وزيارات المستشفى وحفلات المواليد والعقيقة وأعياد الميلاد والتخرج ورمضان والعيد وفعاليات الشركات. رموز QR شخصية ورد بضغطة واحدة بالعربية والإنجليزية.",
    eyebrow: "دعوات المناسبات",
    h1: "دعوات إلكترونية لكل مناسبة",
    intro: "تحوّل إنفترا أي مناسبة إلى دعوة رقمية أنيقة يتلقاها كل ضيف شخصيًا عبر واتساب — مع صفحة دعوة خاصة به، ورد بضغطة واحدة، ورمز QR للدخول.",
    choose: "اختر مناسبتك",
    why: "لماذا يختار المضيفون إنفترا",
    reasons: [
      { title: "تصل حيث يتواجد ضيوفك", body: "تصل الدعوات إلى واتساب عبر منصة واتساب للأعمال الرسمية — دون تطبيقات أو بريد إلكتروني أو رسائل مزعجة." },
      { title: "رد بضغطة واحدة", body: "زرّا القبول والاعتذار داخل الرسالة، وتتحدّث قائمة ضيوفك لحظة الرد." },
      { title: "رمز QR لكل ضيف", body: "رموز دخول فريدة — لا رمز واحد للجميع — لتستقبل كل ضيف وتعرف من حضر." },
      { title: "العربية والإنجليزية", body: "كل تصميم يعمل بالعربية أو الإنجليزية أو كلتيهما، بخطوط عربية حقيقية من اليمين إلى اليسار." },
    ],
  },
};
