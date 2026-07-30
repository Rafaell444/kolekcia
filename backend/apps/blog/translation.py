from modeltranslation.translator import TranslationOptions, translator

from .models import BlogPost


class BlogPostTranslationOptions(TranslationOptions):
    fields = ("title", "excerpt", "content")


translator.register(BlogPost, BlogPostTranslationOptions)
