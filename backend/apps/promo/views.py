from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import PromoCode
from .serializers import PromoCodeSerializer


class ValidatePromoView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get("code", "").strip().upper()
        order_value = request.data.get("order_value", 0)

        try:
            promo = PromoCode.objects.get(code=code, is_active=True)
        except PromoCode.DoesNotExist:
            return Response({"detail": "Invalid or expired promo code."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else None
        error = promo.validate(user, order_value)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "code": promo.code,
            "discount_type": promo.discount_type,
            "discount_value": str(promo.discount_value),
        })
