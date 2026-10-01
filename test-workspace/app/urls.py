from django.urls import path
from django.shortcuts import render

urlpatterns = [
    path(
        "app/", 
        lambda request: render(request, 'app.index'), 
        name="app:index"
    )
]