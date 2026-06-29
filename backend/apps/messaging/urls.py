from django.urls import path
from .views import ConversationListView, ConversationDetailView, SendMessageView

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<int:pk>/messages/", SendMessageView.as_view(), name="send-message"),
]
