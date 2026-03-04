 from datetime import datetime, timedelta
 from typing import Any, Optional

 from jose import JWTError, jwt
 from passlib.context import CryptContext
 from pydantic import BaseModel

 from app.core.config import get_settings

 pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
 ALGORITHM = "HS256"


 class TokenPayload(BaseModel):
     sub: str
     exp: int


 def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
     settings = get_settings()
     if expires_delta is None:
         expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
     expire = datetime.utcnow() + expires_delta
     to_encode: dict[str, Any] = {"exp": expire, "sub": subject}
     encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
     return encoded_jwt


 def decode_token(token: str) -> TokenPayload:
     settings = get_settings()
     try:
         payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
         return TokenPayload(**payload)
     except JWTError as exc:
         raise JWTError("Invalid token") from exc


 def verify_password(plain_password: str, hashed_password: str) -> bool:
     return pwd_context.verify(plain_password, hashed_password)


 def get_password_hash(password: str) -> str:
     return pwd_context.hash(password)
