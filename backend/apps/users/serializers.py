from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, Address


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("email", "name", "password", "password2")

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists. Please sign in or reset your password.")
        return email

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop("password2")
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data["email"], password=data["password"])
        if not user:
            raise serializers.ValidationError({"detail": "Invalid email or password."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "Account is deactivated."})
        data["user"] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", "email", "name", "role", "avatar", "is_active", "date_joined",
            "phone", "date_of_birth", "spendable_points", "lifetime_points",
        )
        read_only_fields = (
            "id", "email", "role", "is_active", "date_joined",
            "spendable_points", "lifetime_points",
        )


class AddressSerializer(serializers.ModelSerializer):
    label = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=50)
    line1 = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=255)
    line2 = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=255)
    city = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=100)
    state = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=100)
    zip_code = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=20)
    country = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=100)

    class Meta:
        model = Address
        fields = ("id", "label", "line1", "line2", "city", "state", "zip_code", "country", "is_default")

    def validate(self, attrs):
        errors = {}
        labels = {
            "label": "Address label",
            "line1": "Address line 1",
            "city": "City",
            "state": "State / Region",
            "zip_code": "Postal code",
            "country": "Country",
        }

        for field, label in labels.items():
            if self.instance and field not in attrs:
                continue
            value = str(attrs.get(field) or "").strip()
            if not value:
                errors[field] = [f"{label} is required."]
            else:
                attrs[field] = value

        if "line2" in attrs:
            attrs["line2"] = str(attrs.get("line2") or "").strip()

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, data):
        if data["new_password"] != data["new_password2"]:
            raise serializers.ValidationError({"new_password2": "Passwords do not match."})
        return data


class GoogleAuthSerializer(serializers.Serializer):
    id_token = serializers.CharField()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    password = serializers.CharField(validators=[validate_password])
    password2 = serializers.CharField()

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return data
