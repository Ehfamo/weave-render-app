"""Read-only HTTP regression for restored P0 entries on the isolated local server."""
from html.parser import HTMLParser
from urllib.request import urlopen


class Headings(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.values = []

    def handle_starttag(self, tag, attrs):
        if tag == "h1":
            self.active = True
            self.values.append("")

    def handle_endtag(self, tag):
        if tag == "h1":
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.values[-1] += data


for route, heading in [
    ("/en/data/annotation", "Annotation Studio"),
    ("/en/evals/experiments", "A/B Testing"),
    ("/en/inbox", "Inbox"),
    ("/en/legal", "Legal"),
]:
    with urlopen("http://127.0.0.1:4173" + route, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"Unexpected HTTP status for {route}: {response.status}")
        parser = Headings()
        parser.feed(response.read().decode("utf-8"))
        if heading not in parser.values:
            raise RuntimeError(f"Expected heading missing for {route}: {heading}")
        print("P0_ROUTE_HTTP_PASS", route, heading)
