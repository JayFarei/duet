// Original placeholder prose. A paragraph starting "## " is a subhead, "> " a pull quote.
export type Art = "keepers" | "moss" | "islands" | "starter" | "index";
export interface Article {
  slug: Art; section: string; title: string; dek: string; author: string; date: string;
  /** Hue for the hero's soft tones (low saturation, set in CSS). */
  hue: number;
  body: string[];
}

export const ARTICLES: Article[] = [
  {
    slug: "keepers", section: "History", title: "What the Keepers Wrote Down", author: "Mara Ellison", date: "October 24", hue: 215,
    dek: "For two centuries, lighthouse logbooks recorded weather, ships and boredom. Read together, they are an accidental diary of the sea.",
    body: [
      "Every lighthouse kept a book. The rules varied by coast and by century, but the duty was the same everywhere: at the end of each watch, the keeper wrote down the state of the wind, the sea, the sky and the light. Most entries are a single line. Many are only a few words. Wind northwest, fresh. Visibility good. Light exhibited sunset to sunrise. Lamp trimmed twice.",
      "Read one page and you learn almost nothing. Read a decade of pages and something else appears. The handwriting changes when a new assistant arrives. The entries grow longer in winter, when there was more to report and less to do. A keeper who wrote three words a night for years will suddenly fill half a page about a ship that came too close, and then return to his three words as if nothing had happened.",
      "## The weather, by hand",
      "Historians of climate have started to take these books seriously. Before automated stations, the keepers were among the few people anywhere who looked at the same patch of sky at the same hours every day, for decades, and wrote down what they saw. Their notes are coarse by modern standards, but they are steady, and steadiness is exactly what a long record needs.",
      "> The logbook was never meant to be a diary. Over enough nights, it became one.",
      "There is a quieter value too. The logs record what it was like to tend something that must never fail, in a place where nobody was watching. Nobody read most of these entries when they were written. They were kept anyway, night after night, in case one night mattered.",
      "The last staffed lights were automated within living memory, and the books stopped with them. Some ended mid-season, the final entry no different from the thousand before it: wind light, sea calm, light exhibited. It is hard to imagine a better last line.",
    ],
  },
  {
    slug: "moss", section: "Nature", title: "A Slow Country of Moss", author: "Tomas Reyes", date: "October 23", hue: 105,
    dek: "Mosses have no roots, no flowers and no hurry. They have also outlasted almost everything else that grows on land.",
    body: [
      "Kneel down at the edge of almost any path and you are looking at one of the oldest designs for living on land. Mosses were among the first plants to leave the water, hundreds of millions of years ago, and they have changed remarkably little since. They never needed to. The arrangement works.",
      "A moss has no true roots. The fine threads that anchor it to stone or bark are for holding on, not drinking. Water and minerals are taken in across the whole surface of the plant, which is why mosses love shade and rain, and why a cushion of moss feels like a wet sponge after a storm.",
      "## Waiting out the dry",
      "What happens when the rain stops is the remarkable part. Many mosses simply dry out. They curl, darken, and to all appearances die. They can stay that way for weeks or months, and in some cases far longer. Then a little water arrives and within hours the leaves unfold and the plant is green again, as though it had only blinked.",
      "> Within hours the leaves unfold, as though the plant had only blinked.",
      "Gardeners in Japan have cultivated moss for centuries, raking and sweeping and weeding to keep its surfaces calm. A moss garden asks for patience rather than effort. It grows a few millimetres in a good year. Its changes are measured in seasons, and the best way to see it is to sit still long enough to stop expecting anything to happen.",
      "It is tempting to call mosses humble. That misses the point. They are not small because they failed to become trees. They are small because small, in the right place, is a complete answer.",
    ],
  },
  {
    slug: "islands", section: "History", title: "The Islands That Were Never There", author: "Ines Holloway", date: "October 22", hue: 185,
    dek: "Old charts are full of land that nobody could find twice. Some phantom islands lasted on maps for centuries.",
    body: [
      "For most of the history of navigation, finding an island was easier than proving it did not exist. A sailor who sighted land wrote it down. A cartographer who received the report drew it in. Removing it again required someone to sail to the exact spot, look carefully, find only water, and be believed.",
      "So islands accumulated. Some were low banks of cloud on the horizon, which can look convincingly like a coastline at dusk. Some were icebergs, or floating rafts of pumice from distant eruptions. Some came from honest errors of longitude, so that one real island was charted twice, a few hundred miles apart, and both copies were faithfully reproduced for generations.",
      "## Copied, then copied again",
      "Maps were built from earlier maps. An island that appeared on a respected chart would be traced onto the next one, and the next, each copy adding authority. By the time anyone thought to check, the island had a name, an outline, sometimes a reputation for good water or dangerous reefs.",
      "> Removing an island required someone to find only water, and be believed.",
      "Some lasted remarkably long. A small island in the Coral Sea appeared on charts and even in digital map data well into this century, until a research voyage in 2012 sailed through where it was supposed to be and found open ocean more than a kilometre deep. The island was quietly deleted. It had existed, on paper, for over a hundred years.",
      "It is easy to laugh at the old mapmakers. But every map is a record of what someone believed when it was drawn, and every map we use today contains mistakes nobody has sailed out to find yet.",
    ],
  },
  {
    slug: "starter", section: "Craft", title: "Bread Remembers", author: "Hanna Lindqvist", date: "October 21", hue: 38,
    dek: "A sourdough starter is flour, water and time. It is also a small ecosystem that can outlive the people who feed it.",
    body: [
      "Mix flour and water, leave it somewhere warm, and wait. For a day or two, not much happens. Then bubbles appear, and a smell that is sour, then fruity, then something like beer. You have not added yeast. It was already there, on the grain and in the air and on your hands, waiting for food.",
      "What lives in a jar of starter is a partnership. Wild yeasts produce the gas that makes dough rise. Lactic acid bacteria, far more numerous, produce the acids that give sourdough its tang and keep unwelcome microbes away. Each makes the jar a better home for the other. Feed it regularly and the community settles into a balance that can persist for years.",
      "## A living inheritance",
      "Because a starter can be kept going indefinitely, bakers pass them on. A spoonful given to a friend becomes a new jar in a new kitchen, and over months it shifts a little to suit its new flour and its new climate. Some bakeries claim starters that have been fed every day for generations. The claims are hard to verify and a pleasure to believe.",
      "> A spoonful given to a friend becomes a new jar in a new kitchen.",
      "Baking with one teaches a particular kind of attention. The starter is livelier in summer and sluggish in winter. It rises faster when you are in a hurry and slower when you are watching. Recipes give times, but experienced bakers mostly ignore them and look at the dough instead: how it has grown, how it jiggles, how it springs back under a fingertip.",
      "The bread that comes out is never quite the same twice. That is not a flaw in the method. It is the method. A loaf of sourdough is a report on a week of weather, a bag of flour and a jar kept alive by someone who cared enough to remember it.",
    ],
  },
  {
    slug: "index", section: "Craft", title: "In Praise of the Index", author: "Owen Achterberg", date: "October 20", hue: 12,
    dek: "The humble list at the back of a book is a work of interpretation, and for centuries it was made entirely by hand.",
    body: [
      "Turn to the back of a serious non-fiction book and you will usually find it: several pages of small type, alphabetical, dense with numbers. The index is the part of a book most readers use and fewest notice. It feels mechanical, like something a machine would produce. For most of its history, it was not.",
      "Indexes grew up alongside the page number, which is a younger invention than it seems. Once pages could be reliably numbered, readers could be told where to look, and scholars began building tables that pointed from topics to places in a text. A good index turned a book from something you read once, front to back, into something you could consult.",
      "## Deciding what matters",
      "Making one is an act of reading, not counting. A word search finds every page where a term appears. An indexer finds every page where an idea is discussed, including the ones where it is never named. They decide that a passage about a ship's provisions belongs under scurvy, that two spellings are one person, that a joke on page forty is not worth sending anyone to.",
      "> An indexer finds every page where an idea is discussed, including the ones where it is never named.",
      "Professional indexers still exist, and the best of them are a writer's most attentive reader. They notice when a book contradicts itself, when a promised topic never arrives, when a name drifts in spelling between chapters. Some authors dread the index for exactly this reason.",
      "Search has made the index seem old-fashioned, and for finding a single word it is. But a search box returns everything. An index returns what someone thought was worth finding, arranged so you can see the shape of a book at a glance. That is a different thing, and it still has no automatic substitute.",
    ],
  },
];

export const minutes = (a: Article) => Math.ceil(a.body.join(" ").split(/\s+/).length / 200);
export const find = (slug: string | null) => ARTICLES.find((a) => a.slug === slug);
