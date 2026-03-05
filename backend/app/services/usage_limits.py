from datetime import datetime, timedelta

from app.core.config import get_settings
from app.models.user import PlanType, User


def ensure_month_cycle(user: User) -> None:
    if not user.projects_cycle_start:
        user.projects_cycle_start = datetime.utcnow()
        user.projects_this_month = 0
        return
    if datetime.utcnow() - user.projects_cycle_start >= timedelta(days=30):
        user.projects_cycle_start = datetime.utcnow()
        user.projects_this_month = 0


def can_process_project(user: User) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    settings = get_settings()
    ensure_month_cycle(user)
    if user.plan == PlanType.free:
        return user.projects_this_month < settings.free_projects_per_month
    return True


def register_project_processed(user: User) -> None:
    ensure_month_cycle(user)
    user.projects_this_month += 1
