from django.urls import reverse
from rest_framework.test import APITestCase

from .models import BlogPost


class PublicBlogPublishingTests(APITestCase):
    def test_post_appears_after_it_is_published(self):
        post = BlogPost.objects.create(
            title="Publishing test",
            excerpt="A test post",
            content="Test content",
            is_published=False,
        )

        list_url = reverse("blog-list")
        self.assertEqual(self.client.get(list_url).json(), [])

        post.is_published = True
        post.save()
        post.refresh_from_db()

        response = self.client.get(list_url)
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(post.published_at)
        self.assertEqual([item["id"] for item in response.json()], [post.id])

    def test_draft_post_detail_is_not_public(self):
        post = BlogPost.objects.create(
            title="Private draft",
            content="Draft content",
            is_published=False,
        )

        response = self.client.get(reverse("blog-detail", kwargs={"slug": post.slug}))
        self.assertEqual(response.status_code, 404)
