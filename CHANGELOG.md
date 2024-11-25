
2024-11-25 (v0.2.0)
------------------

- Feature: Support create and update API endpoints
- Feature: Support new `personalProfile` endpoint for creating JSON profiles based on user data
- Feature: Include LLM response time in API responses
- Feature: Adding support for directly using AWS bedrock SDK to access Llama 3.x using inference profiles
- Feature: Support default provider and model in config
- Feature: Support LLM token limit, flagging no system prompt available for LLM, including LLM info in API responses
- Feature: Remove auto registration of new DIDs
- Feature: Make RAG more configurable via API endpoint parameters
- Fix: CORS was incorrectly configured
- Fix: Improve handling of JSON responses, auto-cleanup when LLM returns invalid JSON
- Fix: Escape HTML on client side to avoid JS code injection risks
- Fix: Calendar events not indexed and available for personal prompt

2024-09-30
------------------

- Alpha release (Telegram and Google)