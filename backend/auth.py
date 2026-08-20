import os
from fastapi import Depends,HTTPException
from jose import jwt,JWTError
from fastapi.security import HTTPAuthorizationCredentials,HTTPBearer
from passlib.context import CryptContext
from database import *
from dotenv import load_dotenv

from typing import Optional

load_dotenv()

SECRET_KEY = os.environ["JWT_SECRET_KEY"]

ALGORITHM = "HS256"

pwd_context = CryptContext(
    schemes=['bcrypt'],
    deprecated = 'auto'
)


security = HTTPBearer(auto_error=False)


def autenticat_curr_user(token: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if token is None:
        raise HTTPException(
            status_code = 400,
            detail = "Token Not found...!!"
        )
    db = SessionLocal()

    try:
        payload = jwt.decode(token.credentials,SECRET_KEY,algorithms=[ALGORITHM])
        username = payload.get("username")

        if username is None:
            raise HTTPException(
                status_code = 400,
                detail = "Invaild Token..."
            )
        user = db.query(RegisterDb).filter(RegisterDb.username == username).first()

        if user is None:
            raise HTTPException(
                status_code= 400,
                detail = "User not Found..."
            )
        return user

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    finally:
        db.close()