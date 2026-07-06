from django.core.management.base import BaseCommand
from apps.products.models import Category, Artist, Product, ProductImage, ProductVariant, SizeVariant, PosterSize, PosterFinish, PosterFrame
from apps.cms.models import HeroSlide, FAQ
from apps.gamification.models import Badge, XPRule


class Command(BaseCommand):
    help = "Seed database with initial data (figures + wallpanels only)"

    def handle(self, *args, **kwargs):
        self._reset_catalog()
        self._seed_poster_options()
        self._seed_categories()
        self._seed_artists()
        self._seed_products()
        self._seed_processing_options()
        self._sync_product_vendors()
        self._sync_tenants()
        self._seed_cms()
        self._seed_gamification()
        self.stdout.write(self.style.SUCCESS("Database seeded successfully."))

    def _reset_catalog(self):
        from apps.products.models import Review, WishlistItem
        WishlistItem.objects.all().delete()
        Review.objects.all().delete()
        SizeVariant.objects.all().delete()
        ProductVariant.objects.all().delete()
        ProductImage.objects.all().delete()
        Product.objects.all().delete()
        Artist.objects.all().delete()
        Category.objects.all().delete()
        self.stdout.write("  Catalog reset.")

    def _seed_poster_options(self):
        sizes = [
            ("xs", "XS (8×11 in)", 0),
            ("s", "S (12×17 in)", 5),
            ("m", "M (18×24 in)", 10),
            ("l", "L (24×32 in)", 20),
            ("xl", "XL (36×48 in)", 40),
        ]
        for pk, label, surcharge in sizes:
            PosterSize.objects.get_or_create(id=pk, defaults={"label": label, "surcharge": surcharge})

        finishes = [
            ("matte", "Matte", 0),
            ("gloss", "Gloss", 5),
            ("satin", "Satin", 8),
            ("canvas", "Canvas", 15),
        ]
        for pk, label, surcharge in finishes:
            PosterFinish.objects.get_or_create(id=pk, defaults={"label": label, "surcharge": surcharge})

        frames = [
            ("none", "No Frame", 0),
            ("black", "Black", 15),
            ("white", "White", 15),
            ("walnut", "Walnut", 25),
            ("gold", "Gold", 30),
        ]
        for pk, label, surcharge in frames:
            PosterFrame.objects.get_or_create(id=pk, defaults={"label": label, "surcharge": surcharge})

        self.stdout.write("  Poster options seeded.")

    def _seed_categories(self):
        cats = [
            (
                "figures",
                "Figures",
                "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=400&h=400&fit=crop",
                0,
            ),
            (
                "wallpanels",
                "Wallpanels",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
                0,
            ),
        ]
        for slug, name, image_url, count in cats:
            Category.objects.create(slug=slug, name=name, image_url=image_url, count=count)
        self.stdout.write("  Categories seeded.")

    def _seed_artists(self):
        from apps.users.models import User
        from apps.vendors.models import Vendor

        artists_data = [
            (
                "Ryo Tanabe",
                "ryo_tanabe",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=1200&h=400&fit=crop",
                "Osaka sculptor specializing in premium 3D metal collectible figures — from anime icons to original characters.",
                96,
                12100,
                22,
                "Gold",
                True,
                "vendor2@kolekcia.com",
                "figure-studio",
            ),
            (
                "Alex Tanaka",
                "alex_tanaka",
                "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=400&fit=crop",
                "Berlin-based artist crafting ultra-HD 3D relief metal wallpanels with proprietary UV-cure layering.",
                89,
                9200,
                18,
                "Gold",
                True,
                "vendor1@kolekcia.com",
                "panel-studio",
            ),
        ]
        for name, handle, avatar, cover, bio, designs, followers, level, badge, verified, user_email, vendor_slug in artists_data:
            user = User.objects.filter(email=user_email).first()
            vendor = Vendor.objects.filter(slug=vendor_slug).first()
            Artist.objects.create(
                name=name,
                handle=handle,
                user=user,
                vendor=vendor,
                avatar_url=avatar,
                cover_url=cover,
                bio=bio,
                designs=designs,
                followers=followers,
                level=level,
                badge=badge,
                verified=verified,
            )
        self.stdout.write("  Artists seeded.")

    def _seed_products(self):
        from decimal import Decimal

        figures_cat = Category.objects.get(slug="figures")
        wallpanels_cat = Category.objects.get(slug="wallpanels")

        # ── Figures (Ryo Tanabe) ───────────────────────────────────────────────
        # Each tuple: (title, base_price_usd, orig_price, is_limited, is_sale, is_new, is_exclusive,
        #              allow_custom_size, rating, review_count, tags, description, material,
        #              image_url, regional_prices,
        #              size_variants [(label, price_usd)])
        figure_products = [
            (
                "Cyber Samurai",
                39.99, None, True, False, False, False, True,
                4.7, 987, ["Figure", "Samurai", "Cyberpunk"],
                "A battle-hardened cyber-samurai cast in zinc alloy with chrome-plated armour details. Every panel edge is hand-filed for razor precision. Display on any flat surface — no stand required.",
                "Zinc Alloy with Chrome Plating",
                "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop",
                {"GEL": {"price": "109.00"}, "EUR": {"price": "37.50"}, "GBP": {"price": "32.00"}},
                [("S (15 cm)", "39.99"), ("M (22 cm)", "54.99"), ("L (30 cm)", "79.99"), ("XL (40 cm)", "109.99")],
            ),
            (
                "Neon Ronin",
                34.99, 44.99, False, True, True, False, True,
                4.8, 654, ["Figure", "Ronin", "Neon"],
                "Roaming the neon-lit ruins of a collapsed city, this ronin figure glows under UV light thanks to our phosphorescent resin inlay technique. A fan favourite since its debut drop.",
                "Zinc Alloy with UV-reactive Resin Inlay",
                "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=840&fit=crop",
                {"GEL": {"price": "95.00"}, "EUR": {"price": "32.50"}, "GBP": {"price": "27.50"}},
                [("S (15 cm)", "34.99"), ("M (22 cm)", "49.99"), ("L (30 cm)", "69.99")],
            ),
            (
                "Ghost Protocol",
                44.99, None, False, False, False, True, True,
                4.9, 432, ["Figure", "Ghost", "Exclusive"],
                "An exclusive stealth operative rendered in matte black titanium finish. Micro-engraved tactical vest details visible under magnification. Only 200 units ever produced.",
                "Titanium-coated Zinc Alloy",
                "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop",
                {"GEL": {"price": "122.00"}, "EUR": {"price": "41.50"}, "GBP": {"price": "35.50"}},
                [("S (15 cm)", "44.99"), ("M (22 cm)", "64.99"), ("L (30 cm)", "89.99"), ("XL (40 cm)", "124.99")],
            ),
            (
                "Oni Guardian",
                49.99, None, True, False, True, True, False,
                5.0, 321, ["Figure", "Oni", "Exclusive"],
                "The guardian of the mountain gate — sculpted in hand-patinated brass alloy with real copper oxide weathering applied by the artist. A limited-run collector's centrepiece.",
                "Brass Alloy with Copper Oxide Patina",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop",
                {"GEL": {"price": "135.00"}, "EUR": {"price": "46.00"}, "GBP": {"price": "39.50"}},
                [("S (18 cm)", "49.99"), ("M (25 cm)", "69.99"), ("L (35 cm)", "99.99")],
            ),
        ]

        # ── Wallpanels (Alex Tanaka) ───────────────────────────────────────────
        wallpanel_products = [
            (
                "Midnight Circuit",
                34.99, None, True, False, False, False, False,
                4.6, 876, ["Wallpanel", "Circuit", "Cyberpunk"],
                "An intricate circuit-board relief etched at 0.3 mm depth across the full panel surface. UV-printed cyan traces glow under black light. Ships flat with hidden keyhole mounts.",
                "Aluminium Composite, UV-cure Inks",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop",
                {"GEL": {"price": "95.00"}, "EUR": {"price": "32.50"}, "GBP": {"price": "27.50"}},
                [("40×60 cm", "34.99"), ("60×90 cm", "59.99"), ("80×120 cm", "89.99"), ("100×150 cm", "129.99")],
            ),
            (
                "Aurora Drift",
                49.99, None, False, False, False, True, False,
                4.9, 2108, ["Wallpanel", "Aurora", "Exclusive"],
                "Sweeping northern-lights gradient captured in 12-layer UV relief printing. The panel shifts colour as viewing angle changes — from emerald to violet — thanks to our iridescent base coat.",
                "Aluminium Composite, Iridescent UV-cure Inks",
                "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop",
                {"GEL": {"price": "135.00"}, "EUR": {"price": "46.00"}, "GBP": {"price": "39.50"}},
                [("40×60 cm", "49.99"), ("60×90 cm", "79.99"), ("80×120 cm", "119.99"), ("100×150 cm", "169.99")],
            ),
            (
                "Void Horizon",
                39.99, 49.99, False, True, True, False, True,
                4.7, 765, ["Wallpanel", "Space", "Sale"],
                "A deep-space panorama with raised planetary relief at the horizon line. Matte black background with mirror-polished planet surfaces creates a striking contrast even in low light.",
                "Aluminium Composite, Mirror-polished Inlay",
                "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop",
                {"GEL": {"price": "108.00"}, "EUR": {"price": "36.50"}, "GBP": {"price": "31.50"}},
                [("40×60 cm", "39.99"), ("60×90 cm", "64.99"), ("80×120 cm", "94.99")],
            ),
            (
                "Crystal Forest",
                29.99, 34.99, False, True, False, False, True,
                4.5, 543, ["Wallpanel", "Forest", "Nature"],
                "Crystalline tree canopy rendered in frosted acrylic over polished aluminium. Morning light refracts through the frosted layer, casting rainbow spectra across surrounding walls.",
                "Aluminium Composite, Frosted Acrylic Overlay",
                "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=840&fit=crop",
                {"GEL": {"price": "81.00"}, "EUR": {"price": "27.50"}, "GBP": {"price": "23.50"}},
                [("40×60 cm", "29.99"), ("60×90 cm", "49.99"), ("80×120 cm", "74.99")],
            ),
        ]

        ryo = Artist.objects.get(handle="ryo_tanabe")
        alex = Artist.objects.get(handle="alex_tanaka")

        def create_products(products_list, artist, category):
            for (title, price, orig_price, is_limited, is_sale, is_new, is_exclusive,
                 allow_custom_size, rating, review_count, tags,
                 description, material, img_url,
                 regional_prices, size_variants) in products_list:

                product = Product.objects.create(
                    title=title,
                    artist=artist,
                    category=category,
                    vendor=artist.vendor,
                    base_price=Decimal(str(price)),
                    original_price=Decimal(str(orig_price)) if orig_price else None,
                    is_limited=is_limited,
                    is_sale=is_sale,
                    is_new=is_new,
                    is_exclusive=is_exclusive,
                    allow_custom_size=allow_custom_size,
                    rating=Decimal(str(rating)),
                    review_count=review_count,
                    tags=tags,
                    description=description,
                    material=material,
                    regional_prices=regional_prices,
                )
                product.categories.add(category)
                ProductImage.objects.create(product=product, url=img_url, order=0)

                for sort_order, (label, sv_price) in enumerate(size_variants):
                    SizeVariant.objects.create(
                        product=product,
                        label=label,
                        price_usd=Decimal(sv_price),
                        sort_order=sort_order,
                        is_active=True,
                    )

        create_products(figure_products, ryo, figures_cat)
        create_products(wallpanel_products, alex, wallpanels_cat)

        for cat in Category.objects.all():
            cat.count = cat.products.count()
            cat.save(update_fields=["count"])

        self.stdout.write("  Products seeded with size variants, descriptions, materials, categories.")

    def _seed_processing_options(self):
        from apps.orders.models import ProcessingOption
        opts = [
            ("standard", "Standard", 15, 20, "0.00", "0.00", 0),
            ("fast",     "Fast",     8,  12, "25.00", "68.00", 1),
            ("express",  "Express",  4,  6,  "50.00", "135.00", 2),
        ]
        for slug, label, days_min, days_max, price_usd, price_gel, sort_order in opts:
            ProcessingOption.objects.update_or_create(
                slug=slug,
                defaults={
                    "label": label,
                    "est_days_min": days_min,
                    "est_days_max": days_max,
                    "price_usd": price_usd,
                    "price_gel": price_gel,
                    "sort_order": sort_order,
                    "is_active": True,
                },
            )
        self.stdout.write("  Processing options seeded.")

    def _sync_product_vendors(self):
        from apps.vendors.models import Vendor

        panel_vendor = Vendor.objects.filter(slug="panel-studio").first()
        figure_vendor = Vendor.objects.filter(slug="figure-studio").first()
        updated = 0

        for product in Product.objects.select_related("artist", "category", "vendor"):
            target_vendor = product.vendor
            if not target_vendor and product.artist and product.artist.vendor:
                target_vendor = product.artist.vendor
            if not target_vendor and product.category:
                if product.category.slug == "wallpanels":
                    target_vendor = panel_vendor
                elif product.category.slug == "figures":
                    target_vendor = figure_vendor
            if target_vendor and product.vendor_id != target_vendor.id:
                product.vendor = target_vendor
                product.save(update_fields=["vendor"])
                updated += 1

        self.stdout.write(f"  Product vendors synced ({updated} updated).")

    def _sync_tenants(self):
        from apps.tenants.models import Tenant
        from apps.users.models import User
        from apps.vendors.models import Vendor

        tenant_specs = [
            ("wallpanels", "Wallpanels", "panel-studio", "vendor1@kolekcia.com"),
            ("figures", "Figures", "figure-studio", "vendor2@kolekcia.com"),
        ]
        for tenant_id, tenant_name, vendor_slug, owner_email in tenant_specs:
            owner = User.objects.filter(email=owner_email).first()
            vendor = Vendor.objects.filter(slug=vendor_slug).first()
            tenant, _ = Tenant.objects.get_or_create(id=tenant_id, defaults={"name": tenant_name, "owner": owner})
            tenant.name = tenant_name
            if owner:
                tenant.owner = owner
            tenant.save(update_fields=["name", "owner"])
            if vendor:
                tenant.products.set(vendor.products.all())

        self.stdout.write("  Tenants synced.")

    def _seed_cms(self):
        slides = [
            ("image", "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=1440&h=720&fit=crop", None, "COLLECTIBLE\nFIGURES", "Precision metal figures sculpted for display shelves and collector cabinets", "Shop Figures", "/catalog?category=figures", "#e63946", 0),
            ("image", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1440&h=720&fit=crop", None, "METAL\nWALLPANELS", "3D relief panels that turn any wall into a living art installation", "Shop Wallpanels", "/catalog?category=wallpanels", "#e8a427", 1),
            ("image", "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1440&h=720&fit=crop", None, "LIMITED\nDROPS", "Exclusive pieces from our two in-house studios. New releases every Friday.", "View Limited Editions", "/catalog?limited=true", "#00b4d8", 2),
        ]
        for (slide_type, image_url, video_poster_url, headline, subline, cta, cta_href, accent, order) in slides:
            if not HeroSlide.objects.filter(headline=headline).exists():
                HeroSlide.objects.create(
                    type=slide_type,
                    image_url=image_url or "",
                    video_poster_url=video_poster_url or "",
                    headline=headline,
                    subline=subline,
                    cta=cta,
                    cta_href=cta_href,
                    accent=accent,
                    order=order,
                    is_active=True,
                )

        faqs = [
            ("What materials are used?", "Our posters are printed on premium metal using advanced UV printing technology, ensuring vibrant colors and durability.", "general", 0),
            ("How long does shipping take?", "Standard shipping takes 5-7 business days. Express options available at checkout.", "shipping", 1),
            ("Can I return my order?", "We accept returns within 30 days if the item is damaged or defective. Custom orders are non-refundable.", "returns", 2),
            ("Do you ship internationally?", "Yes! We ship to over 80 countries worldwide. International shipping typically takes 10-14 business days.", "shipping", 3),
        ]
        for question, answer, category, order in faqs:
            FAQ.objects.get_or_create(question=question, defaults={"answer": answer, "category": category, "order": order})

        self.stdout.write("  CMS data seeded.")

    def _seed_gamification(self):
        badges = [
            ("First Purchase", "🛒", "common", "Complete your first order.", "first_purchase"),
            ("Auction Gladiator", "⚔️", "rare", "Win your first live auction.", "auction_won"),
            ("Collector", "🖼️", "common", "Own 10+ posters.", "collector"),
            ("Art Connoisseur", "🎨", "epic", "Purchase from 5 different artist categories.", "art_connoisseur"),
            ("Review Legend", "⭐", "rare", "Submit 20+ verified reviews.", "review_legend"),
            ("Legendary Patron", "👑", "legendary", "Spend $1,000+ lifetime.", "legendary_patron"),
            ("Referral Champion", "🤝", "epic", "Refer 5 friends who complete purchases.", "referral_champion"),
            ("Night Owl", "🦉", "common", "Make a purchase between midnight and 4am.", "night_owl"),
        ]
        for name, icon, rarity, description, trigger_action in badges:
            Badge.objects.get_or_create(name=name, defaults={
                "icon": icon, "rarity": rarity, "description": description, "trigger_action": trigger_action
            })

        xp_rules = [
            ("first_purchase", 100, True),
            ("newsletter_signup", 25, True),
            ("profile_complete", 50, True),
            ("review_submitted", 15, False),
            ("auction_won", 200, False),
            ("referral", 75, False),
            ("order_placed", 10, False),
        ]
        for action_key, xp_amount, is_one_time in xp_rules:
            XPRule.objects.get_or_create(action_key=action_key, defaults={"xp_amount": xp_amount, "is_one_time": is_one_time})

        self.stdout.write("  Gamification data seeded.")
