from app.services.claude_client import ClaudeClient

c = ClaudeClient()
answer = c.generate(
    question="How much is a 2019 VW Polo used?",
    context="No relevant knowledge base entries found.",
)
print("OK:", answer[:300])
