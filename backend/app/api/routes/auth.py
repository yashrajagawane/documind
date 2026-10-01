from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db_session
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.schemas.auth import AuthResponse, Credentials, PublicUser

router = APIRouter(prefix="/auth")
settings = get_settings()
REFRESH_COOKIE = "documind_refresh"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.jwt_refresh_expire_days * 86400,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite="lax",
        path=f"{settings.api_v1_prefix}/auth",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=f"{settings.api_v1_prefix}/auth")


async def issue_session(
    response: Response, user: User, db: AsyncSession, family_id: UUID | None = None
) -> tuple[AuthResponse, RefreshSession]:
    raw_token = create_refresh_token()
    refresh_session = RefreshSession(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        family_id=family_id or uuid4(),
        expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_expire_days),
    )
    db.add(refresh_session)
    await db.flush()
    set_refresh_cookie(response, raw_token)
    return (
        AuthResponse(
            user=PublicUser.model_validate(user), access_token=create_access_token(user.id)
        ),
        refresh_session,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    credentials: Credentials, response: Response, db: AsyncSession = Depends(get_db_session)
) -> AuthResponse:
    email = str(credentials.email).lower()
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email is already registered."
        )
    user = User(email=email, hashed_password=hash_password(credentials.password))
    db.add(user)
    await db.flush()
    result, _ = await issue_session(response, user, db)
    await db.commit()
    return result


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: Credentials, response: Response, db: AsyncSession = Depends(get_db_session)
) -> AuthResponse:
    email = str(credentials.email).lower()
    user = await db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    result, _ = await issue_session(response, user, db)
    await db.commit()
    return result


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
        )
    row = await db.execute(
        select(RefreshSession, User)
        .join(User, User.id == RefreshSession.user_id)
        .where(RefreshSession.token_hash == hash_refresh_token(refresh_token))
    )
    session_user = row.one_or_none()
    if not session_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
        )
    session, user = session_user
    now = datetime.now(UTC)
    if session.revoked_at or session.expires_at <= now:
        if session.revoked_at:
            await db.execute(
                RefreshSession.__table__.update()
                .where(RefreshSession.family_id == session.family_id)
                .values(revoked_at=now)
            )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
        )
    session.revoked_at = now
    result, replacement = await issue_session(response, user, db, family_id=session.family_id)
    session.replaced_by_id = replacement.id
    await db.commit()
    return result


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    if refresh_token:
        session = await db.scalar(
            select(RefreshSession).where(
                RefreshSession.token_hash == hash_refresh_token(refresh_token)
            )
        )
        if session and not session.revoked_at:
            session.revoked_at = datetime.now(UTC)
            await db.commit()
    clear_refresh_cookie(response)
    return response


