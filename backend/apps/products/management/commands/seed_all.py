"""
Comprehensive database seed: users, vendors, artists, products (30+),
variants, reviews, auctions, gamification, promo codes, CMS.
Run: python manage.py seed_all
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random


class Command(BaseCommand):
    help = "Seed the full database with rich demo data"

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.MIGRATE_HEADING("=== Kolekcia Full Seed ==="))
        self._seed_poster_options()
        self._reset_catalog()
        self._seed_categories()
        self._seed_users()
        self._seed_vendors()
        self._seed_artists()
        self._seed_products()
        self._sync_product_vendors()
        self._sync_tenants()
        self._seed_reviews()
        self._seed_auctions()
        self._seed_gamification()
        self._seed_promos()
        self._seed_cms()
        self.stdout.write(self.style.SUCCESS("\n✓ Database seeded successfully!"))

    # ────────────────────────────────────────────────
    def _seed_poster_options(self):
        from apps.products.models import PosterSize, PosterFinish, PosterFrame
        sizes = [
            ("xs", "XS  (8 × 11 in)",  0),
            ("s",  "S  (12 × 17 in)",  5),
            ("m",  "M  (18 × 24 in)", 10),
            ("l",  "L  (24 × 32 in)", 20),
            ("xl", "XL (36 × 48 in)", 40),
        ]
        for pk, label, sur in sizes:
            PosterSize.objects.get_or_create(id=pk, defaults={"label": label, "surcharge": sur})

        finishes = [
            ("matte",  "Matte",   0),
            ("gloss",  "Gloss",   5),
            ("satin",  "Satin",   8),
            ("canvas", "Canvas", 15),
        ]
        for pk, label, sur in finishes:
            PosterFinish.objects.get_or_create(id=pk, defaults={"label": label, "surcharge": sur})

        frames = [
            ("none",   "No Frame",  0),
            ("black",  "Black",    15),
            ("white",  "White",    15),
            ("walnut", "Walnut",   25),
            ("gold",   "Gold",     30),
        ]
        for pk, label, sur in frames:
            PosterFrame.objects.get_or_create(id=pk, defaults={"label": label, "surcharge": sur})

        self.stdout.write("  ✓ Poster options")

    def _reset_catalog(self):
        from apps.products.models import Review, WishlistItem, Product, ProductImage, ProductVariant, Artist, Category
        from apps.auctions.models import Auction

        WishlistItem.objects.all().delete()
        Review.objects.all().delete()
        Auction.objects.all().delete()
        ProductVariant.objects.all().delete()
        ProductImage.objects.all().delete()
        Product.objects.all().delete()
        Artist.objects.all().delete()
        Category.objects.all().delete()
        self.stdout.write("  ✓ Catalog reset")

    # ────────────────────────────────────────────────
    def _seed_categories(self):
        from apps.products.models import Category
        cats = [
            ("figures",    "Figures",    "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=400&h=400&fit=crop", 0),
            ("wallpanels", "Wallpanels", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop", 0),
        ]
        for slug, name, img, count in cats:
            Category.objects.create(slug=slug, name=name, image_url=img, count=count)
        self.stdout.write("  ✓ Categories")

    # ────────────────────────────────────────────────
    def _seed_users(self):
        from apps.users.models import User
        from apps.gamification.models import GamificationProfile

        # Staff / artist users
        staff = [
            ("vendor1@kolekcia.com", "Panel Studio",  "vendor12345",   "staff", True,  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face"),
            ("vendor2@kolekcia.com", "Figure Studio", "vendor12345",   "staff", True,  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&crop=face"),
            ("super@kolekcia.com",  "Superadmin",    "AdminPass123!", "staff", True,  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face"),
        ]
        for email, name, pw, role, is_staff, avatar in staff:
            if not User.objects.filter(email=email).exists():
                u = User.objects.create_user(email=email, password=pw, name=name, role=role, is_staff=is_staff, avatar=avatar)
                if email == "super@kolekcia.com":
                    u.is_superuser = True
                    u.save()

        # Regular customers
        customers = [
            ("alice@example.com",   "Alice Chen",    "Test1234!", "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=80&h=80&fit=crop&crop=face", 1250),
            ("bob@example.com",     "Bob Müller",    "Test1234!", "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=face", 750),
            ("carlos@example.com",  "Carlos Rivera", "Test1234!", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face", 320),
            ("diana@example.com",   "Diana Park",    "Test1234!", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face", 2100),
            ("evan@example.com",    "Evan Nakamura", "Test1234!", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face", 500),
        ]
        for email, name, pw, avatar, xp in customers:
            if not User.objects.filter(email=email).exists():
                u = User.objects.create_user(email=email, password=pw, name=name, role="customer", avatar=avatar)
                profile, _ = GamificationProfile.objects.get_or_create(user=u)
                profile.xp = xp
                profile.points = xp
                profile.recalculate_level()
                profile.save()

        self.stdout.write("  ✓ Users (3 staff + 5 customers)")

    # ────────────────────────────────────────────────
    def _seed_vendors(self):
        from apps.users.models import User
        from apps.vendors.models import Vendor

        vendors_data = [
            (
                "vendor1@kolekcia.com",
                "Panel Studio",
                "panel-studio",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop",
                "We craft ultra-high-definition 3D metal panel posters using our proprietary UV-cure layering process. Each panel is a sculptural art piece that transforms any wall.",
                "vendor1@kolekcia.com",
                "3D Panel Poster",
                "Hyper-realistic 3D relief metal panels — submit your image and we'll turn it into a stunning textured wall piece.",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop",
            ),
            (
                "vendor2@kolekcia.com",
                "Figure Studio",
                "figure-studio",
                "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=200&h=200&fit=crop",
                "Precision-printed 3D collectible figures using resin SLA technology. From anime characters to custom portraits — we make the impossible tangible.",
                "vendor2@kolekcia.com",
                "3D Figure",
                "Send us a reference image and we'll sculpt a one-of-a-kind 3D printed figure, hand-painted and ready to display.",
                "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=800&h=400&fit=crop",
            ),
        ]

        for email, name, slug, logo, desc, pay_email, prod_type, prod_desc, cover in vendors_data:
            try:
                user = User.objects.get(email=email)
                Vendor.objects.get_or_create(user=user, defaults={
                    "name": name, "slug": slug, "logo_url": logo,
                    "description": desc, "payment_email": pay_email,
                    "custom_product_type": prod_type,
                    "custom_product_description": prod_desc,
                    "custom_cover_url": cover,
                })
            except User.DoesNotExist:
                pass

        self.stdout.write("  ✓ Vendors")

    # ────────────────────────────────────────────────
    def _seed_artists(self):
        from apps.products.models import Artist
        from apps.users.models import User
        from apps.vendors.models import Vendor

        artists_data = [
            (
                "Ryo Tanabe", "ryo_tanabe",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=1200&h=400&fit=crop",
                "Osaka sculptor specializing in premium 3D metal collectible figures — from anime icons to original characters.",
                96, 12100, 22, "Gold", True, "vendor2@kolekcia.com", "figure-studio",
            ),
            (
                "Alex Tanaka", "alex_tanaka",
                "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=400&fit=crop",
                "Berlin-based artist crafting ultra-HD 3D relief metal wallpanels with proprietary UV-cure layering.",
                89, 9200, 18, "Gold", True, "vendor1@kolekcia.com", "panel-studio",
            ),
        ]

        for (name, handle, avatar, cover, bio, designs, followers, level, badge, verified, user_email, vendor_slug) in artists_data:
            defaults = {
                "name": name, "avatar_url": avatar, "cover_url": cover, "bio": bio,
                "designs": designs, "followers": followers, "level": level,
                "badge": badge, "verified": verified,
            }
            if user_email:
                try:
                    defaults["user"] = User.objects.get(email=user_email)
                except User.DoesNotExist:
                    pass
            if vendor_slug:
                try:
                    defaults["vendor"] = Vendor.objects.get(slug=vendor_slug)
                except Exception:
                    pass
            Artist.objects.create(handle=handle, **defaults)

        self.stdout.write("  ✓ Artists")

    # ────────────────────────────────────────────────
    def _seed_products(self):
        from apps.products.models import (
            Artist, Category, Product, ProductImage, ProductVariant,
            PosterSize, PosterFinish, PosterFrame,
        )

        # (title, artist_handle, cat_slug, base_price, orig_price, limited, sale, new_, exclusive, rating, reviews, tags, image_url, extra_images)
        products_data = [
            # Figures — Ryo Tanabe
            ("Cyber Samurai",   "ryo_tanabe",  "figures",    39.99, None,  True,  False, False, False, 4.7,  987, ["Figure","Samurai","Cyberpunk"],
             "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop",
             ["https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=840&fit=crop"]),
            ("Neon Ronin",      "ryo_tanabe",  "figures",    34.99, 44.99, False, True,  True,  False, 4.8,  654, ["Figure","Ronin","Neon"],
             "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=840&fit=crop", []),
            ("Ghost Protocol",  "ryo_tanabe",  "figures",    44.99, None,  False, False, False, True,  4.9,  432, ["Figure","Ghost","Limited"],
             "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop", []),
            ("Oni Guardian",    "ryo_tanabe",  "figures",    49.99, None,  True,  False, True,  True,  5.0,  321, ["Figure","Oni","Exclusive"],
             "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop", []),
            ("Dragon Knight",   "ryo_tanabe",  "figures",    54.99, None,  True,  False, False, True,  4.9,  278, ["Figure","Dragon","Knight"],
             "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop", []),
            ("Pixel Phantom",   "ryo_tanabe",  "figures",    29.99, 39.99, False, True,  False, False, 4.5,  543, ["Figure","Pixel","Retro"],
             "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=840&fit=crop", []),
            # Wallpanels — Alex Tanaka
            ("Midnight Circuit", "alex_tanaka", "wallpanels", 34.99, None,  True,  False, False, False, 4.6,  876, ["Wallpanel","Circuit","Cyberpunk"],
             "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop",
             ["https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop"]),
            ("Aurora Drift",     "alex_tanaka", "wallpanels", 49.99, None,  False, False, False, True,  4.9, 2108, ["Wallpanel","Aurora","Exclusive"],
             "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop", []),
            ("Void Horizon",     "alex_tanaka", "wallpanels", 39.99, 49.99, False, True,  True,  False, 4.7,  765, ["Wallpanel","Space","Sale"],
             "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop", []),
            ("Crystal Forest",   "alex_tanaka", "wallpanels", 29.99, 34.99, False, True,  False, False, 4.5,  543, ["Wallpanel","Forest","Nature"],
             "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=840&fit=crop", []),
            ("Liquid Geometry",  "alex_tanaka", "wallpanels", 44.99, None,  False, False, True,  False, 4.7,  432, ["Wallpanel","Abstract","Geometric"],
             "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&h=840&fit=crop", []),
            ("Event Horizon",    "alex_tanaka", "wallpanels", 59.99, None,  True,  False, False, True,  5.0,  211, ["Wallpanel","Cosmos","Limited"],
             "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&h=840&fit=crop", []),
        ]

        default_size   = __import__("apps.products.models", fromlist=["PosterSize"]).PosterSize.objects.get(id="m")
        default_finish = __import__("apps.products.models", fromlist=["PosterFinish"]).PosterFinish.objects.get(id="matte")
        default_frame  = __import__("apps.products.models", fromlist=["PosterFrame"]).PosterFrame.objects.get(id="none")

        all_sizes   = list(__import__("apps.products.models", fromlist=["PosterSize"]).PosterSize.objects.all())
        all_finishes = list(__import__("apps.products.models", fromlist=["PosterFinish"]).PosterFinish.objects.all())

        created = 0
        for (title, handle, cat_slug, price, orig_price, is_limited, is_sale,
             is_new, is_exclusive, rating, review_count, tags, img_url, extra_imgs) in products_data:

            artist   = Artist.objects.get(handle=handle)
            category = Category.objects.get(slug=cat_slug)

            product = Product.objects.create(
                title=title, artist=artist, category=category,
                vendor=artist.vendor,
                base_price=price, original_price=orig_price,
                is_limited=is_limited, is_sale=is_sale,
                is_new=is_new, is_exclusive=is_exclusive,
                rating=rating, review_count=review_count, tags=tags,
            )
            ProductImage.objects.create(product=product, url=img_url, order=0)
            for i, ex_img in enumerate(extra_imgs, start=1):
                ProductImage.objects.create(product=product, url=ex_img, order=i)

            # Create M variant for each finish, and default finish for each size
            ProductVariant.objects.get_or_create(
                product=product, size=default_size, finish=default_finish, frame=default_frame,
                defaults={"stock": 100},
            )
            for finish in all_finishes:
                if finish != default_finish:
                    ProductVariant.objects.get_or_create(
                        product=product, size=default_size, finish=finish, frame=default_frame,
                        defaults={"stock": 50},
                    )
            for size in all_sizes:
                if size != default_size:
                    ProductVariant.objects.get_or_create(
                        product=product, size=size, finish=default_finish, frame=default_frame,
                        defaults={"stock": 75},
                    )
            created += 1

        for cat in Category.objects.all():
            cat.count = cat.products.count()
            cat.save(update_fields=["count"])

        self.stdout.write(f"  ✓ Products ({created} created)")

    def _sync_product_vendors(self):
        from apps.products.models import Product
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

        self.stdout.write(f"  ✓ Product vendors synced ({updated} updated)")

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

        self.stdout.write("  ✓ Tenants synced")

    # ────────────────────────────────────────────────
    def _seed_reviews(self):
        from apps.products.models import Product, Review
        from apps.users.models import User

        review_texts = [
            ("Amazing quality — the colours are even more vivid in person!", 5),
            ("Arrived perfectly packaged. Already ordered a second one.", 5),
            ("Great print, the metal finish is top-notch.", 4),
            ("Looks incredible on my wall. My guests always ask about it.", 5),
            ("Exactly as described. Fast shipping too!", 4),
            ("The detail is insane. Worth every cent.", 5),
            ("Very happy with the purchase. Slight colour variance from screen but still beautiful.", 4),
            ("Magnetic mounting worked flawlessly. Took under a minute.", 5),
            ("Solid quality. The gloss finish really makes it pop.", 4),
            ("Perfect gift. My partner was speechless.", 5),
        ]

        customers = list(User.objects.filter(role="customer"))
        products = list(Product.objects.all())

        created = 0
        for i, product in enumerate(products):
            # Give each product 3-6 reviews
            num_reviews = random.randint(3, 6)
            used_users = set()
            for j in range(min(num_reviews, len(customers))):
                user = customers[(i + j) % len(customers)]
                if user.id in used_users:
                    continue
                used_users.add(user.id)
                text, rating = review_texts[(i + j) % len(review_texts)]
                if not Review.objects.filter(product=product, user=user).exists():
                    Review.objects.create(
                        product=product, user=user,
                        rating=rating, text=text, approved=True,
                    )
                    created += 1

        self.stdout.write(f"  ✓ Reviews ({created} created)")

    # ────────────────────────────────────────────────
    def _seed_auctions(self):
        from apps.products.models import Product
        from apps.auctions.models import Auction

        now = timezone.now()

        auctions_data = [
            ("Cyber Samurai — Signed Edition",      "Ryo Tanabe",  "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop", 249.99,  48,  True),
            ("Oni Guardian — Artist Proof",         "Ryo Tanabe",  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop", 499.99,  96,  True),
            ("Ghost Protocol — Chrome Variant",     "Ryo Tanabe",  "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop", 399.99,  72,  True),
            ("Aurora Drift — Master Panel",         "Alex Tanaka", "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop", 299.99,  72,  True),
            ("Midnight Circuit — Glow Edition",     "Alex Tanaka", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop", 129.99,  60,  True),
            ("Event Horizon — Collector Series",    "Alex Tanaka", "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&h=840&fit=crop", 349.99, 168, True),
            ("Void Horizon — Embossed Metal",       "Alex Tanaka", "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop", 179.99,  36,  True),
            ("Dragon Knight — Foil 1/50",           "Ryo Tanabe",  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop", 459.99, 120, True),
        ]

        created = 0
        for (title, artist_name, image_url, starting_bid, offset_h, is_live) in auctions_data:
            if Auction.objects.filter(title=title).exists():
                continue
            ends_at = now + timedelta(hours=offset_h)
            Auction.objects.create(
                title=title,
                artist_name=artist_name,
                image_url=image_url,
                starting_bid=starting_bid,
                ends_at=ends_at,
                is_live=is_live,
            )
            created += 1

        self.stdout.write(f"  ✓ Auctions ({created} created)")

    # ────────────────────────────────────────────────
    def _seed_gamification(self):
        from apps.gamification.models import Badge, XPRule

        badges = [
            ("Welcome",           "👋", "common",    "Create your Kolekcia account.",                    "registration_bonus"),
            ("First Purchase",    "🛒", "common",    "Complete your first order.",                       "first_purchase"),
            ("Auction Gladiator", "⚔️", "rare",      "Win your first live auction.",                     "auction_won"),
            ("Collector",         "🖼️", "common",    "Own 10+ posters.",                                "collector"),
            ("Art Connoisseur",   "🎨", "epic",      "Purchase from 5 different artist categories.",    "art_connoisseur"),
            ("Review Legend",     "⭐", "rare",      "Submit 20+ verified reviews.",                    "review_legend"),
            ("Legendary Patron",  "👑", "legendary", "Spend $1,000+ lifetime.",                          "legendary_patron"),
            ("Referral Champion", "🤝", "epic",      "Refer 5 friends who complete purchases.",          "referral_champion"),
            ("Night Owl",         "🦉", "common",    "Make a purchase between midnight and 4am.",        "night_owl"),
            ("Streak Master",     "🔥", "rare",      "Log in 30 days in a row.",                        "streak_30"),
            ("Wishlist Curator",  "💜", "common",    "Add 10 items to your wishlist.",                   "wishlist_10"),
            ("Social Butterfly",  "🦋", "epic",      "Share 5 products on social media.",                "social_share_5"),
        ]
        for name, icon, rarity, description, trigger_action in badges:
            Badge.objects.get_or_create(name=name, defaults={
                "icon": icon, "rarity": rarity,
                "description": description, "trigger_action": trigger_action,
            })

        from apps.promo.models import PromoCode
        freeshp = PromoCode.objects.filter(code="FREESHIP").first()
        if freeshp:
            Badge.objects.filter(trigger_action="first_purchase").update(
                prize_promo=freeshp,
                prize_description="Free shipping on your next order over $49",
            )

        xp_rules = [
            ("registration_bonus", 5, True),
            ("first_purchase",     100, True),
            ("newsletter_signup",   25, True),
            ("profile_complete",    50, True),
            ("review_submitted",    15, False),
            ("auction_won",        200, False),
            ("referral",            75, False),
            ("order_placed",        10, False),
            ("daily_login",          5, False),
            ("streak_30",          300, True),
            ("wishlist_10",         30, True),
            ("social_share_5",      50, True),
        ]
        for action_key, xp_amount, is_one_time in xp_rules:
            XPRule.objects.update_or_create(
                action_key=action_key,
                defaults={"xp_amount": xp_amount, "is_one_time": is_one_time},
            )

        self.stdout.write("  ✓ Gamification (badges + XP rules)")

    # ────────────────────────────────────────────────
    def _seed_promos(self):
        from apps.promo.models import PromoCode

        promos = [
            ("WELCOME10",   "percent", 10,  None,  1, 0,    None,   True,  "10% off for new members"),
            ("FREESHIP",    "percent",  0,  None,  1, 49,   None,   True,  "Free shipping over $49"),
            ("SAVE20",      "percent", 20,  100,   1, 50,   None,   True,  "20% off orders over $50 (max 100 uses)"),
            ("FLASH15",     "percent", 15,  None,  1, 0,    24,     True,  "Flash 15% off — 24h only"),
            ("COLLECTOR5",  "fixed",    5,  None,  3, 30,   None,   True,  "$5 off repeat purchases"),
        ]
        for (code, dtype, value, max_uses, max_per_user, min_val, expires_h, active, _desc) in promos:
            expires_at = timezone.now() + timedelta(hours=expires_h) if expires_h else None
            PromoCode.objects.get_or_create(
                code=code,
                defaults={
                    "discount_type": dtype,
                    "discount_value": value,
                    "max_uses": max_uses,
                    "max_uses_per_user": max_per_user,
                    "min_order_value": min_val,
                    "expires_at": expires_at,
                    "is_active": active,
                },
            )

        self.stdout.write("  ✓ Promo codes")

    # ────────────────────────────────────────────────
    def _seed_cms(self):
        from apps.cms.models import HeroSlide, FAQ, AnnouncementBar

        AnnouncementBar.objects.get_or_create(
            pk=1,
            defaults={
                "messages": [
                    "FREE SHIPPING on orders over $49 — use code FREESHIP",
                    "LIMITED EDITIONS: New drops every Friday at noon",
                    "EARN XP with every purchase — unlock exclusive badges",
                ],
                "is_active": True,
            },
        )

        slides = [
            ("image", "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=1440&h=720&fit=crop", None,
             "COLLECTIBLE\nFIGURES", "Precision metal figures from Figure Studio", "Shop Figures", "/catalog?category=figures", "#e63946", 0),
            ("image", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1440&h=720&fit=crop", None,
             "METAL\nWALLPANELS", "3D relief panels from Panel Studio", "Shop Wallpanels", "/catalog?category=wallpanels", "#e8a427", 1),
            ("image", "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1440&h=720&fit=crop", None,
             "LIMITED\nDROPS", "Exclusive pieces from our two in-house studios", "View Limited Editions", "/catalog?limited=true", "#00b4d8", 2),
            ("image", "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=1440&h=720&fit=crop", None,
             "LIVE\nAUCTIONS", "Bid on signed originals and one-of-a-kind artist proofs", "View Auctions", "/auctions", "#e63946", 3),
        ]
        for (stype, img, vposter, headline, subline, cta, cta_href, accent, order) in slides:
            if not HeroSlide.objects.filter(headline=headline).exists():
                HeroSlide.objects.create(
                    type=stype, image_url=img or "", video_poster_url=vposter or "",
                    headline=headline, subline=subline, cta=cta,
                    cta_href=cta_href, accent=accent, order=order, is_active=True,
                )

        faqs = [
            ("What materials are used?",        "Our posters are printed on premium aluminium using advanced UV printing technology — vibrant, durable, and scratch-resistant.", "general", 0),
            ("How long does shipping take?",    "Standard shipping: 5-7 business days. Express: 2-3 business days. We ship worldwide to 80+ countries.", "shipping", 1),
            ("Can I return my order?",          "100-day no-questions return policy. If you're not satisfied for any reason, contact us for a free return and full refund.", "returns", 2),
            ("How does magnetic mounting work?","Every order includes 4 magnetic mounting pins. Press a pin into the wall, click the poster on — no tools, no damage, under 30 seconds.", "general", 3),
            ("Do you ship internationally?",    "Yes! We ship to 80+ countries. International delivery typically takes 10-14 business days.", "shipping", 4),
            ("How do artist royalties work?",   "Artists set their own royalty on top of our base price. We handle production and fulfilment. Royalties are paid monthly.", "general", 5),
        ]
        for q, a, cat, order in faqs:
            FAQ.objects.get_or_create(question=q, defaults={"answer": a, "category": cat, "order": order})

        self.stdout.write("  ✓ CMS (hero slides + FAQs)")
