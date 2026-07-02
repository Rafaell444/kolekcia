from django.core.management.base import BaseCommand
from apps.products.models import Category, Artist, Product, ProductImage, ProductVariant, PosterSize, PosterFinish, PosterFrame
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
        self._sync_product_vendors()
        self._sync_tenants()
        self._seed_cms()
        self._seed_gamification()
        self.stdout.write(self.style.SUCCESS("Database seeded successfully."))

    def _reset_catalog(self):
        from apps.products.models import Review, WishlistItem
        WishlistItem.objects.all().delete()
        Review.objects.all().delete()
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
        products_data = [
            # Figures — Ryo Tanabe
            ("Cyber Samurai", "ryo_tanabe", "figures", 39.99, None, True, False, False, False, 4.7, 987, ["Figure", "Samurai", "Cyberpunk"], "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop"),
            ("Neon Ronin", "ryo_tanabe", "figures", 34.99, 44.99, False, True, True, False, 4.8, 654, ["Figure", "Ronin", "Neon"], "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=840&fit=crop"),
            ("Ghost Protocol", "ryo_tanabe", "figures", 44.99, None, False, False, False, True, 4.9, 432, ["Figure", "Ghost", "Limited"], "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop"),
            ("Oni Guardian", "ryo_tanabe", "figures", 49.99, None, True, False, True, True, 5.0, 321, ["Figure", "Oni", "Exclusive"], "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop"),
            # Wallpanels — Alex Tanaka
            ("Midnight Circuit", "alex_tanaka", "wallpanels", 34.99, None, True, False, False, False, 4.6, 876, ["Wallpanel", "Circuit", "Cyberpunk"], "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop"),
            ("Aurora Drift", "alex_tanaka", "wallpanels", 49.99, None, False, False, False, True, 4.9, 2108, ["Wallpanel", "Aurora", "Exclusive"], "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop"),
            ("Void Horizon", "alex_tanaka", "wallpanels", 39.99, 49.99, False, True, True, False, 4.7, 765, ["Wallpanel", "Space", "Sale"], "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop"),
            ("Crystal Forest", "alex_tanaka", "wallpanels", 29.99, 34.99, False, True, False, False, 4.5, 543, ["Wallpanel", "Forest", "Nature"], "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=840&fit=crop"),
        ]

        default_size = PosterSize.objects.get(id="m")
        default_finish = PosterFinish.objects.get(id="matte")
        default_frame = PosterFrame.objects.get(id="none")

        for (title, handle, cat_slug, price, orig_price, is_limited, is_sale, is_new, is_exclusive, rating, review_count, tags, img_url) in products_data:
            artist = Artist.objects.get(handle=handle)
            category = Category.objects.get(slug=cat_slug)
            product = Product.objects.create(
                title=title,
                artist=artist,
                category=category,
                vendor=artist.vendor,
                base_price=price,
                original_price=orig_price,
                is_limited=is_limited,
                is_sale=is_sale,
                is_new=is_new,
                is_exclusive=is_exclusive,
                rating=rating,
                review_count=review_count,
                tags=tags,
            )
            ProductImage.objects.create(product=product, url=img_url, order=0)
            ProductVariant.objects.create(product=product, size=default_size, finish=default_finish, frame=default_frame, stock=100)

        for cat in Category.objects.all():
            cat.count = cat.products.count()
            cat.save(update_fields=["count"])

        self.stdout.write("  Products seeded.")

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
