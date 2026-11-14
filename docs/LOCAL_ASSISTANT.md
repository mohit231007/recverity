# Local semantic research assistant

The RecVerity assistant is a **retrieval tool, not a chatbot powered by a large language model**.

- A small collection of authored notes is embedded with the website. The browser builds a TF-IDF lexical representation and a low-rank latent semantic representation (LSA-like document factorization), then scores query-document similarity.
- Returned answers are original curated project text, accompanied by a direct source URL. There is no generative synthesis, **persistent** conversational memory, external API key, telemetry, or paid model invocation. The page displays up to nine question/answer exchanges in current-tab DOM state; clearing or reloading removes them. Follow-up questions are independently retrieved (they are not resolved with hidden LLM memory).
- If there is no relevant note above the threshold, the assistant **abstains**. Matching score is *not* calibrated confidence.
- Language coverage and vocabulary are limited. For sophisticated natural language generation one could optionally integrate a browser-run open model later, but bundling model weights would increase download cost and add licensing/performance complexity.
- No uploaded CSV rows or user identifiers are placed into the assistant index.

Security: all uploaded CSV content is written to the DOM using `textContent`. No browser storage or server uploads occur. Avoid loading personal or sensitive data on shared or untrusted machines.
