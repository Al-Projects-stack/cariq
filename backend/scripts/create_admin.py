"""
Create the first admin user. There is no public signup endpoint on purpose:
run this on the server (or any machine with DATABASE_URL pointing at it).

    cd backend
    python scripts/create_admin.py --email you@example.com --role admin

The password is read from an interactive prompt and never from argv, shell
history, or code.
"""
import argparse
import getpass
import sys
from pathlib import Path

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env BEFORE importing app modules (config reads env at import time)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.db.database import SessionLocal, engine, Base
from app.db.models import AdminUser
from app.services.admin_auth import hash_password


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a CarIQ admin user")
    parser.add_argument("--email", required=True, help="Login email address")
    parser.add_argument("--role", default="admin", choices=["admin", "editor"])
    args = parser.parse_args()

    email = args.email.strip().lower()
    password = getpass.getpass("Admin password (min 8 chars): ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords do not match.", file=sys.stderr)
        return 1
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 1

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(AdminUser).filter(AdminUser.email == email).first():
            print(f"Admin user {email} already exists.", file=sys.stderr)
            return 1
        db.add(AdminUser(email=email, password_hash=hash_password(password), role=args.role))
        db.commit()
        print(f"Created {args.role} user: {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
