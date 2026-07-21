import type { Locale } from "./i18n"

export type PageSEO = {
  title: string
  description: string
}

export type LocalizedSEO = Record<Locale, PageSEO>

/**
 * Page titles intentionally omit a trailing " | Koleqcia".
 * The root layout title template (`%s | Koleqcia`) appends the brand once.
 */
export const HOMEPAGE_SEO: LocalizedSEO = {
  en: {
    title: "Unique Gifts, Anime & Gaming Decor Made in Georgia",
    description: "Discover handmade anime, gaming, and movie decor. Shop unique gifts, wall art, and figures. Proudly made in Georgia. Find the perfect gift today!",
  },
  ka: {
    title: "ანიმე, თამაშები და უნიკალური საჩუქრები",
    description: "აღმოაჩინე ანიმესა და თამაშების უნიკალური საჩუქრები. ხის პოსტერები, ფიგურები და კედლის დეკორაცია. დამზადებულია საქართველოში.",
  },
  ru: {
    title: "Аниме Декор и Необычные Подарки в Грузии",
    description: "Ищете необычный подарок геймеру или любителю аниме? Уникальный игровой декор, фигурки и деревянные панно ручной работы. Сделано в Грузии.",
  },
}

export const CATALOG_SEO: LocalizedSEO = {
  en: {
    title: "Shop Anime Figures & Gaming Decor | Koleqcia Catalog",
    description: "Browse handmade anime figures, wooden wall panels, and gaming room decor. Unique gifts made in Georgia — shop the full Koleqcia catalog.",
  },
  ka: {
    title: "ანიმე ფიგურები და გეიმინგ დეკორი | Koleqcia კატალოგი",
    description: "აღმოაჩინე ხელით დამზადებული ანიმეს ფიგურები, ხის პოსტერები და გეიმინგ დეკორაცია. უნიკალური საჩუქრები საქართველოდან — Koleqcia კატალოგი.",
  },
  ru: {
    title: "Каталог Аниме Фигурок и Игрового Декора",
    description: "Смотрите каталог Koleqcia: аниме фигурки ручной работы, деревянные панно и декор для игровой комнаты. Уникальные подарки из Грузии.",
  },
}

export const ABOUT_SEO: LocalizedSEO = {
  en: {
    title: "About Koleqcia | Handmade Anime & Gaming Decor from Georgia",
    description: "Learn about Koleqcia. We create high-quality, handmade anime figures, gaming wall panels, and unique fanart decor. Proudly made in Georgia.",
  },
  ka: {
    title: "ჩვენ შესახებ | Koleqcia - ანიმე და გეიმინგ დეკორაცია",
    description: "გაიცანი Koleqcia. ჩვენ ვქმნით ანიმესა და თამაშების უნიკალურ ფიგურებსა და ხის პოსტერებს. დამზადებულია საქართველოში სიყვარულით.",
  },
  ru: {
    title: "О Нас | Koleqcia - Аниме Декор Ручной Работы в Грузии",
    description: "Узнайте больше о Koleqcia. Мы создаем уникальные фигурки и деревянные панно для геймеров и любителей аниме. Сделано в Грузии.",
  },
}

export const CUSTOM_SEO: LocalizedSEO = {
  en: {
    title: "Custom Anime Figures & Wood Posters | Order at Koleqcia",
    description: "Need a truly unique gift? Order custom anime figures, gaming room decor, and wooden wall art. Bring your favorite character or fanart to life!",
  },
  ka: {
    title: "ინდივიდუალური შეკვეთა | შექმენი შენი დიზაინი - Koleqcia",
    description: "ეძებ ორიგინალურ საჩუქარს? შეუკვეთე ანიმეს ფიგურები და ხის პოსტერები შენი დიზაინით. საუკეთესო საჩუქარი მეგობრისთვის.",
  },
  ru: {
    title: "Фигурки и Постеры на Заказ | Необычный Подарок от Koleqcia",
    description: "Ищете необычный подарок? Закажите фигурки и настенное панно ручной работы по вашему дизайну. Идеальный кастомный декор для игровой комнаты.",
  },
}

export const AUCTIONS_SEO: LocalizedSEO = {
  en: {
    title: "Exclusive Anime & Gaming Decor Auctions",
    description: "Bid on rare, one-of-a-kind anime figures and custom wooden wall panels. Join the Koleqcia auction to win exclusive handmade gaming decor.",
  },
  ka: {
    title: "ექსკლუზიური აუქციონი | ანიმე და გეიმინგ ნივთები - Koleqcia",
    description: "მიიღე მონაწილეობა Koleqcia-ს აუქციონში. მოიგე ექსკლუზიური ფიგურები და ხის პოსტერები საუკეთესო ფასად.",
  },
  ru: {
    title: "Аукционы Эксклюзивного Аниме Декора",
    description: "Участвуйте в аукционах Koleqcia! Выигрывайте редкие аниме фигурки и эксклюзивное деревянное панно ручной работы по лучшей цене.",
  },
}

export const BLOG_SEO: LocalizedSEO = {
  en: {
    title: "Koleqcia Blog | Gaming Setup Decor & Anime Gift Ideas",
    description: "Read the Koleqcia blog for the best gaming room decor tips, anime gift guides, and behind-the-scenes looks at our handmade wooden posters and figures.",
  },
  ka: {
    title: "Koleqcia ბლოგი | საჩუქრების იდეები და დეკორაცია",
    description: "წაიკითხე Koleqcia-ს ბლოგი. აღმოაჩინე ოთახის დეკორაციის იდეები და რჩევები საუკეთესო საჩუქრის შესარჩევად გეიმერებისთვის.",
  },
  ru: {
    title: "Блог Koleqcia | Идеи Подарков и Декор для Игровой Комнаты",
    description: "Читайте блог Koleqcia: лучшие идеи необычных подарков для геймеров, советы по обустройству игровой комнаты и обзоры аниме новинок.",
  },
}

export const CONTACT_SEO: LocalizedSEO = {
  en: {
    title: "Contact Us | Koleqcia Support & Inquiries",
    description: "Have a question about an order, custom figure, or wooden poster? Contact the Koleqcia team today. We are here to help!",
  },
  ka: {
    title: "კონტაქტი | დაგვიკავშირდით - Koleqcia",
    description: "გაქვს კითხვები შეკვეთასთან დაკავშირებით? დაგვიკავშირდი დღესვე. Koleqcia-ს გუნდი მზად არის დაგეხმაროს.",
  },
  ru: {
    title: "Контакты | Служба Поддержки Koleqcia",
    description: "У вас есть вопросы о заказе, фигурках или деревянных панно? Свяжитесь с командой Koleqcia. Мы всегда рады помочь!",
  },
}

export const ARTISTS_SEO: LocalizedSEO = {
  en: {
    title: "Meet Our Artists | Handmade Anime & Gaming Decor Creators",
    description: "Discover the talented creators behind Koleqcia. Shop handmade anime figures, unique fanart, and wooden gaming room decor from our featured artists.",
  },
  ka: {
    title: "ჩვენი არტისტები | ანიმე და გეიმინგ დეკორაციის შემქმნელები",
    description: "გაიცანით Koleqcia-ს არტისტები. აღმოაჩინეთ უნიკალური საჩუქრები, ხელით დამზადებული ანიმეს ფიგურები და ხის პოსტერები.",
  },
  ru: {
    title: "Наши Художники | Создатели Аниме и Игрового Декора",
    description: "Познакомьтесь с художниками Koleqcia. Уникальный игровой декор, фигурки и деревянные панно ручной работы от лучших авторов.",
  },
}

export const FAQ_SEO: LocalizedSEO = {
  en: {
    title: "FAQ & Support | Koleqcia Handmade Decor",
    description: "Have questions about our custom anime figures, wooden posters, or shipping? Find answers in the Koleqcia FAQ.",
  },
  ka: {
    title: "ხშირად დასმული კითხვები | Koleqcia FAQ",
    description: "გაქვთ კითხვები შეკვეთებთან, ანიმეს ფიგურებსა ან ხის პოსტერებთან დაკავშირებით? იხილეთ პასუხები Koleqcia-ს FAQ-ში.",
  },
  ru: {
    title: "Вопросы и Ответы (FAQ)",
    description: "У вас есть вопросы о кастомных фигурках, деревянных панно или доставке? Найдите ответы в FAQ Koleqcia.",
  },
}

export const SHIPPING_SEO: LocalizedSEO = {
  en: {
    title: "Shipping Information | Koleqcia Order Delivery",
    description: "Learn about Koleqcia's shipping policies. We carefully package and deliver your handmade anime figures and gaming room decor worldwide.",
  },
  ka: {
    title: "მიწოდების პირობები | შეკვეთის ტრანსპორტირება - Koleqcia",
    description: "გაეცანით Koleqcia-ს მიწოდების პირობებს. ჩვენ უსაფრთხოდ ვაწვდით ხელით დამზადებულ ფიგურებსა და პოსტერებს.",
  },
  ru: {
    title: "Информация о Доставке",
    description: "Узнайте о правилах доставки Koleqcia. Мы надежно упаковываем и доставляем ваши аниме фигурки и деревянный декор для стен.",
  },
}

export const RETURNS_SEO: LocalizedSEO = {
  en: {
    title: "Returns & Refunds Policy",
    description: "Read the Koleqcia returns and refunds policy. We want you to be completely satisfied with your handmade unique gifts and gaming decor.",
  },
  ka: {
    title: "დაბრუნების პირობები",
    description: "გაეცანით Koleqcia-ს დაბრუნების პირობებს. ჩვენთვის მნიშვნელოვანია, რომ კმაყოფილი იყოთ თქვენი უნიკალური საჩუქრებით.",
  },
  ru: {
    title: "Возврат и Обмен | Политика Koleqcia",
    description: "Ознакомьтесь с политикой возврата Koleqcia. Мы хотим, чтобы вы были полностью довольны своими необычными подарками и декором.",
  },
}

export const COOKIES_SEO: LocalizedSEO = {
  en: {
    title: "Cookie Policy",
    description: "Information about how Koleqcia uses cookies to improve your browsing and shopping experience for handmade decor.",
  },
  ka: {
    title: "Cookie პოლიტიკა",
    description: "ინფორმაცია იმის შესახებ, თუ როგორ იყენებს Koleqcia მზა ჩანაწერებს (Cookies) თქვენი სამომხმარებლო გამოცდილების გასაუმჯობესებლად.",
  },
  ru: {
    title: "Политика Использования Файлов Cookie",
    description: "Информация о том, как Koleqcia использует файлы cookie для улучшения работы сайта и вашего удобства.",
  },
}

export const PRIVACY_SEO: LocalizedSEO = {
  en: {
    title: "Privacy Policy",
    description: "Learn how Koleqcia protects your data and privacy while you shop for unique gaming room decor and anime gifts.",
  },
  ka: {
    title: "კონფიდენციალურობის პოლიტიკა",
    description: "გაიგეთ, როგორ იცავს Koleqcia თქვენს პერსონალურ მონაცემებს უნიკალური საჩუქრების შეძენისას.",
  },
  ru: {
    title: "Политика Конфиденциальности",
    description: "Узнайте, как Koleqcia защищает ваши данные и конфиденциальность при покупке аниме подарков и декора.",
  },
}

export const TERMS_SEO: LocalizedSEO = {
  en: {
    title: "Terms of Service",
    description: "Read the Terms of Service for Koleqcia. Information regarding the use of our website and purchasing custom handmade decor.",
  },
  ka: {
    title: "მოხმარების წესები",
    description: "გაეცანით Koleqcia-ს ვებგვერდით სარგებლობისა და პროდუქციის შეძენის ოფიციალურ წესებსა და პირობებს.",
  },
  ru: {
    title: "Условия Использования",
    description: "Ознакомьтесь с условиями предоставления услуг Koleqcia. Информация об использовании сайта и покупке декора.",
  },
}
