from django.shortcuts import render

POSTS = [
    {"pk": 1, "slug": "hello-pyblade", "title": "Hello PyBlade"},
    {"pk": 2, "slug": "components", "title": "Writing components"},
]


def post_list(request):
    return render(request, "blog/post_list.html", {"posts": POSTS})


def post_detail(request, pk):
    post = next((p for p in POSTS if p["pk"] == pk), POSTS[0])
    return render(request, "blog/post_detail.html", {"post": post})


def post_edit(request, pk):
    post = next((p for p in POSTS if p["pk"] == pk), POSTS[0])
    return render(request, "blog/post_detail.html", {"post": post, "editing": True})


def post_comments(request, slug):
    post = next((p for p in POSTS if p["slug"] == slug), POSTS[0])
    return render(request, "blog/post_detail.html", {"post": post})


def archive(request, year):
    return render(request, "blog/post_list.html", {"posts": POSTS, "year": year})
