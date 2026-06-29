from django.core.management.base import BaseCommand
from apps.products.models import Category, Artist, Product, ProductImage, ProductVariant, PosterSize, PosterFinish, PosterFrame
from apps.users.models import User
from apps.cms.models import HeroSlide, FAQ, Banner
from apps.gamification.models import Badge, XPRule


class Command(BaseCommand):
    help = "Seed database with initial data from mock-data"

    def handle(self, *args, **kwargs):
        self._seed_poster_options()
        self._seed_categories()
        self._seed_artists()
        self._seed_products()
        self._seed_cms()
        self._seed_gamification()
        self.stdout.write(self.style.SUCCESS("Database seeded successfully."))

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
            ("anime", "Anime", "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&h=200&fit=crop", 45000),
            ("gaming", "Gaming", "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=200&h=200&fit=crop", 38000),
            ("space", "Space", "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=200&h=200&fit=crop", 22000),
            ("nature", "Nature", "https://images.unsplash.com/photo-1448375240586-882707db888b?w=200&h=200&fit=crop", 61000),
            ("abstract", "Abstract", "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200&h=200&fit=crop", 18000),
            ("movies", "Movies", "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&h=200&fit=crop", 29000),
            ("music", "Music", "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop", 17000),
            ("fantasy", "Fantasy", "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&h=200&fit=crop", 33000),
        ]
        for slug, name, image_url, count in cats:
            Category.objects.get_or_create(slug=slug, defaults={"name": name, "image_url": image_url, "count": count})
        self.stdout.write("  Categories seeded.")

    def _seed_artists(self):
        artists_data = [
            ("Kaoru Nishida", "kaoru_nishida", "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=100&fit=crop", 142, 18400, 32, "Diamond", True),
            ("Alex Tanaka", "alex_tanaka", "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=100&fit=crop", 89, 9200, 18, "Gold", True),
            ("Selene Varga", "selene_varga", "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=100&fit=crop", 203, 31000, 45, "Diamond", True),
            ("Marcus Steele", "marcus_steele", "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&h=100&fit=crop", 57, 4800, 11, "Silver", False),
            ("Hana Kurosawa", "hana_kurosawa", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=100&fit=crop", 178, 24600, 39, "Platinum", True),
            ("Ryo Tanabe", "ryo_tanabe", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=400&h=100&fit=crop", 96, 12100, 22, "Gold", True),
            ("Elara Moon", "elara_moon", "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=100&fit=crop", 64, 6200, 14, "Silver", False),
            ("Kai Nomura", "kai_nomura", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face", "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&h=100&fit=crop", 112, 15800, 27, "Gold", True),
        ]
        for name, handle, avatar, cover, designs, followers, level, badge, verified in artists_data:
            Artist.objects.get_or_create(handle=handle, defaults={
                "name": name, "avatar_url": avatar, "cover_url": cover,
                "designs": designs, "followers": followers, "level": level,
                "badge": badge, "verified": verified,
            })
        self.stdout.write("  Artists seeded.")

    def _seed_products(self):
        products_data = [
            ("Neon Dragon", "kaoru_nishida", "anime", 29.99, 39.99, False, True, False, False, 4.8, 1243, ["Anime", "Dragon", "Neon"], "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=560&fit=crop"),
            ("Midnight Circuit", "alex_tanaka", "gaming", 34.99, None, True, False, False, False, 4.6, 876, ["Gaming", "Circuit", "Cyberpunk"], "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=560&fit=crop"),
            ("Void Between Stars", "selene_varga", "space", 34.99, None, False, False, True, False, 4.9, 2108, ["Space", "Stars", "Galaxy"], "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=560&fit=crop"),
            ("Iron Tiger", "marcus_steele", "nature", 27.99, 34.99, False, True, False, False, 4.5, 654, ["Nature", "Tiger", "Wildlife"], "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&h=560&fit=crop"),
            ("Aurora Drift", "hana_kurosawa", "space", 49.99, None, False, False, False, True, 4.9, 3201, ["Space", "Aurora", "Northern Lights"], "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=560&fit=crop"),
            ("Cyber Samurai", "ryo_tanabe", "anime", 39.99, None, True, False, True, False, 4.7, 987, ["Anime", "Samurai", "Cyberpunk"], "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=400&h=560&fit=crop"),
            ("Crystal Forest", "elara_moon", "nature", 24.99, 29.99, False, True, False, False, 4.4, 432, ["Nature", "Forest", "Fantasy"], "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=560&fit=crop"),
            ("Digital Phantom", "kai_nomura", "gaming", 44.99, None, False, False, False, True, 4.8, 1567, ["Gaming", "Digital", "Ghost"], "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&h=560&fit=crop"),
        ]

        default_size = PosterSize.objects.get(id="m")
        default_finish = PosterFinish.objects.get(id="matte")
        default_frame = PosterFrame.objects.get(id="none")

        for (title, handle, cat_slug, price, orig_price, is_limited, is_sale, is_new, is_exclusive, rating, review_count, tags, img_url) in products_data:
            if Product.objects.filter(title=title).exists():
                continue
            artist = Artist.objects.get(handle=handle)
            category = Category.objects.get(slug=cat_slug)
            product = Product.objects.create(
                title=title, artist=artist, category=category,
                base_price=price, original_price=orig_price,
                is_limited=is_limited, is_sale=is_sale, is_new=is_new, is_exclusive=is_exclusive,
                rating=rating, review_count=review_count, tags=tags,
            )
            ProductImage.objects.create(product=product, url=img_url, order=0)
            ProductVariant.objects.create(product=product, size=default_size, finish=default_finish, frame=default_frame, stock=100)

        self.stdout.write("  Products seeded.")

    def _seed_cms(self):
        slides = [
            ("image", "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1440&h=720&fit=crop", None, "ART THAT\nGETS YOU", "2.5 million designs from 150K+ independent artists", "Shop Now", "/catalog", "#e63946", 0),
            ("image", "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1440&h=720&fit=crop", None, "EXPLORE\nTHE COSMOS", "Stunning space art prints from the world's top digital artists", "Browse Space", "/catalog?category=space", "#e8a427", 1),
            ("image", "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1440&h=720&fit=crop", None, "GAME\nON", "Official licensed gaming posters and fan-made originals", "Shop Gaming", "/catalog?category=gaming", "#00b4d8", 2),
            ("video", None, "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1440&h=720&fit=crop", "LIMITED\nDROPS", "Exclusive prints. New releases every Friday at noon.", "View Limited Editions", "/catalog?limited=true", "#e8a427", 3),
        ]
        for (slide_type, image_url, video_poster_url, headline, subline, cta, cta_href, accent, order) in slides:
            if not HeroSlide.objects.filter(headline=headline).exists():
                HeroSlide.objects.create(
                    type=slide_type, image_url=image_url or "", video_poster_url=video_poster_url or "",
                    headline=headline, subline=subline, cta=cta, cta_href=cta_href,
                    accent=accent, order=order, is_active=True,
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
