from django.urls import path, re_path

from . import views

app_name = "blog"

urlpatterns = [
    path("", views.post_list, name="post_list"),
    path("<int:pk>/", views.post_detail, name="post_detail"),
    path(
        "<int:pk>/edit/",
        views.post_edit,
        name="post_edit",
    ),
    path("<slug:slug>/comments/", views.post_comments, name="post_comments"),
    re_path(r"^archive/(?P<year>[0-9]{4})/$", views.archive, name="archive"),
]
