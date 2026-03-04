 from fastapi import APIRouter, Depends, HTTPException, status
 from sqlalchemy.ext.asyncio import AsyncSession
 from sqlmodel import select

 from app.api.deps import get_current_user
 from app.core.security import create_access_token, get_password_hash, verify_password
 from app.db.session import get_session
 from app.models.user import User
 from app.schemas.auth import Token, UserCreate, UserLogin, UserRead

 router = APIRouter(prefix="/auth", tags=["Auth"])


 @router.post("/register", response_model=UserRead, status_code=201)
 async def register_user(
     payload: UserCreate, session: AsyncSession = Depends(get_session)
 ) -> User:
     existing = await session.execute(select(User).where(User.email == payload.email))
     if existing.scalar_one_or_none():
         raise HTTPException(status_code=400, detail="E-mail já cadastrado")
     user = User(
         email=payload.email,
         full_name=payload.full_name,
         company=payload.company,
         hashed_password=get_password_hash(payload.password),
     )
     session.add(user)
     await session.commit()
     await session.refresh(user)
     return user


 @router.post("/login", response_model=Token)
 async def login(
     payload: UserLogin, session: AsyncSession = Depends(get_session)
 ) -> Token:
     result = await session.execute(select(User).where(User.email == payload.email))
     user = result.scalar_one_or_none()
     if not user or not verify_password(payload.password, user.hashed_password):
         raise HTTPException(
             status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas"
         )
     token = create_access_token(user.email)
     return Token(access_token=token)


 @router.get("/me", response_model=UserRead)
 async def read_me(current_user: User = Depends(get_current_user)) -> User:
     return current_user
