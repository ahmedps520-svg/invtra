import type { Locale } from "@/lib/i18n/config";

/** Example wording for each occasion page ("Wording ideas") — every design's text is editable. */
export const OCCASION_WORDING: Record<string, Record<Locale, string[]>> = {
  wedding: {
    en: [
      "Together with their families, Ahmed & Sara request the pleasure of your company at the celebration of their marriage.",
      "With joy in our hearts, we invite you to share the happiest night of our lives.",
      "Your presence would complete our joy. Kindly reply by 1 December.",
    ],
    ar: [
      "بكل الحب والسرور، يتشرّف آل الهاشمي وآل المنصوري بدعوتكم لحضور حفل زفاف أحمد وسارة.",
      "بقلوب يغمرها الفرح، ندعوكم لمشاركتنا أجمل ليلة في عمرنا.",
      "حضوركم يكمّل فرحتنا، ونرجو تأكيد الحضور قبل ١ ديسمبر.",
    ],
  },
  engagement: {
    en: [
      "We said yes! Join us as we celebrate our engagement.",
      "Two families, one joy — please celebrate the engagement of Lina & Omar with us.",
      "An evening of love and family to mark our promise to each other.",
    ],
    ar: ["يسعدنا دعوتكم لمشاركتنا فرحة خطوبة لينا وعمر.", "عائلتان وفرحة واحدة — شاركونا الاحتفال بالخطوبة.", "أمسية عائلية مليئة بالحب نحتفل فيها بوعدنا."],
  },
  "henna-night": {
    en: [
      "Join us for an evening of henna, music and laughter before the big day.",
      "The bride-to-be invites you to her henna night.",
      "Bring your joy — the henna is on us.",
    ],
    ar: ["تتشرّف العروس سارة بدعوتكم لحضور ليلة الحناء.", "ليلة حناء وطرب وفرح قبل اليوم الكبير — بانتظاركم.", "حضوركم يزيّن ليلتنا، والحناء علينا."],
  },
  newborn: {
    en: [
      "Alhamdulillah, baby Layla has arrived! Family and friends are welcome to visit.",
      "Our little one is here. Visiting hours: 4 – 8 PM, Al Zahra Hospital, Suite 512.",
      "Come and meet the newest member of our family.",
    ],
    ar: [
      "الحمد لله، رُزقنا بالمولودة ليلى، ويسعدنا استقبالكم للتهنئة.",
      "وصل صغيرنا بالسلامة، والزيارة من ٤ إلى ٨ مساءً في مستشفى الزهراء، جناح ٥١٢.",
      "تعالوا تعرّفوا على أحدث فرد في عائلتنا.",
    ],
  },
  "baby-shower": {
    en: [
      "A little one is on the way! Join us for a baby shower in honour of Lina.",
      "Clouds, cake and lots of love — celebrate the mum-to-be with us.",
      "Oh baby! Please join us to shower the parents-to-be with love.",
    ],
    ar: ["ضيف صغير في الطريق! يسعدنا حضوركم حفل استقبال المولود احتفاءً بلينا.", "غيوم وحلوى وحب كثير — احتفلوا معنا بالأم المنتظرة.", "شاركونا فرحة انتظار مولودنا الأول."],
  },
  aqiqah: {
    en: [
      "In gratitude for the blessing of our son Yousef, we invite you to his aqiqah.",
      "Join us in giving thanks for our new arrival.",
      "With thankful hearts, we celebrate the aqiqah of Hamad.",
    ],
    ar: ["شكرًا لله على نعمته، ندعوكم لحضور عقيقة ابننا يوسف.", "شاركونا حمد الله وشكره على قدوم مولودنا.", "بقلوب شاكرة، يسعدنا دعوتكم لعقيقة حمد."],
  },
  birthday: {
    en: ["Mariam is turning one! Join us for cake, confetti and lots of smiles.", "Forty and fabulous — come and celebrate with me.", "Party hats on! You're invited to Faisal's birthday."],
    ar: ["مريم تُكمل عامها الأول! شاركونا الكيك والفرح.", "أربعون عامًا من الفرح — يسعدني احتفالكم معي.", "جهّزوا القبعات! أنتم مدعوون لعيد ميلاد فيصل."],
  },
  graduation: {
    en: ["Class of 2027! Celebrate Noura's graduation with us.", "The cap, the gown, the moment — join us as we celebrate.", "Years of hard work deserve a celebration. You're invited."],
    ar: ["دفعة ٢٠٢٧! شاركونا فرحة تخرّج نورة.", "الروب والقبعة واللحظة المنتظرة — احتفلوا معنا.", "سنوات من الجهد تستحق احتفالًا، ويسعدنا حضوركم."],
  },
  anniversary: {
    en: [
      "Twenty-five years of love — join us as we celebrate our silver anniversary.",
      "Still choosing each other. Celebrate our anniversary with us.",
      "A dinner for the people who have shared our journey.",
    ],
    ar: ["خمسة وعشرون عامًا من المودّة — شاركونا ذكرى زواجنا الفضية.", "ما زلنا نختار بعضنا كل يوم، فاحتفلوا معنا بذكرى زواجنا.", "عشاء لمن شاركونا الرحلة."],
  },
  "ramadan-eid": {
    en: ["Ramadan Kareem — you're invited to our ghabga.", "Break your fast with us at our family iftar.", "Eid Mubarak! Join us for our Eid gathering."],
    ar: ["رمضان كريم، يسعدنا حضوركم غبقتنا الرمضانية.", "شاركونا مائدة الإفطار مع العائلة.", "عيدكم مبارك، وحيّاكم في لمّة العيد."],
  },
  corporate: {
    en: [
      "You are cordially invited to the launch of our new collection.",
      "Join our leadership team for an evening of celebration and conversation.",
      "Save your seat at our annual partners' dinner. Please present your QR code at the entrance.",
    ],
    ar: ["يسرّنا دعوتكم لحضور حفل تدشين مجموعتنا الجديدة.", "ندعوكم لأمسية احتفاء وحوار مع فريق القيادة.", "احجز مقعدك في العشاء السنوي للشركاء، ويُرجى إبراز رمز QR عند الدخول."],
  },
};
