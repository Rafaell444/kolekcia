from modeltranslation.translator import TranslationOptions, translator

from .models import ProcessingOption


class ProcessingOptionTranslationOptions(TranslationOptions):
    fields = ("label",)


translator.register(ProcessingOption, ProcessingOptionTranslationOptions)
