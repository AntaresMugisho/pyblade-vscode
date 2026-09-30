from pyblade import LiveComponent

class Counter(LiveComponent):

    def render(self):
        """Render components/counter/counter.html"""

        return self.render_template(context={})
