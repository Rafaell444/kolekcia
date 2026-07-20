from django.utils import translation


class APILocaleMiddleware:
    """
    Activate the Django translation for API requests based on:
      1. ?lang=xx query parameter (highest priority)
      2. Accept-Language header
      3. Falls back to MODELTRANSLATION_DEFAULT_LANGUAGE / LANGUAGE_CODE
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        lang = request.GET.get("lang")
        if not lang:
            accept = request.META.get("HTTP_ACCEPT_LANGUAGE", "")
            if accept:
                lang = accept.split(",")[0].strip()[:2]
        if lang and lang in ("en", "ka", "ru"):
            translation.activate(lang)
        else:
            translation.activate("en")
        response = self.get_response(request)
        translation.deactivate()
        return response
