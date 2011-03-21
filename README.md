This started as a quick personal project. I may or may not make it a little more re-usable.

This will read an RSS feed from a SmugMug gallery and determine if there are new photos. If there are, it posts to Identi.ca.

Tracking of seen photos is done in redis. Authentication is passed in as a Basic Auth base64 hash as the first parameter. This is mostly a hack.
