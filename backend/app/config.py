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

    class Config:
        env_file = ".env"


settings = Settings()
