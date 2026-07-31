from django.db import migrations


TRANSLATIONS = {
    "delivery": {
        "ka": ("სწრაფი მიწოდება", "თქვენს კართან რამდენიმე დღეში"),
        "ru": ("Быстрая доставка", "У вашей двери через несколько дней"),
    },
    "payments": {
        "ka": ("უსაფრთხო გადახდები", "100%-ით დაცული გადახდა 256-ბიტიანი SSL დაშიფვრით"),
        "ru": ("Безопасные платежи", "Защищенная оплата с 256-битным SSL-шифрованием"),
    },
    "returns": {
        "ka": ("100 დღე დაბრუნებისთვის", "მარტივი დაბრუნება ზედმეტი კითხვების გარეშე"),
        "ru": ("100 дней на возврат", "Простой возврат без лишних вопросов"),
    },
}


def forwards(apps, schema_editor):
    TrustBarItem = apps.get_model("cms", "TrustBarItem")
    for item in TrustBarItem.objects.all():
        item.title_en = item.title
        item.description_en = item.description
        translated = TRANSLATIONS.get(item.key)
        if translated:
            item.title_ka, item.description_ka = translated["ka"]
            item.title_ru, item.description_ru = translated["ru"]
        item.save(update_fields=[
            "title_en", "description_en",
            "title_ka", "description_ka",
            "title_ru", "description_ru",
        ])


class Migration(migrations.Migration):
    dependencies = [("cms", "0011_trustbaritem_description_en_and_more")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
