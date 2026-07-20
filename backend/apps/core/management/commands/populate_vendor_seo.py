from django.core.management.base import BaseCommand
from apps.vendors.models import Vendor


VENDOR_SEO_DATA = {
    "panel-studio": {
        "name": "MangaMoon",
        "slug": "mangamoon",
        "meta_title_en": "Anime Posters & Gaming Room Wall Decor | MangaMoon",
        "meta_description_en": (
            "Upgrade your streaming room with unique wooden wall panels and anime "
            "posters by MangaMoon. The perfect gift for a boyfriend or gamer. Shop wall art!"
        ),
        "meta_title_ka": "ანიმე ხის პოსტერები და კედლის დეკორაცია | MangaMoon",
        "meta_description_ka": (
            "გააფორმე შენი ოთახი MangaMoon-ის ხის პოსტერებით. საუკეთესო კედლის "
            "დეკორაცია და საჩუქარი შეყვარებულისთვის. შეუკვეთე ონლაინ."
        ),
        "meta_title_ru": "Аниме Постеры и Деревянное Панно на Стену | MangaMoon",
        "meta_description_ru": (
            "Деревянный декор на стену и аниме постеры от MangaMoon. Идеальный декор "
            "для игровой комнаты и отличный подарок любителю аниме."
        ),
    },
    "figure-studio": {
        "name": "Sculpi",
        "slug": "sculpi",
        "meta_title_en": "Custom Anime & Gaming Figures | Sculpi by Koleqcia",
        "meta_description_en": (
            "Looking for a unique gift? Explore highly detailed anime and gaming "
            "figures by Sculpi. Handmade fanart for your gaming setup. Find your favorite character!"
        ),
        "meta_title_ka": "ანიმეს, ფილმების და თამაშების ფიგურები | Sculpi",
        "meta_description_ka": (
            "ეძებ ორიგინალურ საჩუქარს? აღმოაჩინე Sculpi-ს ფიგურები. საუკეთესო "
            "საჩუქარი ძმისთვის და გეიმერებისთვის. დამზადებულია საქართველოში."
        ),
        "meta_title_ru": "Аниме и Игровые Фигурки Ручной Работы | Sculpi",
        "meta_description_ru": (
            "Уникальные фигурки из игр, фильмов и сериалов от Sculpi. Лучший необычный "
            "подарок для геймера. Выбирайте эксклюзивный игровой декор ручной работы!"
        ),
    },
}


class Command(BaseCommand):
    help = "Populate MangaMoon and Sculpi vendor SEO fields in en/ka/ru."

    def handle(self, *args, **options):
        for old_slug, data in VENDOR_SEO_DATA.items():
            try:
                vendor = Vendor.objects.get(slug=old_slug)
            except Vendor.DoesNotExist:
                try:
                    vendor = Vendor.objects.get(slug=data["slug"])
                except Vendor.DoesNotExist:
                    self.stderr.write(self.style.WARNING(
                        f"  Vendor with slug '{old_slug}' or '{data['slug']}' not found — skipping."
                    ))
                    continue

            vendor.name = data["name"]
            vendor.name_en = data["name"]
            vendor.slug = data["slug"]
            vendor.meta_title_en = data["meta_title_en"]
            vendor.meta_description_en = data["meta_description_en"]
            vendor.meta_title_ka = data["meta_title_ka"]
            vendor.meta_description_ka = data["meta_description_ka"]
            vendor.meta_title_ru = data["meta_title_ru"]
            vendor.meta_description_ru = data["meta_description_ru"]
            vendor.save()

            self.stdout.write(self.style.SUCCESS(
                f"  {data['name']} ({data['slug']}): SEO fields updated for en/ka/ru."
            ))

        self.stdout.write(self.style.SUCCESS("\nDone."))
