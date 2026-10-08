from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    pinecone_api_key: str
    pinecone_index: str
    database_url: str
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    dashboard_token: str = "change-me"
    claude_max_retries: int = 3
    claude_base_delay: float = 1.0
    # Admin dashboard auth: must be set to a long random value in production.
    # Token issuance refuses to run in production while this is "change-me".
    jwt_secret: str = "change-me"
    # Salt for hashing user IPs in failure tracking. Never log plain IPs.
    ip_hash_salt: str = "change-me"
    # Retrieval top-score below this marks a query as weak/failed.
    failure_score_threshold: float = 0.45

    class Config:
        env_file = ".env"


settings = Settings()
