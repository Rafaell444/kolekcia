from rest_framework import serializers
from .models import ReferralInvite


class ReferralClaimSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=32)


class ReferralStatsSerializer(serializers.Serializer):
    code = serializers.CharField()
    total_invites = serializers.IntegerField()
    converted_invites = serializers.IntegerField()
