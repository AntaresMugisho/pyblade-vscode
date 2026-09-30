from pyblade import LiveComponent

class Bookmark(LiveComponent):

    def render(self):
        """Render components/bookmark.html"""

        return self.render_template(context={})
