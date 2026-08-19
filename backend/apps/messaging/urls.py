from django.urls import path
from .views import (
    ChatReportCreateView,
    ChatReportListView,
    ChatRestrictionDetailView,
    ChatRestrictionListView,
    ConversationListView,
    ConversationDetailView,
    ModeratedMessageDeleteView,
    RiskEventListView,
    SendMessageView,
    StartConversationWithCustomerView,
    UnreadCountView,
)

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/start-with-customer/", StartConversationWithCustomerView.as_view(), name="conversation-start-customer"),
    path("conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<int:pk>/messages/", SendMessageView.as_view(), name="send-message"),
    path("unread-count/", UnreadCountView.as_view(), name="unread-count"),
    path("reports/", ChatReportCreateView.as_view(), name="chat-report-create"),
    path("moderation/restrictions/", ChatRestrictionListView.as_view(), name="chat-restrictions"),
    path("moderation/restrictions/<int:pk>/", ChatRestrictionDetailView.as_view(), name="chat-restriction-detail"),
    path("moderation/reports/", ChatReportListView.as_view(), name="chat-report-list"),
    path("moderation/reports/<int:pk>/", ChatReportListView.as_view(), name="chat-report-detail"),
    path("moderation/messages/<str:target_type>/<int:target_id>/delete/", ModeratedMessageDeleteView.as_view(), name="chat-message-delete"),
    path("moderation/risk-events/", RiskEventListView.as_view(), name="risk-event-list"),
]
