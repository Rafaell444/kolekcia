from modeltranslation.translator import TranslationOptions, translator

from .models import AnnouncementBar, Banner, FAQ, HeroSlide, HomepageReview, PageSection, TrustBarItem


class HeroSlideTranslationOptions(TranslationOptions):
    fields = ("headline", "subline", "cta")


class BannerTranslationOptions(TranslationOptions):
    fields = ("title", "subtitle", "cta")


class FAQTranslationOptions(TranslationOptions):
    fields = ("question", "answer", "category")


class AnnouncementBarTranslationOptions(TranslationOptions):
    fields = ("messages",)


class HomepageReviewTranslationOptions(TranslationOptions):
    fields = ("text",)


class PageSectionTranslationOptions(TranslationOptions):
    fields = ("title", "content")


class TrustBarItemTranslationOptions(TranslationOptions):
    fields = ("title", "description")


translator.register(HeroSlide, HeroSlideTranslationOptions)
translator.register(Banner, BannerTranslationOptions)
translator.register(FAQ, FAQTranslationOptions)
translator.register(AnnouncementBar, AnnouncementBarTranslationOptions)
translator.register(HomepageReview, HomepageReviewTranslationOptions)
translator.register(PageSection, PageSectionTranslationOptions)
translator.register(TrustBarItem, TrustBarItemTranslationOptions)
