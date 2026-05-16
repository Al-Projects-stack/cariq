from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    pinecone_api_key: str
    pinecone_index: str
    database_url: str
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
