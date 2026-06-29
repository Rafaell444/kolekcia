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
        self._seed_categories()
        self._seed_users()
        self._seed_vendors()
        self._seed_artists()
        self._seed_products()
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

    # ────────────────────────────────────────────────
    def _seed_categories(self):
        from apps.products.models import Category
        cats = [
            ("anime",    "Anime",    "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop", 45000),
            ("gaming",   "Gaming",   "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=400&fit=crop", 38000),
            ("space",    "Space",    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=400&fit=crop", 22000),
            ("nature",   "Nature",   "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=400&fit=crop", 61000),
            ("abstract", "Abstract", "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=400&fit=crop", 18000),
            ("movies",   "Movies",   "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=400&fit=crop", 29000),
            ("music",    "Music",    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop", 17000),
            ("fantasy",  "Fantasy",  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=400&fit=crop", 33000),
        ]
        for slug, name, img, count in cats:
            Category.objects.get_or_create(slug=slug, defaults={"name": name, "image_url": img, "count": count})
        self.stdout.write("  ✓ Categories")

    # ────────────────────────────────────────────────
    def _seed_users(self):
        from apps.users.models import User
        from apps.gamification.models import GamificationProfile

        # Staff / artist users
        staff = [
            ("panel@kolekcia.com",  "Panel Studio",  "AdminPass123!", "staff", True,  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face"),
            ("figure@kolekcia.com", "Figure Studio", "AdminPass123!", "staff", True,  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&crop=face"),
            ("super@kolekcia.com",  "Superadmin",    "AdminPass123!", "staff", True,  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face"),
        ]
        for email, name, pw, role, is_staff, avatar in staff:
            if not User.objects.filter(email=email).exists():
                u = User.objects.create_user(email=email, password=pw, name=name, role=role, is_staff=is_staff, avatar=avatar)
                if is_staff:
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
                "panel@kolekcia.com",
                "Panel Studio",
                "panel-studio",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop",
                "We craft ultra-high-definition 3D metal panel posters using our proprietary UV-cure layering process. Each panel is a sculptural art piece that transforms any wall.",
                "panel@kolekcia.com",
                "3D Panel Poster",
                "Hyper-realistic 3D relief metal panels — submit your image and we'll turn it into a stunning textured wall piece.",
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop",
            ),
            (
                "figure@kolekcia.com",
                "Figure Studio",
                "figure-studio",
                "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=200&h=200&fit=crop",
                "Precision-printed 3D collectible figures using resin SLA technology. From anime characters to custom portraits — we make the impossible tangible.",
                "figure@kolekcia.com",
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
            # (name, handle, avatar, cover, bio, designs, followers, level, badge, verified, user_email, vendor_slug)
            ("Kaoru Nishida",   "kaoru_nishida",   "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=face",   "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=400&fit=crop",  "Tokyo-born digital artist blending traditional ukiyo-e techniques with neon cyberpunk aesthetics. 12 years creating for galleries from Shibuya to New York.",    142, 18400, 32, "Diamond",  True,  None,                None),
            ("Alex Tanaka",     "alex_tanaka",     "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop&crop=face",   "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=400&fit=crop",  "Berlin-based generative artist using code, glitch, and retro-gaming culture to build vivid worlds. Featured in Wired DE and Designboom.",                       89,  9200,  18, "Gold",     True,  "panel@kolekcia.com", "panel-studio"),
            ("Selene Varga",    "selene_varga",    "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=200&h=200&fit=crop&crop=face",   "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&h=400&fit=crop", "Astrophysicist turned artist. Every piece begins as real NASA data before being transformed into emotional visual narratives about our place in the cosmos.",  203, 31000, 45, "Diamond",  True,  None,                None),
            ("Marcus Steele",   "marcus_steele",   "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop&crop=face",   "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=1200&h=400&fit=crop",  "Wildlife photographer and digital painter. Captures raw animal power and transforms it into bold, large-format metal art.",                                     57,  4800,  11, "Silver",   False, None,                None),
            ("Hana Kurosawa",   "hana_kurosawa",   "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face",     "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&h=400&fit=crop", "Award-winning concept artist for AAA game studios. Her personal work explores memory, light, and the invisible space between moments.",                          178, 24600, 39, "Platinum", True,  None,                None),
            ("Ryo Tanabe",      "ryo_tanabe",      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",   "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=1200&h=400&fit=crop",  "Osaka concept artist and figurine sculptor. His 2D pieces feel three-dimensional; his 3D pieces feel alive.",                                                   96,  12100, 22, "Gold",     True,  "figure@kolekcia.com","figure-studio"),
            ("Elara Moon",      "elara_moon",      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",   "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&h=400&fit=crop", "Nature and fantasy intersect in Elara's work. Trained as a botanist, she draws intricate ecosystems populated by mythological creatures.",                       64,  6200,  14, "Silver",   False, None,                None),
            ("Kai Nomura",      "kai_nomura",      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",   "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1200&h=400&fit=crop", "Former pro gamer turned digital illustrator. Kai's hyper-detailed gaming pieces sell out within hours of release.",                                             112, 15800, 27, "Gold",     True,  None,                None),
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
            Artist.objects.get_or_create(handle=handle, defaults=defaults)

        self.stdout.write("  ✓ Artists")

    # ────────────────────────────────────────────────
    def _seed_products(self):
        from apps.products.models import (
            Artist, Category, Product, ProductImage, ProductVariant,
            PosterSize, PosterFinish, PosterFrame,
        )

        # (title, artist_handle, cat_slug, base_price, orig_price, limited, sale, new_, exclusive, rating, reviews, tags, image_url, extra_images)
        products_data = [
            # ── ANIME ───────────────────────────────────────────────────────────────
            ("Neon Dragon",          "kaoru_nishida", "anime",    29.99, None,  False, False, True,  False, 4.8, 1243, ["Anime","Dragon","Neon","Cyberpunk"],
             "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop",
             ["https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=840&fit=crop"]),

            ("Sakura Ronin",         "kaoru_nishida", "anime",    34.99, 44.99, False, True,  False, False, 4.7,  876, ["Anime","Samurai","Sakura","Japan"],
             "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=840&fit=crop",
             []),

            ("Cyber Samurai",        "ryo_tanabe",    "anime",    39.99, None,  True,  False, False, False, 4.7,  987, ["Anime","Samurai","Cyberpunk","Neon"],
             "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop",
             ["https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=840&fit=crop"]),

            ("Ghost Protocol",       "ryo_tanabe",    "anime",    44.99, None,  False, False, False, True,  4.9, 2108, ["Anime","Ghost","Dystopia","Limited"],
             "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop",
             []),

            ("Oni Throne",           "kaoru_nishida", "anime",    49.99, None,  True,  False, True,  True,  5.0,  432, ["Anime","Oni","Limited","Exclusive"],
             "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop",
             []),

            # ── GAMING ──────────────────────────────────────────────────────────────
            ("Midnight Circuit",     "alex_tanaka",   "gaming",   34.99, None,  True,  False, False, False, 4.6,  876, ["Gaming","Circuit","Cyberpunk","Neon"],
             "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop",
             ["https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop"]),

            ("Digital Phantom",      "kai_nomura",    "gaming",   44.99, None,  False, False, False, True,  4.8, 1567, ["Gaming","Digital","Ghost","Exclusive"],
             "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=840&fit=crop",
             []),

            ("Pixel Overlord",       "kai_nomura",    "gaming",   29.99, 39.99, False, True,  False, False, 4.5,  654, ["Gaming","Pixel","Retro","8Bit"],
             "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=840&fit=crop",
             []),

            ("Neon Arena",           "alex_tanaka",   "gaming",   39.99, None,  False, False, True,  False, 4.6,  543, ["Gaming","Arena","Neon","Esports"],
             "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=600&h=840&fit=crop",
             []),

            ("Dungeon Boss",         "kai_nomura",    "gaming",   54.99, None,  True,  False, False, True,  4.9,  321, ["Gaming","Dungeon","Fantasy","Boss"],
             "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop",
             []),

            # ── SPACE ───────────────────────────────────────────────────────────────
            ("Void Between Stars",   "selene_varga",  "space",    34.99, None,  False, False, True,  False, 4.9, 2108, ["Space","Stars","Galaxy","NASA"],
             "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop",
             ["https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&h=840&fit=crop"]),

            ("Aurora Drift",         "hana_kurosawa", "space",    49.99, None,  False, False, False, True,  4.9, 3201, ["Space","Aurora","Northern Lights","Exclusive"],
             "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop",
             []),

            ("Nebula Core",          "selene_varga",  "space",    39.99, 49.99, False, True,  False, False, 4.7,  987, ["Space","Nebula","Cosmos","Sale"],
             "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&h=840&fit=crop",
             []),

            ("Event Horizon",        "selene_varga",  "space",    59.99, None,  True,  False, False, True,  5.0,  211, ["Space","Black Hole","Physics","Limited"],
             "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop",
             []),

            # ── NATURE ──────────────────────────────────────────────────────────────
            ("Iron Tiger",           "marcus_steele", "nature",   27.99, 34.99, False, True,  False, False, 4.5,  654, ["Nature","Tiger","Wildlife","Animal"],
             "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=600&h=840&fit=crop",
             []),

            ("Crystal Forest",       "elara_moon",    "nature",   24.99, 29.99, False, True,  False, False, 4.4,  432, ["Nature","Forest","Fantasy","Trees"],
             "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=840&fit=crop",
             []),

            ("Obsidian Wolf",        "marcus_steele", "nature",   32.99, None,  False, False, True,  False, 4.6,  765, ["Nature","Wolf","Dark","Monochrome"],
             "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop",
             []),

            ("Ancient Bloom",        "elara_moon",    "nature",   44.99, None,  True,  False, False, False, 4.8,  345, ["Nature","Flowers","Botanical","Limited"],
             "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&h=840&fit=crop",
             []),

            # ── ABSTRACT ────────────────────────────────────────────────────────────
            ("Chromatic Fracture",   "alex_tanaka",   "abstract", 39.99, None,  False, False, True,  False, 4.7,  876, ["Abstract","Color","Fracture","Geometric"],
             "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&h=840&fit=crop",
             []),

            ("Liquid Geometry",      "hana_kurosawa", "abstract", 34.99, 44.99, False, True,  False, False, 4.5,  543, ["Abstract","Geometric","Liquid","3D"],
             "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop",
             []),

            ("Void Prism",           "selene_varga",  "abstract", 54.99, None,  True,  False, False, True,  4.9,  234, ["Abstract","Prism","Space","Exclusive"],
             "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=840&fit=crop",
             []),

            # ── MOVIES ──────────────────────────────────────────────────────────────
            ("Noir City",            "kai_nomura",    "movies",   29.99, None,  False, False, True,  False, 4.6,  765, ["Movies","Noir","City","Retro"],
             "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=840&fit=crop",
             []),

            ("Director's Cut",       "alex_tanaka",   "movies",   44.99, 54.99, False, True,  False, False, 4.5,  432, ["Movies","Film","Cinema","Vintage"],
             "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=840&fit=crop",
             []),

            ("Silver Screen",        "hana_kurosawa", "movies",   34.99, None,  True,  False, False, False, 4.8,  678, ["Movies","Cinema","Limited","Golden Age"],
             "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=840&fit=crop",
             []),

            # ── MUSIC ───────────────────────────────────────────────────────────────
            ("Bass Drop",            "kai_nomura",    "music",    24.99, 29.99, False, True,  False, False, 4.4,  321, ["Music","Bass","Electronic","Club"],
             "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=840&fit=crop",
             []),

            ("Vinyl Soul",           "elara_moon",    "music",    34.99, None,  False, False, True,  False, 4.7,  543, ["Music","Vinyl","Jazz","Retro"],
             "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=840&fit=crop",
             []),

            ("Electric Aria",        "hana_kurosawa", "music",    49.99, None,  True,  False, False, True,  5.0,  189, ["Music","Opera","Electric","Limited"],
             "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&h=840&fit=crop",
             []),

            # ── FANTASY ─────────────────────────────────────────────────────────────
            ("Dragon Realm",         "elara_moon",    "fantasy",  39.99, 49.99, False, True,  False, False, 4.6,  876, ["Fantasy","Dragon","Magic","Castle"],
             "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop",
             []),

            ("Arcane Portal",        "kaoru_nishida", "fantasy",  44.99, None,  False, False, True,  False, 4.8,  654, ["Fantasy","Magic","Portal","Arcane"],
             "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop",
             []),

            ("Last Prophecy",        "marcus_steele", "fantasy",  59.99, None,  True,  False, False, True,  4.9,  432, ["Fantasy","Epic","War","Limited"],
             "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop",
             []),

            ("The Wanderer",         "selene_varga",  "fantasy",  34.99, None,  False, False, False, False, 4.5,  321, ["Fantasy","Journey","Landscape","Mystical"],
             "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop",
             []),
        ]

        default_size   = __import__("apps.products.models", fromlist=["PosterSize"]).PosterSize.objects.get(id="m")
        default_finish = __import__("apps.products.models", fromlist=["PosterFinish"]).PosterFinish.objects.get(id="matte")
        default_frame  = __import__("apps.products.models", fromlist=["PosterFrame"]).PosterFrame.objects.get(id="none")

        all_sizes   = list(__import__("apps.products.models", fromlist=["PosterSize"]).PosterSize.objects.all())
        all_finishes = list(__import__("apps.products.models", fromlist=["PosterFinish"]).PosterFinish.objects.all())

        created = 0
        for (title, handle, cat_slug, price, orig_price, is_limited, is_sale,
             is_new, is_exclusive, rating, review_count, tags, img_url, extra_imgs) in products_data:

            if Product.objects.filter(title=title).exists():
                continue
            try:
                artist   = Artist.objects.get(handle=handle)
                category = Category.objects.get(slug=cat_slug)
            except (Artist.DoesNotExist, Category.DoesNotExist):
                continue

            product = Product.objects.create(
                title=title, artist=artist, category=category,
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

        self.stdout.write(f"  ✓ Products ({created} created)")

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
            # (title, artist_name, image_url, starting_bid, ends_offset_hours, is_live)
            ("Neon Dragon — Signed Original",          "Kaoru Nishida",  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop", 149.99,  48,  True),
            ("Aurora Drift — Artist Proof",            "Hana Kurosawa",  "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop", 299.99,  72,  True),
            ("Void Between Stars — 1/1 Print",        "Selene Varga",   "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop", 199.99,  24,  True),
            ("Cyber Samurai — Limited Foil",           "Ryo Tanabe",     "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop", 249.99,  96,  True),
            ("Digital Phantom — Master Edition",      "Kai Nomura",     "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=840&fit=crop", 399.99, 120,  True),
            ("Last Prophecy — Embossed Metal",        "Marcus Steele",  "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=600&h=840&fit=crop", 179.99,  36,  True),
            ("Event Horizon — Collector Series",      "Selene Varga",   "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&h=840&fit=crop", 349.99, 168, True),
            ("Midnight Circuit — Glow Edition",       "Alex Tanaka",    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop", 129.99,  60,  True),
            ("Ancient Bloom — Pressed Series",        "Elara Moon",     "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=840&fit=crop",  99.99,  18, False),
            ("Oni Throne — Gold Foil 1/50",           "Kaoru Nishida",  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=840&fit=crop", 499.99, 240,  True),
            ("Arcane Portal — Rainbow Chromatic",     "Kaoru Nishida",  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop", 159.99,  84,  True),
            ("Dragon Realm — Watercolour Hybrid",     "Elara Moon",     "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop", 219.99, 144,  True),
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

        xp_rules = [
            ("registration_bonus", 500, True),
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
            XPRule.objects.get_or_create(
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
        from apps.cms.models import HeroSlide, FAQ

        slides = [
            ("image", "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1440&h=720&fit=crop", None,
             "ART THAT\nGETS YOU", "2.5 million designs from 150K+ independent artists", "Shop Now", "/catalog", "#e63946", 0),
            ("image", "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1440&h=720&fit=crop", None,
             "EXPLORE\nTHE COSMOS", "Stunning space art from the world's top digital artists", "Browse Space", "/catalog?category=space", "#e8a427", 1),
            ("image", "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1440&h=720&fit=crop", None,
             "GAME\nON", "Official licensed gaming posters and fan-made originals", "Shop Gaming", "/catalog?category=gaming", "#00b4d8", 2),
            ("image", "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1440&h=720&fit=crop", None,
             "LIMITED\nDROPS", "Exclusive prints. New releases every Friday at noon.", "View Limited Editions", "/catalog?filter=limited", "#e8a427", 3),
            ("image", "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=1440&h=720&fit=crop", None,
             "LIVE\nAUCTIONS", "Bid on signed originals and one-of-a-kind artist proofs.", "View Auctions", "/auctions", "#e63946", 4),
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
