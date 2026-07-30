DEFAULT_TRUST_BAR_ITEMS = [
    {
        "key": "delivery",
        "title": "Fast delivery",
        "description": "At your door in a few days",
        "icon": "truck",
        "logos": [
            {"name": "DHL", "label": "DHL", "bg": "#FFCC00", "text": "#D40511"},
            {"name": "UPS", "label": "UPS", "bg": "#351C15", "text": "#FFB500"},
            {"name": "FedEx", "label": "FedEx", "bg": "#4D148C", "text": "#FF6600"},
        ],
        "sort_order": 0,
        "is_active": True,
    },
    {
        "key": "payments",
        "title": "Secure payments",
        "description": "100% Secure payment with 256-bit SSL Encryption",
        "icon": "shield",
        "logos": [
            {"name": "Visa", "label": "VISA", "bg": "#1A1F71", "text": "#ffffff"},
            {"name": "Mastercard", "label": "MC", "bg": "#EB001B", "text": "#ffffff"},
            {"name": "Apple Pay", "label": "Pay", "bg": "#000000", "text": "#ffffff"},
            {"name": "Google Pay", "label": "GPay", "bg": "#ffffff", "text": "#3c4043"},
            {"name": "PayPal", "label": "PP", "bg": "#003087", "text": "#ffffff"},
        ],
        "sort_order": 1,
        "is_active": True,
    },
    {
        "key": "returns",
        "title": "100 days for return",
        "description": "Easy return, no questions asked",
        "icon": "clock",
        "logos": [],
        "sort_order": 2,
        "is_active": True,
    },
]

DEFAULT_FANDOM_BRANDS = [
    ("The Witcher", "THE WITCHER", "#000000", "#ffffff"),
    ("Harry Potter", "Harry Potter", "#f5f0e8", "#1a1a1a"),
    ("Halo", "HALO", "#1a3a2a", "#4caf7d"),
    ("Chainsaw Man", "CHAINSAW MAN", "#cc0000", "#ffffff"),
    ("Stranger Things", "STRANGER THINGS", "#111111", "#e40404"),
    ("Naruto", "NARUTO", "#ff6600", "#ffffff"),
    ("Call of Duty", "CALL OF DUTY", "#000000", "#c8a84b"),
    ("Dark Souls", "DARK SOULS", "#1a1408", "#c8a84b"),
    ("Game of Thrones", "GAME OF THRONES", "#0d0d0d", "#c8a84b"),
    ("League of Legends", "LoL", "#0bc4e3", "#c8aa6e"),
    ("Dungeons & Dragons", "D&D", "#8b0000", "#ffffff"),
    ("One Piece", "ONE PIECE", "#e30000", "#ffffff"),
    ("Demon Slayer", "DEMON SLAYER", "#1a0a00", "#e86d1f"),
    ("Godzilla", "GODZILLA", "#0a2a0a", "#4caf7d"),
    ("Helldivers", "HELLDIVERS 2", "#1a1a00", "#e8d44d"),
    ("DC", "DC", "#0074e8", "#ffffff"),
]

DEFAULT_SOCIAL_LINKS = [
    ("Reddit", "r/", "#FF4500", "#ffffff", 0),
    ("Discord", "dis", "#5865F2", "#ffffff", 1),
    ("Pinterest", "P", "#E60023", "#ffffff", 2),
    ("Facebook", "f", "#1877F2", "#ffffff", 3),
    ("X", "X", "#000000", "#ffffff", 4),
    ("TikTok", "TT", "#010101", "#ffffff", 5),
]


def ensure_global_homepage_defaults():
    from .models import CommunitySocialLink, FandomBrand, TrustBarItem

    for item in DEFAULT_TRUST_BAR_ITEMS:
        obj, created = TrustBarItem.objects.get_or_create(key=item["key"], defaults=item)
        if not created:
            changed = []
            for field in ("title", "description", "icon", "logos"):
                if not getattr(obj, field):
                    setattr(obj, field, item[field])
                    changed.append(field)
            if changed:
                obj.save(update_fields=changed)

    if not FandomBrand.objects.exists():
        for idx, (name, abbr, bg, text) in enumerate(DEFAULT_FANDOM_BRANDS):
            FandomBrand.objects.create(
                name=name,
                abbreviation=abbr,
                background=bg,
                text_color=text,
                sort_order=idx,
                is_active=True,
            )

    if not CommunitySocialLink.objects.exists():
        for name, abbr, bg, text, sort_order in DEFAULT_SOCIAL_LINKS:
            CommunitySocialLink.objects.create(
                name=name,
                abbr=abbr,
                bg_color=bg,
                text_color=text,
                sort_order=sort_order,
                is_active=True,
            )


def ensure_page_section_defaults():
    from .models import PageSection
    from .management.commands.seed_page_sections import SECTIONS

    for section in SECTIONS:
        obj, created = PageSection.objects.get_or_create(
            page=section["page"],
            section_key=section["section_key"],
            defaults={
                "title": section["title"],
                "content": section["content"],
                "sort_order": section["sort_order"],
                "is_active": True,
            },
        )
        if not created:
            changed = []
            if not obj.title:
                obj.title = section["title"]
                changed.append("title")
            if not obj.content:
                obj.content = section["content"]
                changed.append("content")
            if changed:
                obj.save(update_fields=changed)
