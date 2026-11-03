"""URL configuration for the PyBlade test workspace."""

from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView
from django.shortcuts import render
from django import forms
from datetime import datetime

class ContactForm(forms.Form):
    name = forms.Textarea()
    email = forms.EmailField()
    message = forms.TextInput()

from datetime import datetime

messages = [
    {
        "id": 1,
        "sender": "Alice",
        "content": "Hey! How are you?",
        "created_at": datetime(2026, 10, 28, 9, 15),
    },
    {
        "id": 2,
        "sender": "Bob",
        "content": "I'm doing great, thanks!",
        "created_at": datetime(2026, 10, 28, 9, 20),
    },
    {
        "id": 3,
        "sender": "Alice",
        "content": "Did you finish the project?",
        "created_at": datetime(2026, 10, 29, 14, 30),
    },
    {
        "id": 4,
        "sender": "Bob",
        "content": "Almost done!",
        "created_at": datetime(2026, 10, 29, 15, 10),
    },
    {
        "id": 5,
        "sender": "Alice",
        "content": "Great! Let me know when it's ready.",
        "created_at": datetime(2026, 10, 29, 15, 15),
    },
    {
        "id": 6,
        "sender": "Bob",
        "content": "The project is now complete.",
        "created_at": datetime(2026, 11, 1, 10, 0),
    },
    {
        "id": 7,
        "sender": "Alice",
        "content": "Awesome work!",
        "created_at": datetime(2026, 11, 1, 10, 5),
    },
    {
        "id": 8,
        "sender": "Bob",
        "content": "I've pushed the latest changes.",
        "created_at": datetime(2026, 11, 3, 8, 45),
    },
]

def home(request):

    form = ContactForm()

    context = {
        "form": form,
        "status": "pending",
        "articles" : [{"title" : "Article 1",  "author": "antares"}],
        "fruits": ("Banana", "Apple", "Cherry", "Date"),
        "dict_fruits": [{"name": "Banana", "is_favorite": True}, {"name": "Apple", "is_favorite": False}, {"name": "Coco", "is_favorite": False}],
        "customer": {"first_name": "Antares", "last_name": "Mugisho"},
        "x": 30,
        "y": 75,
        "z": 100,
        "var1": "",
        "var2": None,
        "var3": False,
        "var4": "Variable 4",

        "cities": [
            {"name": "Calcutta", "population": "15,000,000", "country": "India"},
            {"name": "Chicago", "population": "7,000,000", "country": "USA"},
            {"name": "Mumbai", "population": "19,000,000", "country": "India"},
            {"name": "New York", "population": "20,000,000", "country": "USA"},
            {"name": "Tokyo", "population": "33,000,000", "country": "Japan"},
        ],

        "conv_messages": messages,

        "sizes": ["S", "M", "L", "XL", "XXL"],
    }




    return render(request, "home", context=context )

urlpatterns = [
    path("", home, name="home"),
    path("about/", TemplateView.as_view(template_name="about"), name="about"),
    path("admin/", admin.site.urls),
    path("blog/", include("blog.urls")),
]
