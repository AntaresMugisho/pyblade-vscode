"""URL configuration for the PyBlade test workspace."""

from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView

urlpatterns = [
    path("", TemplateView.as_view(template_name="home.html"), name="home"),
    path("about/", TemplateView.as_view(template_name="about.html"), name="about"),
    path("admin/", admin.site.urls),
    path("blog/", include("blog.urls")),
]
