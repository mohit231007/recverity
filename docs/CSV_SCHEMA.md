# Bring-your-own-CSV specification

The public website includes a browser-only CSV audit. **No SQL database, API, login, or installation is required.**

## Catalog CSV

Minimum: `product_id,price` (aliases: `item_id` or `id`; `discounted_price`). Optional: `product_name,category,rating,available`. Category aliases: `main_category`; available alias: `in_stock`. The parser accepts a comma-delimited UTF-8 CSV with a header, escaped quotations and quoted fields.

- **One catalog:** schema, missingness, invalid prices, duplicate IDs and rating-range screening.
- **Reference + current catalogs:** additionally, price PSI/KS, category JS distance and, when both have `available`, inventory JS distance.
- The actual reference and current files should represent **different observation periods from the same population**. A comparison across unrelated product catalogs is not a valid production drift assessment.

## User–item interactions CSV

Minimum: `user_id,product_id` (or `item_id`). Optional: individual `rating`, numeric Unix `timestamp` or ISO `event_time`, and `event_id` (or `review_id`).

- **Training file + test file:** review-event overlap, repeated user–item pairs, and global chronological inversion.
- Missing event IDs mean **event-level overlap cannot be assessed**. Missing timestamps mean **temporal inversion cannot be assessed**.
- Product-level average rating is not a user-specific rating. Supplying ratings from aggregates invalidates preference-model evaluation.

## Limits and privacy

Each CSV is limited to 5 MiB and at most 10,000 data rows for browser responsiveness. No persistence, remote processing, or automated downloads are performed. The data stays in the page's in-memory JavaScript objects. The user can reload to clear it. CSV injection is prevented in display by using `textContent`, and no uploaded CSV values are used as HTML.

The same local catalog and training interactions CSVs also support **top-5 on-device exploratory recommendations** (content similarity, co-interaction cosine, 60/40 hybrid or popularity fallback). The test CSV is excluded from training/ranking. Explicit negative ratings (1–3) are not treated as positive; rating-free events are treated as implicit interactions. Previously rated items are excluded from results. The algorithm caps active history at 20 items and neighbor traversal at 200 to protect browser responsiveness. The tool **does not train a production model** on a user's uploaded file. A scalable SQL pipeline is unnecessary for the current interactive audit, but would be beneficial for repeated streaming ingestion, large datasets, operational joins and historical monitoring.
