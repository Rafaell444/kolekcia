"""Seed default PageSection content from hardcoded storefront data."""
from django.core.management.base import BaseCommand
from apps.cms.models import PageSection


SECTIONS = [
    {
        "page": "home",
        "section_key": "more_ways",
        "title": "More Ways to Kolekcia",
        "sort_order": 0,
        "content": {
            "heading": "More Ways to Kolekcia",
            "cards": [
                {"id": "limited", "label": "Limited Editions", "desc": "Exclusive designs. Unique finishes. Limited runs.", "href": "/catalog?filter=limited", "imageUrl": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=600&fit=crop"},
                {"id": "custom", "label": "Custom Displates", "desc": "Turn anything you love into premium metal posters.", "href": "/custom", "imageUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop"},
                {"id": "club", "label": "KolekciaClub", "desc": "Join and unlock free shipping, early access to limited drops.", "href": "/catalog", "imageUrl": "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&h=600&fit=crop", "accent": "#2563eb"},
            ],
        },
    },
    {
        "page": "home",
        "section_key": "video",
        "title": "Why You Need Metal Art",
        "sort_order": 1,
        "content": {
            "heading": "Why You Need Metal Art From Kolekcia?",
            "cards": [
                {"id": "v1", "label": "Damage-resistant metal print", "thumb": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=500&fit=crop"},
                {"id": "v2", "label": "Tool-free, magnet mounting included", "thumb": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop"},
                {"id": "v3", "label": "Gift-ready packaging", "thumb": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&h=500&fit=crop"},
            ],
        },
    },
    {
        "page": "home",
        "section_key": "newsletter",
        "title": "Newsletter",
        "sort_order": 2,
        "content": {
            "heading": "Sign up and never miss a deal",
            "subheading": "Join our newsletter for the latest discounts and Kolekcia goodies",
            "promoText": "Sign Up & Save 25%!",
            "imageUrl": "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&h=600&fit=crop",
        },
    },
    {
        "page": "home",
        "section_key": "stats",
        "title": "Social Proof Stats",
        "sort_order": 3,
        "content": {
            "stats": [
                {"stat": "2.5M+", "label": "Designs available"},
                {"stat": "150K+", "label": "Artist creators"},
                {"stat": "100+", "label": "Countries shipped"},
            ],
        },
    },
    {
        "page": "about",
        "section_key": "hero",
        "title": "About Hero",
        "sort_order": 0,
        "content": {
            "headline": "Art Belongs on Every Wall",
            "subline": "We're building the world's most passionate collector platform — where artists thrive and fans obsess.",
        },
    },
    {
        "page": "about",
        "section_key": "timeline",
        "title": "Our Story",
        "sort_order": 1,
        "content": {
            "items": [
                {"year": "2018", "title": "The Idea", "body": "Founded in a Bratislava studio apartment with a single printer, a dream, and zero budget."},
                {"year": "2019", "title": "First 1,000 Artists", "body": "Word spread through online communities. Our first big artist cohort joined within 6 months."},
                {"year": "2021", "title": "Magnetic Mounting", "body": "We invented our tool-free magnetic pin system — now shipped with every single order."},
                {"year": "2023", "title": "2 Million Designs", "body": "Crossed 2 million active designs from artists in 80+ countries."},
                {"year": "2025", "title": "Kolekcia Platform", "body": "Launched the full collector platform with auctions, XP rewards, and limited-edition drops."},
            ],
        },
    },
    {
        "page": "contact",
        "section_key": "hero",
        "title": "Contact Hero",
        "sort_order": 0,
        "content": {
            "headline": "We're Here to Help",
            "subline": "Seriously — our support team is made up of art lovers who care about your experience.",
        },
    },
    {
        "page": "contact",
        "section_key": "reasons",
        "title": "Contact Reasons",
        "sort_order": 1,
        "content": {
            "cards": [
                {"label": "Order Issue", "desc": "Damaged item, missing parcel, or wrong product."},
                {"label": "Shipping", "desc": "Tracking, delivery estimates, or address changes."},
                {"label": "Returns", "desc": "Start a return or ask about our 100-day guarantee."},
                {"label": "Artist Support", "desc": "Licensing, royalties, and creator partnership queries."},
            ],
        },
    },
    {
        "page": "product",
        "section_key": "figures",
        "title": "Figures Product Sections",
        "sort_order": 0,
        "content": {
            "blocks": [
                {
                    "type": "feature_grid",
                    "eyebrow": "Figure Studio",
                    "heading": "Sculpted Detail.\nBuilt to Collect.",
                    "body": "Each figure is produced as a precision metal piece — crisp silhouettes, rich surface depth, and colour that holds up on shelves, desks, and in display cases year after year.",
                    "items": [
                        {"icon": "layers", "title": "Layered Depth", "desc": "UV metal printing brings out contours, shadows, and linework that flat prints flatten out."},
                        {"icon": "palette", "title": "Finish Options", "desc": "Matte, gloss, or satin coatings let you match the look of your collection or display setup."},
                        {"icon": "box", "title": "Collector Packaging", "desc": "Ships protected and display-ready — ideal for gifting, unboxing, and long-term storage."},
                    ],
                },
                {
                    "type": "split_content",
                    "eyebrow": "Display Your Way",
                    "heading": "Made for Shelves,\nDesks & Galleries",
                    "body": "Figures aren't just wall art — they're objects meant to be lived with.",
                    "bullets": [
                        {"label": "Shelf lineup", "detail": "Lightweight metal — easy to rearrange without heavy bases."},
                        {"label": "Desk centerpiece", "detail": "Compact sizes that hold attention without dominating the space."},
                        {"label": "Framed display", "detail": "Optional framing for premium presentation and dust protection."},
                    ],
                    "side_items": [
                        {"icon": "package", "label": "Shelf Display"},
                        {"icon": "award", "label": "Limited Editions"},
                        {"icon": "sparkles", "label": "Vivid Colour"},
                        {"icon": "shield", "label": "Durable Metal"},
                    ],
                },
                {
                    "type": "cta_band",
                    "dark": True,
                    "eyebrow": "Custom Commissions",
                    "heading": "Want Something One of a Kind?",
                    "body": "Figure Studio accepts custom references — characters, portraits, or original concepts — and turns them into a bespoke metal figure made to your chosen size and finish.",
                    "buttons": [
                        {"label": "Shop Figures", "href": "/catalog?category=figures", "variant": "outline"},
                        {"label": "Commission a Figure", "href": "/custom"},
                    ],
                },
            ],
        },
    },
    {
        "page": "product",
        "section_key": "wallpanels",
        "title": "Wallpanels Product Sections",
        "sort_order": 1,
        "content": {
            "blocks": [
                {
                    "type": "dark_hero",
                    "eyebrow": "Why Metal?",
                    "heading": "Art That Looks\nAlive on Your Wall",
                    "body": "Metal prints capture light differently than paper or canvas — colours pop with a luminous depth you have to see to believe.",
                    "buttons": [{"label": "Shop All Metal Prints", "href": "/catalog"}],
                    "items": [
                        {"value": "0", "label": "Glare"},
                        {"value": "50yr+", "label": "Durability"},
                        {"value": "100%", "label": "Magnetic Mount"},
                        {"value": "UV", "label": "Print Quality"},
                    ],
                },
                {
                    "type": "feature_grid",
                    "eyebrow": "How It Works",
                    "heading": "From Design to Wall\nin 3 Steps",
                    "body": "Every Kolekcia metal print ships ready to hang with our patented magnetic mounting system.",
                    "items": [
                        {"title": "1. Choose Your Design", "desc": "Browse thousands of designs or upload your own custom artwork."},
                        {"title": "2. We Print on Metal", "desc": "Your design is UV-printed onto premium aluminium with a protective coating."},
                        {"title": "3. Mount & Enjoy", "desc": "Peel, stick the magnetic mount, and snap your print to the wall. No tools needed."},
                    ],
                },
                {
                    "type": "cta_band",
                    "eyebrow": "Magnetic Mounting",
                    "heading": "No Nails. No Holes. No Damage.",
                    "body": "Our patented magnetic mounting system lets you rearrange your collection anytime without leaving a mark.",
                    "buttons": [{"label": "Shop Wallpanels", "href": "/catalog?category=wallpanels"}],
                },
            ],
        },
    },
]


class Command(BaseCommand):
    help = "Seed default page sections for CMS"

    def handle(self, *args, **options):
        for s in SECTIONS:
            PageSection.objects.update_or_create(
                page=s["page"],
                section_key=s["section_key"],
                defaults={
                    "title": s["title"],
                    "content": s["content"],
                    "sort_order": s["sort_order"],
                    "is_active": True,
                },
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(SECTIONS)} page sections."))
