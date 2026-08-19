"""Seed default PageSection content from hardcoded storefront data."""
from django.core.management.base import BaseCommand
from apps.cms.models import PageSection


SECTIONS = [
    {
        "page": "home",
        "section_key": "more_ways",
        "title": "More Ways to Koleqcia",
        "sort_order": 0,
        "content": {
            "heading": "More Ways to Koleqcia",
            "cards": [
                {"id": "limited", "label": "Limited Editions", "desc": "Exclusive designs. Unique finishes. Limited runs.", "href": "/catalog?filter=limited", "imageUrl": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=600&fit=crop"},
                {"id": "custom", "label": "Custom Displates", "desc": "Turn anything you love into premium metal posters.", "href": "/custom", "imageUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop"},
                {"id": "club", "label": "KoleqciaClub", "desc": "Join and unlock free shipping, early access to limited drops.", "href": "/catalog", "imageUrl": "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&h=600&fit=crop", "accent": "#2563eb"},
            ],
        },
    },
    {
        "page": "home",
        "section_key": "video",
        "title": "Why You Need Metal Art",
        "sort_order": 1,
        "content": {
            "heading": "Why You Need Metal Art From Koleqcia?",
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
            "subheading": "Join our newsletter for the latest discounts and Koleqcia goodies",
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
            "eyebrow": "Our Story",
            "headline": "Art Belongs on Every Wall",
            "subline": "We're building the world's most passionate collector platform — where artists thrive and fans obsess.",
            "imageUrl": "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1440&h=800&fit=crop",
            "primaryCta": "Explore the Shop",
            "secondaryCta": "Meet the Team",
            "stats": [
                {"num": "2.5M+", "label": "Unique Designs"},
                {"num": "150K+", "label": "Independent Artists"},
                {"num": "180K+", "label": "Happy Collectors"},
                {"num": "80+", "label": "Countries Served"},
            ],
        },
    },
    {
        "page": "about",
        "section_key": "mission",
        "title": "Mission",
        "sort_order": 1,
        "content": {
            "eyebrow": "Our Mission",
            "heading": "We Exist to Champion Independent Artists.",
            "paragraphs": [
                "The art market has always been controlled by galleries, agents, and institutions. We believe that's wrong. An artist in Manila or Kraków deserves the same global reach as one in New York or London.",
                "Koleqcia takes zero upfront fees from artists. We print, ship, and handle everything — they simply upload their work and earn. Our royalty rates are the highest in the industry.",
                "And when collectors bring home a piece, they're not just decorating a room — they're directly supporting a real person's creative career.",
            ],
            "checklist": [
                "Highest artist royalties in the industry",
                "Zero upfront cost to list your designs",
                "Printed, shipped and handled — all by us",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=1000&fit=crop",
            "stat": "40%",
            "statLabel": "Average artist royalty rate",
        },
    },
    {
        "page": "about",
        "section_key": "values",
        "title": "Values",
        "sort_order": 2,
        "content": {
            "eyebrow": "What We Stand For",
            "heading": "Our Values",
            "cards": [
                {"icon": "palette", "title": "Art First", "body": "Every decision starts with the artist. We set the highest royalty rates in the industry — because creators deserve to thrive."},
                {"icon": "shield", "title": "Zero Compromise Quality", "body": "We print on industrial-grade aluminium with UV-resistant inks that outlast paper or canvas by decades."},
                {"icon": "globe", "title": "Global Community", "body": "150K+ artists from 80+ countries. Your next favourite piece of art is waiting to be discovered."},
                {"icon": "zap", "title": "Effortless Experience", "body": "From browsing to hanging in under 30 seconds — our magnetic mounting system is genuinely magical."},
                {"icon": "heart", "title": "Collector Culture", "body": "Auctions, curated releases, and limited drops — we built a world for collectors who care about the details."},
                {"icon": "truck", "title": "Worldwide Delivery", "body": "Fast, tracked shipping to 120+ countries with carbon-offset packaging on every order."},
            ],
        },
    },
    {
        "page": "about",
        "section_key": "timeline",
        "title": "Our Story",
        "sort_order": 3,
        "content": {
            "eyebrow": "Our Journey",
            "heading": "How We Got Here",
            "items": [
                {"year": "2018", "title": "The Idea", "body": "Founded in a Bratislava studio apartment with a single printer, a dream, and zero budget."},
                {"year": "2019", "title": "First 1,000 Artists", "body": "Word spread through online communities. Our first big artist cohort joined within 6 months."},
                {"year": "2021", "title": "Magnetic Mounting", "body": "We invented our tool-free magnetic pin system — now shipped with every single order."},
                {"year": "2023", "title": "2 Million Designs", "body": "Crossed 2 million active designs from artists in 80+ countries."},
                {"year": "2025", "title": "Koleqcia Platform", "body": "Launched the full collector platform with auctions, loyalty tools, and limited-edition drops."},
            ],
        },
    },
    {
        "page": "about",
        "section_key": "team",
        "title": "Team",
        "sort_order": 4,
        "content": {
            "eyebrow": "The People",
            "heading": "Meet the Team",
            "subheading": "A small crew of artists, engineers and collectors — united by a belief that art should be for everyone.",
            "members": [
                {"name": "Marta Holická", "role": "CEO & Co-Founder", "bio": "Former brand director at a European fashion house. Believed art belongs on every wall, not just galleries.", "img": "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=400&h=400&fit=crop&crop=face"},
                {"name": "Dominik Novák", "role": "CTO & Co-Founder", "bio": "Built the original printing pipeline in his garage. Still writes code every day.", "img": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"},
                {"name": "Yuki Tanaka", "role": "Head of Artist Relations", "bio": "Artist herself with 24K followers. Represents the community inside the company.", "img": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face"},
                {"name": "Lucas Ferreira", "role": "Head of Product", "bio": "Previously built collector platforms for music and trading cards. Obsessive about UX details.", "img": "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop&crop=face"},
            ],
        },
    },
    {
        "page": "about",
        "section_key": "final_cta",
        "title": "Final CTA",
        "sort_order": 5,
        "content": {
            "heading": "Ready to Transform Your Space?",
            "body": "Over 2.5 million designs waiting for your walls. Free shipping over $49.",
            "cta": "Browse the Shop",
        },
    },
    {
        "page": "contact",
        "section_key": "hero",
        "title": "Contact Hero",
        "sort_order": 0,
        "content": {
            "eyebrow": "Get in Touch",
            "headline": "We're Here to Help",
            "subline": "Seriously — our support team is made up of art lovers who care about your experience.",
            "responseLabel": "Response Time",
            "responseValue": "Under 24 hours",
        },
    },
    {
        "page": "contact",
        "section_key": "reasons",
        "title": "Contact Reasons",
        "sort_order": 1,
        "content": {
            "eyebrow": "What do you need help with?",
            "cards": [
                {"icon": "package", "label": "Order Issue", "desc": "Damaged item, missing parcel, or wrong product."},
                {"icon": "truck", "label": "Shipping", "desc": "Tracking, delivery estimates, or address changes."},
                {"icon": "returns", "label": "Returns", "desc": "Start a return or ask about our 100-day guarantee."},
                {"icon": "brush", "label": "Artist Support", "desc": "Licensing, royalties, and creator partnership queries."},
            ],
        },
    },
    {
        "page": "contact",
        "section_key": "form_intro",
        "title": "Contact Form Intro",
        "sort_order": 2,
        "content": {
            "heading": "Send Us a Message",
            "body": "We read every message and reply personally.",
        },
    },
    {
        "page": "contact",
        "section_key": "sidebar",
        "title": "Contact Sidebar",
        "sort_order": 3,
        "content": {
            "promiseTitle": "Fast Replies, Always",
            "promiseBody": "Our support team operates Mon–Fri 9am–6pm CET. Emails sent after hours get a reply first thing the next morning.",
            "homeEyebrow": "Our Home",
            "address": "Obchodná 12\n811 06 Bratislava\nSlovakia",
        },
    },
    {
        "page": "contact",
        "section_key": "faq_intro",
        "title": "FAQ Intro",
        "sort_order": 4,
        "content": {
            "eyebrow": "FAQ",
            "heading": "Common Questions",
            "body": "Answers to everything we get asked most often. Still stuck? Message us directly.",
        },
    },
    {
        "page": "contact",
        "section_key": "shipping_info",
        "title": "Shipping and Returns Info",
        "sort_order": 5,
        "content": {
            "cards": [
                {"icon": "truck", "title": "Shipping", "points": ["Produced in 3 business days", "Standard: 5–8 business days", "Express: 2–3 business days", "Free on orders over $49", "Carbon-offset packaging"]},
                {"icon": "returns", "title": "Returns", "points": ["100-day no-questions return", "Free return label provided", "Full refund to original payment", "No need to return damaged items", "Exchange available"]},
                {"icon": "package", "title": "Packaging", "points": ["Rigid cardboard protection", "Corner guards on every order", "Damage-proof tube for large prints", "Fully recyclable materials", "Mounting kit included"]},
            ],
        },
    },
    {
        "page": "contact",
        "section_key": "bottom_cta",
        "title": "Bottom CTA",
        "sort_order": 6,
        "content": {
            "eyebrow": "Still Browsing?",
            "heading": "Discover 2.5M+ Designs",
            "body": "The perfect piece for your wall is waiting. Free shipping over $49.",
            "cta": "Shop Now",
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
                    "body": "Every Koleqcia metal print ships ready to hang with our patented magnetic mounting system.",
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
