import type { themes as en } from "../en/themes";

export const themes: typeof en = {
  minimal: { name: "بسيط", description: "ورق كريمي وخطوط أنيقة وتفاصيل هادئة. تصميم خالد وراقٍ." },
  luxury: { name: "فاخر", description: "الأسود والعاجي والذهبي الشمباني بإطار آرت ديكو. لأمسيات السهرة الرسمية." },
  romantic: { name: "رومانسي", description: "ألوان وردية هادئة وخط منساب وزخارف نباتية رقيقة." },
  modern: { name: "عصري", description: "خطوط نظيفة وقوس منحوت وتفاصيل هندسية." },
  traditional: { name: "تقليدي", description: "ورق عتيق وعنابي وزخارف كلاسيكية للمناسبات الرسمية." },
  arabic: { name: "عربي", description: "خط عربي كلاسيكي داخل قوس زخرفي، مصمم من اليمين إلى اليسار." },
  bilingual: { name: "ثنائي اللغة", description: "العربية والإنجليزية بتوازن مثالي تحت قوس أنيق." },
  premium: "مميز",
  recommendedFor: { EN: "الإنجليزية", AR: "العربية", BILINGUAL: "العربية + الإنجليزية" },
};
