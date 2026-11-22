# Stationery artwork tools

These scripts make the artwork behind INVTRA's painted designs (`public/stationery/*.jpg`) and the
generated collection's data (`src/lib/themes/collection-*.ts`). They are not part of the app build;
run them by hand when designs change. Python 3 with `numpy`, `scipy` and `Pillow` is needed.

All paths are relative to a working folder that holds `artdata/` (downloads, cut-outs, recipes),
which is deliberately not committed: the source illustrations are public domain and listed with
their links in `public/stationery/CREDITS.md`.

| Step | Script | What it does |
| --- | --- | --- |
| Find | `ov.py` | Searches Openverse for CC0 / public-domain images and makes a contact sheet. |
| Fetch | `dl.py` | Downloads chosen results and records their credits. |
| Cut out | `cut.py` | Removes the old paper, captions and stamps, and makes a transparent cut-out. |
| Ornament | `gold.py` | Draws gold-foil lanterns, crescents, stars, arches, geometric bands, skylines and clouds. |
| Lay out | `recipes.py` | The 27 hand-arranged designs. |
| Lay out | `gen.py` | The collection: templates × flower families × papers per occasion, auto-fitted so nothing covers the text or the QR. |
| Compose | `compose.py` | Prints a recipe onto paper (1080 × 1350 JPEG, optional 360 × 450 thumbnail). |
| Premium | `premium.py` | Marks about a third of the collection Premium (stable per design). |
| Check | `qa.py` | Flags designs whose text lands on artwork (compares card renders with and without text). |
| Publish | `emit.py` | Writes the collection's keys, rows and English/Arabic names into the app and copies the artwork. |

Typical run for the collection:

```sh
python3 gen.py 110 1          # recipes for 110 designs per occasion
python3 premium.py
for r in artdata/recipes2/*.json; do k=$(basename "$r" .json); python3 compose.py "$r" artdata/cut "artdata/out2/$k.jpg" --thumb "artdata/thumb2/$k.jpg"; done
python3 emit.py /path/to/invtra
```

Then render every design through the card engine, run `qa.py`, and run the test suite (every design
must render in English, Arabic and bilingual with a scannable QR code). Bump `ART_VERSION` in
`src/lib/themes/stationery.ts` when existing artwork changes, so browsers fetch the new files.
